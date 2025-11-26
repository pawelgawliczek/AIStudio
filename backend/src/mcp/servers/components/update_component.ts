/**
 * Update Agent Tool
 * Updates an existing workflow component
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { PrismaClient } from '@prisma/client';
import {
  NotFoundError,
  ValidationError,
} from '../../types';
import {
  validateRequired,
  handlePrismaError,
} from '../../utils';

export interface UpdateComponentParams {
  componentId: string;
  name?: string;
  description?: string;
  inputInstructions?: string;
  operationInstructions?: string;
  outputInstructions?: string;
  config?: {
    modelId?: string;
    temperature?: number;
    maxInputTokens?: number;
    maxOutputTokens?: number;
    timeout?: number;
    maxRetries?: number;
    costLimit?: number;
  };
  tools?: string[];
  subtaskConfig?: {
    createSubtask?: boolean;
    layer?: string;
    assignee?: string;
  };
  onFailure?: 'stop' | 'skip' | 'retry' | 'pause';
  tags?: string[];
  active?: boolean;
  version?: string;
}

export interface ComponentResponse {
  id: string;
  projectId: string;
  name: string;
  description: string | null;
  inputInstructions: string;
  operationInstructions: string;
  outputInstructions: string;
  config: any;
  tools: string[];
  subtaskConfig: any;
  onFailure: string;
  tags: string[];
  active: boolean;
  version: string;
  createdAt: string;
  updatedAt: string;
}


// ALIASING: Component → Agent (ST-109)
export const tool: Tool = {
  name: 'update_agent',
  description: 'Update an existing agent definition. Supports partial updates - only provided fields will be modified.',
    inputSchema: {
    type: 'object',
    properties: {
      componentId: {
        type: 'string',
        description: 'Component UUID to update',
      },
      name: {
        type: 'string',
        description: 'Component name (optional)',
      },
      description: {
        type: 'string',
        description: 'Component description (optional)',
      },
      inputInstructions: {
        type: 'string',
        description: 'Instructions for what input this component receives and how to read it (optional)',
      },
      operationInstructions: {
        type: 'string',
        description: 'Instructions for what operations this component should perform (optional)',
      },
      outputInstructions: {
        type: 'string',
        description: 'Instructions for what output this component should produce and how to save it (optional)',
      },
      config: {
        type: 'object',
        description: 'Execution configuration (optional)',
        properties: {
          modelId: { type: 'string' },
          temperature: { type: 'number' },
          maxInputTokens: { type: 'number' },
          maxOutputTokens: { type: 'number' },
          timeout: { type: 'number' },
          maxRetries: { type: 'number' },
          costLimit: { type: 'number' },
        },
      },
      tools: {
        type: 'array',
        items: { type: 'string' },
        description: 'MCP tool names this component can use (optional)',
      },
      subtaskConfig: {
        type: 'object',
        description: 'Subtask configuration (optional)',
        properties: {
          createSubtask: { type: 'boolean' },
          layer: { type: 'string' },
          assignee: { type: 'string' },
        },
      },
      onFailure: {
        type: 'string',
        enum: ['stop', 'skip', 'retry', 'pause'],
        description: 'Failure handling strategy (optional)',
      },
      tags: {
        type: 'array',
        items: { type: 'string' },
        description: 'Tags for categorization (optional)',
      },
      active: {
        type: 'boolean',
        description: 'Whether component is active (optional)',
      },
      version: {
        type: 'string',
        description: 'Version (optional)',
      },
    },
    required: ['componentId'],
  },
};

export const metadata = {
  category: 'components',
  domain: 'workflow',
  tags: ['agent', 'update', 'team'],
  version: '1.0.0',
  since: '2025-11-26',
};

export async function handler(
  prisma: PrismaClient,
  params: UpdateComponentParams,
): Promise<ComponentResponse> {
  try {
    validateRequired(params, ['componentId']);

    // Verify component exists
    const existingComponent = await prisma.component.findUnique({
      where: { id: params.componentId },
    });

    if (!existingComponent) {
      throw new NotFoundError('Component', params.componentId);
    }

    // Build update data object with only provided fields
    const updateData: any = {};

    if (params.name !== undefined) updateData.name = params.name;
    if (params.description !== undefined) updateData.description = params.description;
    if (params.inputInstructions !== undefined) updateData.inputInstructions = params.inputInstructions;
    if (params.operationInstructions !== undefined) updateData.operationInstructions = params.operationInstructions;
    if (params.outputInstructions !== undefined) updateData.outputInstructions = params.outputInstructions;
    if (params.config !== undefined) updateData.config = params.config;
    if (params.tools !== undefined) updateData.tools = params.tools;
    if (params.subtaskConfig !== undefined) updateData.subtaskConfig = params.subtaskConfig;
    if (params.onFailure !== undefined) updateData.onFailure = params.onFailure;
    if (params.tags !== undefined) updateData.tags = params.tags;
    if (params.active !== undefined) updateData.active = params.active;
    if (params.version !== undefined) updateData.version = params.version;

    // Check if there are any fields to update
    if (Object.keys(updateData).length === 0) {
      throw new ValidationError('No fields to update');
    }

    // Update component
    const component = await prisma.component.update({
      where: { id: params.componentId },
      data: updateData,
    });

    return {
      id: component.id,
      projectId: component.projectId,
      name: component.name,
      description: component.description,
      inputInstructions: component.inputInstructions,
      operationInstructions: component.operationInstructions,
      outputInstructions: component.outputInstructions,
      config: component.config,
      tools: component.tools,
      subtaskConfig: component.subtaskConfig,
      onFailure: component.onFailure,
      tags: component.tags,
      active: component.active,
      version: component.version,
      createdAt: component.createdAt.toISOString(),
      updatedAt: component.updatedAt.toISOString(),
    };
  } catch (error: any) {
    if (error.name === 'MCPError') {
      throw error;
    }
    throw handlePrismaError(error, 'update_component');
  }
}
