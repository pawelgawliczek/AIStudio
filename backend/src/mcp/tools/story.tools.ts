/**
 * Story Management MCP Tools
 */

import { PrismaClient } from '@prisma/client';
import {
  CreateStoryParams,
  ListStoriesParams,
  GetStoryParams,
  UpdateStoryParams,
  StoryResponse,
  PaginatedResponse,
  NotFoundError,
  ValidationError,
} from '../types/';
import {
  formatStory,
  generateNextKey,
  validateRequired,
  handlePrismaError,
  getSystemUserId,
} from '../utils';

/**
 * Create a new story
 */
export async function createStory(
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

    // Create story
    const story = await prisma.story.create({
      data: {
        projectId: params.projectId,
        epicId: params.epicId,
        key,
        type: params.type || 'feature',
        title: params.title,
        description: params.description,
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

/**
 * List stories with optional filters and pagination
 */
export async function listStories(
  prisma: PrismaClient,
  params: ListStoriesParams = {},
): Promise<PaginatedResponse<StoryResponse>> {
  try {
    const page = params.page || 1;
    const pageSize = Math.min(params.pageSize || 20, 100);
    const skip = (page - 1) * pageSize;

    // Build where clause dynamically
    const whereClause: any = {};

    if (params.projectId) {
      whereClause.projectId = params.projectId;
    }

    if (params.epicId) {
      whereClause.epicId = params.epicId;
    }

    if (params.status) {
      whereClause.status = params.status;
    }

    if (params.type) {
      whereClause.type = params.type;
    }

    // Get total count
    const total = await prisma.story.count({ where: whereClause });

    // Get paginated data
    const stories = await prisma.story.findMany({
      where: whereClause,
      skip,
      take: pageSize,
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    });

    const totalPages = Math.ceil(total / pageSize);

    return {
      data: stories.map((s: any) => formatStory(s)),
      pagination: {
        page,
        pageSize,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    };
  } catch (error: any) {
    throw handlePrismaError(error, 'list_stories');
  }
}

/**
 * Get a single story by ID with optional related data
 */
export async function getStory(
  prisma: PrismaClient,
  params: GetStoryParams,
): Promise<StoryResponse> {
  try {
    validateRequired(params, ['storyId']);

    const includeClause: any = {};

    if (params.includeSubtasks) {
      includeClause.subtasks = {
        orderBy: { createdAt: 'asc' },
      };
    }

    if (params.includeUseCases) {
      includeClause.useCaseLinks = {
        include: {
          useCase: {
            include: {
              versions: {
                orderBy: { version: 'desc' },
                take: 1,
              },
            },
          },
        },
      };
    }

    if (params.includeCommits) {
      includeClause.commits = {
        include: {
          files: true,
        },
        orderBy: { timestamp: 'desc' },
        take: 10, // Limit to last 10 commits
      };
    }

    const story = await prisma.story.findUnique({
      where: { id: params.storyId },
      include: Object.keys(includeClause).length > 0 ? includeClause : undefined,
    });

    if (!story) {
      throw new NotFoundError('Story', params.storyId);
    }

    return formatStory(
      story,
      params.includeSubtasks || params.includeUseCases || params.includeCommits,
    );
  } catch (error: any) {
    if (error.name === 'MCPError') {
      throw error;
    }
    throw handlePrismaError(error, 'get_story');
  }
}

/**
 * Update an existing story
 */
export async function updateStory(
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

/**
 * Get aggregated story statistics with grouping (Sprint 4.5)
 */
export async function getStorySummary(
  prisma: PrismaClient,
  params: { projectId: string; groupBy: 'status' | 'type' | 'epic' | 'complexity' },
): Promise<any> {
  try {
    validateRequired(params, ['projectId', 'groupBy']);

    const { projectId, groupBy } = params;

    switch (groupBy) {
      case 'status': {
        const byStatus = await prisma.story.groupBy({
          by: ['status'],
          where: { projectId },
          _count: true,
          _avg: { technicalComplexity: true },
        });
        return {
          groupBy: 'status',
          summary: byStatus.map((s) => ({
            status: s.status,
            count: s._count,
            avgComplexity: s._avg.technicalComplexity,
          })),
        };
      }

      case 'type': {
        const byType = await prisma.story.groupBy({
          by: ['type'],
          where: { projectId },
          _count: true,
        });
        return {
          groupBy: 'type',
          summary: byType.map((t) => ({
            type: t.type,
            count: t._count,
          })),
        };
      }

      case 'epic': {
        const byEpic = await prisma.story.groupBy({
          by: ['epicId'],
          where: { projectId },
          _count: true,
        });
        // Enrich with epic titles
        const epicIds = byEpic.map((e) => e.epicId).filter(Boolean) as string[];
        const epics = await prisma.epic.findMany({
          where: { id: { in: epicIds } },
          select: { id: true, key: true, title: true },
        });
        const epicMap = new Map(epics.map((e) => [e.id, e]));

        return {
          groupBy: 'epic',
          summary: byEpic.map((e) => ({
            epicId: e.epicId,
            epic: e.epicId ? epicMap.get(e.epicId) : null,
            count: e._count,
          })),
        };
      }

      case 'complexity': {
        const byComplexity = await prisma.story.groupBy({
          by: ['technicalComplexity'],
          where: { projectId },
          _count: true,
        });
        return {
          groupBy: 'complexity',
          summary: byComplexity
            .filter((c) => c.technicalComplexity !== null)
            .map((c) => ({
              complexity: c.technicalComplexity,
              count: c._count,
            }))
            .sort((a, b) => (a.complexity || 0) - (b.complexity || 0)),
        };
      }

      default:
        throw new ValidationError(`Invalid groupBy: ${groupBy}`);
    }
  } catch (error: any) {
    if (error.name === 'MCPError') {
      throw error;
    }
    throw handlePrismaError(error, 'get_story_summary');
  }
}
