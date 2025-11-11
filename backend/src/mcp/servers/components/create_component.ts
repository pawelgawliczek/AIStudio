/**
 * Create Component Tool
 * Create a new functional component
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { PrismaClient } from '@prisma/client';
import { createComponent } from '../../tools/component.tools';
import { CreateComponentParams } from '../../types';

export const tool: Tool = {
  name: 'create_component',
  description:
    'Create a new functional component for organizing code by business domain. ' +
    'Components represent functional areas (Authentication, Billing, Project Management, etc.).',
  inputSchema: {
    type: 'object',
    properties: {
      projectId: {
        type: 'string',
        description: 'Project ID (UUID)',
      },
      name: {
        type: 'string',
        description: 'Component name (e.g., "Authentication", "Billing", "User Management")',
      },
      description: {
        type: 'string',
        description: 'Component description',
      },
      ownerId: {
        type: 'string',
        description: 'Owner user ID (UUID)',
      },
      filePatterns: {
        type: 'array',
        items: { type: 'string' },
        description: 'File path patterns for auto-detection (e.g., ["**/auth/**", "**/*auth*"])',
      },
      layerIds: {
        type: 'array',
        items: { type: 'string' },
        description: 'Layer IDs this component spans (UUIDs)',
      },
      color: {
        type: 'string',
        description: 'Hex color code for UI display (e.g., "#3B82F6")',
      },
      icon: {
        type: 'string',
        description: 'Icon emoji or name (e.g., "🔐")',
      },
      status: {
        type: 'string',
        enum: ['active', 'deprecated', 'planning'],
        description: 'Component status',
      },
    },
    required: ['projectId', 'name'],
  },
};

export const metadata = {
  category: 'components',
  domain: 'architecture',
  tags: ['component', 'create', 'architecture'],
  version: '1.0.0',
  since: 'sprint-5',
};

export async function handler(
  prisma: PrismaClient,
  params: CreateComponentParams,
) {
  return await createComponent(prisma, params);
}
