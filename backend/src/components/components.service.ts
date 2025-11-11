import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateComponentDto, UpdateComponentDto, FilterComponentDto } from './dto';
import { ComponentStatus } from '@prisma/client';
import { AppWebSocketGateway } from '../websocket/websocket.gateway';

@Injectable()
export class ComponentsService {
  constructor(
    private prisma: PrismaService,
    private wsGateway: AppWebSocketGateway,
  ) {}

  /**
   * Create a new component
   * @param createComponentDto - Component creation data
   * @returns Created component
   */
  async create(createComponentDto: CreateComponentDto) {
    // Verify project exists
    const project = await this.prisma.project.findUnique({
      where: { id: createComponentDto.projectId },
    });

    if (!project) {
      throw new NotFoundException(`Project with ID ${createComponentDto.projectId} not found`);
    }

    // Verify owner exists if provided
    if (createComponentDto.ownerId) {
      const owner = await this.prisma.user.findUnique({
        where: { id: createComponentDto.ownerId },
      });

      if (!owner) {
        throw new NotFoundException(`User with ID ${createComponentDto.ownerId} not found`);
      }
    }

    // Verify all layers exist if provided
    if (createComponentDto.layerIds && createComponentDto.layerIds.length > 0) {
      const layers = await this.prisma.layer.findMany({
        where: { id: { in: createComponentDto.layerIds } },
      });

      if (layers.length !== createComponentDto.layerIds.length) {
        throw new NotFoundException('One or more layer IDs are invalid');
      }
    }

    // Check for duplicate name within project
    const existing = await this.prisma.component.findUnique({
      where: {
        projectId_name: {
          projectId: createComponentDto.projectId,
          name: createComponentDto.name,
        },
      },
    });

    if (existing) {
      throw new ConflictException(`Component with name "${createComponentDto.name}" already exists in this project`);
    }

    // Extract layerIds and prepare data
    const { layerIds, ...componentData } = createComponentDto;

    // Create component with layer relationships
    const component = await this.prisma.component.create({
      data: {
        ...componentData,
        status: componentData.status || ComponentStatus.active,
        layers: layerIds && layerIds.length > 0
          ? {
              create: layerIds.map(layerId => ({ layerId })),
            }
          : undefined,
      },
      include: {
        project: {
          select: { id: true, name: true },
        },
        owner: {
          select: { id: true, name: true, email: true },
        },
        layers: {
          include: {
            layer: {
              select: { id: true, name: true, icon: true, color: true },
            },
          },
        },
        _count: {
          select: {
            storyComponents: true,
            useCases: true,
            testCases: true,
          },
        },
      },
    });

    // Broadcast component created
    this.wsGateway.server?.emit('component:created', {
      projectId: component.projectId,
      component,
    });

    return component;
  }

  /**
   * Find all components with filters
   * @param filterDto - Filter criteria
   * @returns List of components
   */
  async findAll(filterDto: FilterComponentDto) {
    const { projectId, status, layerId } = filterDto;

    const where: any = {};
    if (projectId) where.projectId = projectId;
    if (status) where.status = status;
    if (layerId) {
      where.layers = {
        some: { layerId },
      };
    }

    return this.prisma.component.findMany({
      where,
      include: {
        project: {
          select: { id: true, name: true },
        },
        owner: {
          select: { id: true, name: true, email: true },
        },
        layers: {
          include: {
            layer: {
              select: { id: true, name: true, icon: true, color: true, orderIndex: true },
            },
          },
          orderBy: {
            layer: { orderIndex: 'asc' },
          },
        },
        _count: {
          select: {
            storyComponents: true,
            useCases: true,
            testCases: true,
          },
        },
      },
      orderBy: [{ name: 'asc' }],
    });
  }

  /**
   * Find one component by ID
   * @param id - Component ID
   * @returns Component with related data
   */
  async findOne(id: string) {
    const component = await this.prisma.component.findUnique({
      where: { id },
      include: {
        project: {
          select: { id: true, name: true },
        },
        owner: {
          select: { id: true, name: true, email: true },
        },
        layers: {
          include: {
            layer: {
              select: { id: true, name: true, description: true, icon: true, color: true, orderIndex: true },
            },
          },
          orderBy: {
            layer: { orderIndex: 'asc' },
          },
        },
        _count: {
          select: {
            storyComponents: true,
            useCases: true,
            testCases: true,
          },
        },
      },
    });

    if (!component) {
      throw new NotFoundException(`Component with ID ${id} not found`);
    }

    return component;
  }

