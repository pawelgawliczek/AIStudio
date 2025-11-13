/**
 * Tool Registry - Central registry for tool discovery, registration, and execution (Sprint 4.5)
 *
 * Provides a unified interface for:
 * - Tool discovery from filesystem
 * - Progressive disclosure (search with detail levels)
 * - Tool execution
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { PrismaClient } from '@prisma/client';
import { ToolLoader, ToolModule } from './loader.js';

export class ToolRegistry {
  private loader: ToolLoader;
  private prisma: PrismaClient;

  constructor(serversPath: string, prisma: PrismaClient) {
    this.loader = new ToolLoader(serversPath);
    this.prisma = prisma;
  }

  /**
   * Discover all available tools
   */
  async discoverTools(category: string = 'all'): Promise<ToolModule[]> {
    return this.loader.discoverTools(category);
  }

  /**
   * Get tool definitions for ListToolsRequest
   * Now returns minimal set by default (only meta tools)
   */
  async listTools(category?: string): Promise<Tool[]> {
    const modules = await this.loader.discoverTools(category || 'all');
    return modules.map((m) => m.tool);
  }

  /**
   * Execute a tool by name
   */
  async executeTool(name: string, params: any): Promise<any> {
    const toolModule = await this.loader.getToolByName(name);

    if (!toolModule) {
      throw new Error(`Tool not found: ${name}`);
    }

    // Execute handler with prisma client
    return toolModule.handler(this.prisma, params);
  }

  /**
   * Search tools with progressive disclosure
   */
  async searchTools(
    query: string,
    category: string,
    detailLevel: string
  ): Promise<any> {
    console.error(`📊 searchTools: discovering tools for category="${category}"`);
    let tools = await this.discoverTools(category);
    console.error(`📊 searchTools: found ${tools.length} tools`);

    // Filter by query
    if (query) {
      const queryLower = query.toLowerCase();
      tools = tools.filter(
        (t) =>
          t.tool.name.toLowerCase().includes(queryLower) ||
          t.tool.description?.toLowerCase().includes(queryLower) ||
          t.metadata?.tags?.some((tag) => tag.toLowerCase().includes(queryLower))
      );
      console.error(`📊 searchTools: after query filter, ${tools.length} tools remain`);
    }

    console.error(`📊 searchTools: formatting with detail_level="${detailLevel}"`);

    // Return based on detail level
    switch (detailLevel) {
      case 'names_only':
        return {
          tools: tools.map((t) => t.tool.name),
          total: tools.length,
          detail_level: 'names_only',
        };

      case 'with_descriptions':
        return {
          tools: tools.map((t) => ({
            name: t.tool.name,
            description: t.tool.description,
            category: t.metadata?.category,
          })),
          total: tools.length,
          detail_level: 'with_descriptions',
        };

      case 'full_schema':
        return {
          tools: tools.map((t) => ({
            name: t.tool.name,
            description: t.tool.description,
            category: t.metadata?.category,
            inputSchema: t.tool.inputSchema,
            metadata: t.metadata,
          })),
          total: tools.length,
          detail_level: 'full_schema',
        };

      default:
        throw new Error(`Invalid detail_level: ${detailLevel}`);
    }
  }
}
