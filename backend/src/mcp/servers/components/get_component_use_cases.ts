/**
 * Get Component Use Cases Tool
 * Get all use cases for a component (BA workflow)
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { PrismaClient } from '@prisma/client';
import { getComponentUseCases } from '../../tools/component.tools';
import { GetComponentUseCasesParams } from '../../types';

export const tool: Tool = {
  name: 'get_component_use_cases',
  description:
    'Get all use cases associated with a component. Useful for BA analysis workflow to understand ' +
    'functional requirements within a specific business domain.',
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
  domain: 'business_analysis',
  tags: ['component', 'use-cases', 'ba', 'requirements'],
  version: '1.0.0',
  since: 'sprint-5',
  aiHints: [
    'Use this when analyzing use cases for a specific business domain',
    'Returns all use cases linked to the component with test case counts',
    'Helpful for BA agents to understand component functionality',
  ],
};

export async function handler(
  prisma: PrismaClient,
  params: GetComponentUseCasesParams,
) {
  return await getComponentUseCases(prisma, params);
}
