/**
 * Update Coordinator Tool
 * Updates an existing coordinator agent
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

export interface UpdateCoordinatorParams {
  coordinatorId: string;
  name?: string;
  description?: string;
  domain?: string;
  coordinatorInstructions?: string;
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
  decisionStrategy?: 'sequential' | 'adaptive' | 'parallel' | 'conditional';
  componentIds?: string[];
  active?: boolean;
  version?: string;
}

export interface CoordinatorResponse {
  id: string;
  projectId: string;
  name: string;
  description: string;
  domain: string;
  coordinatorInstructions: string;
  flowDiagram: string | null;
  config: any;
  tools: string[];
  decisionStrategy: string;
  componentIds: string[];
  active: boolean;
  version: string;
  createdAt: string;
  updatedAt: string;
}

export const tool: Tool = {
  name: 'update_coordinator',
  description: 'Update an existing coordinator agent definition. Supports partial updates - only provided fields will be modified.',
  inputSchema: {
    type: 'object',
    properties: {
      coordinatorId: {
        type: 'string',
        description: 'Coordinator UUID to update',
      },
      name: {
        type: 'string',
        description: 'Coordinator name (optional)',
      },
      description: {
        type: 'string',
        description: 'Coordinator description (optional)',
      },
      domain: {
        type: 'string',
        description: 'Domain (e.g., software-development, content-creation) (optional)',
      },
      coordinatorInstructions: {
        type: 'string',
        description: 'Instructions for the coordinator on how to orchestrate workflow (optional)',
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
        description: 'MCP tool names this coordinator can use (optional)',
      },
      decisionStrategy: {
        type: 'string',
        enum: ['sequential', 'adaptive', 'parallel', 'conditional'],
        description: 'Decision strategy for component execution (optional)',
      },
      componentIds: {
        type: 'array',
        items: { type: 'string' },
        description: 'Array of Component IDs in library (optional)',
      },
      active: {
        type: 'boolean',
        description: 'Whether coordinator is active (optional)',
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
  category: 'coordinators',
  domain: 'workflow',
  tags: ['coordinator', 'update', 'workflow'],
  version: '1.0.0',
  since: 'update-tools',
};

/**
 * Generate a compact flow diagram for the coordinator
 */
function generateFlowDiagram(
  components: Array<{ id: string; name: string }>,
  decisionStrategy: string,
  coordinatorInstructions: string,
): string {
  // Extract component names in order
  const componentNames = components.map(c => c.name);

  // Check if this is an adaptive workflow with complexity routing
  const isAdaptiveWorkflow = coordinatorInstructions.includes('Trivial') &&
                              coordinatorInstructions.includes('businessComplexity');

  if (isAdaptiveWorkflow && decisionStrategy === 'adaptive') {
    // Generate complexity-based routing diagram
    return `PM → [Complexity Assessment]
  ├─ Trivial (BC≤3,TC≤3): ${componentNames[4] || 'Developer'}
  ├─ Simple (BC≤5,TC≤5): ${componentNames[4] || 'Developer'} → ${componentNames[3] || 'Architect'}
  ├─ Medium (BC≤7,TC≤7): ${componentNames[0] || 'Explore'} → ${componentNames[1] || 'BA'} → ${componentNames[2] || 'Designer'} → ${componentNames[3] || 'Arch'} → ${componentNames[4] || 'Dev'} → ${componentNames[5] || 'QA'}
  ├─ Complex (BC>7,TC>7): ${componentNames[0] || 'Explore'} → ${componentNames[1] || 'BA'} → ${componentNames[2] || 'Designer'} → ${componentNames[3] || 'Arch'} → ${componentNames[4] || 'Dev'} → ${componentNames[5] || 'QA'} → ${componentNames[6] || 'DevOps'}
  └─ Critical: Full Workflow + Validation`;
  }

  // Default sequential flow
  if (decisionStrategy === 'sequential') {
    return `Sequential: ${componentNames.join(' → ')}`;
  }

  // Default parallel flow
  if (decisionStrategy === 'parallel') {
    return `Parallel:\n  ${componentNames.map(n => `├─ ${n}`).join('\n  ')}`;
  }

  // Default conditional or adaptive without complexity
  return `${decisionStrategy.charAt(0).toUpperCase() + decisionStrategy.slice(1)}: ${componentNames.join(' → ')}`;
}

