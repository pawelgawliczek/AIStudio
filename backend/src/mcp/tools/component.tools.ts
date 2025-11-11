/**
 * Component Management MCP Tools
 */

import { PrismaClient } from '@prisma/client';
import {
  CreateComponentParams,
  UpdateComponentParams,
  ListComponentsParams,
  GetComponentParams,
  GetComponentUseCasesParams,
  GetComponentStoriesParams,
  ComponentResponse,
  NotFoundError,
  ValidationError,
} from '../types';
import {
  validateRequired,
  handlePrismaError,
} from '../utils';

/**
 * Format component for MCP response
 */
function formatComponent(component: any, includeDetails = false): ComponentResponse {
  const formatted: ComponentResponse = {
    id: component.id,
    projectId: component.projectId,
    name: component.name,
    description: component.description,
    ownerId: component.ownerId,
    filePatterns: component.filePatterns || [],
    color: component.color,
    icon: component.icon,
    status: component.status,
    createdAt: component.createdAt.toISOString(),
    updatedAt: component.updatedAt.toISOString(),
  };

  if (component.owner) {
    formatted.owner = {
      id: component.owner.id,
      name: component.owner.name,
      email: component.owner.email,
    };
  }

  if (includeDetails && component._count) {
    formatted.usageCount = {
      stories: component._count.storyComponents || 0,
      useCases: component._count.useCases || 0,
      testCases: component._count.testCases || 0,
    };
  }

  if (component.layers) {
    formatted.layers = component.layers.map((cl: any) => ({
      id: cl.layer.id,
      name: cl.layer.name,
      icon: cl.layer.icon,
      color: cl.layer.color,
      orderIndex: cl.layer.orderIndex,
    })).sort((a: any, b: any) => a.orderIndex - b.orderIndex);
  }

  return formatted;
}

/**
 * Create a new component
 */
