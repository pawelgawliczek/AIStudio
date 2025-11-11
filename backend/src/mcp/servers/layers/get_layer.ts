/**
 * Get Layer Tool
 * Get detailed information about a specific layer
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { PrismaClient } from '@prisma/client';
import { getLayer } from '../../tools/layer.tools';
import { GetLayerParams } from '../../types';

export const tool: Tool = {
  name: 'get_layer',
  description:
    'Get detailed information about a specific layer including its components and usage statistics.',
  inputSchema: {
    type: 'object',
    properties: {
      layerId: {
        type: 'string',
        description: 'Layer ID (UUID)',
      },
    },
    required: ['layerId'],
  },
};

export const metadata = {
  category: 'layers',
  domain: 'architecture',
  tags: ['layer', 'get', 'architecture'],
  version: '1.0.0',
  since: 'sprint-5',
};

export async function handler(
  prisma: PrismaClient,
  params: GetLayerParams,
) {
  return await getLayer(prisma, params);
}
