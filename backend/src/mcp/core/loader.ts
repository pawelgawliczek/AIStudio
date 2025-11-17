/**
 * Tool Loader - Dynamic tool loading from filesystem (Sprint 4.5)
 *
 * Implements progressive disclosure pattern by loading tool definitions
 * and handlers on-demand instead of static imports.
 */

import fs from 'fs/promises';
import path from 'path';
import { pathToFileURL } from 'url';
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

        // Get all .ts and .js files except index files
        const files = await fs.readdir(categoryPath);
        const toolFiles = files.filter(
          (f) => (f.endsWith('.ts') || f.endsWith('.js')) && !f.startsWith('index')
        );

        // Load each tool module
        for (const file of toolFiles) {
          const toolPath = path.join(categoryPath, file);
          const module = await this.loadToolModule(toolPath);
          if (module) {
            tools.push(module);
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
   */
  async loadToolModule(filePath: string): Promise<ToolModule | null> {
    // Check cache first
    if (this.cache.has(filePath)) {
      return this.cache.get(filePath)!;
    }

    try {
      const fileUrl = pathToFileURL(filePath).href;
      const module = await import(fileUrl);

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
