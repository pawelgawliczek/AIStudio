import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StoryStatus, Prisma } from '@prisma/client';
import {
  CreateStoryDto,
  UpdateStoryDto,
  FilterStoryDto,
  UpdateStoryStatusDto,
} from './dto';
import { AppWebSocketGateway } from '../websocket/websocket.gateway';

/**
 * Story Workflow State Machine
 * Defines valid state transitions for stories
 */
const STORY_WORKFLOW: Record<StoryStatus, StoryStatus[]> = {
  backlog: [StoryStatus.planning],
  planning: [StoryStatus.backlog, StoryStatus.analysis],
  analysis: [StoryStatus.planning, StoryStatus.architecture],
  architecture: [StoryStatus.analysis, StoryStatus.design],
  design: [StoryStatus.architecture, StoryStatus.implementation],
  implementation: [StoryStatus.design, StoryStatus.review],
  review: [StoryStatus.implementation, StoryStatus.qa],
  qa: [StoryStatus.review, StoryStatus.done, StoryStatus.implementation],
  done: [], // Terminal state - can only be changed by admin override
  blocked: [], // Can be moved from any state, but cannot transition forward until unblocked
};

@Injectable()
export class StoriesService {
  constructor(
    private prisma: PrismaService,
    private wsGateway: AppWebSocketGateway,
  ) {}

  /**
   * Generate next story key for a project
   * @param projectId - Project ID
   * @returns Next story key (e.g., ST-1, ST-2)
   */
  private async generateNextKey(projectId: string): Promise<string> {
    const lastStory = await this.prisma.story.findFirst({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      select: { key: true },
    });

    if (!lastStory) {
      return 'ST-1';
    }

    const lastNumber = parseInt(lastStory.key.split('-')[1]);
    return `ST-${lastNumber + 1}`;
  }

  /**
   * Validate story status transition
   * @param currentStatus - Current story status
   * @param newStatus - Desired new status
   * @param isAdmin - Whether user is admin (can override workflow)
   * @throws BadRequestException if transition is invalid
   */
  private validateStatusTransition(
    currentStatus: StoryStatus,
    newStatus: StoryStatus,
    isAdmin: boolean = false
  ): void {
    // Admin can override any transition
    if (isAdmin) {
      return;
    }

    // Check if new status is same as current
    if (currentStatus === newStatus) {
      return; // Allow staying in same state
    }

    // Get valid next states
    const validNextStates = STORY_WORKFLOW[currentStatus];

    // Check if transition is valid
    if (!validNextStates.includes(newStatus)) {
      throw new BadRequestException(
        `Invalid status transition from ${currentStatus} to ${newStatus}. ` +
          `Valid next states: ${validNextStates.join(', ')}`
      );
    }
  }

  /**
   * Check if story has required complexity fields for implementation
   * @param story - Story to check
   * @throws BadRequestException if complexity fields are missing
   */
  private validateComplexityForImplementation(story: any): void {
    if (
      !story.businessComplexity ||
      !story.technicalComplexity ||
      !story.businessImpact
    ) {
      throw new BadRequestException(
        'Story must have businessComplexity, technicalComplexity, and businessImpact ' +
          'before moving to implementation phase'
      );
    }
  }

  /**
   * Create a new story
   * @param createStoryDto - Story creation data
   * @param userId - User ID creating the story
   * @returns Created story
   */
  async create(createStoryDto: CreateStoryDto, userId: string) {
    // Verify project exists
    const project = await this.prisma.project.findUnique({
      where: { id: createStoryDto.projectId },
    });

    if (!project) {
      throw new NotFoundException(`Project with ID ${createStoryDto.projectId} not found`);
    }

    // Verify epic exists if provided
    if (createStoryDto.epicId) {
      const epic = await this.prisma.epic.findUnique({
        where: { id: createStoryDto.epicId },
      });

      if (!epic) {
        throw new NotFoundException(`Epic with ID ${createStoryDto.epicId} not found`);
      }
    }

    // Generate story key
    const key = await this.generateNextKey(createStoryDto.projectId);

    // Create story
    const story = await this.prisma.story.create({
      data: {
        ...createStoryDto,
        key,
        createdById: userId,
        status: StoryStatus.planning, // Always start in planning
      },
      include: {
        project: {
          select: { id: true, name: true },
        },
        epic: {
          select: { id: true, key: true, title: true },
        },
        assignedFramework: {
          select: { id: true, name: true },
        },
        _count: {
          select: {
            subtasks: true,
            commits: true,
          },
        },
      },
    });

    // Broadcast story created
    this.wsGateway.broadcastStoryCreated(story.projectId, story);

    return story;
  }

