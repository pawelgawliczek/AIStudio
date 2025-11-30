import * as os from 'os';
import * as path from 'path';
import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { PrismaClient } from '@prisma/client';

export const tool: Tool = {
  name: 'start_team_run',
  description: 'Initialize a new team execution run. Returns a runId for tracking component executions. Use this at the start of every team execution. Automatically configures transcript tracking for metrics collection.',
  inputSchema: {
    type: 'object',
    properties: {
      teamId: {
        type: 'string',
        description: 'Team ID from database (required)',
      },
      triggeredBy: {
        type: 'string',
        description: 'User ID or system identifier that triggered the team (required)',
      },
      context: {
        type: 'object',
        description: 'Team context data (e.g., prNumber, storyId, branch, etc.)',
      },
      cwd: {
        type: 'string',
        description: 'Current working directory of the orchestrator session. Used to auto-detect transcript location. If not provided, will use project localPath.',
      },
      // ST-148: Approval override options
      approvalOverrides: {
        type: 'object',
        description: 'ST-148: Override approval settings for this run. Can enable/disable approvals globally or for specific states.',
        properties: {
          mode: {
            type: 'string',
            enum: ['default', 'all', 'none'],
            description: '"default" uses workflow state settings, "all" requires approval for all states, "none" skips all approvals',
          },
          stateOverrides: {
            type: 'object',
            description: 'Per-state overrides. Keys are state names, values are booleans (true=require approval, false=skip)',
            additionalProperties: { type: 'boolean' },
          },
        },
      },
    },
    required: ['teamId', 'triggeredBy'],
  },
};

export const metadata = {
  category: 'execution',
  domain: 'Team Execution',
  tags: ['team', 'execution', 'tracking', 'coordinator'],
  version: '1.0.0',
  since: '2025-11-13',
};

