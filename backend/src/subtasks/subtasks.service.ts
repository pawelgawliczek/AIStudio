import { Injectable, NotFoundException } from '@nestjs/common';
import { SubtaskStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AppWebSocketGateway } from '../websocket/websocket.gateway';
import { CreateSubtaskDto, UpdateSubtaskDto, FilterSubtaskDto } from './dto';

@Injectable()
export class SubtasksService {
  constructor(
    private prisma: PrismaService,
    private wsGateway: AppWebSocketGateway,
  ) {}

  /**
   * Create a new subtask
   * @param createSubtaskDto - Subtask creation data
   * @returns Created subtask
   */
  async create(createSubtaskDto: CreateSubtaskDto) {
    // Verify story exists
    const story = await this.prisma.story.findUnique({
      where: { id: createSubtaskDto.storyId },
      select: { id: true, projectId: true },
    });

    if (!story) {
      throw new NotFoundException(`Story with ID ${createSubtaskDto.storyId} not found`);
    }

    // Create subtask
    const subtask = await this.prisma.subtask.create({
      data: {
        ...createSubtaskDto,
        status: SubtaskStatus.todo,
      },
      include: {
        story: {
          select: {
            id: true,
            key: true,
            title: true,
          },
        },
      },
    });

    // Broadcast subtask created
    this.wsGateway.broadcastSubtaskCreated(
      subtask.storyId,
      story.projectId,
      subtask
    );

    return subtask;
  }

  /**
   * Find all subtasks with filters
   * @param filterDto - Filter criteria
   * @returns List of subtasks
   */
  async findAll(filterDto: FilterSubtaskDto) {
    const { storyId, status, assigneeType } = filterDto;

    const where: any = {};
    if (storyId) where.storyId = storyId;
    if (status) where.status = status;
    if (assigneeType) where.assigneeType = assigneeType;

    return this.prisma.subtask.findMany({
      where,
      include: {
        story: {
          select: {
            id: true,
            key: true,
            title: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Find one subtask by ID
   * @param id - Subtask ID
   * @returns Subtask with related data
   */
  async findOne(id: string) {
    const subtask = await this.prisma.subtask.findUnique({
      where: { id },
      include: {
        story: {
          select: {
            id: true,
            key: true,
            title: true,
            projectId: true,
          },
        },
        runs: {
          orderBy: { startedAt: 'desc' },
          take: 5,
        },
      },
    });

    if (!subtask) {
      throw new NotFoundException(`Subtask with ID ${id} not found`);
    }

    return subtask;
  }

  /**
   * Update subtask
   * @param id - Subtask ID
   * @param updateSubtaskDto - Update data
   * @returns Updated subtask
   */
  async update(id: string, updateSubtaskDto: UpdateSubtaskDto) {
    const existingSubtask = await this.prisma.subtask.findUnique({
      where: { id },
      include: {
        story: {
          select: { id: true, projectId: true },
        },
      },
    });

    if (!existingSubtask) {
      throw new NotFoundException(`Subtask with ID ${id} not found`);
    }

    const subtask = await this.prisma.subtask.update({
      where: { id },
      data: updateSubtaskDto,
      include: {
        story: {
          select: {
            id: true,
            key: true,
            title: true,
          },
        },
      },
    });

    // Broadcast subtask updated
    this.wsGateway.broadcastSubtaskUpdated(
      id,
      subtask.storyId,
      existingSubtask.story.projectId,
      subtask
    );

    return subtask;
  }

  /**
   * Delete subtask
   * @param id - Subtask ID
   */
  async remove(id: string) {
    const subtask = await this.prisma.subtask.findUnique({ where: { id } });

    if (!subtask) {
      throw new NotFoundException(`Subtask with ID ${id} not found`);
    }

    await this.prisma.subtask.delete({ where: { id } });

    return { message: 'Subtask deleted successfully' };
  }
}
