/**
 * ST-110: Refactored record_component_complete to use /context command
 * Removed ALL transcript parsing (1,457 lines) and replaced with simple /context parsing
 * ST-112: Added transcriptPath parameter for spawned agent token tracking
 * ST-165: Added auto-discovery of metrics from RemoteJob.result and transcript search
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { PrismaClient } from '@prisma/client';
import { broadcastComponentCompleted } from '../../services/websocket-gateway.instance';
import { ValidationError } from '../../types';
import { parseContextOutput, ContextMetrics } from './parse-context-output';
import { TranscriptParserService } from './services/transcript-parser.service';

/**
 * ST-165: Get the transcript directory for a project path
 * Claude Code stores transcripts at ~/.claude/projects/{escaped-path}/
 */
function getTranscriptDir(projectPath: string): string {
  const homeDir = os.homedir();
  // Escape path: replace / with - (except leading /)
  const escapedPath = projectPath.replace(/^\//, '').replace(/\//g, '-');
  return path.join(homeDir, '.claude', 'projects', escapedPath);
}

/**
 * ST-165: Find a transcript file containing specific content
 * Searches recent transcripts for runId/componentId
 */
function findTranscriptByContent(transcriptDir: string, searchContent: string, searchDays = 7): string | null {
  if (!fs.existsSync(transcriptDir)) {
    return null;
  }

  const cutoffTime = Date.now() - searchDays * 24 * 60 * 60 * 1000;

  // Get all transcripts within time window
  let transcriptFiles: Array<{ name: string; path: string; mtime: Date }>;
  try {
    transcriptFiles = fs
      .readdirSync(transcriptDir)
      .filter((f) => f.endsWith('.jsonl'))
      .map((f) => ({
        name: f,
        path: path.join(transcriptDir, f),
        mtime: fs.statSync(path.join(transcriptDir, f)).mtime,
      }))
      .filter((f) => f.mtime.getTime() > cutoffTime)
      .sort((a, b) => b.mtime.getTime() - a.mtime.getTime()); // newest first
  } catch {
    return null;
  }

  // Search each file for the content
  for (const file of transcriptFiles) {
    try {
      const content = fs.readFileSync(file.path, 'utf-8');
      if (content.includes(searchContent)) {
        return file.path;
      }
    } catch {
      // Skip files we can't read
    }
  }

  return null;
}


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
          // ST-147: Turn metrics (optional, included when using parseTranscriptWithTurns)
          turns: {
            type: 'object',
            properties: {
              totalTurns: { type: 'number' },
              manualPrompts: { type: 'number' },
              autoContinues: { type: 'number' },
            },
          },
        },
      },
      // ST-147: Direct turn metrics (alternative to transcriptMetrics.turns)
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

  // ST-165: Priority 4: Check RemoteJob.result for laptop-executed agents
  if (!contextMetrics && componentRun.remoteJobId) {
    const remoteJob = await prisma.remoteJob.findUnique({
      where: { id: componentRun.remoteJobId },
      select: { result: true, status: true },
    });

    if (remoteJob?.status === 'completed' && remoteJob.result) {
      const result = remoteJob.result as Record<string, unknown>;
      const metrics = result.metrics as Record<string, number> | undefined;

      if (metrics) {
        contextMetrics = {
          tokensInput: metrics.inputTokens || 0,
          tokensOutput: metrics.outputTokens || 0,
          tokensSystemPrompt: null,
          tokensSystemTools: null,
          tokensMcpTools: null,
          tokensMemoryFiles: null,
          tokensMessages: null,
          tokensCacheCreation: metrics.cacheCreationTokens || 0,
          tokensCacheRead: metrics.cacheReadTokens || 0,
          sessionId: (result.sessionId as string) || null,
        };
        dataSource = 'transcript_metrics';
        console.log(`[ST-165] Auto-extracted metrics from RemoteJob.result for component ${params.componentId}:`, {
          inputTokens: metrics.inputTokens,
          outputTokens: metrics.outputTokens,
          cacheCreationTokens: metrics.cacheCreationTokens,
          cacheReadTokens: metrics.cacheReadTokens,
          totalTokens: metrics.totalTokens,
          remoteJobId: componentRun.remoteJobId,
        });
      }
    }
  }

  // ST-165: Priority 5: Auto-search for transcript
  // For spawned agents: use sessionId from RemoteJob.result (more reliable than runId)
  // For orchestrator: search by runId in MCP tool calls
  if (!contextMetrics) {
    // Get the project path from WorkflowRun.metadata._transcriptTracking.projectPath
    // or fallback to Project.hostPath or PROJECT_HOST_PATH
    const workflowRun = await prisma.workflowRun.findUnique({
      where: { id: params.runId },
      select: {
        metadata: true,
        project: {
          select: { hostPath: true },
        },
      },
    });

    // Extract projectPath from metadata._transcriptTracking (stored by start_workflow_run)
    const metadata = workflowRun?.metadata as Record<string, any> | null;
    const transcriptTracking = metadata?._transcriptTracking as Record<string, string> | undefined;
    const projectPath = transcriptTracking?.projectPath ||
                        workflowRun?.project?.hostPath ||
                        process.env.PROJECT_HOST_PATH;

    if (projectPath) {
      const transcriptDir = getTranscriptDir(projectPath);
      let foundTranscript: string | null = null;
      let searchMethod = '';

      // For spawned agents: if we have RemoteJob with sessionId, search by sessionId
      // (even if metrics weren't in result, the transcript might exist)
      if (componentRun.remoteJobId) {
        const remoteJob = await prisma.remoteJob.findUnique({
          where: { id: componentRun.remoteJobId },
          select: { result: true },
        });
        const jobResult = remoteJob?.result as Record<string, unknown> | null;
        const sessionId = jobResult?.sessionId as string | undefined;

        if (sessionId) {
          console.log(`[ST-165] Searching for transcript with sessionId=${sessionId}`);
          foundTranscript = findTranscriptByContent(transcriptDir, sessionId);
          searchMethod = `sessionId=${sessionId}`;
        }
      }

      // Fallback: search by runId (works for orchestrator transcripts with MCP tool calls)
      if (!foundTranscript) {
        console.log(`[ST-165] Searching for transcript with runId=${params.runId}`);
        foundTranscript = findTranscriptByContent(transcriptDir, params.runId);
        searchMethod = `runId=${params.runId}`;
      }

      // Last resort: search by componentRunId
      if (!foundTranscript) {
        console.log(`[ST-165] Searching for transcript with componentRunId=${componentRun.id}`);
        foundTranscript = findTranscriptByContent(transcriptDir, componentRun.id);
        searchMethod = `componentRunId=${componentRun.id}`;
      }

      if (foundTranscript) {
        console.log(`[ST-165] Found transcript via ${searchMethod}: ${foundTranscript}`);
        const transcriptParser = new TranscriptParserService();
        const transcriptMetrics = await transcriptParser.parseAgentTranscript(foundTranscript);

        if (transcriptMetrics) {
          contextMetrics = {
            tokensInput: transcriptMetrics.inputTokens,
            tokensOutput: transcriptMetrics.outputTokens,
            tokensSystemPrompt: null,
            tokensSystemTools: null,
            tokensMcpTools: null,
            tokensMemoryFiles: null,
            tokensMessages: null,
            tokensCacheCreation: transcriptMetrics.cacheCreationTokens,
            tokensCacheRead: transcriptMetrics.cacheReadTokens,
            sessionId: transcriptMetrics.sessionId,
          };
          dataSource = 'transcript';
          console.log(`[ST-165] Auto-parsed transcript for component ${params.componentId}:`, {
            transcriptPath: foundTranscript,
            inputTokens: transcriptMetrics.inputTokens,
            outputTokens: transcriptMetrics.outputTokens,
            cacheCreationTokens: transcriptMetrics.cacheCreationTokens,
            cacheReadTokens: transcriptMetrics.cacheReadTokens,
            totalTokens: transcriptMetrics.totalTokens,
          });
        }
      } else {
        console.log(`[ST-165] No transcript found for component ${params.componentId}`);
      }
    } else {
      console.log(`[ST-165] Cannot auto-search transcript: no project path available`);
    }
  }

  // Get the component info
  const componentInfo = await prisma.component.findUnique({
    where: { id: params.componentId },
    select: { name: true },
  });

  // ST-147: Extract turn metrics from various sources
  let turnMetrics: { totalTurns: number; manualPrompts: number; autoContinues: number } | null = null;

  // Priority 1: Direct turnMetrics parameter
  if (params.turnMetrics && typeof params.turnMetrics === 'object') {
    turnMetrics = {
      totalTurns: params.turnMetrics.totalTurns || 0,
      manualPrompts: params.turnMetrics.manualPrompts || 0,
      autoContinues: params.turnMetrics.autoContinues || 0,
    };
    console.log(`[ST-147] Direct turn metrics for component ${params.componentId}:`, turnMetrics);
  }
  // Priority 2: Turn metrics from transcriptMetrics.turns
  else if (params.transcriptMetrics?.turns && typeof params.transcriptMetrics.turns === 'object') {
    turnMetrics = {
      totalTurns: params.transcriptMetrics.turns.totalTurns || 0,
      manualPrompts: params.transcriptMetrics.turns.manualPrompts || 0,
      autoContinues: params.transcriptMetrics.turns.autoContinues || 0,
    };
    console.log(`[ST-147] Turn metrics from transcriptMetrics for component ${params.componentId}:`, turnMetrics);
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
      // ST-147: Transcript path and component summary
      transcriptPath: params.transcriptPath || null,
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
