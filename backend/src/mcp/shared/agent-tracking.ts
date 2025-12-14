/**
 * Shared Agent Tracking Utilities
 *
 * ST-215: Automatic Agent Tracking in advance_step
 *
 * Extracted core logic from record_component_start.ts and record_component_complete.ts
 * for use in both standalone MCP tools and advance_step automatic tracking.
 */

import { PrismaClient, Prisma } from '@prisma/client';
import {
  broadcastComponentStarted,
  broadcastComponentCompleted,
  startTranscriptTailing,
  stopTranscriptTailing,
} from '../services/websocket-gateway.instance';

export interface StartAgentResult {
  success: boolean;
  componentRunId?: string;
  componentName?: string;
  executionOrder?: number;
  warning?: string;
  error?: string;
}

export interface CompleteAgentResult {
  success: boolean;
  componentRunId?: string;
  componentName?: string;
  status?: 'completed' | 'failed';
  metrics?: {
    durationSeconds: number | null;
  };
  warning?: string;
  error?: string;
}

/**
 * Start agent execution tracking
 *
 * Creates ComponentRun record with status='running'
 * Broadcasts WebSocket event (non-fatal if fails)
 * Starts transcript tailing if available (non-fatal if fails)
 */
export async function startAgentTracking(
  prisma: PrismaClient,
  params: {
    runId: string;
    componentId: string;
    input?: Record<string, unknown>;
  },
): Promise<StartAgentResult> {
  try {
    // Check for existing running ComponentRun (idempotency)
    const existingRun = await prisma.componentRun.findFirst({
      where: {
        workflowRunId: params.runId,
        componentId: params.componentId,
        status: 'running',
      },
    });

    if (existingRun) {
      // Already running - return success with warning
      const component = await prisma.component.findUnique({
        where: { id: params.componentId },
        select: { name: true },
      });
      return {
        success: true,
        componentRunId: existingRun.id,
        componentName: component?.name,
        executionOrder: existingRun.executionOrder ?? undefined,
        warning: `Component already has running ComponentRun (${existingRun.id}). Skipping duplicate creation.`,
      };
    }

    // Verify workflow run exists and is running
    const workflowRun = await prisma.workflowRun.findUnique({
      where: { id: params.runId },
    });

    if (!workflowRun) {
      return {
        success: false,
        error: `Workflow run with ID ${params.runId} not found`,
      };
    }

    if (workflowRun.status !== 'running') {
      return {
        success: false,
        error: `Workflow run ${params.runId} is not in running state. Current status: ${workflowRun.status}`,
      };
    }

    // Verify component exists
    const component = await prisma.component.findUnique({
      where: { id: params.componentId },
    });

    if (!component) {
      return {
        success: false,
        error: `Component with ID ${params.componentId} not found`,
      };
    }

    // ST-69: Auto-increment executionOrder for component runs
    const existingRuns = await prisma.componentRun.findMany({
      where: {
        workflowRunId: params.runId,
        executionOrder: { not: null },
      },
      orderBy: { executionOrder: 'desc' },
      take: 1,
    });

    const nextExecutionOrder =
      existingRuns.length > 0 ? (existingRuns[0].executionOrder || 0) + 1 : 1;

    // Create ComponentRun record
    const componentRun = await prisma.componentRun.create({
      data: {
        workflowRunId: params.runId,
        componentId: params.componentId,
        executionOrder: nextExecutionOrder,
        status: 'running',
        inputData: (params.input || {}) as Prisma.InputJsonValue,
        metadata: {} as Prisma.InputJsonValue,
        startedAt: new Date(),
        userPrompts: 0,
        systemIterations: 1,
        humanInterventions: 0,
        iterationLog: [] as Prisma.InputJsonValue,
      },
    });

    // Non-fatal: Broadcast WebSocket event
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
      console.warn(
        `[agent-tracking] Failed to broadcast component started: ${wsError.message}`,
      );
    }

    // Non-fatal: Start transcript tailing if available
    try {
      const runForTranscript = await prisma.workflowRun.findUnique({
        where: { id: params.runId },
        select: { spawnedAgentTranscripts: true },
      });

      if (runForTranscript) {
        const spawnedAgents =
          (runForTranscript.spawnedAgentTranscripts as any[] | null) || [];
        const agentEntry = spawnedAgents.find(
          (a: any) => a.componentId === params.componentId,
        );

        if (agentEntry?.transcriptPath) {
          await startTranscriptTailing(componentRun.id, agentEntry.transcriptPath);
        }
      }
    } catch (tailError: any) {
      console.warn(
        `[agent-tracking] Failed to start transcript tailing: ${tailError.message}`,
      );
    }

    return {
      success: true,
      componentRunId: componentRun.id,
      componentName: component.name,
      executionOrder: nextExecutionOrder,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Unknown error in startAgentTracking',
    };
  }
}

/**
 * Complete agent execution tracking
 *
 * Updates ComponentRun record with output, status, and duration
 * Broadcasts WebSocket event (non-fatal if fails)
 * Stops transcript tailing (non-fatal if fails)
 *
 * Note: This is a simplified version that does NOT parse transcripts for detailed metrics.
 * For full metrics (tokens, cache), use record_agent_complete directly.
 */
