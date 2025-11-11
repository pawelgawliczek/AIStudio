/**
 * Get Component Tool
 * Get detailed information about a specific component
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { PrismaClient } from '@prisma/client';
import { getComponent } from '../../tools/component.tools';
import { GetComponentParams } from '../../types';

export const tool: Tool = {
  name: 'get_component',
  description:
    'Get detailed information about a specific component including its layers, owner, and usage statistics.',
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
  domain: 'architecture',
  tags: ['component', 'get', 'architecture'],
  version: '1.0.0',
  since: 'sprint-5',
};

export async function handler(
  prisma: PrismaClient,
  params: GetComponentParams,
) {
  return await getComponent(prisma, params);
}
