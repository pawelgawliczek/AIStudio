/**
 * Update Layer Tool
 * Update an existing layer
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { PrismaClient } from '@prisma/client';
import { updateLayer } from '../../tools/layer.tools';
import { UpdateLayerParams } from '../../types';

export const tool: Tool = {
  name: 'update_layer',
  description:
    'Update an existing architectural layer. All fields except layerId are optional.',
  inputSchema: {
    type: 'object',
    properties: {
      layerId: {
        type: 'string',
        description: 'Layer ID to update (UUID)',
      },
      name: {
        type: 'string',
        description: 'New layer name',
      },
      description: {
        type: 'string',
        description: 'New description',
      },
      techStack: {
        type: 'array',
        items: { type: 'string' },
        description: 'Updated technology stack',
      },
      orderIndex: {
        type: 'number',
        description: 'New display order',
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
        enum: ['active', 'deprecated'],
        description: 'New status',
      },
    },
    required: ['layerId'],
  },
};

export const metadata = {
  category: 'layers',
  domain: 'architecture',
  tags: ['layer', 'update', 'architecture'],
  version: '1.0.0',
  since: 'sprint-5',
};

export async function handler(
  prisma: PrismaClient,
  params: UpdateLayerParams,
) {
  return await updateLayer(prisma, params);
}
