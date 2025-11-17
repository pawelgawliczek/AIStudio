import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { PrismaClient } from '@prisma/client';
import { ValidationError } from '../../types';

export const tool: Tool = {
  name: 'record_component_complete',
  description: 'Log the completion of a component execution with output and metrics. Call this after component logic finishes.',
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
      metrics: {
        type: 'object',
        description: 'DEPRECATED: Metrics are now auto-aggregated from OTEL telemetry. This field is ignored.',
        properties: {
          tokensUsed: {
            type: 'number',
            description: 'DEPRECATED: Auto-calculated from OTEL events',
          },
          durationSeconds: {
            type: 'number',
            description: 'Execution duration in seconds',
          },
          userPrompts: {
            type: 'number',
            description: 'Number of user prompts/clarifications',
          },
          systemIterations: {
            type: 'number',
            description: 'Number of system iterations/refinements',
          },
          humanInterventions: {
            type: 'number',
            description: 'Number of human interventions',
          },
          linesOfCode: {
            type: 'number',
            description: 'Lines of code generated/analyzed',
          },
          filesModified: {
            type: 'number',
            description: 'Number of files modified',
          },
          costUsd: {
            type: 'number',
            description: 'DEPRECATED: Auto-calculated from OTEL events',
          },
        },
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
      transcriptPath: {
        type: 'string',
        description: 'Path to Claude Code transcript.jsonl file. If provided, metrics will be auto-extracted from transcript instead of OTEL events.',
      },
      cleanupPolicy: {
        type: 'string',
        enum: ['delete', 'truncate', 'archive', 'keep'],
        description: 'What to do with transcript after parsing: delete (remove file), truncate (clear contents), archive (move to archive dir), keep (do nothing). Default: truncate',
      },
    },
    required: ['runId', 'componentId'],
  },
};

export const metadata = {
  category: 'execution',
  domain: 'Workflow Execution',
  tags: ['component', 'execution', 'tracking', 'metrics'],
  version: '1.0.0',
  since: '2025-11-13',
};

// Transcript parsing types
interface TranscriptMetrics {
  tokensInput: number;
  tokensOutput: number;
  tokensCacheRead: number;
  tokensCacheWrite: number;
  cacheHits: number;
  cacheMisses: number;
  toolCalls: number;
  toolErrors: number;
  linesAdded: number;
  linesDeleted: number;
  linesModified: number;
  filesModified: string[];
  testsGenerated: number;
  toolBreakdown: Record<string, { calls: number; errors: number; totalDuration: number }>;
  userPrompts: number;
  systemIterations: number;
}

