/**
 * Create Component Tool
 * Creates a new workflow component with 3 instruction sets
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

export interface CreateComponentParams {
  projectId: string;
  name: string;
  description?: string;
  inputInstructions: string;
  operationInstructions: string;
  outputInstructions: string;
  config: {
    modelId: string;
    temperature?: number;
    maxInputTokens?: number;
    maxOutputTokens?: number;
    timeout?: number;
    maxRetries?: number;
    costLimit?: number;
  };
  tools: string[];
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

export const tool: Tool = {
  name: 'create_component',
  description: 'Create a new workflow component with 3 instruction sets (input, operation, output)',
  inputSchema: {
    type: 'object',
    properties: {
      projectId: {
        type: 'string',
        description: 'Project UUID',
      },
      name: {
        type: 'string',
        description: 'Component name',
      },
      description: {
        type: 'string',
        description: 'Component description (optional)',
      },
      inputInstructions: {
        type: 'string',
        description: 'Instructions for what input this component receives and how to read it',
      },
      operationInstructions: {
        type: 'string',
        description: 'Instructions for what operations this component should perform',
      },
      outputInstructions: {
        type: 'string',
        description: 'Instructions for what output this component should produce and how to save it',
      },
      config: {
        type: 'object',
        description: 'Execution configuration (modelId, temperature, maxInputTokens, maxOutputTokens, timeout, maxRetries, costLimit)',
        properties: {
          modelId: { type: 'string' },
          temperature: { type: 'number' },
          maxInputTokens: { type: 'number' },
          maxOutputTokens: { type: 'number' },
          timeout: { type: 'number' },
          maxRetries: { type: 'number' },
          costLimit: { type: 'number' },
        },
        required: ['modelId'],
      },
      tools: {
        type: 'array',
        items: { type: 'string' },
        description: 'MCP tool names this component can use',
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
        description: 'Failure handling strategy (default: stop)',
      },
      tags: {
        type: 'array',
        items: { type: 'string' },
        description: 'Tags for categorization (optional)',
      },
      active: {
        type: 'boolean',
        description: 'Whether component is active (default: true)',
      },
      version: {
        type: 'string',
        description: 'Version (default: v1.0)',
      },
    },
    required: ['projectId', 'name', 'inputInstructions', 'operationInstructions', 'outputInstructions', 'config', 'tools'],
  },
};

export const metadata = {
  category: 'components',
  domain: 'workflow',
  tags: ['component', 'create', 'workflow'],
  version: '1.0.0',
  since: 'workflow-mvp',
};

// ALIASING: Component → Agent (ST-109)
export const agentTool: Tool = {
  name: 'create_agent',
  description: 'Create a new agent with 3 instruction sets (input, operation, output). Agents are AI workers that execute specific tasks within teams.',
  inputSchema: tool.inputSchema,
};

export const agentMetadata = {
  category: 'components',
  domain: 'workflow',
  tags: ['agent', 'create', 'team'],
  version: '1.0.0',
  since: '2025-11-26',
};

export async function handler(
  prisma: PrismaClient,
  params: CreateComponentParams,
): Promise<ComponentResponse> {
  try {
    validateRequired(params, [
      'projectId',
      'name',
      'inputInstructions',
      'operationInstructions',
      'outputInstructions',
      'config',
      'tools',
    ]);

    // Verify project exists
    const project = await prisma.project.findUnique({
      where: { id: params.projectId },
    });

    if (!project) {
      throw new NotFoundError('Project', params.projectId);
    }

    // Validate config
    if (!params.config.modelId) {
      throw new ValidationError('config.modelId is required');
    }

    // Create component
    const component = await prisma.component.create({
      data: {
        projectId: params.projectId,
        name: params.name,
        description: params.description,
        inputInstructions: params.inputInstructions,
        operationInstructions: params.operationInstructions,
        outputInstructions: params.outputInstructions,
        config: params.config,
        tools: params.tools,
        subtaskConfig: params.subtaskConfig || {},
        onFailure: params.onFailure || 'stop',
        tags: params.tags || [],
        active: params.active !== undefined ? params.active : true,
        version: params.version || 'v1.0',
      },
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
    throw handlePrismaError(error, 'create_component');
  }
}
