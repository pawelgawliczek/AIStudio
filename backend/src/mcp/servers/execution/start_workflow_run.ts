import * as os from 'os';
import * as path from 'path';
import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { PrismaClient } from '@prisma/client';
import { TranscriptRegistrationService } from '../../../remote-agent/transcript-registration.service';
import { buildMasterSessionInstructions } from './master-session-instructions';
import { registerWorkflowOnLaptop } from './workflow-tracker-utils';

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
        description: 'REQUIRED: Current working directory of the orchestrator session (e.g., /Users/you/projects/AIStudio). Used to locate Claude Code transcripts for metrics. Must be the HOST path where Claude Code is running, NOT a Docker path.',
      },
      // ST-172: Session tracking from hooks
      sessionId: {
        type: 'string',
        description: 'ST-170: REQUIRED - Claude Code session ID from SessionStart hook. Used for transcript matching and live streaming. Get from SessionStart hook context.',
      },
      transcriptPath: {
        type: 'string',
        description: 'ST-170: REQUIRED - Exact transcript path from SessionStart hook (stdin.transcript_path). Stored in WorkflowRun.masterTranscriptPaths for live streaming.',
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
    required: ['teamId', 'triggeredBy', 'cwd', 'sessionId', 'transcriptPath'],
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
  if (!params.cwd) {
    throw new Error('cwd is required - must be the HOST path where Claude Code is running (e.g., /Users/you/projects/AIStudio). This is needed for transcript tracking.');
  }

  // ST-170: Validate transcript tracking parameters (now required for live streaming)
  if (!params.sessionId) {
    throw new Error('sessionId is required - must be provided from SessionStart hook context. This enables transcript matching and live streaming. Get it from the SessionStart hook output.');
  }
  if (!params.transcriptPath) {
    throw new Error('transcriptPath is required - must be provided from SessionStart hook (stdin.transcript_path). This enables live transcript streaming. Get it from the SessionStart hook output.');
  }

  // Verify workflow exists and get states for checkpoint initialization
  const workflow = await prisma.workflow.findUnique({
    where: { id: workflowId },
    include: {
      project: true,
      states: {
        orderBy: { order: 'asc' },
        take: 1, // Only need first state for checkpoint initialization
      },
    },
  });

  if (!workflow) {
    throw new Error(`Workflow with ID ${workflowId} not found`);
  }

  if (!workflow.active) {
    throw new Error(`Workflow ${workflow.name} is not active. Please activate it first.`);
  }

  // Get component IDs from workflow componentAssignments
  const componentAssignments = (workflow.componentAssignments as any) || [];
  const componentIds = Array.isArray(componentAssignments)
    ? componentAssignments.map((assignment: any) => assignment.componentId).filter(Boolean)
    : [];

  // Determine transcript directory from cwd (now required)
  // cwd is the HOST path where Claude Code is running (e.g., /Users/you/projects/AIStudio)
  // This is used to locate transcripts at ~/.claude/projects/<escaped-path>/
  const projectPath = params.cwd;
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

  // ST-187: Initialize checkpoint at first state
  // This allows get_current_step to immediately return actionable instructions
  const firstState = workflow.states[0];
  const initialCheckpoint = firstState ? {
    version: 1,
    runId: '', // Will be filled after creation
    workflowId: workflowId,
    currentStateId: firstState.id,
    currentPhase: 'pre' as const,
    phaseStatus: 'pending' as const,
    completedStates: [] as string[],
    skippedStates: [] as string[],
    phaseOutputs: {} as Record<string, unknown>,
    resourceUsage: {
      tokensUsed: 0,
      agentSpawns: 0,
      stateTransitions: 0,
      durationMs: 0,
    },
    checkpointedAt: new Date().toISOString(),
    runStartedAt: new Date().toISOString(),
  } : null;

  // Create WorkflowRun record with transcript tracking info
  // ST-105: Removed existingTranscriptsAtStart - use orchestratorStartTime for timestamp-based filtering
  // ST-167: Extract storyId from context to link properly to Story table
  const storyId = params.context?.storyId as string | undefined;

  // ST-172: Build initial masterTranscriptPaths from provided transcriptPath or discovered orchestrator transcript
  const initialTranscriptPaths: string[] = [];
  if (params.transcriptPath) {
    // Hook provided exact path (preferred)
    initialTranscriptPaths.push(params.transcriptPath);
    console.log(`[ST-172] Using hook-provided transcript path: ${params.transcriptPath}`);
  } else if (orchestratorTranscript) {
    // Fallback: construct path from discovered filename
    const fullPath = path.join(transcriptDirectory, orchestratorTranscript);
    initialTranscriptPaths.push(fullPath);
    console.log(`[ST-172] Using discovered transcript path: ${fullPath}`);
  }

  // Extract Claude session ID from transcript filename (e.g., "8f9fc948-1234-5678-abcd.jsonl" → "8f9fc948-1234-5678-abcd")
  // Needed early for ST-170 unassigned transcript matching
  const claudeSessionId = orchestratorTranscript?.replace('.jsonl', '') || undefined;

  const workflowRun = await prisma.workflowRun.create({
    data: {
      workflowId: workflowId,
      projectId: workflow.projectId,
      // ST-167: Link to Story table if storyId provided (enables status bar tracking)
      ...(storyId && { storyId }),
      status: 'running',
      // ST-172: Store initial transcript path(s)
      masterTranscriptPaths: initialTranscriptPaths,
      metadata: {
        ...params.context,
        _transcriptTracking: {
          projectPath,
          transcriptDirectory,
          orchestratorStartTime: new Date().toISOString(),
          orchestratorTranscript, // Specific filename (e.g., "8f9fc948-....jsonl")
          // ST-172: sessionId for linking additional transcripts after compaction
          sessionId: params.sessionId || null,
          // ST-105: Use orchestratorStartTime for filtering instead of file list
        },
        // ST-148: Store approval override settings for this run
        _approvalOverrides: approvalOverrides,
        // ST-187: Initialize checkpoint so get_current_step works immediately
        ...(initialCheckpoint && { checkpoint: initialCheckpoint }),
      },
      triggeredBy: params.triggeredBy,
      startedAt: new Date(),
    },
    include: {
      workflow: true,
    },
  });

  // ST-187: Update checkpoint with actual runId
  if (initialCheckpoint) {
    initialCheckpoint.runId = workflowRun.id;
    const updatedMetadata = {
      ...(workflowRun.metadata as Record<string, unknown>),
      checkpoint: initialCheckpoint as unknown,
    };
    await prisma.workflowRun.update({
      where: { id: workflowRun.id },
      data: {
        metadata: updatedMetadata as any,
      },
    });
  }

  // ST-170: Match any unassigned transcripts to this workflow run
  // If transcripts were detected before the workflow started, associate them now
  if (params.sessionId || claudeSessionId) {
    const sessionId = params.sessionId || claudeSessionId;
    const transcriptRegistrationService = new TranscriptRegistrationService(prisma as any);
    try {
      await transcriptRegistrationService.matchUnassignedTranscripts(workflowRun.id, sessionId);
      console.log(`[ST-170] Checked for unassigned transcripts (session: ${sessionId})`);
    } catch (error: any) {
      // Non-fatal - log but don't fail workflow start
      console.warn(`[ST-170] Failed to match unassigned transcripts: ${error.message}`);
    }
  }

  // ST-57: Create orchestrator ComponentRun with executionOrder=0
  // This enables unified tracking of orchestrator metrics in the same table as components
  // Note: orchestratorComponentRun is no longer created as coordinatorId field was removed
  // Orchestrator metrics are now tracked differently (ST-164)
  const orchestratorComponentRun = null;

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

  // ST-164: Register workflow on laptop for context recovery after compaction
  // This is a best-effort operation - don't fail the workflow if laptop agent is offline
  // Note: storyId already extracted above at line 130 for Story table linking
  // Note: claudeSessionId extracted earlier (before WorkflowRun creation) for ST-170
  let workflowTrackerResult: { success: boolean; agentOffline?: boolean; error?: string } | null = null;
  try {
    workflowTrackerResult = await registerWorkflowOnLaptop(
      workflowRun.id,
      workflowId,
      storyId || undefined,
      claudeSessionId // Pass Claude session ID for session-aware tracking
    );
  } catch (error: any) {
    // Non-fatal - log but don't fail
    console.warn(`[ST-164] Failed to register workflow on laptop: ${error.message}`);
  }

  // Build component list for master session instructions
  const componentList = components.map((c, index) => ({
    componentId: c.id,
    componentName: c.name,
    description: c.description,
    order: index + 1,
  }));

  // Build master session instructions
  const masterSessionInstructions = buildMasterSessionInstructions({
    runId: workflowRun.id,
    workflowId: workflowRun.workflowId,
    workflowName: workflow.name,
    components: componentList,
    storyContext: {
      storyId: storyId,
      storyKey: params.context?.storyKey,
      title: params.context?.title,
    },
  });

  return {
    success: true,
    runId: workflowRun.id,
    workflowId: workflowRun.workflowId,
    workflowName: workflow.name,
    orchestratorComponentRunId: orchestratorComponentRun?.id || null, // ST-57: Return orchestrator ComponentRun ID (null after ST-164)
    // ST-105: Name→UUID mapping to resolve component names
    componentMap,
    // ST-99: Component references only - agents call get_component_instructions({ componentId }) for full instructions
    components: componentList,
    status: workflowRun.status,
    startedAt: workflowRun.startedAt.toISOString(),
    context: workflowRun.metadata,
    // ST-167: Master session instructions for orchestrator
    masterSessionInstructions,
    // ST-164: Include workflow tracking status
    workflowTracking: workflowTrackerResult ? {
      registered: workflowTrackerResult.success,
      agentOffline: workflowTrackerResult.agentOffline || false,
      claudeSessionId: claudeSessionId || null,
      error: workflowTrackerResult.error,
    } : null,
    // ST-187: Checkpoint info - workflow is ready to execute immediately
    checkpoint: initialCheckpoint ? {
      initialized: true,
      currentStateId: initialCheckpoint.currentStateId,
      currentStateName: firstState?.name,
      currentPhase: initialCheckpoint.currentPhase,
      phaseStatus: initialCheckpoint.phaseStatus,
      message: `Checkpoint initialized at first state "${firstState?.name}". Call get_current_step to get execution instructions.`,
    } : {
      initialized: false,
      message: 'No states defined in workflow. Cannot initialize checkpoint.',
    },
    // ST-172: Transcript tracking info
    transcriptTracking: {
      masterTranscriptPaths: initialTranscriptPaths,
      sessionId: params.sessionId || null,
      transcriptDirectory,
    },
    message: `Workflow "${workflow.name}" started. Run ID: ${workflowRun.id}. Use componentMap to resolve names to UUIDs.`,
  };
}