// Parse Claude Code transcript.jsonl file to extract metrics
async function parseTranscript(transcriptPath: string): Promise<TranscriptMetrics> {
  const metrics: TranscriptMetrics = {
    tokensInput: 0,
    tokensOutput: 0,
    tokensCacheRead: 0,
    tokensCacheWrite: 0,
    cacheHits: 0,
    cacheMisses: 0,
    toolCalls: 0,
    toolErrors: 0,
    linesAdded: 0,
    linesDeleted: 0,
    linesModified: 0,
    filesModified: [],
    testsGenerated: 0,
    toolBreakdown: {},
    userPrompts: 0,
    systemIterations: 0,
  };

  if (!fs.existsSync(transcriptPath)) {
    throw new Error(`Transcript file not found: ${transcriptPath}`);
  }

  const fileStream = fs.createReadStream(transcriptPath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  });

  const filesAffected = new Set<string>();

  for await (const line of rl) {
    if (!line.trim()) continue;

    try {
      const entry = JSON.parse(line);

      // Track user messages (prompts)
      if (entry.type === 'human' || entry.type === 'user' || entry.role === 'user') {
        metrics.userPrompts++;
      }

      // Track assistant responses (iterations)
      if (entry.type === 'assistant' || entry.role === 'assistant') {
        metrics.systemIterations++;

        // Extract token usage from API response (Claude Code format: message.usage)
        const usage = entry.usage || entry.message?.usage;
        if (usage) {
          metrics.tokensInput += usage.input_tokens || 0;
          metrics.tokensOutput += usage.output_tokens || 0;

          // Cache metrics (Claude Code format uses cache_read_input_tokens)
          if (usage.cache_read_input_tokens && usage.cache_read_input_tokens > 0) {
            metrics.tokensCacheRead += usage.cache_read_input_tokens;
            metrics.cacheHits++;
          } else if (usage.cache_creation_input_tokens && usage.cache_creation_input_tokens > 0) {
            metrics.tokensCacheWrite += usage.cache_creation_input_tokens;
            metrics.cacheMisses++;
          } else {
            metrics.cacheMisses++;
          }
        }
      }

      // Track tool usage (Claude Code format: assistant messages with tool_use in content)
      if (entry.type === 'assistant' && entry.message?.content) {
        const contentArray = Array.isArray(entry.message.content) ? entry.message.content : [entry.message.content];

        for (const contentItem of contentArray) {
          if (contentItem.type === 'tool_use') {
            const toolName = contentItem.name || 'unknown';
            const toolInput = contentItem.input || {};
            const toolSuccess = true; // Assume success unless we see error in tool_result
            const toolDuration = 0; // Duration not directly available in transcript

            metrics.toolCalls++;

            if (!metrics.toolBreakdown[toolName]) {
              metrics.toolBreakdown[toolName] = { calls: 0, errors: 0, totalDuration: 0 };
            }
            metrics.toolBreakdown[toolName].calls++;
            metrics.toolBreakdown[toolName].totalDuration += toolDuration;

            // Track LOC from Write/Edit tools
            if (toolName === 'Write') {
              const filePath = toolInput.file_path || toolInput.filePath || '';
              if (filePath) {
                filesAffected.add(filePath);
                const content = toolInput.content || '';
                if (typeof content === 'string') {
                  metrics.linesAdded += content.split('\n').length;
                }
                // Check if test file
                if (filePath.includes('test') || filePath.includes('spec') || filePath.includes('__tests__')) {
                  metrics.testsGenerated++;
                }
              }
            }

            if (toolName === 'Edit') {
              const filePath = toolInput.file_path || toolInput.filePath || '';
              if (filePath) {
                filesAffected.add(filePath);
                const oldString = toolInput.old_string || toolInput.oldString || '';
                const newString = toolInput.new_string || toolInput.newString || '';
                if (typeof oldString === 'string' && typeof newString === 'string') {
                  const oldLines = oldString.split('\n').length;
                  const newLines = newString.split('\n').length;

                  if (newLines > oldLines) {
                    metrics.linesAdded += newLines - oldLines;
                  } else if (oldLines > newLines) {
                    metrics.linesDeleted += oldLines - newLines;
                  }
                  metrics.linesModified += Math.min(oldLines, newLines);

                  // Check if test file
                  if (filePath.includes('test') || filePath.includes('spec') || filePath.includes('__tests__')) {
                    metrics.testsGenerated++;
                  }
                }
              }
            }
          }
        }
      }

      // Also check for tool_result entries (errors are tracked here)
      if (entry.type === 'tool_result' && entry.is_error) {
        metrics.toolErrors++;
        // Note: We'd need to track which tool this error belongs to for per-tool error counting
      }
    } catch (err) {
      // Skip malformed JSON lines
      console.warn(`Skipping malformed transcript line: ${line.substring(0, 100)}`);
    }
  }

  metrics.filesModified = Array.from(filesAffected);
  return metrics;
}

// Find most recent transcript file in directory modified after a given time
function findMostRecentTranscript(transcriptDirectory: string, afterTime?: Date): string | null {
  if (!fs.existsSync(transcriptDirectory)) {
    return null;
  }

  const files = fs.readdirSync(transcriptDirectory)
    .filter(f => f.endsWith('.jsonl'))
    .map(f => {
      const filePath = path.join(transcriptDirectory, f);
      const stats = fs.statSync(filePath);
      return { path: filePath, mtime: stats.mtime };
    })
    .filter(f => !afterTime || f.mtime >= afterTime)
    .sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

  return files.length > 0 ? files[0].path : null;
}

