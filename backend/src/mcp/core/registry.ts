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
import { TelemetryService } from '../../telemetry/telemetry.service.js';
import { resolveStory, isUUID } from '../shared/resolve-identifiers.js';
import { ToolLoader, ToolModule } from './loader.js';
import { getActiveProfile, isToolInProfile, ProfileName } from './profiles.js';

export class ToolRegistry {
  private loader: ToolLoader;
  private prisma: PrismaClient;

  constructor(
    serversPath: string,
    prisma: PrismaClient,
    private readonly telemetry: TelemetryService
  ) {
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
   *
   * ST-197: Meta tools (search_tools, invoke_tool) receive ToolRegistry
   * instead of PrismaClient for special handling
   * ST-259: Wrapped with telemetry.withSpan() for distributed tracing
   */
  async executeTool(name: string, params: any): Promise<any> {
    return this.telemetry.withSpan(
      `mcp.${name}`,
      async (span) => {
        const startTime = Date.now();

        // ST-262: Extract story context for trace propagation
        const storyContext = await this.extractStoryContext(params);

        // Add span attributes
        span.setAttributes({
          'tool.name': name,
          'tool.category': await this.getToolCategory(name),
          'operation.type': 'mcp_tool',
          ...storyContext,  // Add story.id and story.key if available
        });

        try {
          const toolModule = await this.loader.getToolByName(name);
          if (!toolModule) {
            throw new Error(`Tool not found: ${name}`);
          }

          // Meta tools need registry access
          let result: any;
          if (name === 'search_tools' || name === 'invoke_tool') {
            // ST-259: Add invoked tool name for better error investigation
            if (name === 'invoke_tool' && params?.toolName) {
              span.setAttribute('mcp.invoked_tool', params.toolName);
            }
            result = await toolModule.handler(this, params);
          } else {
            result = await toolModule.handler(this.prisma, params);
          }

          const durationMs = Date.now() - startTime;
          span.setAttribute('duration_ms', durationMs);

          return result;
        } catch (error) {
          const durationMs = Date.now() - startTime;
          span.setAttribute('duration_ms', durationMs);
          span.setAttribute('error', true);
          throw error;
        }
      },
      { 'tool.name': name, 'operation.type': 'mcp_tool' }
    );
  }

  /**
   * Get tool category for a given tool name
   * Used for telemetry attributes
   */
  private async getToolCategory(name: string): Promise<string> {
    try {
      const toolModule = await this.loader.getToolByName(name);
      return toolModule?.metadata?.category || 'unknown';
    } catch {
      return 'unknown';
    }
  }

  /**
   * Extract story context from MCP tool parameters for tracing
   * ST-262: Enables story-level trace propagation
   */
  private async extractStoryContext(
    params: Record<string, any>
  ): Promise<{ 'story.id'?: string; 'story.key'?: string }> {
    if (!params || typeof params !== 'object') {
      return {};
    }

    try {
      // Pattern 1 (Highest Priority): runId or workflowRunId -> resolve to story
      const runIdParam = params.runId || params.workflowRunId;
      if (runIdParam) {
        if (!isUUID(runIdParam)) {
          console.warn(`[extractStoryContext] Invalid runId format: ${runIdParam}`);
          return {};
        }
        const run = await this.prisma.workflowRun.findUnique({
          where: { id: runIdParam },
          select: {
            storyId: true,
            story: { select: { id: true, key: true } },
          },
        });
        if (!run) {
          console.warn(`[extractStoryContext] WorkflowRun not found: ${runIdParam}`);
          return {};
        }
        if (!run.story) {
          console.warn(
            `[extractStoryContext] WorkflowRun has no associated story: ${runIdParam}`
          );
          return {};
        }
        return { 'story.id': run.story.id, 'story.key': run.story.key };
      }

      // Pattern 2: Direct storyId UUID
      if ('storyId' in params && params.storyId != null) {
        if (!isUUID(params.storyId)) {
          console.warn(`[extractStoryContext] Invalid storyId format: ${params.storyId}`);
          return {};
        }
        const story = await this.prisma.story.findUnique({
          where: { id: params.storyId },
          select: { id: true, key: true },
        });
        if (!story) {
          console.warn(`[extractStoryContext] Story not found: ${params.storyId}`);
          return {};
        }
        return { 'story.id': story.id, 'story.key': story.key };
      }

      // Pattern 3 (Lowest Priority): story parameter (ST-XXX key or UUID)
      if (params.story) {
        const story = await resolveStory(this.prisma, params.story);
        if (!story) {
          console.warn(`[extractStoryContext] Story not found: ${params.story}`);
          return {};
        }
        return { 'story.id': story.id, 'story.key': story.key };
      }

      return {};
    } catch (error) {
      console.warn(
        `[extractStoryContext] Error extracting story context`,
        error
      );
      return {};
    }
  }

  /**
   * Search tools with progressive disclosure
   *
   * ST-197: Only returns tools NOT in core profile (core tools already loaded).
   * This prevents context bloat when search_tools is called.
   */
  async searchTools(
    query: string,
    category: string,
    detailLevel: string
  ): Promise<any> {
    console.error(`📊 searchTools: discovering tools for category="${category}"`);
    let tools = await this.discoverTools(category);
    console.error(`📊 searchTools: found ${tools.length} total tools`);

    // ST-197: Exclude core profile tools - they're already loaded via listTools()
    const profile = getActiveProfile();
    if (profile === 'core') {
      const beforeCount = tools.length;
      tools = tools.filter((t) => !isToolInProfile(t.tool.name, 'core'));
      console.error(`📊 searchTools: excluded ${beforeCount - tools.length} core tools, ${tools.length} remain`);
    }

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
          note: profile === 'core' ? 'Excludes 28 core tools (already loaded). Use invoke_tool to call these.' : undefined,
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
          note: profile === 'core' ? 'Excludes 28 core tools (already loaded). Use invoke_tool to call these.' : undefined,
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
          note: profile === 'core' ? 'Excludes 28 core tools (already loaded). Use invoke_tool to call these.' : undefined,
        };

      default:
        throw new Error(`Invalid detail_level: ${detailLevel}`);
    }
  }
}
