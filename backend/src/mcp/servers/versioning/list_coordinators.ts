/**
 * List Coordinators Tool
 * List coordinators (components with 'coordinator' tag)
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { PrismaClient } from '@prisma/client';
import { PaginatedResponse } from '../../types';

export interface ListCoordinatorsParams {
  projectId?: string;
  active?: boolean;
  includeInactive?: boolean;
  versionMajor?: number;
  page?: number;
  pageSize?: number;
}

export interface CoordinatorWithVersionInfo {
  id: string;
  name: string;
  description: string | null;
  versionMajor: number;
  versionMinor: number;
  versionLabel: string;
  active: boolean;
  isDeprecated: boolean;
  hasParent: boolean;
  childCount: number;
  workflowCount: number;
  createdAt: string;
  updatedAt: string;
}

export const tool: Tool = {
  name: 'list_coordinators',
  description: 'List coordinators (components with coordinator tag) with filtering and pagination',
  inputSchema: {
    type: 'object',
    properties: {
      projectId: {
        type: 'string',
        description: 'Filter by project UUID',
      },
      active: {
        type: 'boolean',
        description: 'Filter by active status',
      },
      includeInactive: {
        type: 'boolean',
        description: 'Include inactive coordinators (default: false)',
      },
      versionMajor: {
        type: 'number',
        description: 'Filter by major version',
      },
      page: {
        type: 'number',
        description: 'Page number (default: 1)',
      },
      pageSize: {
        type: 'number',
        description: 'Items per page (default: 20, max: 100)',
      },
    },
    required: [],
  },
};

export const metadata = {
  category: 'versioning',
  domain: 'Version Management',
  tags: ['coordinator', 'list', 'version', 'query'],
  version: '1.0.0',
  since: '2025-11-21',
};

// ALIASING: Coordinator → Project Manager (ST-109)
export const projectManagerTool: Tool = {
  name: 'list_project_managers',
  description: 'List project managers with filtering and pagination. Project managers orchestrate agents and manage team execution.',
  inputSchema: tool.inputSchema,
};

export const projectManagerMetadata = {
  category: 'versioning',
  domain: 'Version Management',
  tags: ['project-manager', 'list', 'version', 'query'],
  version: '1.0.0',
  since: '2025-11-26',
};

export async function handler(
  prisma: PrismaClient,
  params: ListCoordinatorsParams,
): Promise<PaginatedResponse<CoordinatorWithVersionInfo>> {
  const page = Math.max(1, params.page || 1);
  const pageSize = Math.min(100, Math.max(1, params.pageSize || 20));
  const skip = (page - 1) * pageSize;

  // Build where clause - coordinators have 'coordinator' tag
  const where: any = {
    tags: {
      has: 'coordinator',
    },
  };

  if (params.projectId) {
    where.projectId = params.projectId;
  }

  // Handle active filter
  if (params.active !== undefined) {
    where.active = params.active;
  } else if (!params.includeInactive) {
    where.active = true;
  }

  if (params.versionMajor !== undefined) {
    where.versionMajor = params.versionMajor;
  }

  // Count total
  const total = await prisma.component.count({ where });

  // Fetch coordinators with related data
  const coordinators = await prisma.component.findMany({
    where,
    skip,
    take: pageSize,
    orderBy: [
      { versionMajor: 'desc' },
      { versionMinor: 'desc' },
      { name: 'asc' },
    ],
    include: {
      _count: {
        select: {
          children: true,
          workflowsAsCoordinator: true,
        },
      },
    },
  });

  const data: CoordinatorWithVersionInfo[] = coordinators.map((c) => ({
    id: c.id,
    name: c.name,
    description: c.description,
    versionMajor: c.versionMajor,
    versionMinor: c.versionMinor,
    versionLabel: `${c.versionMajor}.${c.versionMinor}`,
    active: c.active,
    isDeprecated: c.isDeprecated,
    hasParent: !!c.parentId,
    childCount: c._count.children,
    workflowCount: c._count.workflowsAsCoordinator,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  }));

  const totalPages = Math.ceil(total / pageSize);

  return {
    data,
    pagination: {
      page,
      pageSize,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    },
  };
}