// Cleanup transcript after parsing
async function cleanupTranscript(
  transcriptPath: string,
  policy: 'delete' | 'truncate' | 'archive' | 'keep',
  componentRunId: string
): Promise<string> {
  if (!fs.existsSync(transcriptPath)) {
    return 'File not found';
  }

  switch (policy) {
    case 'delete':
      fs.unlinkSync(transcriptPath);
      return 'Deleted transcript file';

    case 'truncate':
      fs.writeFileSync(transcriptPath, '');
      return 'Truncated transcript file';

    case 'archive': {
      const archiveDir = '/tmp/vibestudio-transcript-archives';
      if (!fs.existsSync(archiveDir)) {
        fs.mkdirSync(archiveDir, { recursive: true });
      }
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const archivePath = `${archiveDir}/transcript-${componentRunId}-${timestamp}.jsonl`;
      fs.renameSync(transcriptPath, archivePath);
      return `Archived transcript to ${archivePath}`;
    }

    case 'keep':
    default:
      return 'Kept transcript file unchanged';
  }
}

export async function handler(prisma: PrismaClient, params: any) {
  // Validate required fields
  if (!params.runId) {
    throw new ValidationError('Missing required parameter: runId', {
      expectedState: 'A valid workflow run ID must be provided'
    });
  }
  if (!params.componentId) {
    throw new ValidationError('Missing required parameter: componentId', {
      expectedState: 'A valid component ID must be provided'
    });
  }

  const status = params.status || 'completed';
  if (!['completed', 'failed'].includes(status)) {
    throw new ValidationError('Invalid status value. Status must be either "completed" or "failed"', {
      expectedState: 'Either "completed" or "failed"',
      currentState: status
    });
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
        resourceId: `runId: ${params.runId}, componentId: ${params.componentId}`
      }
    );
  }

  const metrics = params.metrics || {};
  const completedAt = new Date();
  const durationSeconds =
    metrics.durationSeconds || Math.round((completedAt.getTime() - componentRun.startedAt.getTime()) / 1000);

  // Determine data source: transcript file OR OTEL events
  let dataSource: 'transcript' | 'otel' = 'otel';
  let transcriptMetrics: TranscriptMetrics | null = null;
  let cleanupMessage = '';
  let autoDetectedTranscript = false;

  // Auto-detect transcript if not provided
  let transcriptPath = params.transcriptPath;
  if (!transcriptPath) {
    // Get transcript tracking from ComponentRun metadata (internal tracking data)
    const componentMetadata = (componentRun.metadata as Record<string, any>) || {};
    const componentTranscriptTracking = componentMetadata._transcriptTracking;

    if (componentTranscriptTracking?.transcriptDirectory) {
      const transcriptDir = componentTranscriptTracking.transcriptDirectory;
      const existingBefore = componentTranscriptTracking.existingTranscriptsBeforeAgent || [];

      // Find NEW transcripts (created after component start, not in existingBefore list)
      if (fs.existsSync(transcriptDir)) {
        const currentTranscripts = fs.readdirSync(transcriptDir)
          .filter((f: string) => f.endsWith('.jsonl'));

        const newTranscripts = currentTranscripts.filter(
          (f: string) => !existingBefore.includes(f)
        );

        if (newTranscripts.length > 0) {
          // If multiple new transcripts, pick the most recently modified one
          const mostRecent = newTranscripts
            .map((f: string) => ({
              name: f,
              mtime: fs.statSync(path.join(transcriptDir, f)).mtime,
            }))
            .sort((a, b) => b.mtime.getTime() - a.mtime.getTime())[0];

          transcriptPath = path.join(transcriptDir, mostRecent.name);
          autoDetectedTranscript = true;
        } else {
          // No new transcripts - agent might have shared orchestrator's session
          // Fall back to most recently modified transcript
          const detectedPath = findMostRecentTranscript(
            transcriptDir,
            componentRun.startedAt
          );

          if (detectedPath) {
            transcriptPath = detectedPath;
            autoDetectedTranscript = true;
          }
        }
      }
    }
  }

  if (transcriptPath) {
    // Parse transcript file instead of OTEL events
    dataSource = 'transcript';
    transcriptMetrics = await parseTranscript(transcriptPath);

    // Apply cleanup policy after parsing
    const cleanupPolicy = params.cleanupPolicy || 'truncate';
    cleanupMessage = await cleanupTranscript(transcriptPath, cleanupPolicy, componentRun.id);
    if (autoDetectedTranscript) {
      cleanupMessage = `Auto-detected transcript: ${path.basename(transcriptPath)}. ${cleanupMessage}`;
    }
  }

  // AUTO-AGGREGATE METRICS FROM TRANSCRIPT (UC-METRICS-007)
  // Calculate metrics from transcript parsing
  const tokensInput = transcriptMetrics?.tokensInput || 0;
  const tokensOutput = transcriptMetrics?.tokensOutput || 0;
  const cacheHits = transcriptMetrics?.cacheHits || 0;
  const cacheMisses = transcriptMetrics?.cacheMisses || 0;
  const tokensCacheRead = transcriptMetrics?.tokensCacheRead || 0;
  const tokensCacheWrite = transcriptMetrics?.tokensCacheWrite || 0;
  const toolCalls = transcriptMetrics?.toolCalls || 0;
  const toolErrors = transcriptMetrics?.toolErrors || 0;
  // Calculate cost based on Sonnet 4 pricing: $3/M input, $15/M output, $0.30/M cache read
  const totalCostUsd = transcriptMetrics
    ? (tokensInput * 3 / 1000000) + (tokensOutput * 15 / 1000000) + (tokensCacheRead * 0.3 / 1000000)
    : 0;
  const linesAdded = transcriptMetrics?.linesAdded || 0;
  const linesDeleted = transcriptMetrics?.linesDeleted || 0;
  const linesModified = transcriptMetrics?.linesModified || 0;
  const testsGenerated = transcriptMetrics?.testsGenerated || 0;
  const filesAffected = new Set<string>(transcriptMetrics?.filesModified || []);
  const toolBreakdown: Record<string, { calls: number; errors: number; totalDuration: number }> = transcriptMetrics?.toolBreakdown || {};

  const filesModifiedArray = Array.from(filesAffected);
  const filesModifiedCount = filesAffected.size;

  // Calculate derived metrics
  const cacheHitRate = (cacheHits + cacheMisses) > 0 ? cacheHits / (cacheHits + cacheMisses) : 0;
  const errorRate = toolCalls > 0 ? toolErrors / toolCalls : 0;
  const successRate = 1 - errorRate;
  // Include cache_read_input_tokens in total - these are actual input tokens used by the model
  const totalTokens = tokensInput + tokensCacheRead + tokensOutput;
  const tokensPerSecond = durationSeconds > 0 ? totalTokens / durationSeconds : 0;

  // Format tool breakdown with averages
  const formattedToolBreakdown: Record<string, any> = {};
  for (const [toolName, stats] of Object.entries(toolBreakdown)) {
    formattedToolBreakdown[toolName] = {
      calls: stats.calls,
      errors: stats.errors,
      avgDuration: stats.calls > 0 ? stats.totalDuration / stats.calls : 0,
    };
  }

  // Get the component info first
  const componentInfo = await prisma.component.findUnique({
    where: { id: params.componentId },
    select: { name: true },
  });

  // Update ComponentRun record with AUTO-AGGREGATED metrics
  const updatedComponentRun = await prisma.componentRun.update({
    where: { id: componentRun.id },
    data: {
      status,
      outputData: params.output || {},
      // Auto-aggregated from OTEL
      totalTokens: totalTokens || null,
      tokensInput: tokensInput || null,
      tokensOutput: tokensOutput || null,
      tokensCacheRead: tokensCacheRead || null,
      tokensCacheWrite: tokensCacheWrite || null,
      cacheHits: cacheHits || null,
      cacheMisses: cacheMisses || null,
      cacheHitRate: cacheHitRate || null,
      cost: totalCostUsd || null,
      errorRate: errorRate || null,
      successRate: successRate || null,
      toolBreakdown: formattedToolBreakdown,
      tokensPerSecond: tokensPerSecond || null,
      // Code impact metrics (auto-calculated from OTEL)
      linesAdded: linesAdded || null,
      linesDeleted: linesDeleted || null,
      linesModified: linesModified || null,
      filesModified: filesModifiedArray, // Array of file paths modified
      locGenerated: linesAdded + linesModified, // Total LOC generated/modified
      // Metrics from transcript or manual input
      durationSeconds,
      userPrompts: transcriptMetrics?.userPrompts || metrics.userPrompts || 0,
      systemIterations: transcriptMetrics?.systemIterations || metrics.systemIterations || 1,
      humanInterventions: metrics.humanInterventions || 0,
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
    estimatedCost: allComponentRuns.reduce((sum, cr) => sum + Number(cr.cost || 0), 0),
    durationSeconds: allComponentRuns.reduce((sum, cr) => sum + (cr.durationSeconds || 0), 0),
    totalUserPrompts: allComponentRuns.reduce((sum, cr) => sum + (cr.userPrompts || 0), 0),
    totalIterations: allComponentRuns.reduce((sum, cr) => sum + (cr.systemIterations || 0), 0),
    totalInterventions: allComponentRuns.reduce((sum, cr) => sum + (cr.humanInterventions || 0), 0),
    avgPromptsPerComponent: allComponentRuns.length
      ? allComponentRuns.reduce((sum, cr) => sum + (cr.userPrompts || 0), 0) / allComponentRuns.length
      : 0,
  };

  await prisma.workflowRun.update({
    where: { id: params.runId },
    data: {
      totalTokens: aggregatedMetrics.totalTokens || null,
      estimatedCost: aggregatedMetrics.estimatedCost || null,
      durationSeconds: aggregatedMetrics.durationSeconds || null,
      totalUserPrompts: aggregatedMetrics.totalUserPrompts || null,
      totalIterations: aggregatedMetrics.totalIterations || null,
      totalInterventions: aggregatedMetrics.totalInterventions || null,
      avgPromptsPerComponent: aggregatedMetrics.avgPromptsPerComponent || null,
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
    transcriptCleanup: cleanupMessage || null,
    autoAggregatedMetrics: {
      tokensInput,
      tokensOutput,
      totalTokens,
      cacheHits,
      cacheMisses,
      cacheHitRate,
      tokensCacheRead,
      tokensCacheWrite,
      toolCalls,
      toolErrors,
      errorRate,
      successRate,
      totalCostUsd,
      tokensPerSecond,
      toolBreakdown: formattedToolBreakdown,
      // Code impact metrics
      linesAdded,
      linesDeleted,
      linesModified,
      filesModified: filesModifiedCount,
      filesModifiedPaths: filesModifiedArray,
      testsGenerated,
      totalLOC: linesAdded + linesModified,
    },
    metrics: {
      tokensUsed: updatedComponentRun.totalTokens,
      durationSeconds: updatedComponentRun.durationSeconds,
      costUsd: Number(updatedComponentRun.cost),
      linesOfCode: updatedComponentRun.locGenerated,
      userPrompts: updatedComponentRun.userPrompts,
      systemIterations: updatedComponentRun.systemIterations,
      humanInterventions: updatedComponentRun.humanInterventions,
    },
    aggregatedMetrics,
    message: `Component "${componentName}" ${status}. Parsed transcript file. ${cleanupMessage}. Duration: ${durationSeconds}s, Tokens: ${totalTokens}, Cost: $${totalCostUsd.toFixed(4)}, Tools: ${toolCalls}, LOC: ${linesAdded + linesModified}`,
  };
}

