/**
 * Record Agent Start
 *
 * ST-109: Aliased from record_component_start to record_agent_start
 * ST-215: Refactored to use shared agent-tracking module
 *
 * Note: This tool is still available for manual tracking, but advance_step
 * now handles this automatically when transitioning PRE → AGENT phase.
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { PrismaClient } from '@prisma/client';
import { startAgentTracking } from '../../shared/agent-tracking';

// ALIASING: Component → Agent (ST-109)
export const tool: Tool = {
  name: 'record_agent_start',
  description: 'Log agent execution start. Note: advance_step handles this automatically. Use only for manual tracking.',
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
  version: '2.0.0',
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

  // ST-215: Delegate to shared agent-tracking module
  const result = await startAgentTracking(prisma, {
    runId: params.runId,
    componentId: params.componentId,
    input: params.input,
  });

  // If tracking failed, throw an error (this tool expects success)
  if (!result.success) {
    throw new Error(result.error || 'Failed to start agent tracking');
  }

  // Get additional details for response (maintains backward compatibility)
  const componentRun = await prisma.componentRun.findUnique({
    where: { id: result.componentRunId },
  });

  return {
    success: true,
    componentRunId: result.componentRunId,
    runId: params.runId,
    componentId: params.componentId,
    componentName: result.componentName,
    executionOrder: result.executionOrder,
    status: 'running',
    startedAt: componentRun?.startedAt?.toISOString() || new Date().toISOString(),
    // Include warning if there was one (e.g., duplicate detection)
    warning: result.warning,
    message: result.warning
      ? `Component "${result.componentName}" tracking: ${result.warning}`
      : `Component "${result.componentName}" execution started. Component run ID: ${result.componentRunId}.`,
  };
}
