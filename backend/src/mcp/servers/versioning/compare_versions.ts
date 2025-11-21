/**
 * Compare Versions Tool
 * Compare two entity versions field by field
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { PrismaClient } from '@prisma/client';
import { NotFoundError, ValidationError } from '../../types';
import { validateRequired, handlePrismaError } from '../../utils';

export interface CompareVersionsParams {
  entityType: 'component' | 'workflow' | 'coordinator';
  versionId1: string;
  versionId2: string;
}

export interface FieldDiff {
  field: string;
  changeType: 'added' | 'removed' | 'modified' | 'unchanged';
  value1?: any;
  value2?: any;
}

export interface ComparisonResult {
  entityType: string;
  version1: { id: string; versionLabel: string; name: string };
  version2: { id: string; versionLabel: string; name: string };
  checksumMatch: boolean;
  fieldDiffs: FieldDiff[];
  summary: {
    added: number;
    removed: number;
    modified: number;
    unchanged: number;
  };
}

export const tool: Tool = {
  name: 'compare_versions',
  description: 'Compare two entity versions field by field',
  inputSchema: {
    type: 'object',
    properties: {
      entityType: {
        type: 'string',
        enum: ['component', 'workflow', 'coordinator'],
        description: 'Entity type (required)',
      },
      versionId1: {
        type: 'string',
        description: 'First version UUID (required)',
      },
      versionId2: {
        type: 'string',
        description: 'Second version UUID (required)',
      },
    },
    required: ['entityType', 'versionId1', 'versionId2'],
  },
};

export const metadata = {
  category: 'versioning',
  domain: 'Version Management',
  tags: ['version', 'compare', 'diff'],
  version: '1.0.0',
  since: '2025-11-21',
};

// Fields to compare for each entity type
const COMPONENT_FIELDS = [
  'name',
  'description',
  'inputInstructions',
  'operationInstructions',
  'outputInstructions',
  'config',
  'tools',
  'tags',
  'onFailure',
  'active',
];

const COORDINATOR_FIELDS = [
  ...COMPONENT_FIELDS,
  'coordinatorInstructions',
  'decisionStrategy',
  'componentIds',
  'flowDiagram',
];

const WORKFLOW_FIELDS = [
  'name',
  'description',
  'triggerConfig',
  'coordinatorId',
  'active',
];

function compareFields(obj1: any, obj2: any, fields: string[]): FieldDiff[] {
  const diffs: FieldDiff[] = [];

  for (const field of fields) {
    const val1 = obj1[field];
    const val2 = obj2[field];

    const val1Str = JSON.stringify(val1);
    const val2Str = JSON.stringify(val2);

    if (val1 === undefined && val2 !== undefined) {
      diffs.push({ field, changeType: 'added', value1: val1, value2: val2 });
    } else if (val1 !== undefined && val2 === undefined) {
      diffs.push({ field, changeType: 'removed', value1: val1, value2: val2 });
    } else if (val1Str !== val2Str) {
      diffs.push({ field, changeType: 'modified', value1: val1, value2: val2 });
    } else {
      diffs.push({ field, changeType: 'unchanged', value1: val1, value2: val2 });
    }
  }

  return diffs;
}

export async function handler(
  prisma: PrismaClient,
  params: CompareVersionsParams,
): Promise<ComparisonResult> {
  try {
    validateRequired(params, ['entityType', 'versionId1', 'versionId2']);

    if (!['component', 'workflow', 'coordinator'].includes(params.entityType)) {
      throw new ValidationError(`Invalid entityType: ${params.entityType}`);
    }

    // For coordinators, we fetch from component table
    const isCoordinator = params.entityType === 'coordinator';
    const fetchType = isCoordinator ? 'component' : params.entityType;

    let entity1: any;
    let entity2: any;

    if (fetchType === 'component') {
      entity1 = await prisma.component.findUnique({ where: { id: params.versionId1 } });
      entity2 = await prisma.component.findUnique({ where: { id: params.versionId2 } });
    } else {
      entity1 = await prisma.workflow.findUnique({ where: { id: params.versionId1 } });
      entity2 = await prisma.workflow.findUnique({ where: { id: params.versionId2 } });
    }

    if (!entity1) {
      throw new NotFoundError(`${params.entityType} version`, params.versionId1);
    }
    if (!entity2) {
      throw new NotFoundError(`${params.entityType} version`, params.versionId2);
    }

    // For coordinators, validate both have coordinator tag
    if (isCoordinator) {
      if (!entity1.tags?.includes('coordinator')) {
        throw new ValidationError(`Entity ${params.versionId1} is not a coordinator`);
      }
      if (!entity2.tags?.includes('coordinator')) {
        throw new ValidationError(`Entity ${params.versionId2} is not a coordinator`);
      }
    }

    // Select fields to compare based on entity type
    let fieldsToCompare: string[];
    if (isCoordinator) {
      fieldsToCompare = COORDINATOR_FIELDS;
    } else if (params.entityType === 'workflow') {
      fieldsToCompare = WORKFLOW_FIELDS;
    } else {
      fieldsToCompare = COMPONENT_FIELDS;
    }

    // Compare fields
    const fieldDiffs = compareFields(entity1, entity2, fieldsToCompare);

    // Check checksum match
    const checksumMatch =
      entity1.instructionsChecksum === entity2.instructionsChecksum &&
      entity1.configChecksum === entity2.configChecksum;

    // Calculate summary
    const summary = {
      added: fieldDiffs.filter((d) => d.changeType === 'added').length,
      removed: fieldDiffs.filter((d) => d.changeType === 'removed').length,
      modified: fieldDiffs.filter((d) => d.changeType === 'modified').length,
      unchanged: fieldDiffs.filter((d) => d.changeType === 'unchanged').length,
    };

    return {
      entityType: params.entityType,
      version1: {
        id: entity1.id,
        versionLabel: `${entity1.versionMajor}.${entity1.versionMinor}`,
        name: entity1.name,
      },
      version2: {
        id: entity2.id,
        versionLabel: `${entity2.versionMajor}.${entity2.versionMinor}`,
        name: entity2.name,
      },
      checksumMatch,
      fieldDiffs,
      summary,
    };
  } catch (error: any) {
    if (error.name === 'MCPError') {
      throw error;
    }
    throw handlePrismaError(error, 'compare_versions');
  }
}
