/**
 * Update Component Tool
 * Update an existing component
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { PrismaClient } from '@prisma/client';
import { updateComponent } from '../../tools/component.tools';
import { UpdateComponentParams } from '../../types';

export const tool: Tool = {
  name: 'update_component',
  description:
    'Update an existing functional component. All fields except componentId are optional. ' +
    'When updating layerIds, the new list completely replaces the old one.',
  inputSchema: {
    type: 'object',
    properties: {
      componentId: {
        type: 'string',
        description: 'Component ID to update (UUID)',
      },
      name: {
        type: 'string',
        description: 'New component name',
      },
      description: {
        type: 'string',
        description: 'New description',
      },
      ownerId: {
        type: 'string',
        description: 'New owner user ID (UUID)',
      },
      filePatterns: {
        type: 'array',
        items: { type: 'string' },
        description: 'Updated file path patterns',
      },
      layerIds: {
        type: 'array',
        items: { type: 'string' },
        description: 'Updated layer IDs (replaces existing)',
      },
      color: {
        type: 'string',
        description: 'New hex color code',
      },
      icon: {
        type: 'string',
        description: 'New icon',
      },
      status: {
        type: 'string',
        enum: ['active', 'deprecated', 'planning'],
        description: 'New status',
      },
    },
    required: ['componentId'],
  },
};

export const metadata = {
  category: 'components',
  domain: 'architecture',
  tags: ['component', 'update', 'architecture'],
  version: '1.0.0',
  since: 'sprint-5',
};

export async function handler(
  prisma: PrismaClient,
  params: UpdateComponentParams,
) {
  return await updateComponent(prisma, params);
}
