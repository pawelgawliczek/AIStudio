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
  generateStructuredSummary,
  serializeComponentSummary,
  ComponentSummaryStructured,
} from '../../types/component-summary.types';
import {
  broadcastComponentStarted,
  broadcastComponentCompleted,
  startTranscriptTailing,
  stopTranscriptTailing,
} from '../services/websocket-gateway.instance';
import { calculateCost } from '../utils/pricing';
import { RemoteRunner } from '../utils/remote-runner';

// Metrics from transcript parsing
interface TranscriptMetrics {
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
    tokensInput?: number | null;
    tokensOutput?: number | null;
    totalTokens?: number | null;
    cost?: number | null;
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
      // NOTE: spawnedAgentTranscripts is stored in metadata, NOT in the dedicated field
      const runForTranscript = await prisma.workflowRun.findUnique({
        where: { id: params.runId },
        select: { metadata: true },
      });

      if (runForTranscript) {
        const spawnedAgents =
          ((runForTranscript.metadata as any)?.spawnedAgentTranscripts as any[] | null) || [];
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
 * Updates ComponentRun record with output, status, duration, AND telemetry metrics
 * Parses transcript files on laptop for token counts (via RemoteRunner)
 * Broadcasts WebSocket event (non-fatal if fails)
 * Stops transcript tailing (non-fatal if fails)
 */
export async function completeAgentTracking(
  prisma: PrismaClient,
  params: {
    runId: string;
    componentId: string;
    output?: Record<string, unknown>;
    status?: 'completed' | 'failed';
    componentSummary?: string | ComponentSummaryStructured; // ST-203: Accept structured or string
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

    // ST-203: Generate or serialize structured summary
    let summaryJson: string | null = null;
    if (params.componentSummary) {
      if (typeof params.componentSummary === 'string') {
        // Already a string - assume it's JSON
        summaryJson = params.componentSummary;
      } else {
        // Structured object - serialize it
        summaryJson = serializeComponentSummary(params.componentSummary);
      }
    } else {
      // Auto-generate from output
      const structured = generateStructuredSummary(
        params.output,
        component?.name || 'Unknown',
        status === 'failed' ? 'failed' : 'success',
      );
      summaryJson = serializeComponentSummary(structured);
    }

    // Parse transcript for telemetry (non-fatal if fails)
    let telemetryMetrics: {
      tokensInput: number | null;
      tokensOutput: number | null;
      totalTokens: number | null;
      tokensCacheCreation: number | null;
      tokensCacheRead: number | null;
      modelId: string | null;
      cost: number | null;
    } | null = null;

    try {
      let transcriptPath: string | null = null;
      let localAgentId: string | null = null;

      // ST-242: Look for transcript in multiple sources (same as record_component_complete)
      // Source 1: spawnedAgentTranscripts in workflow metadata (filtered by componentId)
      const workflowRunForTranscripts = await prisma.workflowRun.findUnique({
        where: { id: params.runId },
        select: { metadata: true },
      });

      const spawnedAgentTranscripts =
        ((workflowRunForTranscripts?.metadata as any)?.spawnedAgentTranscripts as any[] | null) || [];

      // Find transcript for this component, most recent first
      const matchingTranscripts = spawnedAgentTranscripts
        .filter((t: any) => t.componentId === params.componentId)
        .sort((a: any, b: any) => new Date(b.spawnedAt).getTime() - new Date(a.spawnedAt).getTime());

      if (matchingTranscripts.length > 0) {
        transcriptPath = matchingTranscripts[0].transcriptPath;
        localAgentId = matchingTranscripts[0].agentId;
        console.log(`[agent-tracking] Found transcript in spawnedAgentTranscripts for ${params.componentId}: ${transcriptPath}`);
      }

      // ST-242: Source 2 - Fallback to unassigned_transcripts table (ST-170)
      // TranscriptWatcher on laptop auto-detects transcripts and stores them there
      if (!transcriptPath) {
        const unassignedTranscript = await prisma.unassignedTranscript.findFirst({
          where: {
            workflowRunId: params.runId,
            agentId: { not: null }, // Only agent transcripts (not master sessions)
          },
          orderBy: { detectedAt: 'desc' }, // Most recent first
        });

        if (unassignedTranscript) {
          transcriptPath = unassignedTranscript.transcriptPath;
          localAgentId = unassignedTranscript.agentId;
          console.log(`[agent-tracking] Found transcript in unassigned_transcripts for ${params.componentId}: ${transcriptPath} (agent: ${localAgentId})`);
        }
      }

      // ST-242: Source 3 - Fallback to Transcript table (ST-168)
      // Transcripts may have been uploaded by record_component_complete already
      if (!transcriptPath) {
        const dbTranscript = await prisma.transcript.findFirst({
          where: {
            workflowRunId: params.runId,
            componentRunId: componentRun.id,
            type: 'AGENT',
          },
          orderBy: { createdAt: 'desc' },
        });

        if (dbTranscript && dbTranscript.metrics) {
          // Transcript already in DB with metrics - extract them directly
          const metrics = dbTranscript.metrics as any;
          if (metrics.tokensInput !== undefined) {
            console.log(`[agent-tracking] Found parsed transcript in DB for ${params.componentId}`);
            const componentCost = calculateCost({
              tokensInput: metrics.tokensInput || 0,
              tokensOutput: metrics.tokensOutput || 0,
              tokensCacheCreation: metrics.tokensCacheCreation || 0,
              tokensCacheRead: metrics.tokensCacheRead || 0,
              modelId: metrics.model || null,
            });
            telemetryMetrics = {
              tokensInput: metrics.tokensInput || 0,
              tokensOutput: metrics.tokensOutput || 0,
              // ST-255: Fix double-counting - totalTokens = input + output + cache_creation (NOT cache_read)
              // cache_read is already included in input_tokens (it's a subset of context that was cached)
              totalTokens: (metrics.tokensInput || 0) + (metrics.tokensOutput || 0) + (metrics.tokensCacheCreation || 0),
              tokensCacheCreation: metrics.tokensCacheCreation || 0,
              tokensCacheRead: metrics.tokensCacheRead || 0,
              modelId: metrics.model || null,
              cost: componentCost,
            };
          }
        }
      }

      // ST-242: Source 4 - Fallback to running-workflows.json on laptop via RemoteRunner
      // The track-agents hook writes spawned agent transcripts to this local file
      if (!transcriptPath && !telemetryMetrics) {
        try {
          // Get session ID and project path from workflow run metadata
          const workflowRunForSession = await prisma.workflowRun.findUnique({
            where: { id: params.runId },
            select: { metadata: true },
          });
          const transcriptTracking = (workflowRunForSession?.metadata as any)?._transcriptTracking;
          const sessionId = transcriptTracking?.sessionId;
          const projectPath = transcriptTracking?.projectPath;

          if (sessionId && projectPath) {
            const runner = new RemoteRunner();
            // Use read-file (approved script) instead of exec-command
            const runningWorkflowsPath = `${projectPath}/.claude/running-workflows.json`;
            const result = await runner.execute<{ content: string }>('read-file', [
              `--path=${runningWorkflowsPath}`,
            ], {
              requestedBy: 'completeAgentTracking',
            });

            if (result.executed && result.success && result.result?.content) {
              try {
                const workflowData = JSON.parse(result.result.content);
                const sessionData = workflowData?.sessions?.[sessionId];
                const spawnedTranscripts = sessionData?.spawnedAgentTranscripts;

                if (Array.isArray(spawnedTranscripts) && spawnedTranscripts.length > 0) {
                  // Get the most recent transcript
                  const agentEntry = spawnedTranscripts[spawnedTranscripts.length - 1];
                  if (agentEntry && agentEntry.transcriptPath) {
                    transcriptPath = agentEntry.transcriptPath;
                    localAgentId = agentEntry.agentId;
                    console.log(`[agent-tracking] Found transcript in running-workflows.json for ${params.componentId}: ${transcriptPath} (agent: ${localAgentId})`);
                  }
                }
              } catch (parseError) {
                // JSON parse failed - no valid entry
                console.log(`[agent-tracking] No valid transcript entry in running-workflows.json for session ${sessionId}`);
              }
            }
          }
        } catch (rwError: any) {
          console.warn(`[agent-tracking] Failed to read running-workflows.json: ${rwError.message}`);
        }
      }

      // ST-242: Only parse via RemoteRunner if we don't already have metrics from Transcript table
      if (transcriptPath && !telemetryMetrics) {
        console.log(`[agent-tracking] Parsing transcript for ${params.componentId}: ${transcriptPath}`);

        // Parse transcript on laptop via RemoteRunner
        const runner = new RemoteRunner();
        const result = await runner.execute<TranscriptMetrics>('parse-transcript', [`--file=${transcriptPath}`], {
          requestedBy: 'completeAgentTracking',
        });

        if (result.executed && result.success && result.result) {
          const metrics = result.result;
          // ST-242: Calculate cost using centralized pricing utility
          const componentCost = calculateCost({
            tokensInput: metrics.inputTokens,
            tokensOutput: metrics.outputTokens,
            tokensCacheCreation: metrics.cacheCreationTokens,
            tokensCacheRead: metrics.cacheReadTokens,
            modelId: metrics.model,
          });
          telemetryMetrics = {
            tokensInput: metrics.inputTokens,
            tokensOutput: metrics.outputTokens,
            // ST-255: Use totalTokens from parser (already correctly calculated as input + output + cache_creation)
            // Do NOT add cacheReadTokens - it's already included in inputTokens (cached context subset)
            totalTokens: metrics.totalTokens || (metrics.inputTokens + metrics.outputTokens + (metrics.cacheCreationTokens || 0)),
            tokensCacheCreation: metrics.cacheCreationTokens,
            tokensCacheRead: metrics.cacheReadTokens,
            modelId: metrics.model || null,
            cost: componentCost,
          };
          console.log(`[agent-tracking] Parsed telemetry for ${params.componentId}:`, {
            tokensInput: telemetryMetrics.tokensInput,
            tokensOutput: telemetryMetrics.tokensOutput,
            totalTokens: telemetryMetrics.totalTokens,
            cost: telemetryMetrics.cost,
            modelId: telemetryMetrics.modelId,
          });
        } else {
          console.warn(`[agent-tracking] Failed to parse transcript: ${result.error || 'unknown error'}`);
        }
      } else if (!telemetryMetrics) {
        console.log(`[agent-tracking] No transcript found for component ${params.componentId}`);
      }
    } catch (telemetryError: any) {
      console.warn(`[agent-tracking] Telemetry parsing failed (non-fatal): ${telemetryError.message}`);
    }

    // ST-234: Get code impact metrics from git diff
    let codeImpactMetrics: { linesAdded: number; linesDeleted: number; filesModified: string[] } | null = null;
    try {
      // Get workflow run to find story's worktree
      const workflowRunForWorktree = await prisma.workflowRun.findUnique({
        where: { id: params.runId },
        select: { storyId: true },
      });

      if (workflowRunForWorktree?.storyId) {
        const worktree = await prisma.worktree.findFirst({
          where: { storyId: workflowRunForWorktree.storyId, status: 'active' },
          select: { worktreePath: true },
        });

        if (worktree?.worktreePath) {
          // Use RemoteRunner to get git diff from laptop
          const runner = new RemoteRunner();
          const gitResult = await runner.execute<{ stdout: string; stderr: string }>('exec-command', [
            '--command=git diff main...HEAD --numstat',
            `--cwd=${worktree.worktreePath}`,
          ], {
            requestedBy: 'completeAgentTracking',
          });

          if (gitResult.executed && gitResult.success && gitResult.result?.stdout) {
            let linesAdded = 0;
            let linesDeleted = 0;
            const filesModified: string[] = [];

            for (const line of gitResult.result.stdout.split('\n').filter((l: string) => l.trim())) {
              const parts = line.split('\t');
              if (parts.length >= 3) {
                const added = parseInt(parts[0] || '0', 10) || 0;
                const deleted = parseInt(parts[1] || '0', 10) || 0;
                const file = parts[2];
                linesAdded += added;
                linesDeleted += deleted;
                if (file) filesModified.push(file);
              }
            }

            codeImpactMetrics = { linesAdded, linesDeleted, filesModified };
            console.log(`[agent-tracking] Code impact for ${params.componentId}:`, {
              linesAdded,
              linesDeleted,
              filesModified: filesModified.length,
            });
          }
        }
      }
    } catch (gitError: any) {
      // Non-fatal - log and continue
      console.warn(`[agent-tracking] Failed to get code impact metrics: ${gitError.message}`);
    }

    // Update ComponentRun with telemetry and code impact
    const updatedComponentRun = await prisma.componentRun.update({
      where: { id: componentRun.id },
      data: {
        status,
        outputData: (params.output || {}) as Prisma.InputJsonValue,
        componentSummary: summaryJson,
        errorMessage: params.errorMessage || null,
        durationSeconds,
        finishedAt: completedAt,
        // ST-242: Add telemetry including cost and modelId
        ...(telemetryMetrics && {
          tokensInput: telemetryMetrics.tokensInput,
          tokensOutput: telemetryMetrics.tokensOutput,
          totalTokens: telemetryMetrics.totalTokens,
          tokensCacheCreation: telemetryMetrics.tokensCacheCreation,
          tokensCacheRead: telemetryMetrics.tokensCacheRead,
          modelId: telemetryMetrics.modelId,
          cost: telemetryMetrics.cost,
        }),
        // ST-234: Add code impact metrics if available
        ...(codeImpactMetrics && {
          linesAdded: codeImpactMetrics.linesAdded,
          linesDeleted: codeImpactMetrics.linesDeleted,
          filesModified: codeImpactMetrics.filesModified,
        }),
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

    // ST-242: Aggregate metrics to WorkflowRun
    try {
      const allComponentRuns = await prisma.componentRun.findMany({
        where: { workflowRunId: params.runId },
        select: {
          totalTokens: true,
          tokensInput: true,
          tokensOutput: true,
          cost: true,
          durationSeconds: true,
          linesAdded: true,
          linesDeleted: true,
        },
      });

      const aggregatedMetrics = {
        totalTokensInput: allComponentRuns.reduce((sum, cr) => sum + (cr.tokensInput || 0), 0),
        totalTokensOutput: allComponentRuns.reduce((sum, cr) => sum + (cr.tokensOutput || 0), 0),
        totalTokens: allComponentRuns.reduce((sum, cr) => sum + (cr.totalTokens || 0), 0),
        totalCost: allComponentRuns.reduce((sum, cr) => sum + (Number(cr.cost) || 0), 0),
        durationSeconds: allComponentRuns.reduce((sum, cr) => sum + (cr.durationSeconds || 0), 0),
        totalLinesAdded: allComponentRuns.reduce((sum, cr) => sum + (cr.linesAdded || 0), 0),
        totalLinesDeleted: allComponentRuns.reduce((sum, cr) => sum + (cr.linesDeleted || 0), 0),
      };

      await prisma.workflowRun.update({
        where: { id: params.runId },
        data: {
          totalTokensInput: aggregatedMetrics.totalTokensInput || null,
          totalTokensOutput: aggregatedMetrics.totalTokensOutput || null,
          totalTokens: aggregatedMetrics.totalTokens || null,
          estimatedCost: aggregatedMetrics.totalCost || null,
          durationSeconds: aggregatedMetrics.durationSeconds || null,
          totalLocGenerated: (aggregatedMetrics.totalLinesAdded - aggregatedMetrics.totalLinesDeleted) || null,
        },
      });

      console.log(`[agent-tracking] Aggregated workflow metrics:`, {
        totalTokens: aggregatedMetrics.totalTokens,
        totalCost: aggregatedMetrics.totalCost,
        totalLinesAdded: aggregatedMetrics.totalLinesAdded,
      });
    } catch (aggError: any) {
      console.warn(`[agent-tracking] Failed to aggregate workflow metrics: ${aggError.message}`);
    }

    return {
      success: true,
      componentRunId: updatedComponentRun.id,
      componentName: component?.name,
      status,
      metrics: {
        durationSeconds,
        tokensInput: telemetryMetrics?.tokensInput,
        tokensOutput: telemetryMetrics?.tokensOutput,
        totalTokens: telemetryMetrics?.totalTokens,
        cost: telemetryMetrics?.cost,
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Unknown error in completeAgentTracking',
    };
  }
}

/**
 * @deprecated ST-203: Use generateStructuredSummary from component-summary.types instead
 *
 * Generate a basic summary from output data
 *
 * Extracts meaningful information from common output patterns.
 * Returns a concise summary (max 500 chars).
 *
 * This function is kept for backwards compatibility but should not be used in new code.
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

// ST-203: Re-export from component-summary.types for convenience
export { generateStructuredSummary, serializeComponentSummary, parseComponentSummary } from '../../types/component-summary.types';
