/**
 * Create Layer Tool
 * Create a new architectural layer
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { PrismaClient } from '@prisma/client';
import { createLayer } from '../../tools/layer.tools';
import { CreateLayerParams } from '../../types';

export const tool: Tool = {
  name: 'create_layer',
  description:
    'Create a new architectural layer for organizing code by technical concern. ' +
    'Layers represent the technical stack (Frontend, Backend API, Database, Infrastructure, etc.).',
  inputSchema: {
    type: 'object',
    properties: {
      projectId: {
        type: 'string',
        description: 'Project ID (UUID)',
      },
      name: {
        type: 'string',
        description: 'Layer name (e.g., "Frontend", "Backend API", "Database")',
      },
      description: {
        type: 'string',
        description: 'Layer description',
      },
      techStack: {
        type: 'array',
        items: { type: 'string' },
        description: 'Technology stack (e.g., ["React", "TypeScript", "Vite"])',
      },
      orderIndex: {
        type: 'number',
        description: 'Display order (lower numbers appear first)',
      },
      color: {
        type: 'string',
        description: 'Hex color code for UI display (e.g., "#3B82F6")',
      },
      icon: {
        type: 'string',
        description: 'Icon emoji or name (e.g., "🌐")',
      },
      status: {
        type: 'string',
        enum: ['active', 'deprecated'],
        description: 'Layer status',
      },
    },
    required: ['projectId', 'name', 'orderIndex'],
  },
};

export const metadata = {
  category: 'layers',
  domain: 'architecture',
  tags: ['layer', 'create', 'architecture'],
  version: '1.0.0',
  since: 'sprint-5',
};

export async function handler(
  prisma: PrismaClient,
  params: CreateLayerParams,
) {
  return await createLayer(prisma, params);
}
