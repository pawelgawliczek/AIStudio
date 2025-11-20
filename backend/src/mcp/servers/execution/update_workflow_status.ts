import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { PrismaClient } from '@prisma/client';
import { ValidationError, NotFoundError } from '../../types';

export const tool: Tool = {
  name: 'update_workflow_status',
  description: 'Update workflow execution status. Use this to mark workflow as completed, failed, paused, or cancelled.',
  inputSchema: {
    type: 'object',
    properties: {
      runId: {
        type: 'string',
        description: 'Workflow run ID (required)',
      },
      status: {
        type: 'string',
        enum: ['running', 'paused', 'completed', 'failed', 'cancelled'],
        description: 'New workflow status (required)',
      },
      errorMessage: {
        type: 'string',
        description: 'Error message if status is failed',
      },
      summary: {
        type: 'string',
        description: 'Summary of workflow results (recommended for completed status)',
      },
    },
    required: ['runId', 'status'],
  },
};

export const metadata = {
  category: 'execution',
  domain: 'Workflow Execution',
  tags: ['workflow', 'status', 'tracking'],
  version: '1.0.0',
  since: '2025-11-13',
};

// Parse orchestrator transcript for metrics (similar to record_component_complete)
async function parseOrchestratorTranscript(transcriptPath: string, startTime: Date): Promise<{
  tokensInput: number;
  tokensOutput: number;
  tokensCacheRead: number;
  cacheHits: number;
  cacheMisses: number;
  toolCalls: number;
  userPrompts: number;
  systemIterations: number;
}> {
  const metrics = {
    tokensInput: 0,
    tokensOutput: 0,
    tokensCacheRead: 0,
    cacheHits: 0,
    cacheMisses: 0,
    toolCalls: 0,
    userPrompts: 0,
    systemIterations: 0,
  };

  if (!fs.existsSync(transcriptPath)) {
    return metrics;
  }

  const fileStream = fs.createReadStream(transcriptPath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  });

  for await (const line of rl) {
    if (!line.trim()) continue;

    try {
      const entry = JSON.parse(line);
      const entryTime = entry.timestamp ? new Date(entry.timestamp) : null;

      // Only count entries after workflow start
      if (entryTime && entryTime < startTime) continue;

      // Track user messages (prompts)
      if (entry.type === 'human' || entry.type === 'user') {
        metrics.userPrompts++;
      }

      // Track assistant responses (iterations)
      if (entry.type === 'assistant') {
        metrics.systemIterations++;

        const usage = entry.usage || entry.message?.usage;
        if (usage) {
          metrics.tokensInput += usage.input_tokens || 0;
          metrics.tokensOutput += usage.output_tokens || 0;

          if (usage.cache_read_input_tokens && usage.cache_read_input_tokens > 0) {
            metrics.tokensCacheRead += usage.cache_read_input_tokens;
            metrics.cacheHits++;
          } else if (usage.cache_creation_input_tokens && usage.cache_creation_input_tokens > 0) {
            metrics.cacheMisses++;
          } else {
            metrics.cacheMisses++;
          }
        }

        // Count tool calls
        if (entry.message?.content) {
          const contentArray = Array.isArray(entry.message.content) ? entry.message.content : [entry.message.content];
          for (const item of contentArray) {
            if (item.type === 'tool_use') {
              metrics.toolCalls++;
            }
          }
        }
      }
    } catch (err) {
      // Skip malformed lines
    }
  }

  return metrics;
}

// Find most recent transcript in directory
function findMostRecentTranscript(transcriptDirectory: string): string | null {
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
    .sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

  return files.length > 0 ? files[0].path : null;
}