  /**
   * Find all stories with filters
   * @param filterDto - Filter criteria
   * @returns Paginated list of stories
   */
  async findAll(filterDto: FilterStoryDto) {
    const {
      projectId,
      epicId,
      status,
      type,
      assignedFrameworkId,
      search,
      minTechnicalComplexity,
      maxTechnicalComplexity,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      page = 1,
      limit = 20,
    } = filterDto;

    // Build where clause
    const where: Prisma.StoryWhereInput = {};

    if (projectId) where.projectId = projectId;
    if (epicId) where.epicId = epicId;
    if (status) where.status = status;
    if (type) where.type = type;
    if (assignedFrameworkId) where.assignedFrameworkId = assignedFrameworkId;

    // Technical complexity range
    if (minTechnicalComplexity !== undefined || maxTechnicalComplexity !== undefined) {
      where.technicalComplexity = {};
      if (minTechnicalComplexity !== undefined) {
        where.technicalComplexity.gte = minTechnicalComplexity;
      }
      if (maxTechnicalComplexity !== undefined) {
        where.technicalComplexity.lte = maxTechnicalComplexity;
      }
    }

    // Search in title or description
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Pagination
    const skip = (page - 1) * limit;

    // Get stories and total count
    const [stories, total] = await Promise.all([
      this.prisma.story.findMany({
        where,
        include: {
          project: {
            select: { id: true, name: true },
          },
          epic: {
            select: { id: true, key: true, title: true },
          },
          assignedFramework: {
            select: { id: true, name: true },
          },
          _count: {
            select: {
              subtasks: true,
              commits: true,
            },
          },
        },
        orderBy: { [sortBy]: sortOrder },
        skip,
        take: limit,
      }),
      this.prisma.story.count({ where }),
    ]);

    return {
      data: stories,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Find one story by ID
   * @param id - Story ID
   * @param includeDetails - Whether to include related data
   * @returns Story with optional related data including complete traceability
   */
  async findOne(id: string, includeDetails: boolean = true) {
    const include = includeDetails
      ? {
          project: true,
          epic: true,
          assignedFramework: true,
          subtasks: {
            orderBy: { createdAt: 'asc' as const },
          },
          useCaseLinks: {
            include: {
              useCase: {
                include: {
                  testCases: {
                    orderBy: { createdAt: 'asc' as const },
                  },
                },
              },
            },
            orderBy: { createdAt: 'asc' as const },
          },
          commits: {
            include: {
              files: true,
            },
            orderBy: { timestamp: 'desc' as const },
            take: 20,
          },
          workflowRuns: {
            include: {
              workflow: true,
              coordinator: true,
              componentRuns: {
                include: {
                  component: true,
                },
                orderBy: { executionOrder: 'asc' as const },
              },
            },
            orderBy: { startedAt: 'desc' as const },
          },
          _count: {
            select: {
              subtasks: true,
              commits: true,
              runs: true,
              workflowRuns: true,
            },
          },
        }
      : undefined;

    const story = await this.prisma.story.findUnique({
      where: { id },
      include,
    });

    if (!story) {
      throw new NotFoundException(`Story with ID ${id} not found`);
    }

    return story;
  }

  /**
   * Update story
   * @param id - Story ID
   * @param updateStoryDto - Update data
   * @returns Updated story
   */
  async update(id: string, updateStoryDto: UpdateStoryDto) {
    const existingStory = await this.prisma.story.findUnique({ where: { id } });

    if (!existingStory) {
      throw new NotFoundException(`Story with ID ${id} not found`);
    }

    // Verify epic exists if being updated
    if (updateStoryDto.epicId) {
      const epic = await this.prisma.epic.findUnique({
        where: { id: updateStoryDto.epicId },
      });

      if (!epic) {
        throw new NotFoundException(`Epic with ID ${updateStoryDto.epicId} not found`);
      }
    }

    const story = await this.prisma.story.update({
      where: { id },
      data: updateStoryDto,
      include: {
        project: {
          select: { id: true, name: true },
        },
        epic: {
          select: { id: true, key: true, title: true },
        },
        assignedFramework: {
          select: { id: true, name: true },
        },
      },
    });

    // Broadcast story updated
    this.wsGateway.broadcastStoryUpdated(id, story.projectId, story);

    return story;
  }

  /**
   * Update story status with workflow validation
   * @param id - Story ID
   * @param updateStatusDto - Status update data
   * @param isAdmin - Whether user is admin
   * @returns Updated story
   */
  async updateStatus(
    id: string,
    updateStatusDto: UpdateStoryStatusDto,
    isAdmin: boolean = false
  ) {
    const story = await this.findOne(id, false);
    const oldStatus = story.status;

    // Validate status transition
    this.validateStatusTransition(story.status, updateStatusDto.status, isAdmin);

    // If moving to implementation, check complexity fields
    if (updateStatusDto.status === StoryStatus.implementation && !isAdmin) {
      this.validateComplexityForImplementation(story);
    }

    const updatedStory = await this.prisma.story.update({
      where: { id },
      data: { status: updateStatusDto.status },
      include: {
        project: {
          select: { id: true, name: true },
        },
        epic: {
          select: { id: true, key: true, title: true },
        },
      },
    });

    // Broadcast status changed
    this.wsGateway.broadcastStoryStatusChanged(id, updatedStory.projectId, {
      storyId: id,
      oldStatus: oldStatus,
      newStatus: updatedStory.status,
      story: updatedStory,
    });

    return updatedStory;
  }

  /**
   * Assign story to framework
   * @param id - Story ID
   * @param frameworkId - Framework ID
   * @returns Updated story
   */
  async assignFramework(id: string, frameworkId: string) {
    const story = await this.findOne(id, false);

    // Verify framework exists
    const framework = await this.prisma.agentFramework.findUnique({
      where: { id: frameworkId },
    });

    if (!framework) {
      throw new NotFoundException(`Framework with ID ${frameworkId} not found`);
    }

    return this.prisma.story.update({
      where: { id },
      data: { assignedFrameworkId: frameworkId },
      include: {
        assignedFramework: {
          select: { id: true, name: true },
        },
      },
    });
  }

  /**
   * Delete story
   * @param id - Story ID
   */
  async remove(id: string) {
    const story = await this.prisma.story.findUnique({ where: { id } });

    if (!story) {
      throw new NotFoundException(`Story with ID ${id} not found`);
    }

    await this.prisma.story.delete({ where: { id } });

    return { message: 'Story deleted successfully' };
  }

  /**
   * Update story priority
   * @param id - Story ID
   * @param priority - New priority value
   * @returns Updated story
   */
  async updatePriority(id: string, priority: number) {
    const story = await this.prisma.story.findUnique({ where: { id } });

    if (!story) {
      throw new NotFoundException(`Story with ID ${id} not found`);
    }

    const updatedStory = await this.prisma.story.update({
      where: { id },
      data: { priority },
      include: {
        epic: {
          select: { id: true, title: true },
        },
        _count: {
          select: {
            subtasks: true,
            commits: true,
          },
        },
      },
    });

    // Broadcast story updated
    this.wsGateway.broadcastStoryUpdated(id, updatedStory.projectId, updatedStory);

    return updatedStory;
  }

  /**
   * Reassign story to a different epic
   * @param id - Story ID
   * @param epicId - New epic ID (or null to unassign)
   * @param priority - Optional new priority
   * @returns Updated story
   */
  async reassignEpic(id: string, epicId: string | null, priority?: number) {
    const story = await this.prisma.story.findUnique({ where: { id } });

    if (!story) {
      throw new NotFoundException(`Story with ID ${id} not found`);
    }

    // If epicId is provided, verify it exists
    if (epicId) {
      const epic = await this.prisma.epic.findUnique({ where: { id: epicId } });
      if (!epic) {
        throw new NotFoundException(`Epic with ID ${epicId} not found`);
      }
    }

    const updateData: any = { epicId };
    if (priority !== undefined) {
      updateData.priority = priority;
    }

    const updatedStory = await this.prisma.story.update({
      where: { id },
      data: updateData,
      include: {
        epic: {
          select: { id: true, title: true },
        },
        _count: {
          select: {
            subtasks: true,
            commits: true,
          },
        },
      },
    });

    // Broadcast story updated
    this.wsGateway.broadcastStoryUpdated(id, updatedStory.projectId, updatedStory);

    return updatedStory;
  }
}