export async function handler(prisma: PrismaClient, params: any) {
  // Support both teamId (user-facing) and workflowId (internal) naming
  const workflowId = params.teamId || params.workflowId;

  // Validate required fields
  if (!workflowId) {
    throw new Error('teamId is required');
  }
  if (!params.triggeredBy) {
    throw new Error('triggeredBy is required');
  }

  // Verify workflow exists and get coordinator info
  const workflow = await prisma.workflow.findUnique({
    where: { id: workflowId },
    include: {
      coordinator: true,
      project: true,
    },
  });

  if (!workflow) {
    throw new Error(`Workflow with ID ${workflowId} not found`);
  }

  if (!workflow.active) {
    throw new Error(`Workflow ${workflow.name} is not active. Please activate it first.`);
  }

  // Get component IDs from coordinator
  const coordinatorConfig = (workflow.coordinator.config as any) || {};
  const componentIds = coordinatorConfig.componentIds || [];

  // Determine transcript directory from cwd
  // IMPORTANT: cwd should be the HOST path (from PROJECT_HOST_PATH env or explicit param)
  // DO NOT use workflow.project.localPath here as it contains Docker path (/app)
  const projectPath = params.cwd || process.cwd();
  // Claude Code stores transcripts in ~/.claude/projects/<escaped-path>/
  // Path escaping: /opt/stack/AIStudio → -opt-stack-AIStudio
  const escapedPath = projectPath.replace(/^\//, '-').replace(/\//g, '-');
  const transcriptDirectory = path.join(os.homedir(), '.claude', 'projects', escapedPath);

  // Record the orchestrator's specific transcript (most recently modified = current session)
  const fs = await import('fs');
  let orchestratorTranscript: string | null = null;

  if (fs.existsSync(transcriptDirectory)) {
    const transcriptFiles = fs.readdirSync(transcriptDirectory)
      .filter((f: string) => f.endsWith('.jsonl'))
      .map((f: string) => ({
        name: f,
        mtime: fs.statSync(path.join(transcriptDirectory, f)).mtime,
      }))
      .sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

    // The most recently modified transcript is the orchestrator's session
    orchestratorTranscript = transcriptFiles.length > 0 ? transcriptFiles[0].name : null;
  }

  // ST-148: Process approval overrides
  const approvalOverrides = params.approvalOverrides || { mode: 'default' };

  // Create WorkflowRun record with transcript tracking info
  // ST-105: Removed existingTranscriptsAtStart - use orchestratorStartTime for timestamp-based filtering
  const workflowRun = await prisma.workflowRun.create({
    data: {
      workflowId: workflowId,
      coordinatorId: workflow.coordinatorId,
      projectId: workflow.projectId,
      status: 'running',
      metadata: {
        ...params.context,
        _transcriptTracking: {
          projectPath,
          transcriptDirectory,
          orchestratorStartTime: new Date().toISOString(),
          orchestratorTranscript, // Specific filename (e.g., "8f9fc948-....jsonl")
          // ST-105: Use orchestratorStartTime for filtering instead of file list
        },
        // ST-148: Store approval override settings for this run
        _approvalOverrides: approvalOverrides,
      },
      triggeredBy: params.triggeredBy,
      startedAt: new Date(),
    },
    include: {
      workflow: true,
      coordinator: true,
    },
  });

  // ST-57: Create orchestrator ComponentRun with executionOrder=0
  // This enables unified tracking of orchestrator metrics in the same table as components
  const orchestratorComponentRun = await prisma.componentRun.create({
    data: {
      workflowRunId: workflowRun.id,
      componentId: workflow.coordinatorId, // Coordinator is treated as a component
      executionOrder: 0, // Special order=0 for orchestrator (displays first, purple styling)
      status: 'running',
      success: false, // Will be updated on workflow completion
      startedAt: new Date(),
      metadata: {
        role: 'orchestrator',
        transcriptPath: orchestratorTranscript
          ? path.join(transcriptDirectory, orchestratorTranscript)
          : null,
        dataSource: 'transcript',
      },
    },
  });

  // ST-99: Get component REFERENCES only (not full instructions)
  // Agents pull their own instructions via get_component_instructions({ componentId })
  const componentsFromDb = await prisma.component.findMany({
    where: {
      id: { in: componentIds },
    },
    select: {
      id: true,
      name: true,
      description: true,
      // NOT including: inputInstructions, operationInstructions, outputInstructions
      // Agents retrieve these via get_component_instructions tool
    },
  });

  // ST-105: Preserve order from componentIds array (DB returns random order)
  const componentById = new Map(componentsFromDb.map(c => [c.id, c]));
  const components = componentIds
    .map(id => componentById.get(id))
    .filter((c): c is NonNullable<typeof c> => c !== undefined);

  // ST-105: Create name→id mapping for coordinator to resolve component names to UUIDs
  // Coordinator instructions say "spawn Full-Stack Developer", workflow provides the UUID
  const componentMap: Record<string, string> = {};
  components.forEach(c => {
    componentMap[c.name] = c.id;
  });

  return {
    success: true,
    runId: workflowRun.id,
    workflowId: workflowRun.workflowId,
    workflowName: workflow.name,
    orchestratorComponentRunId: orchestratorComponentRun.id, // ST-57: Return orchestrator ComponentRun ID
    coordinator: {
      id: workflowRun.coordinatorId,
      name: workflow.coordinator.name,
      instructions: workflow.coordinator.operationInstructions,
      strategy: coordinatorConfig.decisionStrategy || "adaptive",
      config: workflow.coordinator.config,
      tools: workflow.coordinator.tools,
      flowDiagram: coordinatorConfig.flowDiagram,
    },
    // ST-105: Name→UUID mapping for coordinator to resolve component names
    componentMap,
    // ST-99: Component references only - agents call get_component_instructions({ componentId }) for full instructions
    components: components.map((c, index) => ({
      componentId: c.id,
      componentName: c.name,
      description: c.description,
      order: index + 1,
    })),
    status: workflowRun.status,
    startedAt: workflowRun.startedAt.toISOString(),
    context: workflowRun.metadata,
    message: `Workflow "${workflow.name}" started. Run ID: ${workflowRun.id}. Follow coordinator.instructions to orchestrate. Use componentMap to resolve names to UUIDs.`,
  };
}
