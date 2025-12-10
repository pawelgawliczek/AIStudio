/**
 * Context Tools Module
 *
 * ST-187: MCP Tool Optimization & Step Commands
 *
 * Provides tools for managing session context, eliminating the need to pass
 * common parameters (like projectId) to every tool call.
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { PrismaClient } from '@prisma/client';

// Import tools
import * as getContextTool from './get_context';
import * as setContextTool from './set_context';

// Tool registry
const toolModules = [
  setContextTool,
  getContextTool,
];

/**
 * Get all tool definitions for this module
 */
export function getTools(): Tool[] {
  return toolModules.map((module) => module.tool);
}

/**
 * Get all tool handlers for this module
 */
export function getHandlers(): Record<string, (prisma: PrismaClient, params: any) => Promise<any>> {
  const handlers: Record<string, (prisma: PrismaClient, params: any) => Promise<any>> = {};

  for (const module of toolModules) {
    handlers[module.tool.name] = module.handler;
  }

  return handlers;
}

/**
 * Get tool metadata for all tools in this module
 */
export function getMetadata(): Record<string, any> {
  const metadata: Record<string, any> = {};

  for (const module of toolModules) {
    if ('metadata' in module) {
      metadata[module.tool.name] = (module as any).metadata;
    }
  }

  return metadata;
}

// Export individual tools for direct access
export { setContextTool, getContextTool };
