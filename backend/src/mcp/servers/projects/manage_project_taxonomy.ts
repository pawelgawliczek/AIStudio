/**
 * Manage Project Taxonomy Tool
 * Manages controlled vocabulary for use case areas within a project
 *
 * Actions:
 * - list: List all taxonomy areas (optionally with usage counts)
 * - add: Add a new area to taxonomy
 * - remove: Remove an area from taxonomy
 * - rename: Rename an area and cascade to use cases
 * - merge: Merge multiple areas into one
 * - suggest: Get similar areas for a given input
 * - validate: Validate if an area exists in taxonomy
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { PrismaClient } from '@prisma/client';
import {
  levenshteinDistance,
  findSimilarAreas,
  normalizeArea,
  SIMILARITY_THRESHOLD,
} from '../../../use-cases/taxonomy.util';
import { ValidationError, NotFoundError } from '../../types';
import { validateRequired, handlePrismaError } from '../../utils';

export const tool: Tool = {
  name: 'manage_project_taxonomy',
  description:
    'Manage controlled vocabulary (taxonomy) for use case areas. Supports list, add, remove, rename, merge, suggest, and validate actions.',
  inputSchema: {
    type: 'object',
    properties: {
      projectId: {
        type: 'string',
        description: 'Project UUID',
      },
      action: {
        type: 'string',
        enum: ['list', 'add', 'remove', 'rename', 'merge', 'suggest', 'validate'],
        description: 'Action to perform on taxonomy',
      },
      area: {
        type: 'string',
        description: 'Area name (for add, remove, rename, suggest, validate)',
      },
      newName: {
        type: 'string',
        description: 'New area name (for rename)',
      },
      areas: {
        type: 'array',
        items: { type: 'string' },
        description: 'Array of area names (for merge)',
      },
      targetArea: {
        type: 'string',
        description: 'Target area name (for merge)',
      },
      force: {
        type: 'boolean',
        description: 'Force operation even if warnings exist',
      },
      includeUsage: {
        type: 'boolean',
        description: 'Include usage counts in list action',
      },
    },
    required: ['projectId', 'action'],
  },
};

export const metadata = {
  category: 'projects',
  domain: 'project_management',
  tags: ['taxonomy', 'vocabulary', 'areas', 'use-cases'],
  version: '1.0.0',
  since: 'ST-207',
};

interface ManageTaxonomyParams {
  projectId: string;
  action: 'list' | 'add' | 'remove' | 'rename' | 'merge' | 'suggest' | 'validate';
  area?: string;
  newName?: string;
  areas?: string[];
  targetArea?: string;
  force?: boolean;
  includeUsage?: boolean;
}

interface ListResult {
  areas: string[];
  count: number;
  usage?: Record<string, number>;
}

interface AddResult {
  added: string;
  taxonomy: string[];
  warnings?: string[];
}

interface RemoveResult {
  removed: string;
  taxonomy: string[];
  warnings?: string[];
}

interface RenameResult {
  renamed: {
    from: string;
    to: string;
  };
  useCasesUpdated: number;
  taxonomy: string[];
}

interface MergeResult {
  merged: {
    from: string[];
    to: string;
  };
  useCasesUpdated: number;
  taxonomy: string[];
}

interface SuggestResult {
  suggestions: Array<{ area: string; distance: number }>;
}

interface ValidateResult {
  valid: boolean;
  exactMatch: boolean;
  suggestions?: Array<{ area: string; distance: number }>;
}

type TaxonomyResult =
  | ListResult
  | AddResult
  | RemoveResult
  | RenameResult
  | MergeResult
  | SuggestResult
  | ValidateResult;

export async function handler(
  prisma: PrismaClient,
  params: ManageTaxonomyParams
): Promise<TaxonomyResult> {
  try {
    validateRequired(params, ['projectId', 'action']);

    // Validate action
    const validActions = ['list', 'add', 'remove', 'rename', 'merge', 'suggest', 'validate'];
    if (!validActions.includes(params.action)) {
      throw new ValidationError(`Invalid action: ${params.action}`);
    }

    // Get project
    const project = await prisma.project.findUnique({
      where: { id: params.projectId },
    });

    if (!project) {
      throw new NotFoundError('Project', `Project with ID ${params.projectId} not found`);
    }

    // Get current taxonomy (default to empty array if null)
    const currentTaxonomy: string[] = (project.taxonomy as string[]) || [];

    // Route to appropriate action handler
    switch (params.action) {
      case 'list':
        return await handleList(prisma, params, currentTaxonomy);
      case 'add':
        return await handleAdd(prisma, params, currentTaxonomy);
      case 'remove':
        return await handleRemove(prisma, params, currentTaxonomy);
      case 'rename':
        return await handleRename(prisma, params, currentTaxonomy);
      case 'merge':
        return await handleMerge(prisma, params, currentTaxonomy);
      case 'suggest':
        return handleSuggest(params, currentTaxonomy);
      case 'validate':
        return handleValidate(params, currentTaxonomy);
      default:
        throw new ValidationError(`Invalid action: ${params.action}`);
    }
  } catch (error: any) {
    if (error.name === 'MCPError') {
      throw error;
    }
    throw handlePrismaError(error, 'manage_project_taxonomy');
  }
}

async function handleList(
  prisma: PrismaClient,
  params: ManageTaxonomyParams,
  taxonomy: string[]
): Promise<ListResult> {
  const result: ListResult = {
    areas: taxonomy,
    count: taxonomy.length,
  };

  // Include usage counts if requested
  if (params.includeUsage) {
    const usage: Record<string, number> = {};
    for (const area of taxonomy) {
      const count = await prisma.useCase.count({
        where: {
          projectId: params.projectId,
          area,
        },
      });
      usage[area] = count;
    }
    result.usage = usage;
  }

  return result;
}

async function handleAdd(
  prisma: PrismaClient,
  params: ManageTaxonomyParams,
  taxonomy: string[]
): Promise<AddResult> {
  validateRequired(params, ['area']);

  const normalized = normalizeArea(params.area!);

  if (!normalized) {
    throw new ValidationError('area cannot be empty');
  }

  // Check for exact match (case-insensitive)
  const exactMatch = taxonomy.find(
    (a) => a.toLowerCase() === normalized.toLowerCase()
  );

  if (exactMatch) {
    throw new ValidationError(`Area "${exactMatch}" already exists in taxonomy`);
  }

  // Check for similar areas
  const similar = findSimilarAreas(normalized, taxonomy);
  if (similar.length > 0 && similar[0].distance <= SIMILARITY_THRESHOLD && !params.force) {
    throw new ValidationError(
      `Cannot add area "${normalized}": similar area "${similar[0].area}" already exists (distance: ${similar[0].distance}). Use force=true to override.`
    );
  }

  // Add to taxonomy
  const newTaxonomy = [...taxonomy, normalized];

  await prisma.project.update({
    where: { id: params.projectId },
    data: { taxonomy: newTaxonomy },
  });

  const result: AddResult = {
    added: normalized,
    taxonomy: newTaxonomy,
  };

  if (params.force && similar.length > 0) {
    result.warnings = [`Similar areas exist: ${similar.map((s) => s.area).join(', ')}`];
  }

  return result;
}

async function handleRemove(
  prisma: PrismaClient,
  params: ManageTaxonomyParams,
  taxonomy: string[]
): Promise<RemoveResult> {
  validateRequired(params, ['area']);

  const normalized = normalizeArea(params.area!);

  // Check if area exists
  const areaIndex = taxonomy.findIndex(
    (a) => a.toLowerCase() === normalized.toLowerCase()
  );

  if (areaIndex === -1) {
    throw new NotFoundError('Area', `Area "${normalized}" not found in taxonomy`);
  }

  const areaToRemove = taxonomy[areaIndex];

  // Check for use cases using this area
  const usageCount = await prisma.useCase.count({
    where: {
      projectId: params.projectId,
      area: areaToRemove,
    },
  });

  if (usageCount > 0 && !params.force) {
    throw new ValidationError(
      `Cannot remove area "${areaToRemove}": ${usageCount} use cases are using this area. Use force=true to override (use cases will be orphaned).`
    );
  }

  // Remove from taxonomy
  const newTaxonomy = taxonomy.filter((_, index) => index !== areaIndex);

  await prisma.project.update({
    where: { id: params.projectId },
    data: { taxonomy: newTaxonomy },
  });

  const result: RemoveResult = {
    removed: areaToRemove,
    taxonomy: newTaxonomy,
  };

  if (usageCount > 0) {
    result.warnings = [
      `${usageCount} use cases were using this area and are now orphaned`,
    ];
  }

  return result;
}

async function handleRename(
  prisma: PrismaClient,
  params: ManageTaxonomyParams,
  taxonomy: string[]
): Promise<RenameResult> {
  validateRequired(params, ['area', 'newName']);

  const normalized = normalizeArea(params.area!);
  const newNormalized = normalizeArea(params.newName!);

  // Check if old area exists
  const areaIndex = taxonomy.findIndex(
    (a) => a.toLowerCase() === normalized.toLowerCase()
  );

  if (areaIndex === -1) {
    throw new NotFoundError('Area', `Area "${normalized}" not found in taxonomy`);
  }

  const oldArea = taxonomy[areaIndex];

  // Check if new name already exists
  const existingNew = taxonomy.find(
    (a) => a.toLowerCase() === newNormalized.toLowerCase()
  );

  if (existingNew) {
    throw new ValidationError(`Area "${existingNew}" already exists in taxonomy`);
  }

  // Use transaction to update both taxonomy and use cases
  const result = await prisma.$transaction(async (tx) => {
    // Update taxonomy
    const newTaxonomy = [...taxonomy];
    newTaxonomy[areaIndex] = newNormalized;

    await tx.project.update({
      where: { id: params.projectId },
      data: { taxonomy: newTaxonomy },
    });

    // Update all use cases with this area
    const updateResult = await tx.useCase.updateMany({
      where: {
        projectId: params.projectId,
        area: oldArea,
      },
      data: {
        area: newNormalized,
      },
    });

    return {
      renamed: {
        from: oldArea,
        to: newNormalized,
      },
      useCasesUpdated: updateResult.count,
      taxonomy: newTaxonomy,
    };
  });

  return result;
}

async function handleMerge(
  prisma: PrismaClient,
  params: ManageTaxonomyParams,
  taxonomy: string[]
): Promise<MergeResult> {
  validateRequired(params, ['areas', 'targetArea']);

  if (!params.areas || params.areas.length < 2) {
    throw new ValidationError('merge action requires at least 2 areas to merge');
  }

  const normalizedTarget = normalizeArea(params.targetArea!);
  const normalizedAreas = params.areas.map((a) => normalizeArea(a));

  // Validate all source areas exist
  for (const area of normalizedAreas) {
    const exists = taxonomy.find((a) => a.toLowerCase() === area.toLowerCase());
    if (!exists) {
      throw new NotFoundError('Area', `Area "${area}" not found in taxonomy`);
    }
  }

  // Use transaction to update taxonomy and use cases
  const result = await prisma.$transaction(async (tx) => {
    // Build new taxonomy
    let newTaxonomy = taxonomy.filter(
      (a) => !normalizedAreas.some((na) => na.toLowerCase() === a.toLowerCase())
    );

    // Add target area if it doesn't exist
    if (!newTaxonomy.some((a) => a.toLowerCase() === normalizedTarget.toLowerCase())) {
      newTaxonomy = [...newTaxonomy, normalizedTarget];
    }

    await tx.project.update({
      where: { id: params.projectId },
      data: { taxonomy: newTaxonomy },
    });

    // Update all use cases from source areas to target area
    const updateResult = await tx.useCase.updateMany({
      where: {
        projectId: params.projectId,
        area: {
          in: normalizedAreas,
        },
      },
      data: {
        area: normalizedTarget,
      },
    });

    return {
      merged: {
        from: normalizedAreas,
        to: normalizedTarget,
      },
      useCasesUpdated: updateResult.count,
      taxonomy: newTaxonomy,
    };
  });

  return result;
}

function handleSuggest(
  params: ManageTaxonomyParams,
  taxonomy: string[]
): SuggestResult {
  validateRequired(params, ['area']);

  const similar = findSimilarAreas(params.area!, taxonomy);

  return {
    suggestions: similar,
  };
}

function handleValidate(
  params: ManageTaxonomyParams,
  taxonomy: string[]
): ValidateResult {
  validateRequired(params, ['area']);

  const normalized = normalizeArea(params.area!);

  // Check for exact match (case-insensitive)
  const exactMatch = taxonomy.find(
    (a) => a.toLowerCase() === normalized.toLowerCase()
  );

  if (exactMatch) {
    return {
      valid: true,
      exactMatch: true,
    };
  }

  // Find similar areas
  const similar = findSimilarAreas(normalized, taxonomy);

  return {
    valid: false,
    exactMatch: false,
    suggestions: similar,
  };
}