  /**
   * Find component with use cases (for BA workflow)
   * @param id - Component ID
   * @returns Component with all use cases
   */
  async findWithUseCases(id: string) {
    const component = await this.prisma.component.findUnique({
      where: { id },
      include: {
        project: {
          select: { id: true, name: true },
        },
        owner: {
          select: { id: true, name: true, email: true },
        },
        layers: {
          include: {
            layer: {
              select: { id: true, name: true, icon: true, color: true },
            },
          },
        },
        useCases: {
          include: {
            testCases: true,
            framework: {
              select: { id: true, name: true },
            },
          },
          orderBy: { ucCode: 'asc' },
        },
      },
    });

    if (!component) {
      throw new NotFoundException(`Component with ID ${id} not found`);
    }

    return component;
  }

  /**
   * Find component with stories (for viewing component impact)
   * @param id - Component ID
   * @returns Component with all related stories
   */
  async findWithStories(id: string) {
    const component = await this.prisma.component.findUnique({
      where: { id },
      include: {
        project: {
          select: { id: true, name: true },
        },
        owner: {
          select: { id: true, name: true, email: true },
        },
        layers: {
          include: {
            layer: {
              select: { id: true, name: true, icon: true, color: true },
            },
          },
        },
        storyComponents: {
          include: {
            story: {
              include: {
                epic: {
                  select: { id: true, title: true },
                },
                assignedTo: {
                  select: { id: true, name: true },
                },
              },
            },
          },
        },
      },
    });

    if (!component) {
      throw new NotFoundException(`Component with ID ${id} not found`);
    }

    return component;
  }

  /**
   * Update component
   * @param id - Component ID
   * @param updateComponentDto - Update data
   * @returns Updated component
   */
  async update(id: string, updateComponentDto: UpdateComponentDto) {
    const existingComponent = await this.prisma.component.findUnique({ where: { id } });

    if (!existingComponent) {
      throw new NotFoundException(`Component with ID ${id} not found`);
    }

    // Verify owner exists if provided
    if (updateComponentDto.ownerId) {
      const owner = await this.prisma.user.findUnique({
        where: { id: updateComponentDto.ownerId },
      });

      if (!owner) {
        throw new NotFoundException(`User with ID ${updateComponentDto.ownerId} not found`);
      }
    }

    // Check for duplicate name if name is being changed
    if (updateComponentDto.name && updateComponentDto.name !== existingComponent.name) {
      const duplicate = await this.prisma.component.findUnique({
        where: {
          projectId_name: {
            projectId: existingComponent.projectId,
            name: updateComponentDto.name,
          },
        },
      });

      if (duplicate) {
        throw new ConflictException(`Component with name "${updateComponentDto.name}" already exists in this project`);
      }
    }

    // Extract layerIds and prepare data
    const { layerIds, ...componentData } = updateComponentDto;

    // If layerIds provided, verify all layers exist
    if (layerIds && layerIds.length > 0) {
      const layers = await this.prisma.layer.findMany({
        where: { id: { in: layerIds } },
      });

      if (layers.length !== layerIds.length) {
        throw new NotFoundException('One or more layer IDs are invalid');
      }
    }

    // Update component with layer relationships
    const component = await this.prisma.component.update({
      where: { id },
      data: {
        ...componentData,
        layers: layerIds
          ? {
              deleteMany: {},
              create: layerIds.map(layerId => ({ layerId })),
            }
          : undefined,
      },
      include: {
        project: {
          select: { id: true, name: true },
        },
        owner: {
          select: { id: true, name: true, email: true },
        },
        layers: {
          include: {
            layer: {
              select: { id: true, name: true, icon: true, color: true },
            },
          },
        },
        _count: {
          select: {
            storyComponents: true,
            useCases: true,
            testCases: true,
          },
        },
      },
    });

    // Broadcast component updated
    this.wsGateway.server?.emit('component:updated', {
      componentId: id,
      projectId: component.projectId,
      component,
    });

    return component;
  }

  /**
   * Delete component
   * @param id - Component ID
   * @throws BadRequestException if component is in use
   */
  async remove(id: string) {
    const component = await this.prisma.component.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            storyComponents: true,
            useCases: true,
            testCases: true,
          },
        },
      },
    });

    if (!component) {
      throw new NotFoundException(`Component with ID ${id} not found`);
    }

    // Prevent deletion if component is in use
    const totalUsage =
      component._count.storyComponents +
      component._count.useCases +
      component._count.testCases;

    if (totalUsage > 0) {
      throw new BadRequestException(
        `Cannot delete component "${component.name}" - it is used by ${component._count.storyComponents} stories, ` +
        `${component._count.useCases} use cases, and ${component._count.testCases} test cases. ` +
        `Consider deprecating instead.`
      );
    }

    await this.prisma.component.delete({ where: { id } });

    return { message: 'Component deleted successfully' };
  }
}
