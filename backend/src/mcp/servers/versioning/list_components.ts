/**
 * List Components Tool
 * List components with filtering and pagination
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { PrismaClient } from '@prisma/client';
import { PaginatedResponse } from '../../types';

export interface ListComponentsParams {
  projectId?: string;
  active?: boolean;
  includeInactive?: boolean;
  versionMajor?: number;
  page?: number;
  pageSize?: number;
}

export interface ComponentWithVersionInfo {
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
  createdAt: string;
  updatedAt: string;
}

export const tool: Tool = {
  name: 'list_components',
  description: 'List components with filtering (projectId, active, versionMajor) and pagination',
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
        description: 'Include inactive components (default: false)',
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
  tags: ['component', 'list', 'version', 'query'],
  version: '1.0.0',
  since: '2025-11-21',
};

// ALIASING: Component → Agent (ST-109)
export const agentTool: Tool = {
  name: 'list_agents',
  description: 'List agents with filtering (projectId, active, versionMajor) and pagination. Agents are AI workers that execute specific tasks within teams.',
  inputSchema: tool.inputSchema,
};

export const agentMetadata = {
  category: 'versioning',
  domain: 'Version Management',
  tags: ['agent', 'list', 'version', 'query'],
  version: '1.0.0',
  since: '2025-11-26',
};

export async function handler(
  prisma: PrismaClient,
  params: ListComponentsParams,
): Promise<PaginatedResponse<ComponentWithVersionInfo>> {
  const page = Math.max(1, params.page || 1);
  const pageSize = Math.min(100, Math.max(1, params.pageSize || 20));
  const skip = (page - 1) * pageSize;

  // Build where clause
  const where: any = {};

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

  // Fetch components with child count
  const components = await prisma.component.findMany({
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
        select: { children: true },
      },
    },
  });

  const data: ComponentWithVersionInfo[] = components.map((c) => ({
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
