/**
 * ST-110: Refactored record_component_complete to use /context command
 * Removed ALL transcript parsing (1,457 lines) and replaced with simple /context parsing
 * ST-112: Added transcriptPath parameter for spawned agent token tracking
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { PrismaClient } from '@prisma/client';
import { ValidationError } from '../../types';
import { parseContextOutput, ContextMetrics } from './parse-context-output';
import { TranscriptParserService } from './services/transcript-parser.service';

export const tool: Tool = {
  name: 'record_component_complete',
  description:
    'Log the completion of a component execution with output and metrics. Call this after component logic finishes.',
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
      contextOutput: {
        type: 'string',
        description:
          'Raw /context command output from Claude Code. When provided, token metrics will be parsed from this output.',
      },
      transcriptPath: {
        type: 'string',
        description:
          'Path to agent transcript JSONL file (for spawned agents). When provided, token metrics will be parsed from transcript. Only works when MCP server runs locally.',
      },
      transcriptMetrics: {
        type: 'object',
        description:
          'Direct token metrics from get_transcript_metrics or local parse-transcript.ts script. Use this when MCP server runs remotely.',
        properties: {
          inputTokens: { type: 'number' },
          outputTokens: { type: 'number' },
          cacheCreationTokens: { type: 'number' },
          cacheReadTokens: { type: 'number' },
          totalTokens: { type: 'number' },
          model: { type: 'string' },
        },
      },
    },
    required: ['runId', 'componentId'],
  },
};

export const metadata = {
  category: 'execution',
  domain: 'Workflow Execution',
  tags: ['component', 'execution', 'tracking', 'metrics'],
  version: '2.0.0', // ST-110: Major version bump for breaking changes
  since: '2025-11-25',
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

  // Parse metrics from contextOutput, transcriptMetrics, or transcriptPath
  let contextMetrics: ContextMetrics | null = null;
  let dataSource: 'context' | 'transcript' | 'transcript_metrics' | 'none' = 'none';

  // Priority 1: contextOutput (orchestrator agents - ST-110 pattern)
  if (params.contextOutput && typeof params.contextOutput === 'string') {
    contextMetrics = parseContextOutput(params.contextOutput);
    dataSource = 'context';
    console.log(`[ST-110] Parsed /context output for component ${params.componentId}:`, {
      tokensInput: contextMetrics.tokensInput,
      tokensSystemPrompt: contextMetrics.tokensSystemPrompt,
      tokensSystemTools: contextMetrics.tokensSystemTools,
      tokensMcpTools: contextMetrics.tokensMcpTools,
      tokensMemoryFiles: contextMetrics.tokensMemoryFiles,
      tokensMessages: contextMetrics.tokensMessages,
    });
  }
  // Priority 2: transcriptMetrics (direct metrics from get_transcript_metrics or local script)
  else if (params.transcriptMetrics && typeof params.transcriptMetrics === 'object') {
    const tm = params.transcriptMetrics;
    contextMetrics = {
      tokensInput: tm.inputTokens || 0,
      tokensOutput: tm.outputTokens || 0,
      tokensSystemPrompt: null,
      tokensSystemTools: null,
      tokensMcpTools: null,
      tokensMemoryFiles: null,
      tokensMessages: null,
      tokensCacheCreation: tm.cacheCreationTokens || 0,
      tokensCacheRead: tm.cacheReadTokens || 0,
      sessionId: null,
    };
    dataSource = 'transcript_metrics';
    console.log(`[transcript_metrics] Direct metrics for component ${params.componentId}:`, {
      inputTokens: tm.inputTokens,
      outputTokens: tm.outputTokens,
      cacheCreationTokens: tm.cacheCreationTokens,
      cacheReadTokens: tm.cacheReadTokens,
      totalTokens: tm.totalTokens,
      model: tm.model,
    });
  }
  // Priority 3: transcriptPath (spawned agents - ST-112 pattern, only works locally)
  else if (params.transcriptPath && typeof params.transcriptPath === 'string') {
    const transcriptParser = new TranscriptParserService();
    const transcriptMetrics = await transcriptParser.parseAgentTranscript(params.transcriptPath);

    if (transcriptMetrics) {
      // Map transcript metrics to ContextMetrics format for consistency
      contextMetrics = {
        tokensInput: transcriptMetrics.inputTokens,
        tokensOutput: transcriptMetrics.outputTokens,
        tokensSystemPrompt: null, // Not available in transcript
        tokensSystemTools: null,  // Not available in transcript
        tokensMcpTools: null,     // Not available in transcript
        tokensMemoryFiles: null,  // Not available in transcript
        tokensMessages: null,     // Not available in transcript
        tokensCacheCreation: transcriptMetrics.cacheCreationTokens,
        tokensCacheRead: transcriptMetrics.cacheReadTokens,
        sessionId: transcriptMetrics.sessionId,
      };
      dataSource = 'transcript';
      console.log(`[ST-112] Parsed transcript for component ${params.componentId}:`, {
        agentId: transcriptMetrics.agentId,
        inputTokens: transcriptMetrics.inputTokens,
        outputTokens: transcriptMetrics.outputTokens,
        cacheCreationTokens: transcriptMetrics.cacheCreationTokens,
        cacheReadTokens: transcriptMetrics.cacheReadTokens,
        totalTokens: transcriptMetrics.totalTokens,
      });
    } else {
      console.warn(`[ST-112] Failed to parse transcript at ${params.transcriptPath}`);
    }
  }

  // Get the component info
  const componentInfo = await prisma.component.findUnique({
    where: { id: params.componentId },
    select: { name: true },
  });

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
  };

  await prisma.workflowRun.update({
    where: { id: params.runId },
    data: {
      totalTokens: aggregatedMetrics.totalTokens || null,
      durationSeconds: aggregatedMetrics.durationSeconds || null,
    },
  });

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
    aggregatedMetrics,
    message: `Component "${componentName}" ${status}. Duration: ${durationSeconds}s, Tokens: ${contextMetrics?.tokensInput || 0}`,
  };
}
