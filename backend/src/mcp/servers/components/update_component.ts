/**
 * Update Agent Tool (with Project Manager alias)
 * Updates an existing workflow component (agent or project manager)
 *
 * Project Managers are agents with 'coordinator' tag and additional fields:
 * - domain, decisionStrategy, componentIds stored in config
 * - coordinatorInstructions maps to operationInstructions
 * - flowDiagram auto-generated based on componentIds and strategy
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
  // PM-specific fields (only used when component has 'coordinator' tag)
  domain?: string;
  decisionStrategy?: 'sequential' | 'adaptive' | 'parallel' | 'conditional';
  componentIds?: string[];
  coordinatorInstructions?: string;  // Alias for operationInstructions
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
  // PM-specific response fields (only present for coordinators)
  domain?: string;
  decisionStrategy?: string;
  componentIds?: string[];
  flowDiagram?: string;
  coordinatorInstructions?: string;
}


// Primary tool: update_agent
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

// Alias tool: update_project_manager (same handler, different schema for PM-specific fields)
export const aliasTool: Tool = {
  name: 'update_project_manager',
  description: 'Update an existing project manager definition. Supports partial updates - only provided fields will be modified.',
  inputSchema: {
    type: 'object',
    properties: {
      coordinatorId: {
        type: 'string',
        description: 'Project Manager UUID to update',
      },
      name: {
        type: 'string',
        description: 'Project Manager name (optional)',
      },
      description: {
        type: 'string',
        description: 'Project Manager description (optional)',
      },
      domain: {
        type: 'string',
        description: 'Domain (e.g., software-development, content-creation) (optional)',
      },
      coordinatorInstructions: {
        type: 'string',
        description: 'Instructions for the project manager on how to orchestrate workflow (optional)',
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
        description: 'MCP tool names this project manager can use (optional)',
      },
      decisionStrategy: {
        type: 'string',
        enum: ['sequential', 'adaptive', 'parallel', 'conditional'],
        description: 'Decision strategy for component execution (optional)',
      },
      componentIds: {
        type: 'array',
        items: { type: 'string' },
        description: 'Array of Agent IDs in the project manager\'s library (optional)',
      },
      active: {
        type: 'boolean',
        description: 'Whether project manager is active (optional)',
      },
      version: {
        type: 'string',
        description: 'Version (optional)',
      },
    },
    required: ['coordinatorId'],
  },
};

export const metadata = {
  category: 'components',
  domain: 'workflow',
  tags: ['agent', 'project-manager', 'update', 'team'],
  version: '1.0.0',
  since: '2025-11-26',
};

/**
 * Generate a compact flow diagram for coordinators
 */
function generateFlowDiagram(
  components: Array<{ id: string; name: string }>,
  decisionStrategy: string,
  operationInstructions: string,
): string {
  const componentNames = components.map(c => c.name);

  // Check if this is an adaptive workflow with complexity routing
  const isAdaptiveWorkflow = operationInstructions.includes('Trivial') &&
                              operationInstructions.includes('businessComplexity');

  if (isAdaptiveWorkflow && decisionStrategy === 'adaptive') {
    return `PM → [Complexity Assessment]
  ├─ Trivial (BC≤3,TC≤3): ${componentNames[4] || 'Developer'}
  ├─ Simple (BC≤5,TC≤5): ${componentNames[4] || 'Developer'} → ${componentNames[3] || 'Architect'}
  ├─ Medium (BC≤7,TC≤7): ${componentNames[0] || 'Explore'} → ${componentNames[1] || 'BA'} → ${componentNames[2] || 'Designer'} → ${componentNames[3] || 'Arch'} → ${componentNames[4] || 'Dev'} → ${componentNames[5] || 'QA'}
  ├─ Complex (BC>7,TC>7): ${componentNames[0] || 'Explore'} → ${componentNames[1] || 'BA'} → ${componentNames[2] || 'Designer'} → ${componentNames[3] || 'Arch'} → ${componentNames[4] || 'Dev'} → ${componentNames[5] || 'QA'} → ${componentNames[6] || 'DevOps'}
  └─ Critical: Full Workflow + Validation`;
  }

  if (decisionStrategy === 'sequential') {
    return `Sequential: ${componentNames.join(' → ')}`;
  }

  if (decisionStrategy === 'parallel') {
    return `Parallel:\n  ${componentNames.map(n => `├─ ${n}`).join('\n  ')}`;
  }

  return `${decisionStrategy.charAt(0).toUpperCase() + decisionStrategy.slice(1)}: ${componentNames.join(' → ')}`;
}

