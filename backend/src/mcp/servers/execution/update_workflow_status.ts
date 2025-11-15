import { PrismaClient } from '@prisma/client';
import { Tool } from '@modelcontextprotocol/sdk/types.js';
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
  if (['completed', 'failed', 'cancelled'].includes(params.status)) {
    const componentRuns = await prisma.componentRun.findMany({
      where: {
        workflowRunId: params.runId,
        status: { in: ['completed', 'failed'] },
      },
    });

    const durationMinutes = updatedWorkflowRun.finishedAt
      ? Math.round(
          (updatedWorkflowRun.finishedAt.getTime() - updatedWorkflowRun.startedAt.getTime()) / 60000
        )
      : null;

    finalMetrics = {
      componentsCompleted: componentRuns.filter((cr) => cr.status === 'completed').length,
      componentsFailed: componentRuns.filter((cr) => cr.status === 'failed').length,
      totalComponents: componentRuns.length,
      totalTokens: updatedWorkflowRun.totalTokens,
      totalCost: Number(updatedWorkflowRun.estimatedCost),
      totalDuration: updatedWorkflowRun.durationSeconds,
      durationMinutes,
      totalUserPrompts: updatedWorkflowRun.totalUserPrompts,
      totalIterations: updatedWorkflowRun.totalIterations,
      totalInterventions: updatedWorkflowRun.totalInterventions,
    };
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
    finalMetrics,
    summary: params.summary || null,
    message: `Workflow status updated to "${params.status}". ${params.summary || ''}`,
  };
}
