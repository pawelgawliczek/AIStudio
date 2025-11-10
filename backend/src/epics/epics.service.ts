import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEpicDto, UpdateEpicDto, FilterEpicDto } from './dto';
import { EpicStatus } from '@prisma/client';

@Injectable()
export class EpicsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Generate next epic key for a project
   * @param projectId - Project ID
   * @returns Next epic key (e.g., EP-1, EP-2)
   */
  private async generateNextKey(projectId: string): Promise<string> {
    const lastEpic = await this.prisma.epic.findFirst({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      select: { key: true },
    });

    if (!lastEpic) {
      return 'EP-1';
    }

    const lastNumber = parseInt(lastEpic.key.split('-')[1]);
    return `EP-${lastNumber + 1}`;
  }

  /**
   * Create a new epic
   * @param createEpicDto - Epic creation data
   * @returns Created epic
   */
  async create(createEpicDto: CreateEpicDto) {
    // Verify project exists
    const project = await this.prisma.project.findUnique({
      where: { id: createEpicDto.projectId },
    });

    if (!project) {
      throw new NotFoundException(`Project with ID ${createEpicDto.projectId} not found`);
    }

    // Generate epic key
    const key = await this.generateNextKey(createEpicDto.projectId);

    // Create epic
    return this.prisma.epic.create({
      data: {
        ...createEpicDto,
        key,
        status: EpicStatus.planning,
      },
      include: {
        project: {
          select: { id: true, name: true },
        },
        _count: {
          select: {
            stories: true,
            commits: true,
          },
        },
      },
    });
  }

  /**
   * Find all epics with filters
   * @param filterDto - Filter criteria
   * @returns List of epics
   */
  async findAll(filterDto: FilterEpicDto) {
    const { projectId, status } = filterDto;

    const where: any = {};
    if (projectId) where.projectId = projectId;
    if (status) where.status = status;

    return this.prisma.epic.findMany({
      where,
      include: {
        project: {
          select: { id: true, name: true },
        },
        _count: {
          select: {
            stories: true,
            commits: true,
          },
        },
      },
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
    });
  }

  /**
   * Find one epic by ID
   * @param id - Epic ID
   * @returns Epic with related data
   */
  async findOne(id: string) {
    const epic = await this.prisma.epic.findUnique({
      where: { id },
      include: {
        project: {
          select: { id: true, name: true },
        },
        stories: {
          orderBy: { createdAt: 'desc' },
          include: {
            _count: {
              select: {
                subtasks: true,
                commits: true,
              },
            },
          },
        },
        _count: {
          select: {
            stories: true,
            commits: true,
          },
        },
      },
    });

    if (!epic) {
      throw new NotFoundException(`Epic with ID ${id} not found`);
    }

    return epic;
  }

  /**
   * Update epic
   * @param id - Epic ID
   * @param updateEpicDto - Update data
   * @returns Updated epic
   */
  async update(id: string, updateEpicDto: UpdateEpicDto) {
    const existingEpic = await this.prisma.epic.findUnique({ where: { id } });

    if (!existingEpic) {
      throw new NotFoundException(`Epic with ID ${id} not found`);
    }

    return this.prisma.epic.update({
      where: { id },
      data: updateEpicDto,
      include: {
        project: {
          select: { id: true, name: true },
        },
        _count: {
          select: {
            stories: true,
            commits: true,
          },
        },
      },
    });
  }

  /**
   * Delete epic
   * @param id - Epic ID
   * @throws BadRequestException if epic has stories
   */
  async remove(id: string) {
    const epic = await this.prisma.epic.findUnique({
      where: { id },
      include: {
        _count: {
          select: { stories: true },
        },
      },
    });

    if (!epic) {
      throw new NotFoundException(`Epic with ID ${id} not found`);
    }

    // Prevent deletion if epic has stories
    if (epic._count.stories > 0) {
      throw new BadRequestException(
        `Cannot delete epic with ${epic._count.stories} stories. Delete or reassign stories first.`
      );
    }

    await this.prisma.epic.delete({ where: { id } });

    return { message: 'Epic deleted successfully' };
  }
}
