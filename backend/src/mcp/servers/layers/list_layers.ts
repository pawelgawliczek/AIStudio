/**
 * List Layers Tool
 * Lists all layers with optional filters
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { PrismaClient } from '@prisma/client';
import { listLayers } from '../../tools/layer.tools';
import { ListLayersParams } from '../../types';

export const tool: Tool = {
  name: 'list_layers',
  description:
    'List all architectural layers in a project. Layers organize code by technical concern (Frontend, Backend, Database, etc.). ' +
    'Use this to view available layers for organizing stories and components.',
  inputSchema: {
    type: 'object',
    properties: {
      projectId: {
        type: 'string',
        description: 'Filter by project ID (UUID)',
      },
      status: {
        type: 'string',
        enum: ['active', 'deprecated'],
        description: 'Filter by layer status',
      },
    },
  },
};

export const metadata = {
  category: 'layers',
  domain: 'architecture',
  tags: ['layer', 'list', 'architecture'],
  version: '1.0.0',
  since: 'sprint-5',
  aiHints: [
    'Use this when you need to see what architectural layers exist for a project',
    'Layers help organize code by technical stack (Frontend, Backend, Database, etc.)',
    'Each layer shows usage counts for stories, components, use cases, and test cases',
  ],
};

export async function handler(
  prisma: PrismaClient,
  params: ListLayersParams,
) {
  return await listLayers(prisma, params);
}
