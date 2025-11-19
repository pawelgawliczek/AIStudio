import * as os from 'os';
import * as path from 'path';
import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { PrismaClient } from '@prisma/client';

export const tool: Tool = {
  name: 'start_workflow_run',
  description: 'Initialize a new workflow execution run. Returns a runId for tracking component executions. Use this at the start of every workflow execution. Automatically configures transcript tracking for metrics collection.',
  inputSchema: {
    type: 'object',
    properties: {
      workflowId: {
        type: 'string',
        description: 'Workflow ID from database (required)',
      },
      triggeredBy: {
        type: 'string',
        description: 'User ID or system identifier that triggered the workflow (required)',
      },
      context: {
        type: 'object',
        description: 'Workflow context data (e.g., prNumber, storyId, branch, etc.)',
      },
      cwd: {
        type: 'string',
        description: 'Current working directory of the orchestrator session. Used to auto-detect transcript location. If not provided, will use project localPath.',
      },
    },
    required: ['workflowId', 'triggeredBy'],
  },
};

export const metadata = {
  category: 'execution',
  domain: 'Workflow Execution',
  tags: ['workflow', 'execution', 'tracking', 'coordinator'],
  version: '1.0.0',
  since: '2025-11-13',
};

export async function handler(prisma: PrismaClient, params: any) {
  // Validate required fields
  if (!params.workflowId) {
    throw new Error('workflowId is required');
  }
  if (!params.triggeredBy) {
    throw new Error('triggeredBy is required');
  }

  // Verify workflow exists and get coordinator info
  const workflow = await prisma.workflow.findUnique({
    where: { id: params.workflowId },
    include: {
      coordinator: true,
      project: true,
    },
  });

  if (!workflow) {
    throw new Error(`Workflow with ID ${params.workflowId} not found`);
  }

  if (!workflow.active) {
    throw new Error(`Workflow ${workflow.name} is not active. Please activate it first.`);
  }

  // Get component IDs from coordinator
  const componentIds = workflow.coordinator.componentIds || [];

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
  let existingTranscripts: string[] = [];

  if (fs.existsSync(transcriptDirectory)) {
    const transcriptFiles = fs.readdirSync(transcriptDirectory)
      .filter((f: string) => f.endsWith('.jsonl'))
      .map((f: string) => ({
        name: f,
        mtime: fs.statSync(path.join(transcriptDirectory, f)).mtime,
      }))
      .sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

    existingTranscripts = transcriptFiles.map(f => f.name);
    // The most recently modified transcript is the orchestrator's session
    orchestratorTranscript = transcriptFiles.length > 0 ? transcriptFiles[0].name : null;
  }

  // Create WorkflowRun record with transcript tracking info
  const workflowRun = await prisma.workflowRun.create({
    data: {
      workflowId: params.workflowId,
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
          existingTranscriptsAtStart: existingTranscripts, // All transcripts before workflow
        },
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

  // Get component details with full instructions
  const components = await prisma.component.findMany({
    where: {
      id: { in: componentIds },
    },
    select: {
      id: true,
      name: true,
      description: true,
      inputInstructions: true,
      operationInstructions: true,
      outputInstructions: true,
      config: true,
      tools: true,
    },
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
      instructions: workflow.coordinator.coordinatorInstructions,
      strategy: workflow.coordinator.decisionStrategy,
      config: workflow.coordinator.config,
      tools: workflow.coordinator.tools,
      flowDiagram: workflow.coordinator.flowDiagram,
    },
    components: components.map((c, index) => ({
      componentId: c.id,
      componentName: c.name,
      description: c.description,
      inputInstructions: c.inputInstructions,
      operationInstructions: c.operationInstructions,
      outputInstructions: c.outputInstructions,
      config: c.config,
      tools: c.tools,
      order: index + 1,
    })),
    status: workflowRun.status,
    startedAt: workflowRun.startedAt.toISOString(),
    context: workflowRun.metadata,
    message: `Workflow "${workflow.name}" started successfully. Run ID: ${workflowRun.id}. Orchestrator ComponentRun created (executionOrder=0). Use coordinator instructions to begin orchestration.`,
  };
}
