/**
 * List Components Tool
 * Lists all components with optional filters
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { PrismaClient } from '@prisma/client';
import { listComponents } from '../../tools/component.tools';
import { ListComponentsParams } from '../../types';

export const tool: Tool = {
  name: 'list_components',
  description:
    'List all functional components in a project. Components organize code by business domain (Authentication, Billing, etc.). ' +
    'Use this to view available components for organizing stories and understanding the system architecture.',
  inputSchema: {
    type: 'object',
    properties: {
      projectId: {
        type: 'string',
        description: 'Filter by project ID (UUID)',
      },
      status: {
        type: 'string',
        enum: ['active', 'deprecated', 'planning'],
        description: 'Filter by component status',
      },
      layerId: {
        type: 'string',
        description: 'Filter components that belong to a specific layer (UUID)',
      },
    },
  },
};

export const metadata = {
  category: 'components',
  domain: 'architecture',
  tags: ['component', 'list', 'architecture'],
  version: '1.0.0',
  since: 'sprint-5',
  aiHints: [
    'Use this when you need to see what functional components exist for a project',
    'Components help organize code by business domain (Authentication, Billing, etc.)',
    'Each component shows its layers, owner, and usage counts',
  ],
};

export async function handler(
  prisma: PrismaClient,
  params: ListComponentsParams,
) {
  return await listComponents(prisma, params);
}
