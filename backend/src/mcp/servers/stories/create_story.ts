/**
 * Create Story Tool
 * Creates a new story within a project and optionally an epic
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { PrismaClient } from '@prisma/client';
import {
  CreateStoryParams,
  StoryResponse,
  NotFoundError,
  ValidationError,
} from '../../types';
import {
  formatStory,
  generateNextKey,
  validateRequired,
  handlePrismaError,
  getSystemUserId,
  autoTruncateSummary,
} from '../../utils';

export const tool: Tool = {
  name: 'create_story',
  description: 'Create a new story in a project. Requires projectId and title.',
  inputSchema: {
    type: 'object',
    properties: {
      projectId: {
        type: 'string',
        description: 'Project UUID',
      },
      epicId: {
        type: 'string',
        description: 'Epic UUID (optional)',
      },
      title: {
        type: 'string',
        description: 'Story title',
      },
      description: {
        type: 'string',
        description: 'Story description',
      },
      type: {
        type: 'string',
        enum: ['feature', 'bug', 'defect', 'chore', 'spike'],
        description: 'Story type (default: feature)',
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
      summary: {
        type: 'string',
        description:
          'AI-generated 2-sentence summary (max 300 chars). If not provided, auto-truncates from description.',
      },
    },
    required: ['projectId', 'title'],
  },
};

export const metadata = {
  category: 'stories',
  domain: 'project_management',
  tags: ['story', 'create'],
  version: '1.0.0',
  since: 'sprint-3',
};

export async function handler(
  prisma: PrismaClient,
  params: CreateStoryParams,
): Promise<StoryResponse> {
  try {
    validateRequired(params, ['projectId', 'title']);

    // Verify project exists
    const project = await prisma.project.findUnique({
      where: { id: params.projectId },
    });

    if (!project) {
      throw new NotFoundError('Project', params.projectId);
    }

    // Verify epic exists if provided
    if (params.epicId) {
      const epic = await prisma.epic.findUnique({
        where: { id: params.epicId },
      });

      if (!epic) {
        throw new NotFoundError('Epic', params.epicId);
      }

      // Verify epic belongs to the project
      if (epic.projectId !== params.projectId) {
        throw new ValidationError('Epic does not belong to the specified project');
      }
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

    // Get system user ID for createdBy
    const systemUserId = await getSystemUserId(prisma);

    // Generate next story key (e.g., ST-1, ST-2)
    const key = await generateNextKey(prisma, 'story', params.projectId);

    // Generate summary: use provided summary or auto-truncate from description
    const summary =
      params.summary?.slice(0, 300) ||
      autoTruncateSummary(params.description);

    // Create story
    const story = await prisma.story.create({
      data: {
        projectId: params.projectId,
        epicId: params.epicId,
        key,
        type: params.type || 'feature',
        title: params.title,
        description: params.description,
        summary,
        status: 'planning',
        businessImpact: params.businessImpact,
        businessComplexity: params.businessComplexity,
        technicalComplexity: params.technicalComplexity,
        assignedFrameworkId: params.assignedFrameworkId,
        createdById: systemUserId,
      },
    });

    return formatStory(story);
  } catch (error: any) {
    if (error.name === 'MCPError') {
      throw error;
    }
    throw handlePrismaError(error, 'create_story');
  }
}
