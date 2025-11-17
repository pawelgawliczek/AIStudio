/**
 * Get Agent Interaction History Tool
 * Retrieve detailed interaction history including prompts, tool calls, and responses
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { PrismaClient } from '@prisma/client';

export const tool: Tool = {
  name: 'get_agent_interaction_history',
  description:
    'Retrieve detailed agent interaction history for a component run, including tool calls, prompts, and responses. Uses OtelEvents for granular tracking.',
  inputSchema: {
    type: 'object',
    properties: {
      componentRunId: {
        type: 'string',
        description: 'Component run ID to get interaction history for',
      },
      workflowRunId: {
        type: 'string',
        description: 'Workflow run ID to get all interactions for',
      },
      includeToolParameters: {
        type: 'boolean',
        description: 'Include tool input parameters (default: true)',
      },
      includeMetadata: {
        type: 'boolean',
        description: 'Include full event metadata (default: false)',
      },
      limit: {
        type: 'number',
        description: 'Maximum number of events to return (default: 100)',
      },
    },
    required: [],
  },
};

export const metadata = {
  category: 'metrics',
  domain: 'Agent Performance',
  tags: ['interaction', 'history', 'prompts', 'tools', 'conversation'],
  version: '1.0.0',
  since: '2025-11-17',
};

export async function handler(prisma: PrismaClient, params: any) {
  if (!params.componentRunId && !params.workflowRunId) {
    throw new Error('Either componentRunId or workflowRunId is required');
  }

  const includeToolParameters = params.includeToolParameters !== false;
  const includeMetadata = params.includeMetadata === true;
  const limit = Math.min(params.limit || 100, 500);

  // Build query based on provided ID
  const whereClause: any = {};
  if (params.componentRunId) {
    whereClause.componentRunId = params.componentRunId;
  } else if (params.workflowRunId) {
    whereClause.workflowRunId = params.workflowRunId;
  }

  // Fetch OTEL events
  const events = await prisma.otelEvent.findMany({
    where: whereClause,
    orderBy: { timestamp: 'asc' },
    take: limit,
    include: {
      componentRun: {
        select: {
          id: true,
          component: {
            select: {
              name: true,
            },
          },
          iterationLog: true,
        },
      },
    },
  });

  // Group events by type
  const apiRequests: any[] = [];
  const toolCalls: any[] = [];
  const otherEvents: any[] = [];

  for (const event of events) {
    const baseEvent: any = {
      eventId: event.id,
      timestamp: event.timestamp.toISOString(),
      eventType: event.eventType,
      eventName: event.eventName,
      sessionId: event.sessionId,
      componentName: event.componentRun?.component?.name,
    };

    if (event.eventType === 'claude_code.api_request') {
      const apiEvent = {
        ...baseEvent,
        tokens: event.metadata as any,
      };
      if (includeMetadata) {
        apiEvent.fullMetadata = event.metadata;
        apiEvent.attributes = event.attributes;
      }
      apiRequests.push(apiEvent);
    } else if (
      event.eventType === 'claude_code.tool_use' ||
      event.toolName
    ) {
      const toolEvent: any = {
        ...baseEvent,
        toolName: event.toolName,
        duration: event.toolDuration,
        success: event.toolSuccess,
        error: event.toolError,
      };
      if (includeToolParameters) {
        toolEvent.parameters = event.toolParameters;
      }
      if (includeMetadata) {
        toolEvent.fullMetadata = event.metadata;
      }
      toolCalls.push(toolEvent);
    } else {
      const otherEvent = { ...baseEvent };
      if (includeMetadata) {
        otherEvent.metadata = event.metadata;
        otherEvent.attributes = event.attributes;
      }
      otherEvents.push(otherEvent);
    }
  }

  // Get iteration log if available (contains prompt summaries)
  let iterationHistory: any[] = [];
  if (params.componentRunId) {
    const componentRun = await prisma.componentRun.findUnique({
      where: { id: params.componentRunId },
      select: {
        iterationLog: true,
        userPrompts: true,
        systemIterations: true,
        humanInterventions: true,
      },
    });

    if (componentRun?.iterationLog) {
      iterationHistory = componentRun.iterationLog as any[];
    }
  }

  // Calculate interaction statistics
  const stats = {
    totalEvents: events.length,
    apiRequests: apiRequests.length,
    toolCalls: toolCalls.length,
    otherEvents: otherEvents.length,
    uniqueTools: [...new Set(toolCalls.map((t) => t.toolName))],
    toolSuccessRate:
      toolCalls.length > 0
        ? toolCalls.filter((t) => t.success).length / toolCalls.length
        : 1.0,
    avgToolDuration:
      toolCalls.length > 0
        ? toolCalls.reduce((sum, t) => sum + (t.duration || 0), 0) / toolCalls.length
        : 0,
    timespan:
      events.length > 0
        ? {
            first: events[0].timestamp.toISOString(),
            last: events[events.length - 1].timestamp.toISOString(),
            durationMs:
              events[events.length - 1].timestamp.getTime() - events[0].timestamp.getTime(),
          }
        : null,
  };

  return {
    componentRunId: params.componentRunId,
    workflowRunId: params.workflowRunId,
    statistics: stats,
    iterationHistory,
    interactions: {
      apiRequests,
      toolCalls,
      otherEvents,
    },
    summary: generateInteractionSummary(apiRequests, toolCalls),
  };
}

function generateInteractionSummary(
  apiRequests: any[],
  toolCalls: any[],
): string {
  const toolGroups: Record<string, number> = {};
  for (const call of toolCalls) {
    toolGroups[call.toolName] = (toolGroups[call.toolName] || 0) + 1;
  }

  const sortedTools = Object.entries(toolGroups)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  let summary = `Agent made ${apiRequests.length} API requests and ${toolCalls.length} tool calls. `;

  if (sortedTools.length > 0) {
    summary += `Most used tools: ${sortedTools.map(([name, count]) => `${name} (${count})`).join(', ')}.`;
  }

  const failedTools = toolCalls.filter((t) => !t.success);
  if (failedTools.length > 0) {
    summary += ` ${failedTools.length} tool calls failed.`;
  }

  return summary;
}
