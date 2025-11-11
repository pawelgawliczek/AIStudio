/**
 * Layer Management MCP Tools
 */

import { PrismaClient } from '@prisma/client';
import {
  CreateLayerParams,
  UpdateLayerParams,
  ListLayersParams,
  GetLayerParams,
  LayerResponse,
  NotFoundError,
  ValidationError,
} from '../types';
import {
  validateRequired,
  handlePrismaError,
} from '../utils';

/**
 * Format layer for MCP response
 */
function formatLayer(layer: any, includeDetails = false): LayerResponse {
  const formatted: LayerResponse = {
    id: layer.id,
    projectId: layer.projectId,
    name: layer.name,
    description: layer.description,
    techStack: layer.techStack || [],
    orderIndex: layer.orderIndex,
    color: layer.color,
    icon: layer.icon,
    status: layer.status,
    createdAt: layer.createdAt.toISOString(),
    updatedAt: layer.updatedAt.toISOString(),
  };

  if (includeDetails && layer._count) {
    formatted.usageCount = {
      stories: layer._count.storyLayers || 0,
      components: layer._count.componentLayers || 0,
      useCases: layer._count.useCases || 0,
      testCases: layer._count.testCases || 0,
    };
  }

  if (includeDetails && layer.componentLayers) {
    formatted.components = layer.componentLayers.map((cl: any) => ({
      id: cl.component.id,
      name: cl.component.name,
      icon: cl.component.icon,
      color: cl.component.color,
    }));
  }

  return formatted;
}

/**
 * Create a new layer
 */
export async function createLayer(
  prisma: PrismaClient,
  params: CreateLayerParams,
): Promise<LayerResponse> {
  try {
    validateRequired(params, ['projectId', 'name', 'orderIndex']);

    // Verify project exists
    const project = await prisma.project.findUnique({
      where: { id: params.projectId },
    });

    if (!project) {
      throw new NotFoundError('Project', params.projectId);
    }

    // Check for duplicate name within project
    const existing = await prisma.layer.findUnique({
      where: {
        projectId_name: {
          projectId: params.projectId,
          name: params.name,
        },
      },
    });

    if (existing) {
      throw new ValidationError(`Layer with name "${params.name}" already exists in this project`);
    }

    // Create layer
    const layer = await prisma.layer.create({
      data: {
        projectId: params.projectId,
        name: params.name,
        description: params.description,
        techStack: params.techStack || [],
        orderIndex: params.orderIndex,
        color: params.color,
        icon: params.icon,
        status: params.status || 'active',
      },
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

    return formatLayer(layer, true);
  } catch (error: any) {
    if (error.name === 'MCPError') {
      throw error;
    }
    throw handlePrismaError(error, 'create_layer');
  }
}

/**
 * List all layers with filters
 */
export async function listLayers(
  prisma: PrismaClient,
  params: ListLayersParams = {},
): Promise<LayerResponse[]> {
  try {
    const where: any = {};
    if (params.projectId) where.projectId = params.projectId;
    if (params.status) where.status = params.status;

    const layers = await prisma.layer.findMany({
      where,
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
      orderBy: [{ orderIndex: 'asc' }, { createdAt: 'asc' }],
    });

    return layers.map((layer: any) => formatLayer(layer, true));
  } catch (error: any) {
    throw handlePrismaError(error, 'list_layers');
  }
}

/**
 * Get a single layer by ID
 */
export async function getLayer(
  prisma: PrismaClient,
  params: GetLayerParams,
): Promise<LayerResponse> {
  try {
    validateRequired(params, ['layerId']);

    const layer = await prisma.layer.findUnique({
      where: { id: params.layerId },
      include: {
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
      throw new NotFoundError('Layer', params.layerId);
    }

    return formatLayer(layer, true);
  } catch (error: any) {
    if (error.name === 'MCPError') {
      throw error;
    }
    throw handlePrismaError(error, 'get_layer');
  }
}

/**
 * Update layer
 */
export async function updateLayer(
  prisma: PrismaClient,
  params: UpdateLayerParams,
): Promise<LayerResponse> {
  try {
    validateRequired(params, ['layerId']);

    const existingLayer = await prisma.layer.findUnique({
      where: { id: params.layerId }
    });

    if (!existingLayer) {
      throw new NotFoundError('Layer', params.layerId);
    }

    // Check for duplicate name if name is being changed
    if (params.name && params.name !== existingLayer.name) {
      const duplicate = await prisma.layer.findUnique({
        where: {
          projectId_name: {
            projectId: existingLayer.projectId,
            name: params.name,
          },
        },
      });

      if (duplicate) {
        throw new ValidationError(`Layer with name "${params.name}" already exists in this project`);
      }
    }

    // Prepare update data
    const updateData: any = {};
    if (params.name !== undefined) updateData.name = params.name;
    if (params.description !== undefined) updateData.description = params.description;
    if (params.techStack !== undefined) updateData.techStack = params.techStack;
    if (params.orderIndex !== undefined) updateData.orderIndex = params.orderIndex;
    if (params.color !== undefined) updateData.color = params.color;
    if (params.icon !== undefined) updateData.icon = params.icon;
    if (params.status !== undefined) updateData.status = params.status;

    const layer = await prisma.layer.update({
      where: { id: params.layerId },
      data: updateData,
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

    return formatLayer(layer, true);
  } catch (error: any) {
    if (error.name === 'MCPError') {
      throw error;
    }
    throw handlePrismaError(error, 'update_layer');
  }
}

/**
 * Delete layer
 * @throws ValidationError if layer is in use
 */
export async function deleteLayer(
  prisma: PrismaClient,
  params: GetLayerParams,
): Promise<{ message: string }> {
  try {
    validateRequired(params, ['layerId']);

    const layer = await prisma.layer.findUnique({
      where: { id: params.layerId },
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
      throw new NotFoundError('Layer', params.layerId);
    }

    // Prevent deletion if layer is in use
    const totalUsage =
      layer._count.storyLayers +
      layer._count.componentLayers +
      layer._count.useCases +
      layer._count.testCases;

    if (totalUsage > 0) {
      throw new ValidationError(
        `Cannot delete layer "${layer.name}" - it is used by ${layer._count.storyLayers} stories, ` +
        `${layer._count.componentLayers} components, ${layer._count.useCases} use cases, ` +
        `and ${layer._count.testCases} test cases. Consider deprecating instead.`
      );
    }

    await prisma.layer.delete({ where: { id: params.layerId } });

    return { message: 'Layer deleted successfully' };
  } catch (error: any) {
    if (error.name === 'MCPError') {
      throw error;
    }
    throw handlePrismaError(error, 'delete_layer');
  }
}