export async function handler(
  prisma: PrismaClient,
  params: UpdateComponentParams & { coordinatorId?: string },
): Promise<ComponentResponse> {
  try {
    // Support both componentId and coordinatorId (PM alias)
    const componentId = params.componentId || params.coordinatorId;
    if (!componentId) {
      throw new ValidationError('Either componentId or coordinatorId is required');
    }

    // Verify component exists
    const existingComponent = await prisma.component.findUnique({
      where: { id: componentId },
    });

    if (!existingComponent) {
      throw new NotFoundError('Component', componentId);
    }

    // Check if this is a coordinator (PM)
    const isCoordinator = existingComponent.tags.includes('coordinator');

    // Build update data object with only provided fields
    const updateData: any = {};

    // Common fields
    if (params.name !== undefined) updateData.name = params.name;
    if (params.description !== undefined) updateData.description = params.description;
    if (params.inputInstructions !== undefined) updateData.inputInstructions = params.inputInstructions;
    if (params.outputInstructions !== undefined) updateData.outputInstructions = params.outputInstructions;
    if (params.tools !== undefined) updateData.tools = params.tools;
    if (params.subtaskConfig !== undefined) updateData.subtaskConfig = params.subtaskConfig;
    if (params.onFailure !== undefined) updateData.onFailure = params.onFailure;
    if (params.tags !== undefined) updateData.tags = params.tags;
    if (params.active !== undefined) updateData.active = params.active;
    if (params.version !== undefined) updateData.version = params.version;

    // Handle operationInstructions (also accept coordinatorInstructions as alias)
    const newOperationInstructions = params.operationInstructions || params.coordinatorInstructions;
    if (newOperationInstructions !== undefined) {
      updateData.operationInstructions = newOperationInstructions;
    }

    // Handle config - merge with existing for coordinators
    const existingConfig = (existingComponent.config as any) || {};
    let newConfig = { ...existingConfig };
    let configUpdated = false;

    if (params.config !== undefined) {
      newConfig = { ...newConfig, ...params.config };
      configUpdated = true;
    }

    // PM-specific fields (stored in config)
    if (isCoordinator) {
      if (params.domain !== undefined) {
        newConfig.domain = params.domain;
        configUpdated = true;
      }

      if (params.decisionStrategy !== undefined) {
        newConfig.decisionStrategy = params.decisionStrategy;
        configUpdated = true;
      }

      // Handle componentIds update (requires validation and flow diagram regeneration)
      if (params.componentIds !== undefined) {
        const components = await prisma.component.findMany({
          where: {
            id: { in: params.componentIds },
            projectId: existingComponent.projectId,
          },
          select: { id: true, name: true },
        });

        if (components.length !== params.componentIds.length) {
          throw new ValidationError('One or more component IDs not found or do not belong to the project');
        }

        const sortedComponents = params.componentIds.map(id =>
          components.find(c => c.id === id)!
        );

        const decisionStrategy = params.decisionStrategy || newConfig.decisionStrategy || 'sequential';
        const operationInstructions = newOperationInstructions || existingComponent.operationInstructions;

        newConfig.componentIds = params.componentIds;
        newConfig.flowDiagram = generateFlowDiagram(sortedComponents, decisionStrategy, operationInstructions);
        configUpdated = true;
      } else if (params.decisionStrategy !== undefined || newOperationInstructions !== undefined) {
        // Regenerate flow diagram if strategy or instructions changed
        const componentIds = newConfig.componentIds || [];
        if (componentIds.length > 0) {
          const components = await prisma.component.findMany({
            where: {
              id: { in: componentIds },
              projectId: existingComponent.projectId,
            },
            select: { id: true, name: true },
          });

          if (components.length > 0) {
            const sortedComponents = componentIds.map((id: string) =>
              components.find(c => c.id === id)!
            ).filter(Boolean);

            const decisionStrategy = params.decisionStrategy || newConfig.decisionStrategy || 'sequential';
            const operationInstructions = newOperationInstructions || existingComponent.operationInstructions;

            newConfig.flowDiagram = generateFlowDiagram(sortedComponents, decisionStrategy, operationInstructions);
            configUpdated = true;
          }
        }
      }
    }

    if (configUpdated) {
      updateData.config = newConfig;
    }

    // Check if there are any fields to update
    if (Object.keys(updateData).length === 0) {
      throw new ValidationError('No fields to update');
    }

    // Update component
    const component = await prisma.component.update({
      where: { id: componentId },
      data: updateData,
    });

    // Build response
    const finalConfig = (component.config as any) || {};
    const response: ComponentResponse = {
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

    // Add PM-specific fields for coordinators
    if (component.tags.includes('coordinator')) {
      response.domain = finalConfig.domain;
      response.decisionStrategy = finalConfig.decisionStrategy;
      response.componentIds = finalConfig.componentIds || [];
      response.flowDiagram = finalConfig.flowDiagram;
      response.coordinatorInstructions = component.operationInstructions;
    }

    return response;
  } catch (error: any) {
    if (error.name === 'MCPError') {
      throw error;
    }
    throw handlePrismaError(error, 'update_component');
  }
}
