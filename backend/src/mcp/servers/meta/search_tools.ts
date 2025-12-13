/**
 * Progressive Disclosure Tool - search_tools (Sprint 4.5)
 *
 * Allows agents to discover tools progressively with three detail levels:
 * - names_only: Returns just tool names (~100 bytes)
 * - with_descriptions: Returns names + descriptions (~500 bytes)
 * - full_schema: Returns complete tool definitions (~1KB per tool)
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { ToolRegistry } from '../../core/registry.js';

export const tool: Tool = {
  name: 'search_tools',
  description: 'Discover MCP tools by query/category. Returns non-core tools only (core already loaded).',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Optional keyword search (searches name, description, tags)',
      },
      category: {
        type: 'string',
        enum: ['projects', 'epics', 'stories', 'meta', 'all'],
        description: 'Filter by tool category',
      },
      detail_level: {
        type: 'string',
        enum: ['names_only', 'with_descriptions', 'full_schema'],
        default: 'names_only',
        description: 'Level of detail to return',
      },
    },
  },
};

export const metadata = {
  category: 'meta',
  domain: 'tool_discovery',
  tags: ['meta', 'search', 'discovery', 'progressive-disclosure'],
  version: '1.0.0',
  since: 'sprint-4.5',
};

export async function handler(
  registry: ToolRegistry,
  params: {
    query?: string;
    category?: string;
    detail_level?: string;
  }
): Promise<any> {
  const query = params.query || '';
  const category = params.category || 'all';
  const detailLevel = params.detail_level || 'names_only';

  console.error(`🔍 search_tools called: query="${query}", category="${category}", detail_level="${detailLevel}"`);

  const result = await registry.searchTools(query, category, detailLevel);

  console.error(`✅ search_tools returning ${result.total} tools`);

  return result;
}