export async function handler(prisma: PrismaClient, params: any) {
  // Validate required fields
  if (!params.runId) {
    throw new ValidationError('Missing required parameter: runId', {
      expectedState: 'A valid workflow run ID must be provided'
    });
  }
  if (!params.status) {
    throw new ValidationError('Missing required parameter: status', {
      expectedState: 'A valid status value must be provided'
    });
  }

  const validStatuses = ['running', 'paused', 'completed', 'failed', 'cancelled'];
  if (!validStatuses.includes(params.status)) {
    throw new ValidationError(`Invalid status value. Status must be one of: ${validStatuses.join(', ')}`, {
      expectedState: 'One of: running, paused, completed, failed, cancelled',
      currentState: params.status || 'none'
    });
  }

  // Get workflow run
  const workflowRun = await prisma.workflowRun.findUnique({
    where: { id: params.runId },
    include: {
      workflow: true,
    },
  });

  if (!workflowRun) {
    throw new NotFoundError('Workflow run', params.runId, {
      searchTool: 'list_workflow_runs',
      createTool: 'start_workflow_run'
    });
  }

  // Prepare update data
  const updateData: any = {
    status: params.status,
    errorMessage: params.errorMessage || null,
  };

  // Set finishedAt for terminal states
  if (['completed', 'failed', 'cancelled'].includes(params.status) && !workflowRun.finishedAt) {
    updateData.finishedAt = new Date();
  }

  // Update workflow run
  const updatedWorkflowRun = await prisma.workflowRun.update({
    where: { id: params.runId },
    data: updateData,
  });

  // Calculate final metrics for completed/failed/cancelled states
  let finalMetrics = null;
  let orchestratorMetrics = null;
  let transcriptParsed = false;
  let orchestratorTranscriptPath: string | null = null;

  if (['completed', 'failed', 'cancelled'].includes(params.status)) {
    // Try to parse orchestrator transcript first (preferred method)
    const workflowMetadata = (workflowRun.metadata as Record<string, any>) || {};
    const transcriptTracking = workflowMetadata._transcriptTracking;

    let orchestratorTokensInput = 0;
    let orchestratorTokensOutput = 0;
    let orchestratorCostUsd = 0;
    let orchestratorToolCalls = 0;
    let orchestratorUserPrompts = 0;
    let orchestratorIterations = 0;

    if (transcriptTracking?.transcriptDirectory) {
      // Use the specific orchestrator transcript recorded at workflow start
      if (transcriptTracking.orchestratorTranscript) {
        orchestratorTranscriptPath = path.join(
          transcriptTracking.transcriptDirectory,
          transcriptTracking.orchestratorTranscript
        );
      } else {
        // Fallback: find most recent transcript
        orchestratorTranscriptPath = findMostRecentTranscript(transcriptTracking.transcriptDirectory);
      }

      if (orchestratorTranscriptPath && fs.existsSync(orchestratorTranscriptPath)) {
        const parsedMetrics = await parseOrchestratorTranscript(
          orchestratorTranscriptPath,
          workflowRun.startedAt
        );

        orchestratorTokensInput = parsedMetrics.tokensInput;
        orchestratorTokensOutput = parsedMetrics.tokensOutput;
        orchestratorToolCalls = parsedMetrics.toolCalls;
        orchestratorUserPrompts = parsedMetrics.userPrompts;
        orchestratorIterations = parsedMetrics.systemIterations;
        orchestratorCostUsd = (orchestratorTokensInput * 3 / 1000000) + (orchestratorTokensOutput * 15 / 1000000) + (parsedMetrics.tokensCacheRead * 0.3 / 1000000);
        transcriptParsed = true;
      }
    }

    orchestratorMetrics = {
      tokensInput: orchestratorTokensInput,
      tokensOutput: orchestratorTokensOutput,
      totalTokens: orchestratorTokensInput + orchestratorTokensOutput,
      costUsd: orchestratorCostUsd,
      toolCalls: orchestratorToolCalls,
      userPrompts: orchestratorUserPrompts,
      iterations: orchestratorIterations,
      dataSource: 'transcript',
      transcriptPath: orchestratorTranscriptPath,
    };

    // ST-57: Find and update orchestrator ComponentRun (executionOrder=0)
    const orchestratorComponentRun = await prisma.componentRun.findFirst({
      where: {
        workflowRunId: params.runId,
        executionOrder: 0,
      },
    });

    if (orchestratorComponentRun) {
      // Update orchestrator ComponentRun with parsed metrics
      await prisma.componentRun.update({
        where: { id: orchestratorComponentRun.id },
        data: {
          status: params.status === 'completed' ? 'completed' : 'failed',
          success: params.status === 'completed',
          finishedAt: new Date(),
          durationSeconds: Math.round(
            (new Date().getTime() - orchestratorComponentRun.startedAt.getTime()) / 1000
          ),
          // Token metrics
          tokensInput: orchestratorMetrics.tokensInput,
          tokensOutput: orchestratorMetrics.tokensOutput,
          totalTokens: orchestratorMetrics.totalTokens,
          // Cost (note: field is 'cost', not 'costUsd' per architect analysis)
          cost: orchestratorMetrics.costUsd,
          // Decision-making metrics
          toolCalls: orchestratorMetrics.toolCalls, // ST-57: New field
          userPrompts: orchestratorMetrics.userPrompts,
          systemIterations: orchestratorMetrics.iterations,
          // Metadata
          metadata: {
            ...(typeof orchestratorComponentRun.metadata === 'object' && orchestratorComponentRun.metadata !== null
              ? orchestratorComponentRun.metadata
              : {}),
            parsedAt: new Date().toISOString(),
            dataSource: orchestratorMetrics.dataSource,
            transcriptPath: orchestratorMetrics.transcriptPath,
          },
        },
      });
    }

    // ST-57: Get ALL component metrics (including orchestrator with executionOrder=0)
    const allComponentRuns = await prisma.componentRun.findMany({
      where: {
        workflowRunId: params.runId,
        status: { in: ['completed', 'failed'] },
      },
    });

    // Separate orchestrator from regular components for reporting
    const orchestratorRun = allComponentRuns.find(cr => cr.executionOrder === 0);
    const regularComponentRuns = allComponentRuns.filter(cr => cr.executionOrder !== 0);

    const durationMinutes = updatedWorkflowRun.finishedAt
      ? Math.round(
          (updatedWorkflowRun.finishedAt.getTime() - updatedWorkflowRun.startedAt.getTime()) / 60000
        )
      : null;

    // ST-57: Calculate totals from ALL ComponentRuns (unified approach)
    const totalTokensFromComponents = allComponentRuns.reduce((sum, cr) => sum + (cr.totalTokens || 0), 0);
    const totalCostFromComponents = allComponentRuns.reduce((sum, cr) => sum + Number(cr.cost || 0), 0);

    // For backward compatibility reporting, separate orchestrator from agents
    const agentTokens = regularComponentRuns.reduce((sum, cr) => sum + (cr.totalTokens || 0), 0);
    const agentCost = regularComponentRuns.reduce((sum, cr) => sum + Number(cr.cost || 0), 0);

    finalMetrics = {
      componentsCompleted: regularComponentRuns.filter((cr) => cr.status === 'completed').length,
      componentsFailed: regularComponentRuns.filter((cr) => cr.status === 'failed').length,
      totalComponents: regularComponentRuns.length,
      // Orchestrator metrics (from ComponentRun now, not JSONB)
      orchestratorTokens: orchestratorRun?.totalTokens || orchestratorMetrics.totalTokens,
      orchestratorCost: orchestratorRun?.cost || orchestratorMetrics.costUsd,
      // Agent metrics (regular components)
      agentTokens,
      agentCost,
      // Total workflow metrics (orchestrator + agents) - now unified
      totalTokens: totalTokensFromComponents,
      totalCost: totalCostFromComponents,
      totalDuration: updatedWorkflowRun.durationSeconds,
      durationMinutes,
      totalUserPrompts: updatedWorkflowRun.totalUserPrompts,
      totalIterations: updatedWorkflowRun.totalIterations,
      totalInterventions: updatedWorkflowRun.totalInterventions,
    };

    // ST-57: Update WorkflowRun with aggregated metrics from ALL ComponentRuns
    // Clean metadata by removing internal tracking data
    const cleanMetadata = { ...workflowMetadata };
    delete cleanMetadata._transcriptTracking; // Remove internal tracking from display

    await prisma.workflowRun.update({
      where: { id: params.runId },
      data: {
        // ST-57: Aggregated workflow metrics from ALL ComponentRuns (unified tracking)
        totalTokensInput: allComponentRuns.reduce((sum, cr) => sum + (cr.tokensInput || 0), 0),
        totalTokensOutput: allComponentRuns.reduce((sum, cr) => sum + (cr.tokensOutput || 0), 0),
        totalTokens: finalMetrics.totalTokens,
        estimatedCost: finalMetrics.totalCost,
        // ST-17 BACKWARD COMPATIBILITY: Keep coordinatorMetrics JSONB for now
        // (Will be removed in future migration after frontend is updated)
        coordinatorMetrics: {
          tokensInput: orchestratorMetrics.tokensInput,
          tokensOutput: orchestratorMetrics.tokensOutput,
          totalTokens: orchestratorMetrics.totalTokens,
          costUsd: orchestratorMetrics.costUsd,
          toolCalls: orchestratorMetrics.toolCalls,
          userPrompts: orchestratorMetrics.userPrompts,
          iterations: orchestratorMetrics.iterations,
          dataSource: orchestratorMetrics.dataSource,
          transcriptPath: orchestratorMetrics.transcriptPath,
        },
        // Metadata for debugging
        metadata: {
          ...cleanMetadata,
          orchestratorMetrics: {
            tokensInput: orchestratorMetrics.tokensInput,
            tokensOutput: orchestratorMetrics.tokensOutput,
            totalTokens: orchestratorMetrics.totalTokens,
            costUsd: orchestratorMetrics.costUsd,
            toolCalls: orchestratorMetrics.toolCalls,
            userPrompts: orchestratorMetrics.userPrompts,
            iterations: orchestratorMetrics.iterations,
          },
          agentMetrics: {
            totalTokens: agentTokens,
            totalCost: agentCost,
            componentsCompleted: finalMetrics.componentsCompleted,
            componentsFailed: finalMetrics.componentsFailed,
          },
        },
      },
    });
  }

  return {
    success: true,
    runId: updatedWorkflowRun.id,
    workflowId: updatedWorkflowRun.workflowId,
    workflowName: workflowRun.workflow.name,
    status: updatedWorkflowRun.status,
    startedAt: updatedWorkflowRun.startedAt.toISOString(),
    completedAt: updatedWorkflowRun.finishedAt?.toISOString(),
    errorMessage: updatedWorkflowRun.errorMessage,
    orchestratorMetrics,
    finalMetrics,
    summary: params.summary || null,
    message: `Workflow status updated to "${params.status}". ${orchestratorMetrics ? `Parsed orchestrator transcript: ${orchestratorMetrics.totalTokens} tokens, $${orchestratorMetrics.costUsd.toFixed(4)} cost.` : ''} ${params.summary || ''}`,
  };
}

