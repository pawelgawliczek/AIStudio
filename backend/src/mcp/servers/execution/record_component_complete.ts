/**
 * ST-110: Refactored record_component_complete to use /context command
 * ST-172: Simplified to use registry-based transcript lookup (single source of truth)
 *
 * Two data sources for metrics:
 * 1. contextOutput - For orchestrator's own /context command output
 * 2. spawned_agent_transcripts registry - For spawned agents (populated by orchestrator calling add_transcript)
 *
 * The orchestrator must call add_transcript({ type: 'agent', componentId, transcriptPath })
 * BEFORE calling record_agent_complete. This ensures the registry is the single source of truth.
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { PrismaClient } from '@prisma/client';
import { broadcastComponentCompleted } from '../../services/websocket-gateway.instance';
import { ValidationError } from '../../types';
import { RemoteRunner } from '../../utils/remote-runner';
import { parseContextOutput, ContextMetrics } from './parse-context-output';

// ALIASING: Component → Agent (ST-109)
export const tool: Tool = {
  name: 'record_agent_complete',
  description: 'Log the completion of an agent execution with output and metrics. Call this after agent logic finishes.',
  inputSchema: {
    type: 'object',
    properties: {
      runId: {
        type: 'string',
        description: 'Workflow run ID (required)',
      },
      componentId: {
        type: 'string',
        description: 'Component ID (required)',
      },
      output: {
        type: 'object',
        description: 'Component output data (optional)',
      },
      status: {
        type: 'string',
        enum: ['completed', 'failed'],
        description: 'Component execution status (default: completed)',
      },
      errorMessage: {
        type: 'string',
        description: 'Error message if status is failed',
      },
      // ST-172: For orchestrator's own metrics (runs /context command in its session)
      contextOutput: {
        type: 'string',
        description:
          'Raw /context command output from Claude Code. Use ONLY for orchestrator components that run /context in their own session.',
      },
      // ST-147: Direct turn metrics
      turnMetrics: {
        type: 'object',
        description: 'ST-147: Turn tracking metrics for session telemetry',
        properties: {
          totalTurns: { type: 'number', description: 'All user messages (manual + auto)' },
          manualPrompts: { type: 'number', description: 'Actual user-typed input' },
          autoContinues: { type: 'number', description: 'Auto-continue/confirmation prompts' },
        },
      },
      // ST-147: Component summary for resume context
      componentSummary: {
        type: 'string',
        description: 'ST-147: AI-generated summary of what this agent accomplished',
      },
      // ST-172: Transcript paths come from spawned_agent_transcripts registry
      // The orchestrator MUST call add_transcript({ type: 'agent', componentId, transcriptPath })
      // BEFORE calling record_agent_complete. This tool reads from the registry.
    },
    required: ['runId', 'componentId'],
  },
};

export const metadata = {
  category: 'execution',
  domain: 'Team Execution',
  tags: ['agent', 'execution', 'tracking', 'metrics'],
  version: '1.0.0',
  since: '2025-11-26',
};

export async function handler(prisma: PrismaClient, params: any) {
  // Validate required fields
  if (!params.runId) {
    throw new ValidationError('Missing required parameter: runId', {
      expectedState: 'A valid workflow run ID must be provided',
    });
  }
  if (!params.componentId) {
    throw new ValidationError('Missing required parameter: componentId', {
      expectedState: 'A valid component ID must be provided',
    });
  }

  const status = params.status || 'completed';
  if (!['completed', 'failed'].includes(status)) {
    throw new ValidationError(
      'Invalid status value. Status must be either "completed" or "failed"',
      {
        expectedState: 'Either "completed" or "failed"',
        currentState: status,
      },
    );
  }

  // Find the component run (most recent running one for this component in this workflow run)
  const componentRun = await prisma.componentRun.findFirst({
    where: {
      workflowRunId: params.runId,
      componentId: params.componentId,
      status: 'running',
    },
    orderBy: {
      startedAt: 'desc',
    },
  });

  if (!componentRun) {
    throw new ValidationError(
      `No running component execution found for workflow run ${params.runId} and component ${params.componentId}.`,
      {
        expectedState: 'Component must be in "running" state',
        currentState: 'No running component found',
        resourceId: `runId: ${params.runId}, componentId: ${params.componentId}`,
      },
    );
  }

  const completedAt = new Date();
  const durationSeconds = Math.round(
    (completedAt.getTime() - componentRun.startedAt.getTime()) / 1000,
  );

  // ST-172: Simplified metric discovery - two sources only
  let contextMetrics: ContextMetrics | null = null;
  let dataSource: 'context' | 'transcript' | 'none' = 'none';
  let discoveredAgentId: string | undefined;
  let discoveredTranscriptPath: string | undefined;
  let turnMetrics: { totalTurns: number; manualPrompts: number; autoContinues: number } | null = null;

  // Source 1: contextOutput (for orchestrator's own /context output)
  if (params.contextOutput && typeof params.contextOutput === 'string') {
    contextMetrics = parseContextOutput(params.contextOutput);
    dataSource = 'context';
    console.log(`[ST-172] Parsed /context output for component ${params.componentId}:`, {
      tokensInput: contextMetrics.tokensInput,
      tokensOutput: contextMetrics.tokensOutput,
    });
  }

  // Source 2: spawned_agent_transcripts registry (SINGLE SOURCE OF TRUTH for spawned agents)
  // The orchestrator MUST call add_transcript({ type: 'agent', componentId, transcriptPath })
  // BEFORE calling record_agent_complete
  if (!contextMetrics) {
    const workflowRunForTranscript = await prisma.workflowRun.findUnique({
      where: { id: params.runId },
      select: {
        spawnedAgentTranscripts: true,
        metadata: true,
      },
    });

    if (workflowRunForTranscript) {
      const spawnedAgents = (workflowRunForTranscript.spawnedAgentTranscripts as any[] | null) || [];
      const agentEntry = spawnedAgents.find((a: any) => a.componentId === params.componentId);

      if (agentEntry?.transcriptPath) {
        // Found in registry - use RemoteRunner to parse the transcript on the laptop
        const runner = new RemoteRunner();
        const scriptParams = [`--file=${agentEntry.transcriptPath}`];

        console.log(`[ST-172] Found agent transcript in registry for component ${params.componentId}: ${agentEntry.transcriptPath}`);

        interface RemoteMetrics {
          inputTokens: number;
          outputTokens: number;
          cacheCreationTokens: number;
          cacheReadTokens: number;
          totalTokens: number;
          model: string;
          transcriptPath: string;
          agentId?: string;
          sessionId?: string;
          turns?: {
            totalTurns: number;
            manualPrompts: number;
            autoContinues: number;
          };
        }

        const result = await runner.execute<RemoteMetrics>('parse-transcript', scriptParams, {
          requestedBy: 'record_agent_complete',
        });

        if (result.executed && result.success && result.result) {
          const metrics = result.result;
          contextMetrics = {
            tokensInput: metrics.inputTokens,
            tokensOutput: metrics.outputTokens,
            tokensSystemPrompt: null,
            tokensSystemTools: null,
            tokensMcpTools: null,
            tokensMemoryFiles: null,
            tokensMessages: null,
            tokensCacheCreation: metrics.cacheCreationTokens,
            tokensCacheRead: metrics.cacheReadTokens,
            sessionId: metrics.sessionId || null,
          };
          dataSource = 'transcript';
          discoveredAgentId = agentEntry.agentId || metrics.agentId;
          discoveredTranscriptPath = agentEntry.transcriptPath;

          if (metrics.turns) {
            turnMetrics = {
              totalTurns: metrics.turns.totalTurns,
              manualPrompts: metrics.turns.manualPrompts,
              autoContinues: metrics.turns.autoContinues,
            };
          }

          console.log(`[ST-172] Parsed agent transcript for component ${params.componentId}:`, {
            agentId: discoveredAgentId,
            transcriptPath: agentEntry.transcriptPath,
            inputTokens: metrics.inputTokens,
            outputTokens: metrics.outputTokens,
          });
        } else {
          console.warn(`[ST-172] Failed to parse transcript at ${agentEntry.transcriptPath}:`, {
            executed: result.executed,
            success: result.success,
            error: result.error,
          });
        }
      } else {
        // Not in registry - this is expected for orchestrator components that use contextOutput
        // or indicates the orchestrator didn't call add_transcript before record_agent_complete
        console.log(`[ST-172] No transcript in registry for component ${params.componentId}. ` +
          `For spawned agents, ensure add_transcript({ type: 'agent', componentId, transcriptPath }) was called.`);
      }
    }
  }

  // Get the component info
  const componentInfo = await prisma.component.findUnique({
    where: { id: params.componentId },
    select: { name: true },
  });

  // ST-147: Extract turn metrics
  // Priority 1: Direct turnMetrics parameter
  // Priority 2: From transcript parsing (set above)
  if (params.turnMetrics && typeof params.turnMetrics === 'object') {
    turnMetrics = {
      totalTurns: params.turnMetrics.totalTurns || 0,
      manualPrompts: params.turnMetrics.manualPrompts || 0,
      autoContinues: params.turnMetrics.autoContinues || 0,
    };
    console.log(`[ST-147] Direct turn metrics for component ${params.componentId}:`, turnMetrics);
  }

  // Update ComponentRun record with /context or transcript metrics
  const updatedComponentRun = await prisma.componentRun.update({
    where: { id: componentRun.id },
    data: {
      status,
      outputData: params.output || {},
      // ST-110/ST-112: Token breakdown from /context command or transcript
      totalTokens: contextMetrics?.tokensInput || null,
      tokensInput: contextMetrics?.tokensInput || null,
      tokensOutput: contextMetrics?.tokensOutput || null,
      tokensSystemPrompt: contextMetrics?.tokensSystemPrompt || null,
      tokensSystemTools: contextMetrics?.tokensSystemTools || null,
      tokensMcpTools: contextMetrics?.tokensMcpTools || null,
      tokensMemoryFiles: contextMetrics?.tokensMemoryFiles || null,
      tokensMessages: contextMetrics?.tokensMessages || null,
      // ST-112: Session ID from transcript
      sessionId: contextMetrics?.sessionId || componentRun.sessionId || null,
      // ST-147: Turn metrics
      totalTurns: turnMetrics?.totalTurns || null,
      manualPrompts: turnMetrics?.manualPrompts || null,
      autoContinues: turnMetrics?.autoContinues || null,
      // ST-172: Transcript path and agent ID from registry (single source of truth)
      transcriptPath: discoveredTranscriptPath || null,
      claudeAgentId: discoveredAgentId || null,
      componentSummary: params.componentSummary || null,
      // ST-112: Store cache tokens in metadata (no dedicated fields in schema)
      metadata: contextMetrics?.tokensCacheCreation || contextMetrics?.tokensCacheRead
        ? {
            ...(typeof componentRun.metadata === 'object' && componentRun.metadata !== null ? componentRun.metadata : {}),
            cacheTokens: {
              creation: contextMetrics.tokensCacheCreation || 0,
              read: contextMetrics.tokensCacheRead || 0,
            },
          }
        : componentRun.metadata,
      // Duration
      durationSeconds,
      finishedAt: completedAt,
      errorMessage: params.errorMessage || null,
    },
  });

  const componentName = componentInfo?.name || 'Unknown Component';

  // Update WorkflowRun aggregated metrics
  const allComponentRuns = await prisma.componentRun.findMany({
    where: {
      workflowRunId: params.runId,
      status: { in: ['completed', 'failed'] },
    },
  });

  const aggregatedMetrics = {
    totalTokens: allComponentRuns.reduce((sum, cr) => sum + (cr.totalTokens || 0), 0),
    durationSeconds: allComponentRuns.reduce((sum, cr) => sum + (cr.durationSeconds || 0), 0),
    // ST-147: Aggregate turn metrics
    totalTurns: allComponentRuns.reduce((sum, cr) => sum + (cr.totalTurns || 0), 0),
    totalManualPrompts: allComponentRuns.reduce((sum, cr) => sum + (cr.manualPrompts || 0), 0),
  };

  const componentCount = allComponentRuns.length;

  // ST-172: Transcript paths are stored in WorkflowRun when:
  // - start_team_run is called (initial master transcript)
  // - compact hook fires (adds new transcript to masterTranscriptPaths)
  // - Task hook fires (adds spawned agent to spawnedAgentTranscripts)
  // No need to update them here - they're already in the DB

  await prisma.workflowRun.update({
    where: { id: params.runId },
    data: {
      totalTokens: aggregatedMetrics.totalTokens || null,
      durationSeconds: aggregatedMetrics.durationSeconds || null,
      // ST-147: Aggregated turn metrics
      totalTurns: aggregatedMetrics.totalTurns || null,
      totalManualPrompts: aggregatedMetrics.totalManualPrompts || null,
      // Calculate existing fields too
      totalUserPrompts: aggregatedMetrics.totalManualPrompts || null,
      avgPromptsPerComponent: componentCount > 0
        ? aggregatedMetrics.totalManualPrompts / componentCount
        : null,
    },
  });

  // ST-129: Broadcast component completed event via HTTP to backend
  // (MCP runs in separate process, cannot share memory with NestJS WebSocket gateway)
  try {
    const workflowRun = await prisma.workflowRun.findUnique({
      where: { id: params.runId },
      select: {
        projectId: true,
        storyId: true,
      },
    });

    const story = workflowRun?.storyId
      ? await prisma.story.findUnique({
          where: { id: workflowRun.storyId },
          select: { key: true, title: true },
        })
      : null;

    if (workflowRun && story) {
      await broadcastComponentCompleted(params.runId, workflowRun.projectId, {
        componentName: componentName,
        storyKey: story.key,
        storyTitle: story.title,
        status: status,
        completedAt: completedAt.toISOString(),
      });
    }
  } catch (wsError: any) {
    // Non-fatal - log and continue
    console.warn(`[ST-129] Failed to broadcast component completed: ${wsError.message}`);
  }

  return {
    success: true,
    componentRunId: updatedComponentRun.id,
    runId: updatedComponentRun.workflowRunId,
    componentId: updatedComponentRun.componentId,
    componentName,
    status: updatedComponentRun.status,
    startedAt: updatedComponentRun.startedAt.toISOString(),
    completedAt: updatedComponentRun.finishedAt?.toISOString(),
    dataSource,
    contextMetrics: contextMetrics || null,
    metrics: {
      tokensUsed: updatedComponentRun.totalTokens,
      tokensSystemPrompt: updatedComponentRun.tokensSystemPrompt,
      tokensSystemTools: updatedComponentRun.tokensSystemTools,
      tokensMcpTools: updatedComponentRun.tokensMcpTools,
      tokensMemoryFiles: updatedComponentRun.tokensMemoryFiles,
      tokensMessages: updatedComponentRun.tokensMessages,
      durationSeconds: updatedComponentRun.durationSeconds,
    },
    // ST-147: Turn metrics in response
    turnMetrics: turnMetrics || null,
    aggregatedMetrics,
    message: `Component "${componentName}" ${status}. Duration: ${durationSeconds}s, Tokens: ${contextMetrics?.tokensInput || 0}${turnMetrics ? `, Turns: ${turnMetrics.totalTurns} (manual: ${turnMetrics.manualPrompts})` : ''}`,
  };
}
