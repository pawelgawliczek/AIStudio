/**
 * Delete Layer Tool
 * Delete a layer (only if not in use)
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { PrismaClient } from '@prisma/client';
import { deleteLayer } from '../../tools/layer.tools';
import { GetLayerParams } from '../../types';

export const tool: Tool = {
  name: 'delete_layer',
  description:
    'Delete a layer. Will fail if the layer is used by any stories, components, use cases, or test cases. ' +
    'Consider deprecating the layer instead by updating its status to "deprecated".',
  inputSchema: {
    type: 'object',
    properties: {
      layerId: {
        type: 'string',
        description: 'Layer ID to delete (UUID)',
      },
    },
    required: ['layerId'],
  },
};

export const metadata = {
  category: 'layers',
  domain: 'architecture',
  tags: ['layer', 'delete', 'architecture'],
  version: '1.0.0',
  since: 'sprint-5',
};

export async function handler(
  prisma: PrismaClient,
  params: GetLayerParams,
) {
  return await deleteLayer(prisma, params);
}
