/**
 * Delete Component Tool
 * Delete a component (only if not in use)
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { PrismaClient } from '@prisma/client';
import { deleteComponent } from '../../tools/component.tools';
import { GetComponentParams } from '../../types';

export const tool: Tool = {
  name: 'delete_component',
  description:
    'Delete a component. Will fail if the component is used by any stories, use cases, or test cases. ' +
    'Consider deprecating the component instead by updating its status to "deprecated".',
  inputSchema: {
    type: 'object',
    properties: {
      componentId: {
        type: 'string',
        description: 'Component ID to delete (UUID)',
      },
    },
    required: ['componentId'],
  },
};

export const metadata = {
  category: 'components',
  domain: 'architecture',
  tags: ['component', 'delete', 'architecture'],
  version: '1.0.0',
  since: 'sprint-5',
};

export async function handler(
  prisma: PrismaClient,
  params: GetComponentParams,
) {
  return await deleteComponent(prisma, params);
}
