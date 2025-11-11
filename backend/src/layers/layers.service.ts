import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLayerDto, UpdateLayerDto, FilterLayerDto } from './dto';
import { LayerStatus } from '@prisma/client';
import { AppWebSocketGateway } from '../websocket/websocket.gateway';

@Injectable()
export class LayersService {
  constructor(
    private prisma: PrismaService,
    private wsGateway: AppWebSocketGateway,
  ) {}

  /**
   * Create a new layer
   * @param createLayerDto - Layer creation data
   * @returns Created layer
   */
  async create(createLayerDto: CreateLayerDto) {
    // Verify project exists
    const project = await this.prisma.project.findUnique({
      where: { id: createLayerDto.projectId },
    });

    if (!project) {
      throw new NotFoundException(`Project with ID ${createLayerDto.projectId} not found`);
    }

    // Check for duplicate name within project
    const existing = await this.prisma.layer.findUnique({
      where: {
        projectId_name: {
          projectId: createLayerDto.projectId,
          name: createLayerDto.name,
        },
      },
    });

    if (existing) {
      throw new ConflictException(`Layer with name "${createLayerDto.name}" already exists in this project`);
    }

    // Create layer
    const layer = await this.prisma.layer.create({
      data: {
        ...createLayerDto,
        status: createLayerDto.status || LayerStatus.active,
      },
      include: {
        project: {
          select: { id: true, name: true },
        },
        _count: {
          select: {
            storyLayers: true,
            componentLayers: true,
            useCases: true,
            testCases: true,
          },
        },
      },
    });

    // Broadcast layer created
    this.wsGateway.server?.emit('layer:created', {
      projectId: layer.projectId,
      layer,
    });

    return layer;
  }

  /**
   * Find all layers with filters
   * @param filterDto - Filter criteria
   * @returns List of layers
   */
  async findAll(filterDto: FilterLayerDto) {
    const { projectId, status } = filterDto;

    const where: any = {};
    if (projectId) where.projectId = projectId;
    if (status) where.status = status;

    return this.prisma.layer.findMany({
      where,
      include: {
        project: {
          select: { id: true, name: true },
        },
        _count: {
          select: {
            storyLayers: true,
            componentLayers: true,
            useCases: true,
            testCases: true,
          },
        },
      },
      orderBy: [{ orderIndex: 'asc' }, { createdAt: 'asc' }],
    });
  }

  /**
   * Find one layer by ID
   * @param id - Layer ID
   * @returns Layer with related data
   */
  async findOne(id: string) {
    const layer = await this.prisma.layer.findUnique({
      where: { id },
      include: {
        project: {
          select: { id: true, name: true },
        },
        componentLayers: {
          include: {
            component: {
              select: { id: true, name: true, icon: true, color: true },
            },
          },
        },
        _count: {
          select: {
            storyLayers: true,
            componentLayers: true,
            useCases: true,
            testCases: true,
          },
        },
      },
    });

    if (!layer) {
      throw new NotFoundException(`Layer with ID ${id} not found`);
    }

    return layer;
  }

  /**
   * Update layer
   * @param id - Layer ID
   * @param updateLayerDto - Update data
   * @returns Updated layer
   */
  async update(id: string, updateLayerDto: UpdateLayerDto) {
    const existingLayer = await this.prisma.layer.findUnique({ where: { id } });

    if (!existingLayer) {
      throw new NotFoundException(`Layer with ID ${id} not found`);
    }

    // Check for duplicate name if name is being changed
    if (updateLayerDto.name && updateLayerDto.name !== existingLayer.name) {
      const duplicate = await this.prisma.layer.findUnique({
        where: {
          projectId_name: {
            projectId: existingLayer.projectId,
            name: updateLayerDto.name,
          },
        },
      });

      if (duplicate) {
        throw new ConflictException(`Layer with name "${updateLayerDto.name}" already exists in this project`);
      }
    }

    const layer = await this.prisma.layer.update({
      where: { id },
      data: updateLayerDto,
      include: {
        project: {
          select: { id: true, name: true },
        },
        _count: {
          select: {
            storyLayers: true,
            componentLayers: true,
            useCases: true,
            testCases: true,
          },
        },
      },
    });

    // Broadcast layer updated
    this.wsGateway.server?.emit('layer:updated', {
      layerId: id,
      projectId: layer.projectId,
      layer,
    });

    return layer;
  }

  /**
   * Delete layer
   * @param id - Layer ID
   * @throws BadRequestException if layer is in use
   */
  async remove(id: string) {
    const layer = await this.prisma.layer.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            storyLayers: true,
            componentLayers: true,
            useCases: true,
            testCases: true,
          },
        },
      },
    });

    if (!layer) {
      throw new NotFoundException(`Layer with ID ${id} not found`);
    }

    // Prevent deletion if layer is in use
    const totalUsage =
      layer._count.storyLayers +
      layer._count.componentLayers +
      layer._count.useCases +
      layer._count.testCases;

    if (totalUsage > 0) {
      throw new BadRequestException(
        `Cannot delete layer "${layer.name}" - it is used by ${layer._count.storyLayers} stories, ` +
        `${layer._count.componentLayers} components, ${layer._count.useCases} use cases, ` +
        `and ${layer._count.testCases} test cases. Consider deprecating instead.`
      );
    }

    await this.prisma.layer.delete({ where: { id } });

    return { message: 'Layer deleted successfully' };
  }
}
