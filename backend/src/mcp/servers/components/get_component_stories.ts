/**
 * Get Component Stories Tool
 * Get all stories related to a component
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { PrismaClient } from '@prisma/client';
import { getComponentStories } from '../../tools/component.tools';
import { GetComponentStoriesParams } from '../../types';

export const tool: Tool = {
  name: 'get_component_stories',
  description:
    'Get all stories that are associated with a component. Useful for understanding the impact ' +
    'and development activity within a specific business domain.',
  inputSchema: {
    type: 'object',
    properties: {
      componentId: {
        type: 'string',
        description: 'Component ID (UUID)',
      },
    },
    required: ['componentId'],
  },
};

export const metadata = {
  category: 'components',
  domain: 'project_management',
  tags: ['component', 'stories', 'impact', 'tracking'],
  version: '1.0.0',
  since: 'sprint-5',
  aiHints: [
    'Use this when you need to see all development work for a business domain',
    'Returns stories with their status, type, epic, and assignee',
    'Helpful for understanding component activity and planning',
  ],
};

export async function handler(
  prisma: PrismaClient,
  params: GetComponentStoriesParams,
) {
  return await getComponentStories(prisma, params);
}
