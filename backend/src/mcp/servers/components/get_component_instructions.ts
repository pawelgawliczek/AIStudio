/**
 * Get Agent Instructions Tool
 * Retrieves work instructions for a component agent on-demand
 *
 * Purpose: Enables reference-based component architecture by allowing
 * spawned agents to retrieve their instructions separately from workflow context.
 * This reduces token usage and eliminates truncation in get_workflow_context.
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { PrismaClient } from '@prisma/client';
import { NotFoundError, ValidationError } from '../../types';
import { validateRequired, handlePrismaError } from '../../utils';

export interface GetComponentInstructionsParams {
  componentId: string;
}

export interface ComponentInstructionsResponse {
  componentId: string;
  componentName: string;
  description: string | null;
  inputInstructions: string;
  operationInstructions: string;
  outputInstructions: string;
  config: any;
  tools: string[];
  subtaskConfig?: any;
  onFailure: string;
}


// ALIASING: Component → Agent (ST-109)
export const tool: Tool = {
  name: 'get_agent_instructions',
  description:
    'Retrieve work instructions for an agent. Returns input/operation/output instructions, config, and tools. ' +
    'Used by spawned agents to get their instructions on-demand, enabling token-efficient team orchestration.',
  inputSchema: {
    type: 'object',
    properties: {
      componentId: {
        type: 'string',
        description: 'Component UUID (required)',
      },
    },
    required: ['componentId'],
  }
};

export const metadata = {
  category: 'components',
  domain: 'team-execution',
  tags: ['agent', 'instructions', 'team'],
  version: '1.0.0',
  since: '2025-11-26',
};

export async function handler(
  prisma: PrismaClient,
  params: GetComponentInstructionsParams,
): Promise<ComponentInstructionsResponse> {
  try {
    // 1. Validate input
    validateRequired(params, ['componentId']);

    // 2. Query component with full instructions
    const component = await prisma.component.findUnique({
      where: { id: params.componentId },
      select: {
        id: true,
        name: true,
        description: true,
        inputInstructions: true,
        operationInstructions: true,
        outputInstructions: true,
        config: true,
        tools: true,
        subtaskConfig: true,
        onFailure: true,
        active: true,
      },
    });

    // 3. Validate component exists
    if (!component) {
      throw new NotFoundError('Component', params.componentId);
    }

    // 4. Validate component is active
    if (!component.active) {
      throw new ValidationError(
        `Component ${params.componentId} is inactive`,
      );
    }

    // 5. Validate instructions are complete
    if (
      !component.inputInstructions ||
      !component.operationInstructions ||
      !component.outputInstructions
    ) {
      throw new ValidationError(
        `Component ${params.componentId} has incomplete instructions`,
      );
    }

    // 6. Return instructions
    return {
      componentId: component.id,
      componentName: component.name,
      description: component.description,
      inputInstructions: component.inputInstructions,
      operationInstructions: component.operationInstructions,
      outputInstructions: component.outputInstructions,
      config: component.config,
      tools: component.tools,
      subtaskConfig: component.subtaskConfig,
      onFailure: component.onFailure,
    };
  } catch (error: any) {
    if (error.name === 'MCPError') throw error;
    throw handlePrismaError(error, 'get_component_instructions');
  }
}
