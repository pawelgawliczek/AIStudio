/**
 * Assign Workflow to Story Tool
 * Pre-configure workflow for a story
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { PrismaClient } from '@prisma/client';

export const tool: Tool = {
  name: 'assign_workflow_to_story',
  description:
    'Assign a workflow to a story for future execution. Pass null as workflowId to clear the assignment.',
  inputSchema: {
    type: 'object',
    properties: {
      storyId: {
        type: 'string',
        description: 'Story UUID (required)',
      },
      workflowId: {
        type: ['string', 'null'],
        description: 'Workflow UUID to assign, or null to clear assignment',
      },
    },
    required: ['storyId'],
  },
};

export const metadata = {
  category: 'execution',
  domain: 'Workflow Execution',
  tags: ['workflow', 'story', 'assignment', 'configuration'],
  version: '1.0.0',
  since: '2025-11-14',
};

export async function handler(prisma: PrismaClient, params: any) {
  // Validate required fields
  if (!params.storyId) {
    throw new Error('storyId is required');
  }

  // Verify story exists
  const story = await prisma.story.findUnique({
    where: { id: params.storyId },
    select: {
      id: true,
      key: true,
      title: true,
      projectId: true,
      assignedWorkflowId: true,
    },
  });

  if (!story) {
    throw new Error(`Story with ID ${params.storyId} not found`);
  }

  let workflow = null;

  // If workflowId provided (not null), verify it exists and is active
  if (params.workflowId !== null && params.workflowId !== undefined) {
    workflow = await prisma.workflow.findUnique({
      where: { id: params.workflowId },
      select: {
        id: true,
        name: true,
        description: true,
        active: true,
        projectId: true,
      },
    });

    if (!workflow) {
      throw new Error(`Workflow with ID ${params.workflowId} not found`);
    }

    if (!workflow.active) {
      throw new Error(
        `Cannot assign inactive workflow "${workflow.name}" to story ${story.key}. Please activate the workflow first.`,
      );
    }

    // Check if workflow belongs to the same project as story
    if (workflow.projectId !== story.projectId) {
      throw new Error(
        `Workflow "${workflow.name}" does not belong to the same project as story ${story.key}`,
      );
    }
  }

  // Update story's assigned workflow
  await prisma.story.update({
    where: { id: story.id },
    data: {
      assignedWorkflowId: params.workflowId || null,
    },
  });

  // Build response message
  let message;
  if (params.workflowId) {
    message = `Assigned workflow "${workflow.name}" to story ${story.key}`;
  } else {
    message = `Cleared workflow assignment for story ${story.key}`;
  }

  return {
    success: true,
    story: {
      id: story.id,
      key: story.key,
      title: story.title,
    },
    workflow: workflow
      ? {
          id: workflow.id,
          name: workflow.name,
          description: workflow.description,
        }
      : null,
    previousWorkflowId: story.assignedWorkflowId,
    message,
  };
}
