/**
 * Create Coordinator Tool
 * Creates a new coordinator agent for workflow orchestration
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

export interface CreateCoordinatorParams {
  projectId: string;
  name: string;
  description: string;
  domain: string;
  coordinatorInstructions: string;
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
  decisionStrategy: 'sequential' | 'adaptive' | 'parallel' | 'conditional';
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
  name: 'create_coordinator',
  description: 'Create a new coordinator agent for workflow orchestration',
  inputSchema: {
    type: 'object',
    properties: {
      projectId: {
        type: 'string',
        description: 'Project UUID',
      },
      name: {
        type: 'string',
        description: 'Coordinator name',
      },
      description: {
        type: 'string',
        description: 'Coordinator description',
      },
      domain: {
        type: 'string',
        description: 'Domain (e.g., software-development, content-creation)',
      },
      coordinatorInstructions: {
        type: 'string',
        description: 'Instructions for the coordinator on how to orchestrate workflow',
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
        description: 'MCP tool names this coordinator can use',
      },
      decisionStrategy: {
        type: 'string',
        enum: ['sequential', 'adaptive', 'parallel', 'conditional'],
        description: 'Decision strategy for component execution',
      },
      componentIds: {
        type: 'array',
        items: { type: 'string' },
        description: 'Array of Component IDs in library (optional)',
      },
      active: {
        type: 'boolean',
        description: 'Whether coordinator is active (default: true)',
      },
      version: {
        type: 'string',
        description: 'Version (default: v1.0)',
      },
    },
    required: ['projectId', 'name', 'description', 'domain', 'coordinatorInstructions', 'config', 'tools', 'decisionStrategy'],
  },
};

export const metadata = {
  category: 'coordinators',
  domain: 'workflow',
  tags: ['coordinator', 'create', 'workflow'],
  version: '1.0.0',
  since: 'workflow-mvp',
};

// ALIASING: Coordinator → Project Manager (ST-109)
export const projectManagerTool: Tool = {
  name: 'create_project_manager',
  description: 'Create a new project manager for team orchestration',
  inputSchema: tool.inputSchema,
};

export const projectManagerMetadata = {
  category: 'coordinators',
  domain: 'team',
  tags: ['project-manager', 'create', 'team'],
  version: '1.0.0',
  since: '2025-11-26',
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
  params: CreateCoordinatorParams,
): Promise<CoordinatorResponse> {
  try {
    validateRequired(params, [
      'projectId',
      'name',
      'description',
      'domain',
      'coordinatorInstructions',
      'config',
      'tools',
      'decisionStrategy',
    ]);

    // Verify project exists
    const project = await prisma.project.findUnique({
      where: { id: params.projectId },
    });

    if (!project) {
      throw new NotFoundError('Project', params.projectId);
    }

    // Verify componentIds exist if provided and fetch names
    let components: Array<{ id: string; name: string }> = [];
    if (params.componentIds && params.componentIds.length > 0) {
      components = await prisma.component.findMany({
        where: {
          id: { in: params.componentIds },
          projectId: params.projectId,
        },
        select: { id: true, name: true },
      });

      if (components.length !== params.componentIds.length) {
        throw new ValidationError('One or more component IDs not found or do not belong to the project');
      }

      // Sort components in the order specified by params.componentIds
      components = params.componentIds.map(id =>
        components.find(c => c.id === id)!
      );
    }

    // Validate config
    if (!params.config.modelId) {
      throw new ValidationError('config.modelId is required');
    }

    // Generate flow diagram
    const flowDiagram = generateFlowDiagram(
      components,
      params.decisionStrategy,
      params.coordinatorInstructions,
    );

    // Store coordinator-specific fields in config
    const coordinatorConfig = {
      ...params.config,
      domain: params.domain,
      decisionStrategy: params.decisionStrategy,
      componentIds: params.componentIds || [],
      flowDiagram,
    };

    // Create coordinator as component with coordinator tags
    const coordinator = await prisma.component.create({
      data: {
        projectId: params.projectId,
        name: params.name,
        description: params.description,
        inputInstructions: 'Coordinator receives workflow context and story details.',
        operationInstructions: params.coordinatorInstructions,
        outputInstructions: 'Coordinator spawns component agents and tracks execution state.',
        config: coordinatorConfig,
        tools: params.tools,
        tags: ['coordinator', 'orchestrator', params.domain],
        active: params.active !== undefined ? params.active : true,
        version: params.version || 'v1.0',
      },
    });

    return {
      id: coordinator.id,
      projectId: coordinator.projectId,
      name: coordinator.name,
      description: coordinator.description,
      domain: params.domain,
      coordinatorInstructions: coordinator.operationInstructions,
      flowDiagram: coordinatorConfig.flowDiagram,
      config: coordinator.config,
      tools: coordinator.tools,
      decisionStrategy: params.decisionStrategy,
      componentIds: params.componentIds || [],
      active: coordinator.active,
      version: coordinator.version,
      createdAt: coordinator.createdAt.toISOString(),
      updatedAt: coordinator.updatedAt.toISOString(),
    };
  } catch (error: any) {
    if (error.name === 'MCPError') {
      throw error;
    }
    throw handlePrismaError(error, 'create_coordinator');
  }
}
