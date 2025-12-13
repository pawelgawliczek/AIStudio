/**
 * Tool Registry - Central registry for tool discovery, registration, and execution (Sprint 4.5)
 *
 * Provides a unified interface for:
 * - Tool discovery from filesystem
 * - Progressive disclosure (search with detail levels)
 * - Tool execution
 * - Profile-based tool filtering (ST-197)
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { PrismaClient } from '@prisma/client';
import { ToolLoader, ToolModule } from './loader.js';
import { getActiveProfile, isToolInProfile, ProfileName } from './profiles.js';

export class ToolRegistry {
  private loader: ToolLoader;
  private prisma: PrismaClient;

  constructor(serversPath: string, prisma: PrismaClient) {
    this.loader = new ToolLoader(serversPath);
    this.prisma = prisma;
  }

  /**
   * Discover all available tools (ignores profile filtering)
   * Used internally for search_tools and invoke_tool
   */
  async discoverTools(category: string = 'all'): Promise<ToolModule[]> {
    return this.loader.discoverTools(category);
  }

  /**
   * Get tool definitions for ListToolsRequest
   *
   * ST-197: Now supports profile-based filtering
   * - MCP_PROFILE=core (default): Returns ~28 frequently-used tools
   * - MCP_PROFILE=full: Returns all ~153 tools
   *
   * Tools not in profile can still be called via invoke_tool
   */
  async listTools(category?: string): Promise<Tool[]> {
    const modules = await this.loader.discoverTools(category || 'all');
    const profile = getActiveProfile();

    // Full profile returns all tools
    if (profile === 'full') {
      return modules.map((m) => m.tool);
    }

    // Core profile filters to frequently-used tools
    return modules.filter((m) => isToolInProfile(m.tool.name, profile)).map((m) => m.tool);
  }

  /**
   * Get the current active profile name
   */
  getActiveProfile(): ProfileName {
    return getActiveProfile();
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