export async function completeAgentTracking(
  prisma: PrismaClient,
  params: {
    runId: string;
    componentId: string;
    output?: Record<string, unknown>;
    status?: 'completed' | 'failed';
    componentSummary?: string;
    errorMessage?: string;
  },
): Promise<CompleteAgentResult> {
  try {
    const status = params.status || 'completed';

    // Find the running ComponentRun
    let componentRun = await prisma.componentRun.findFirst({
      where: {
        workflowRunId: params.runId,
        componentId: params.componentId,
        status: 'running',
      },
      orderBy: { startedAt: 'desc' },
    });

    // Edge case: No running ComponentRun found - create one retroactively
    if (!componentRun) {
      console.warn(
        `[agent-tracking] No running ComponentRun found for ${params.componentId}. Creating retroactively.`,
      );

      // Get execution order
      const existingRuns = await prisma.componentRun.findMany({
        where: {
          workflowRunId: params.runId,
          executionOrder: { not: null },
        },
        orderBy: { executionOrder: 'desc' },
        take: 1,
      });

      const nextExecutionOrder =
        existingRuns.length > 0 ? (existingRuns[0].executionOrder || 0) + 1 : 1;

      componentRun = await prisma.componentRun.create({
        data: {
          workflowRunId: params.runId,
          componentId: params.componentId,
          executionOrder: nextExecutionOrder,
          status: 'running',
          inputData: {} as Prisma.InputJsonValue,
          metadata: { retroactive: true } as Prisma.InputJsonValue,
          startedAt: new Date(),
          userPrompts: 0,
          systemIterations: 1,
          humanInterventions: 0,
          iterationLog: [] as Prisma.InputJsonValue,
        },
      });
    }

    const completedAt = new Date();
    const durationSeconds = Math.round(
      (completedAt.getTime() - componentRun.startedAt.getTime()) / 1000,
    );

    // Get component name
    const component = await prisma.component.findUnique({
      where: { id: params.componentId },
      select: { name: true },
    });

    // Update ComponentRun
    const updatedComponentRun = await prisma.componentRun.update({
      where: { id: componentRun.id },
      data: {
        status,
        outputData: (params.output || {}) as Prisma.InputJsonValue,
        componentSummary: params.componentSummary || null,
        errorMessage: params.errorMessage || null,
        durationSeconds,
        finishedAt: completedAt,
      },
    });

    // Non-fatal: Stop transcript tailing
    try {
      await stopTranscriptTailing(componentRun.id);
    } catch (tailError: any) {
      console.warn(
        `[agent-tracking] Failed to stop transcript tailing: ${tailError.message}`,
      );
    }

    // Non-fatal: Broadcast WebSocket event
    try {
      const workflowRun = await prisma.workflowRun.findUnique({
        where: { id: params.runId },
        select: { projectId: true, storyId: true },
      });

      const story = workflowRun?.storyId
        ? await prisma.story.findUnique({
            where: { id: workflowRun.storyId },
            select: { key: true, title: true },
          })
        : null;

      if (workflowRun && story) {
        await broadcastComponentCompleted(params.runId, workflowRun.projectId, {
          componentName: component?.name || 'Unknown',
          storyKey: story.key,
          storyTitle: story.title,
          status,
          completedAt: completedAt.toISOString(),
        });
      }
    } catch (wsError: any) {
      console.warn(
        `[agent-tracking] Failed to broadcast component completed: ${wsError.message}`,
      );
    }

    return {
      success: true,
      componentRunId: updatedComponentRun.id,
      componentName: component?.name,
      status,
      metrics: { durationSeconds },
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Unknown error in completeAgentTracking',
    };
  }
}

/**
 * Generate a basic summary from output data
 *
 * Extracts meaningful information from common output patterns.
 * Returns a concise summary (max 500 chars).
 */
export function generateComponentSummary(
  output: Record<string, unknown> | undefined,
  componentName: string,
): string {
  if (!output || Object.keys(output).length === 0) {
    return `${componentName} completed execution.`;
  }

  const parts: string[] = [];

  // Check for common status patterns
  const status = output.status || output.result;
  if (typeof status === 'string') {
    parts.push(`${componentName} ${status}.`);
  } else {
    parts.push(`${componentName} completed.`);
  }

  // Check for file modifications
  if (Array.isArray(output.files) && output.files.length > 0) {
    parts.push(`Modified ${output.files.length} file(s).`);
  }

  if (Array.isArray(output.filesModified) && output.filesModified.length > 0) {
    parts.push(`Modified ${output.filesModified.length} file(s).`);
  }

  // Check for summary/changes field
  const summary = output.summary || output.changes || output.description;
  if (typeof summary === 'string' && summary.length > 0) {
    // Truncate long summaries
    const truncated =
      summary.length > 300 ? summary.substring(0, 300) + '...' : summary;
    parts.push(truncated);
  }

  // Check for error count
  if (typeof output.errorCount === 'number' && output.errorCount > 0) {
    parts.push(`Found ${output.errorCount} error(s).`);
  }

  // Check for success/failure indicators
  if (output.success === false || output.failed === true) {
    parts.push('Execution had issues.');
  }

  return parts.join(' ').substring(0, 500);
}