export async function createComponent(
  prisma: PrismaClient,
  params: CreateComponentParams,
): Promise<ComponentResponse> {
  try {
    validateRequired(params, ['projectId', 'name']);

    // Verify project exists
    const project = await prisma.project.findUnique({
      where: { id: params.projectId },
    });

    if (!project) {
      throw new NotFoundError('Project', params.projectId);
    }

    // Verify owner exists if provided
    if (params.ownerId) {
      const owner = await prisma.user.findUnique({
        where: { id: params.ownerId },
      });

      if (!owner) {
        throw new NotFoundError('User', params.ownerId);
      }
    }

    // Verify all layers exist if provided
    if (params.layerIds && params.layerIds.length > 0) {
      const layers = await prisma.layer.findMany({
        where: { id: { in: params.layerIds } },
      });

      if (layers.length !== params.layerIds.length) {
        throw new NotFoundError('Layer', 'one or more layer IDs');
      }
    }

    // Check for duplicate name within project
    const existing = await prisma.component.findUnique({
      where: {
        projectId_name: {
          projectId: params.projectId,
          name: params.name,
        },
      },
    });

    if (existing) {
      throw new ValidationError(`Component with name "${params.name}" already exists in this project`);
    }

    // Create component with layer relationships
    const component = await prisma.component.create({
      data: {
        projectId: params.projectId,
        name: params.name,
        description: params.description,
        ownerId: params.ownerId,
        filePatterns: params.filePatterns || [],
        color: params.color,
        icon: params.icon,
        status: params.status || 'active',
        layers: params.layerIds && params.layerIds.length > 0
          ? {
              create: params.layerIds.map(layerId => ({ layerId })),
            }
          : undefined,
      },
      include: {
        owner: {
          select: { id: true, name: true, email: true },
        },
        layers: {
          include: {
            layer: {
              select: { id: true, name: true, icon: true, color: true, orderIndex: true },
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

    return formatComponent(component, true);
  } catch (error: any) {
    if (error.name === 'MCPError') {
      throw error;
    }
    throw handlePrismaError(error, 'create_component');
  }
}

/**
 * List all components with filters
 */
export async function listComponents(
  prisma: PrismaClient,
  params: ListComponentsParams = {},
): Promise<ComponentResponse[]> {
  try {
    const where: any = {};
    if (params.projectId) where.projectId = params.projectId;
    if (params.status) where.status = params.status;
    if (params.layerId) {
      where.layers = {
        some: { layerId: params.layerId },
      };
    }

    const components = await prisma.component.findMany({
      where,
      include: {
        owner: {
          select: { id: true, name: true, email: true },
        },
        layers: {
          include: {
            layer: {
              select: { id: true, name: true, icon: true, color: true, orderIndex: true },
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
      orderBy: [{ name: 'asc' }],
    });

    return components.map((component: any) => formatComponent(component, true));
  } catch (error: any) {
    throw handlePrismaError(error, 'list_components');
  }
}

/**
 * Get a single component by ID
 */
export async function getComponent(
  prisma: PrismaClient,
  params: GetComponentParams,
): Promise<ComponentResponse> {
  try {
    validateRequired(params, ['componentId']);

    const component = await prisma.component.findUnique({
      where: { id: params.componentId },
      include: {
        owner: {
          select: { id: true, name: true, email: true },
        },
        layers: {
          include: {
            layer: {
              select: { id: true, name: true, description: true, icon: true, color: true, orderIndex: true },
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

    if (!component) {
      throw new NotFoundError('Component', params.componentId);
    }

    return formatComponent(component, true);
  } catch (error: any) {
    if (error.name === 'MCPError') {
      throw error;
    }
    throw handlePrismaError(error, 'get_component');
  }
}

/**
 * Get component with all use cases (for BA workflow)
 */
export async function getComponentUseCases(
  prisma: PrismaClient,
  params: GetComponentUseCasesParams,
): Promise<any> {
  try {
    validateRequired(params, ['componentId']);

    const component = await prisma.component.findUnique({
      where: { id: params.componentId },
      include: {
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
      throw new NotFoundError('Component', params.componentId);
    }

    return {
      component: {
        id: component.id,
        name: component.name,
        description: component.description,
        owner: component.owner,
        layers: component.layers.map((cl: any) => ({
          id: cl.layer.id,
          name: cl.layer.name,
          icon: cl.layer.icon,
          color: cl.layer.color,
        })),
      },
      useCases: component.useCases.map((uc: any) => ({
        id: uc.id,
        ucCode: uc.ucCode,
        title: uc.title,
        area: uc.area,
        frameworkId: uc.frameworkId,
        frameworkName: uc.framework?.name,
        testCaseCount: uc.testCases.length,
        createdAt: uc.createdAt.toISOString(),
        updatedAt: uc.updatedAt.toISOString(),
      })),
      totalUseCases: component.useCases.length,
    };
  } catch (error: any) {
    if (error.name === 'MCPError') {
      throw error;
    }
    throw handlePrismaError(error, 'get_component_use_cases');
  }
}

/**
 * Get component with all related stories (for viewing component impact)
 */
export async function getComponentStories(
  prisma: PrismaClient,
  params: GetComponentStoriesParams,
): Promise<any> {
  try {
    validateRequired(params, ['componentId']);

    const component = await prisma.component.findUnique({
      where: { id: params.componentId },
      include: {
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
                  select: { id: true, key: true, title: true },
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
      throw new NotFoundError('Component', params.componentId);
    }

    return {
      component: {
        id: component.id,
        name: component.name,
        description: component.description,
        owner: component.owner,
        layers: component.layers.map((cl: any) => ({
          id: cl.layer.id,
          name: cl.layer.name,
          icon: cl.layer.icon,
          color: cl.layer.color,
        })),
      },
      stories: component.storyComponents.map((sc: any) => ({
        id: sc.story.id,
        key: sc.story.key,
        title: sc.story.title,
        type: sc.story.type,
        status: sc.story.status,
        epicKey: sc.story.epic?.key,
        epicTitle: sc.story.epic?.title,
        assignedTo: sc.story.assignedTo?.name,
        createdAt: sc.story.createdAt.toISOString(),
        updatedAt: sc.story.updatedAt.toISOString(),
      })),
      totalStories: component.storyComponents.length,
    };
  } catch (error: any) {
    if (error.name === 'MCPError') {
      throw error;
    }
    throw handlePrismaError(error, 'get_component_stories');
  }
}

/**
 * Update component
 */
export async function updateComponent(
  prisma: PrismaClient,
  params: UpdateComponentParams,
): Promise<ComponentResponse> {
  try {
    validateRequired(params, ['componentId']);

    const existingComponent = await prisma.component.findUnique({
      where: { id: params.componentId }
    });

    if (!existingComponent) {
      throw new NotFoundError('Component', params.componentId);
    }

    // Verify owner exists if provided
    if (params.ownerId) {
      const owner = await prisma.user.findUnique({
        where: { id: params.ownerId },
      });

      if (!owner) {
        throw new NotFoundError('User', params.ownerId);
      }
    }

    // Check for duplicate name if name is being changed
    if (params.name && params.name !== existingComponent.name) {
      const duplicate = await prisma.component.findUnique({
        where: {
          projectId_name: {
            projectId: existingComponent.projectId,
            name: params.name,
          },
        },
      });

      if (duplicate) {
        throw new ValidationError(`Component with name "${params.name}" already exists in this project`);
      }
    }

    // If layerIds provided, verify all layers exist
    if (params.layerIds && params.layerIds.length > 0) {
      const layers = await prisma.layer.findMany({
        where: { id: { in: params.layerIds } },
      });

      if (layers.length !== params.layerIds.length) {
        throw new NotFoundError('Layer', 'one or more layer IDs');
      }
    }

    // Prepare update data
    const updateData: any = {};
    if (params.name !== undefined) updateData.name = params.name;
    if (params.description !== undefined) updateData.description = params.description;
    if (params.ownerId !== undefined) updateData.ownerId = params.ownerId;
    if (params.filePatterns !== undefined) updateData.filePatterns = params.filePatterns;
    if (params.color !== undefined) updateData.color = params.color;
    if (params.icon !== undefined) updateData.icon = params.icon;
    if (params.status !== undefined) updateData.status = params.status;

    // Handle layer relationships
    if (params.layerIds) {
      updateData.layers = {
        deleteMany: {},
        create: params.layerIds.map(layerId => ({ layerId })),
      };
    }

    const component = await prisma.component.update({
      where: { id: params.componentId },
      data: updateData,
      include: {
        owner: {
          select: { id: true, name: true, email: true },
        },
        layers: {
          include: {
            layer: {
              select: { id: true, name: true, icon: true, color: true, orderIndex: true },
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

    return formatComponent(component, true);
  } catch (error: any) {
    if (error.name === 'MCPError') {
      throw error;
    }
    throw handlePrismaError(error, 'update_component');
  }
}

/**
 * Delete component
 * @throws ValidationError if component is in use
 */
export async function deleteComponent(
  prisma: PrismaClient,
  params: GetComponentParams,
): Promise<{ message: string }> {
  try {
    validateRequired(params, ['componentId']);

    const component = await prisma.component.findUnique({
      where: { id: params.componentId },
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
      throw new NotFoundError('Component', params.componentId);
    }

    // Prevent deletion if component is in use
    const totalUsage =
      component._count.storyComponents +
      component._count.useCases +
      component._count.testCases;

    if (totalUsage > 0) {
      throw new ValidationError(
        `Cannot delete component "${component.name}" - it is used by ${component._count.storyComponents} stories, ` +
        `${component._count.useCases} use cases, and ${component._count.testCases} test cases. ` +
        `Consider deprecating instead.`
      );
    }

    await prisma.component.delete({ where: { id: params.componentId } });

    return { message: 'Component deleted successfully' };
  } catch (error: any) {
    if (error.name === 'MCPError') {
      throw error;
    }
    throw handlePrismaError(error, 'delete_component');
  }
}
