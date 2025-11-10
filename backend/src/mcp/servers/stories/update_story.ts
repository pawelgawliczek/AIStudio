/**
 * Update Story Tool
 * Updates an existing story (title, description, status, complexity, framework)
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { PrismaClient } from '@prisma/client';
import {
  UpdateStoryParams,
  StoryResponse,
  NotFoundError,
} from '../../types';
import {
  formatStory,
  validateRequired,
  handlePrismaError,
} from '../../utils';

export const tool: Tool = {
  name: 'update_story',
  description:
    'Update an existing story (title, description, status, complexity, framework)',
  inputSchema: {
    type: 'object',
    properties: {
      storyId: {
        type: 'string',
        description: 'Story UUID',
      },
      title: {
        type: 'string',
        description: 'New story title',
      },
      description: {
        type: 'string',
        description: 'New story description',
      },
      status: {
        type: 'string',
        enum: ['planning', 'analysis', 'architecture', 'design', 'impl', 'review', 'qa', 'done'],
        description: 'New story status',
      },
      businessImpact: {
        type: 'number',
        description: 'Business impact score (1-10)',
      },
      businessComplexity: {
        type: 'number',
        description: 'Business complexity score (1-10)',
      },
      technicalComplexity: {
        type: 'number',
        description: 'Technical complexity score (1-10)',
      },
      assignedFrameworkId: {
        type: 'string',
        description: 'Framework UUID to assign this story to',
      },
    },
    required: ['storyId'],
  },
};

export const metadata = {
  category: 'stories',
  domain: 'project_management',
  tags: ['story', 'update', 'modify'],
  version: '1.0.0',
  since: 'sprint-3',
};

export async function handler(
  prisma: PrismaClient,
  params: UpdateStoryParams,
): Promise<StoryResponse> {
  try {
    validateRequired(params, ['storyId']);

    // Verify story exists
    const existingStory = await prisma.story.findUnique({
      where: { id: params.storyId },
    });

    if (!existingStory) {
      throw new NotFoundError('Story', params.storyId);
    }

    // Verify framework exists if provided
    if (params.assignedFrameworkId) {
      const framework = await prisma.agentFramework.findUnique({
        where: { id: params.assignedFrameworkId },
      });

      if (!framework) {
        throw new NotFoundError('Framework', params.assignedFrameworkId);
      }
    }

    // Build update data object (only include provided fields)
    const updateData: any = {};

    if (params.title !== undefined) updateData.title = params.title;
    if (params.description !== undefined) updateData.description = params.description;
    if (params.status !== undefined) updateData.status = params.status;
    if (params.businessImpact !== undefined)
      updateData.businessImpact = params.businessImpact;
    if (params.businessComplexity !== undefined)
      updateData.businessComplexity = params.businessComplexity;
    if (params.technicalComplexity !== undefined)
      updateData.technicalComplexity = params.technicalComplexity;
    if (params.assignedFrameworkId !== undefined)
      updateData.assignedFrameworkId = params.assignedFrameworkId;

    // Update story
    const updatedStory = await prisma.story.update({
      where: { id: params.storyId },
      data: updateData,
    });

    return formatStory(updatedStory);
  } catch (error: any) {
    if (error.name === 'MCPError') {
      throw error;
    }
    throw handlePrismaError(error, 'update_story');
  }
}