export async function handler(
  prisma: PrismaClient,
  params: UpdateCoordinatorParams,
): Promise<CoordinatorResponse> {
  try {
    validateRequired(params, ['coordinatorId']);

    // Verify coordinator exists
    const existingCoordinator = await prisma.coordinatorAgent.findUnique({
      where: { id: params.coordinatorId },
    });

    if (!existingCoordinator) {
      throw new NotFoundError('Coordinator', params.coordinatorId);
    }

    // Build update data object with only provided fields
    const updateData: any = {};

    if (params.name !== undefined) updateData.name = params.name;
    if (params.description !== undefined) updateData.description = params.description;
    if (params.domain !== undefined) updateData.domain = params.domain;
    if (params.coordinatorInstructions !== undefined) updateData.coordinatorInstructions = params.coordinatorInstructions;
    if (params.config !== undefined) updateData.config = params.config;
    if (params.tools !== undefined) updateData.tools = params.tools;
    if (params.decisionStrategy !== undefined) updateData.decisionStrategy = params.decisionStrategy;
    if (params.active !== undefined) updateData.active = params.active;
    if (params.version !== undefined) updateData.version = params.version;

    // Handle componentIds update (requires validation and flow diagram regeneration)
    if (params.componentIds !== undefined) {
      // Verify componentIds exist and belong to the project
      const components = await prisma.component.findMany({
        where: {
          id: { in: params.componentIds },
          projectId: existingCoordinator.projectId,
        },
        select: { id: true, name: true },
      });

      if (components.length !== params.componentIds.length) {
        throw new ValidationError('One or more component IDs not found or do not belong to the project');
      }

      // Sort components in the order specified by params.componentIds
      const sortedComponents = params.componentIds.map(id =>
        components.find(c => c.id === id)!
      );

      // Regenerate flow diagram
      const decisionStrategy = params.decisionStrategy || existingCoordinator.decisionStrategy;
      const coordinatorInstructions = params.coordinatorInstructions || existingCoordinator.coordinatorInstructions;

      updateData.componentIds = params.componentIds;
      updateData.flowDiagram = generateFlowDiagram(
        sortedComponents,
        decisionStrategy,
        coordinatorInstructions,
      );
    } else if (params.decisionStrategy !== undefined || params.coordinatorInstructions !== undefined) {
      // Regenerate flow diagram if strategy or instructions changed
      const componentIds = existingCoordinator.componentIds;
      if (componentIds && componentIds.length > 0) {
        const components = await prisma.component.findMany({
          where: {
            id: { in: componentIds },
            projectId: existingCoordinator.projectId,
          },
          select: { id: true, name: true },
        });

        if (components.length > 0) {
          const sortedComponents = componentIds.map(id =>
            components.find(c => c.id === id)!
          );

          const decisionStrategy = params.decisionStrategy || existingCoordinator.decisionStrategy;
          const coordinatorInstructions = params.coordinatorInstructions || existingCoordinator.coordinatorInstructions;

          updateData.flowDiagram = generateFlowDiagram(
            sortedComponents,
            decisionStrategy,
            coordinatorInstructions,
          );
        }
      }
    }

    // Check if there are any fields to update
    if (Object.keys(updateData).length === 0) {
      throw new ValidationError('No fields to update');
    }

    // Update coordinator
    const coordinator = await prisma.coordinatorAgent.update({
      where: { id: params.coordinatorId },
      data: updateData,
    });

    return {
      id: coordinator.id,
      projectId: coordinator.projectId,
      name: coordinator.name,
      description: coordinator.description,
      domain: coordinator.domain,
      coordinatorInstructions: coordinator.coordinatorInstructions,
      flowDiagram: coordinator.flowDiagram,
      config: coordinator.config,
      tools: coordinator.tools,
      decisionStrategy: coordinator.decisionStrategy,
      componentIds: coordinator.componentIds,
      active: coordinator.active,
      version: coordinator.version,
      createdAt: coordinator.createdAt.toISOString(),
      updatedAt: coordinator.updatedAt.toISOString(),
    };
  } catch (error: any) {
    if (error.name === 'MCPError') {
      throw error;
    }
    throw handlePrismaError(error, 'update_coordinator');
  }
}
