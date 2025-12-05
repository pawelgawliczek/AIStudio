import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { PrismaClient } from '@prisma/client';
import { broadcastComponentStarted, startTranscriptTailing } from '../../services/websocket-gateway.instance';


// ALIASING: Component → Agent (ST-109)
export const tool: Tool = {
  name: 'record_agent_start',
  description: 'Log the start of an agent execution within a team run. Call this before executing agent logic.',
    inputSchema: {
    type: 'object',
    properties: {
      runId: {
        type: 'string',
        description: 'Workflow run ID from start_workflow_run (required)',
      },
      componentId: {
        type: 'string',
        description: 'Component ID from database (required)',
      },
      input: {
        type: 'object',
        description: 'Component input data (optional)',
      },
    },
    required: ['runId', 'componentId'],
  },
};

export const metadata = {
  category: 'execution',
  domain: 'Team Execution',
  tags: ['agent', 'execution', 'tracking'],
  version: '1.0.0',
  since: '2025-11-26',
};

export async function handler(prisma: PrismaClient, params: any) {
  // Validate required fields
  if (!params.runId) {
    throw new Error('runId is required');
  }
  if (!params.componentId) {
    throw new Error('componentId is required');
  }

  // Verify workflow run exists
  const workflowRun = await prisma.workflowRun.findUnique({
    where: { id: params.runId },
  });

  if (!workflowRun) {
    throw new Error(`Workflow run with ID ${params.runId} not found`);
  }

  if (workflowRun.status !== 'running') {
    throw new Error(`Workflow run ${params.runId} is not in running state. Current status: ${workflowRun.status}`);
  }

  // Verify component exists
  const component = await prisma.component.findUnique({
    where: { id: params.componentId },
  });

  if (!component) {
    throw new Error(`Component with ID ${params.componentId} not found`);
  }

  // ST-110: Removed transcript tracking - now using /context command

  // ST-69 FIX: Auto-increment executionOrder for component runs
  // The orchestrator always has executionOrder=0, regular components start at 1 and increment from there
  // This ensures components appear in the correct order in the UI and user prompt counting works correctly
  const existingRuns = await prisma.componentRun.findMany({
    where: {
      workflowRunId: params.runId,
      executionOrder: { not: null }, // Exclude NULL values (old runs without executionOrder)
    },
    orderBy: { executionOrder: 'desc' },
    take: 1,
  });

  const nextExecutionOrder = existingRuns.length > 0
    ? (existingRuns[0].executionOrder || 0) + 1
    : 1; // Start at 1 (orchestrator is always 0)

  // Create ComponentRun record
  const componentRun = await prisma.componentRun.create({
    data: {
      workflowRunId: params.runId,
      componentId: params.componentId,
      executionOrder: nextExecutionOrder, // ST-69: Set execution order for proper UI display
      status: 'running',
      inputData: params.input || {}, // User-visible input data only
      metadata: {}, // ST-110: Removed transcript tracking
      startedAt: new Date(),
      userPrompts: 0,
      systemIterations: 1,
      humanInterventions: 0,
      iterationLog: [],
    },
  });

  // ST-129: Broadcast component started event via HTTP to backend
  // (MCP runs in separate process, cannot share memory with NestJS WebSocket gateway)
  try {
    const story = await prisma.story.findUnique({
      where: { id: workflowRun.storyId || '' },
      select: { key: true, title: true },
    });

    if (story) {
      await broadcastComponentStarted(params.runId, workflowRun.projectId, {
        componentName: component.name,
        storyKey: story.key,
        storyTitle: story.title,
        startedAt: componentRun.startedAt.toISOString(),
      });
    }
  } catch (wsError: any) {
    // Non-fatal - log and continue
    console.warn(`[ST-129] Failed to broadcast component started: ${wsError.message}`);
  }

  // ST-176: Start transcript tailing if transcript path is available
  // The transcript path comes from spawned_agent_transcripts registry
  // populated by the orchestrator via add_transcript tool
  try {
    const workflowRunForTranscript = await prisma.workflowRun.findUnique({
      where: { id: params.runId },
      select: { spawnedAgentTranscripts: true },
    });

    if (workflowRunForTranscript) {
      const spawnedAgents = (workflowRunForTranscript.spawnedAgentTranscripts as any[] | null) || [];
      const agentEntry = spawnedAgents.find((a: any) => a.componentId === params.componentId);

      if (agentEntry?.transcriptPath) {
        await startTranscriptTailing(componentRun.id, agentEntry.transcriptPath);
        console.log(`[ST-176] Started transcript tailing for component ${componentRun.id}: ${agentEntry.transcriptPath}`);
      }
    }
  } catch (tailError: any) {
    // Non-fatal - log and continue
    console.warn(`[ST-176] Failed to start transcript tailing: ${tailError.message}`);
  }

  return {
    success: true,
    componentRunId: componentRun.id,
    runId: componentRun.workflowRunId,
    componentId: componentRun.componentId,
    componentName: component.name,
    status: componentRun.status,
    startedAt: componentRun.startedAt.toISOString(),
    message: `Component "${component.name}" execution started. Component run ID: ${componentRun.id}.`,
  };
}
