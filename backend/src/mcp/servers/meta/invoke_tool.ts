/**
 * MCP Meta-Tool: invoke_tool
 *
 * Enables dynamic tool invocation for tools not in the core profile.
 * Use search_tools to discover tools, then invoke_tool to execute them.
 *
 * Part of MCP Context Optimization (ST-197):
 * - Core profile loads ~28 frequently-used tools
 * - invoke_tool provides access to remaining ~125 tools on-demand
 * - Combined with search_tools for progressive tool discovery
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { ToolRegistry } from '../../core/registry.js';

export const tool: Tool = {
  name: 'invoke_tool',
  description:
    'Execute any MCP tool by name. Use search_tools to discover available tools and their parameters first.',
  inputSchema: {
    type: 'object',
    properties: {
      toolName: {
        type: 'string',
        description: 'Name of the tool to invoke (e.g., "deploy_to_production", "run_backup")',
      },
      params: {
        type: 'object',
        description:
          'Tool parameters as JSON object. Use search_tools with detail_level="full_schema" to see required parameters.',
        additionalProperties: true,
      },
    },
    required: ['toolName'],
  },
};

export const metadata = {
  category: 'meta',
  domain: 'Tool Discovery',
  tags: ['meta', 'invoke', 'dynamic', 'tools'],
  version: '1.0.0',
  since: '2025-12-13',
};

/**
 * Handler for invoke_tool
 *
 * Unlike other tools that receive PrismaClient, this receives ToolRegistry
 * to enable dynamic tool execution.
 *
 * @param registry - ToolRegistry instance for tool lookup and execution
 * @param params - { toolName: string, params?: object }
 */
export async function handler(
  registry: ToolRegistry,
  params: { toolName: string; params?: Record<string, unknown> }
): Promise<unknown> {
  const { toolName, params: toolParams } = params;

  if (!toolName) {
    throw new Error('toolName is required');
  }

  // Prevent recursive calls to invoke_tool
  if (toolName === 'invoke_tool') {
    throw new Error('Cannot recursively invoke invoke_tool');
  }

  console.error(`[invoke_tool] Executing tool: ${toolName}`);

  try {
    // Execute the tool via registry (handles Prisma injection)
    const result = await registry.executeTool(toolName, toolParams || {});
    return result;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);

    // Provide helpful error for unknown tools
    if (message.includes('not found')) {
      throw new Error(
        `Tool "${toolName}" not found. Use search_tools({ query: "${toolName}" }) to find available tools.`
      );
    }

    throw error;
  }
}
