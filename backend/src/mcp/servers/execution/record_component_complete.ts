/**
 * ST-110: Refactored record_component_complete to use /context command
 * Removed ALL transcript parsing (1,457 lines) and replaced with simple /context parsing
 * ST-112: Added transcriptPath parameter for spawned agent token tracking
 * ST-165: Added auto-discovery of metrics from RemoteJob.result and transcript search
 * ST-166: REMOVED transcriptMetrics parameter - caused master session to pass its own metrics
 *         instead of the spawned agent's metrics. Auto-discovery via RemoteRunner is now
 *         the primary method for getting spawned agent metrics.
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { PrismaClient } from '@prisma/client';
import { broadcastComponentCompleted } from '../../services/websocket-gateway.instance';
import { ValidationError } from '../../types';
import { RemoteRunner } from '../../utils/remote-runner';
import { parseContextOutput, ContextMetrics } from './parse-context-output';
import { TranscriptParserService } from './services/transcript-parser.service';

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
      // ST-166: Removed transcriptMetrics parameter - caused master session to pass its own metrics instead of agent's
      // Auto-discovery via RemoteRunner (Priority 6) handles transcript lookup correctly using componentId search
      // ST-147: Direct turn metrics (alternative to auto-discovered turns)
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
      // Claude Code agent ID for transcript lookup
      claudeAgentId: {
        type: 'string',
        description: 'Claude Code agent ID (8-char hex like "b6ebed38"). Transcript filename is agent-{claudeAgentId}.jsonl. Pass this when spawning subagents via Task tool.',
      },
      // ST-172: Transcript paths are now stored in WorkflowRun (masterTranscriptPaths, spawnedAgentTranscripts)
      // and looked up automatically - no need to pass them as parameters
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
  // ST-166: Removed Priority 2 (transcriptMetrics) - caused master session to pass its own metrics
  // Priority 2: transcriptPath (spawned agents - ST-112 pattern, only works locally)
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

  // ST-172: Variables for discovered agent info (used across multiple priorities)
  let discoveredAgentId: string | undefined;
  let discoveredTranscriptPath: string | undefined;
  let turnMetrics: { totalTurns: number; manualPrompts: number; autoContinues: number } | null = null;

  // ST-172: Priority 3: Construct transcript path from claudeAgentId
  // If claudeAgentId is provided, we can construct the path directly without add_transcript
  // Path format: ~/.claude/projects/{escapedProjectPath}/agent-{agentId}.jsonl
  if (!contextMetrics && params.claudeAgentId) {
    const workflowRunForPath = await prisma.workflowRun.findUnique({
      where: { id: params.runId },
      select: { metadata: true },
    });

    const metadata = workflowRunForPath?.metadata as Record<string, any> | null;
    const transcriptTracking = metadata?._transcriptTracking as Record<string, string> | undefined;
    const projectPath = transcriptTracking?.projectPath;

    if (projectPath) {
      // Construct the transcript path from agentId
      // Path escaping: /Users/pawel/projects/AIStudio → -Users-pawel-projects-AIStudio
      const escapedPath = projectPath.replace(/^\//, '-').replace(/\//g, '-');

      // FIX: Extract laptop's home directory from projectPath, not server's process.env.HOME
      // projectPath format: /Users/{username}/... (macOS) or /home/{username}/... (Linux)
      // We need the first 3 path components to get the home directory
      const pathParts = projectPath.split('/').filter(Boolean); // ['Users', 'pawelgawliczek', 'projects', ...]
      let laptopHome: string;
      if (pathParts[0] === 'Users' || pathParts[0] === 'home') {
        // macOS: /Users/username or Linux: /home/username
        laptopHome = `/${pathParts[0]}/${pathParts[1]}`;
      } else {
        // Fallback: assume first two components form the home
        laptopHome = `/${pathParts.slice(0, 2).join('/')}`;
      }

      const constructedTranscriptPath = `${laptopHome}/.claude/projects/${escapedPath}/agent-${params.claudeAgentId}.jsonl`;

      console.log(`[ST-172] Constructing agent transcript path from claudeAgentId: ${constructedTranscriptPath} (derived laptopHome: ${laptopHome})`);

      // Use RemoteRunner to parse the transcript on the laptop
      const runner = new RemoteRunner();
      const scriptParams = [`--file=${constructedTranscriptPath}`];

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
        discoveredAgentId = params.claudeAgentId;
        discoveredTranscriptPath = constructedTranscriptPath;

        // Extract turn metrics if available
        if (metrics.turns && !turnMetrics) {
          turnMetrics = {
            totalTurns: metrics.turns.totalTurns,
            manualPrompts: metrics.turns.manualPrompts,
            autoContinues: metrics.turns.autoContinues,
          };
        }

        console.log(`[ST-172] Parsed agent transcript via claudeAgentId for component ${params.componentId}:`, {
          claudeAgentId: params.claudeAgentId,
          transcriptPath: constructedTranscriptPath,
          inputTokens: metrics.inputTokens,
          outputTokens: metrics.outputTokens,
        });
      } else {
        console.log(`[ST-172] Failed to parse transcript for claudeAgentId ${params.claudeAgentId}:`, {
          executed: result.executed,
          success: result.success,
          error: result.error,
        });
      }
    }
  }

  // ST-172: Priority 4: Look up transcript from WorkflowRun's stored paths (fallback)
  // - spawnedAgentTranscripts: for spawned agents (match by componentId)
  // - masterTranscriptPaths: for orchestrator/master session
  if (!contextMetrics) {
    const workflowRunForTranscript = await prisma.workflowRun.findUnique({
      where: { id: params.runId },
      select: {
        masterTranscriptPaths: true,
        spawnedAgentTranscripts: true,
      },
    });

    if (workflowRunForTranscript) {
      // First check if this component has a spawned agent transcript
      const spawnedAgents = (workflowRunForTranscript.spawnedAgentTranscripts as any[] | null) || [];
      const agentEntry = spawnedAgents.find((a: any) => a.componentId === params.componentId);

      if (agentEntry?.transcriptPath) {
        // Found spawned agent transcript - parse it
        const transcriptParser = new TranscriptParserService();
        const transcriptMetrics = await transcriptParser.parseAgentTranscript(agentEntry.transcriptPath);

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
          console.log(`[ST-172] Parsed spawned agent transcript from DB for component ${params.componentId}:`, {
            transcriptPath: agentEntry.transcriptPath,
            inputTokens: transcriptMetrics.inputTokens,
            outputTokens: transcriptMetrics.outputTokens,
          });
        }
      }
    }
  }

  // ST-165: Priority 5: Check RemoteJob.result for laptop-executed agents
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

  // ST-165: Priority 6: Auto-search for transcript via RemoteRunner
  // Executes parse-transcript.ts on laptop where transcripts live
  // Stores: metrics + agentId + sessionId + transcriptPath
  // Note: discoveredAgentId, discoveredTranscriptPath, turnMetrics declared above at Priority 3

  if (!contextMetrics) {
    // Get the project path from WorkflowRun.metadata._transcriptTracking.projectPath
    const workflowRun = await prisma.workflowRun.findUnique({
      where: { id: params.runId },
      select: {
        metadata: true,
        project: {
          select: { hostPath: true },
        },
      },
    });

    // Extract projectPath from metadata._transcriptTracking (stored by start_workflow_run with cwd)
    const metadata = workflowRun?.metadata as Record<string, any> | null;
    const transcriptTracking = metadata?._transcriptTracking as Record<string, string> | undefined;
    const projectPath = transcriptTracking?.projectPath ||
                        workflowRun?.project?.hostPath ||
                        process.env.PROJECT_HOST_PATH;

    if (projectPath) {
      // Use RemoteRunner to execute parse-transcript.ts on laptop
      const runner = new RemoteRunner();

      // Build search content - prefer componentId, fallback to runId
      const searchContent = params.componentId || params.runId;
      const scriptParams = [`--search=${searchContent}`, `--path=${projectPath}`];

      console.log(`[ST-165] Auto-searching transcript via RemoteRunner: search=${searchContent}, path=${projectPath}`);

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
        discoveredAgentId = metrics.agentId;
        discoveredTranscriptPath = metrics.transcriptPath;

        // Also extract turn metrics if available
        if (metrics.turns && !turnMetrics) {
          turnMetrics = {
            totalTurns: metrics.turns.totalTurns,
            manualPrompts: metrics.turns.manualPrompts,
            autoContinues: metrics.turns.autoContinues,
          };
        }

        console.log(`[ST-165] Auto-parsed transcript via RemoteRunner for component ${params.componentId}:`, {
          transcriptPath: metrics.transcriptPath,
          agentId: metrics.agentId,
          inputTokens: metrics.inputTokens,
          outputTokens: metrics.outputTokens,
          cacheCreationTokens: metrics.cacheCreationTokens,
          totalTokens: metrics.totalTokens,
        });
      } else {
        console.log(`[ST-165] RemoteRunner transcript search failed:`, {
          executed: result.executed,
          success: result.success,
          error: result.error,
          agentOffline: !result.executed,
        });
      }
    } else {
      console.log(`[ST-165] Cannot auto-search transcript: no project path available (did start_team_run receive cwd?)`);
    }
  }

  // Get the component info
  const componentInfo = await prisma.component.findUnique({
    where: { id: params.componentId },
    select: { name: true },
  });

  // ST-147: Extract turn metrics from various sources
  // Note: turnMetrics may already be set by RemoteRunner above

  // Priority 1: Direct turnMetrics parameter (overrides RemoteRunner auto-discovery)
  if (params.turnMetrics && typeof params.turnMetrics === 'object') {
    turnMetrics = {
      totalTurns: params.turnMetrics.totalTurns || 0,
      manualPrompts: params.turnMetrics.manualPrompts || 0,
      autoContinues: params.turnMetrics.autoContinues || 0,
    };
    console.log(`[ST-147] Direct turn metrics for component ${params.componentId}:`, turnMetrics);
  }
  // ST-166: Removed Priority 2 (transcriptMetrics.turns) - transcriptMetrics parameter removed
  // Priority 2: Turn metrics from RemoteRunner (set above in contextMetrics block)

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
      // ST-147: Transcript path, agent ID, and component summary
      // Priority: explicit params > auto-discovered values
      transcriptPath: params.transcriptPath || discoveredTranscriptPath || null,
      claudeAgentId: params.claudeAgentId || discoveredAgentId || null,
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
