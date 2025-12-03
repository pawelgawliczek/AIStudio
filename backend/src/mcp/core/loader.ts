/**
 * Tool Loader - Dynamic tool loading from filesystem (Sprint 4.5)
 *
 * Implements progressive disclosure pattern by loading tool definitions
 * and handlers on-demand instead of static imports.
 */

import fs from 'fs/promises';
import path from 'path';
import { Tool } from '@modelcontextprotocol/sdk/types.js';

export interface ToolModule {
  tool: Tool;
  handler: Function;
  metadata?: {
    category: string;
    domain: string;
    tags: string[];
    version: string;
    since: string;
    updated?: string;
  };
}

export class ToolLoader {
  private cache: Map<string, ToolModule> = new Map();
  private serversPath: string;

  constructor(serversPath: string) {
    this.serversPath = serversPath;
  }

  /**
   * Discover all tool files in the servers/ directory
   */
  async discoverTools(category: string = 'all'): Promise<ToolModule[]> {
    const tools: ToolModule[] = [];
    const categoriesPath = this.serversPath;

    try {
      // Get category directories
      const categories =
        category === 'all'
          ? await fs.readdir(categoriesPath)
          : [category];

      for (const cat of categories) {
        const categoryPath = path.join(categoriesPath, cat);
        const stat = await fs.stat(categoryPath).catch(() => null);

        if (!stat?.isDirectory()) continue;

        // Get all .ts and .js files except index and spec files
        const files = await fs.readdir(categoryPath);
        const toolFiles = files.filter(
          (f) =>
            (f.endsWith('.ts') || f.endsWith('.js')) &&
            !f.startsWith('index') &&
            !f.includes('.spec.') &&
            !f.includes('.test.')
        );

        // Load each tool module
        for (const file of toolFiles) {
          const toolPath = path.join(categoryPath, file);
          const module = await this.loadToolModule(toolPath);
          if (module) {
            tools.push(module);
            // Check if alias tool was also cached
            const modulePath = toolPath.replace(/\.ts$/, '.js');
            const rawModule = require(modulePath);
            if (rawModule.aliasTool) {
              const aliasPath = `${toolPath}#${rawModule.aliasTool.name}`;
              const aliasModule = this.cache.get(aliasPath);
              if (aliasModule) {
                tools.push(aliasModule);
              }
            }
          }
        }
      }

      return tools;
    } catch (error) {
      console.error('Error discovering tools:', error);
      return [];
    }
  }

  /**
   * Load a single tool module from file path
   * Uses require() for CommonJS compatibility in Docker/production
   */
  async loadToolModule(filePath: string): Promise<ToolModule | null> {
    // Check cache first
    if (this.cache.has(filePath)) {
      return this.cache.get(filePath)!;
    }

    try {
      // Use require() for CommonJS compatibility
      // Clear require cache to ensure fresh load in development
      const modulePath = filePath.replace(/\.ts$/, '.js');
      delete require.cache[require.resolve(modulePath)];
      const module = require(modulePath);

      if (!module.tool || !module.handler) {
        console.warn(`Invalid tool module (missing tool or handler): ${filePath}`);
        return null;
      }

      const toolModule: ToolModule = {
        tool: module.tool,
        handler: module.handler,
        metadata: module.metadata,
      };

      // Cache for future use
      this.cache.set(filePath, toolModule);

      // Also cache alias tool if present (uses same handler)
      if (module.aliasTool) {
        const aliasModule: ToolModule = {
          tool: module.aliasTool,
          handler: module.handler,
          metadata: module.metadata,
        };
        const aliasPath = `${filePath}#${module.aliasTool.name}`;
        this.cache.set(aliasPath, aliasModule);
      }

      return toolModule;
    } catch (error) {
      console.error(`Failed to load tool module ${filePath}:`, error);
      return null;
    }
  }

  /**
   * Get a specific tool by name
   */
  async getToolByName(name: string): Promise<ToolModule | null> {
    const allTools = await this.discoverTools();
    return allTools.find((t) => t.tool.name === name) || null;
  }

  /**
   * Clear cache (useful for testing)
   */
  clearCache(): void {
    this.cache.clear();
  }
}
