import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { PrismaClient, MappingSource } from '@prisma/client';
import { ToolMetadata } from '../../types/index.js';

export const tool: Tool = {
  name: 'update_file_mappings',
  description: 'Manually create or update file-to-usecase mappings. Links files to use cases, overrides automatic mappings, and documents relationships. Multiple use cases per file supported.',
  inputSchema: {
    type: 'object',
    properties: {
      projectId: {
        type: 'string',
        description: 'Project ID',
      },
      filePath: {
        type: 'string',
        description: 'File path (relative to repo root)',
      },
      useCaseKeys: {
        type: 'array',
        items: { type: 'string' },
        description: 'Array of use case keys (e.g., ["UC-AUTH-001", "UC-AUTH-002"])',
      },
      source: {
        type: 'string',
        enum: [
          'MANUAL',
          'COMMIT_DERIVED',
          'AI_INFERRED',
          'PATTERN_MATCHED',
          'IMPORT_ANALYSIS',
        ],
        description: 'Source of the mapping (default: MANUAL)',
      },
      confidence: {
        type: 'number',
        description: 'Confidence score 0.0-1.0 (default: 1.0 for MANUAL)',
      },
    },
    required: ['projectId', 'filePath', 'useCaseKeys'],
  },
};

export const metadata: ToolMetadata = {
  category: 'code-quality',
  domain: 'impact-analysis',
  tags: ['mapping', 'use-cases', 'files', 'manual'],
  version: '1.0.0',
  since: '0.6.0',
  lastUpdated: '2025-11-13',
};

export async function handler(prisma: PrismaClient, params: any): Promise<any> {
  const {
    projectId,
    filePath,
    useCaseKeys,
    source = 'MANUAL',
    confidence,
  } = params;

  if (!projectId) {
    throw new Error('projectId is required');
  }
  if (!filePath) {
    throw new Error('filePath is required');
  }
  if (!useCaseKeys || !Array.isArray(useCaseKeys) || useCaseKeys.length === 0) {
    throw new Error('useCaseKeys must be a non-empty array');
  }

  // Verify project exists
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { name: true },
  });

  if (!project) {
    throw new Error(`Project ${projectId} not found`);
  }

  // Get use case IDs from keys
  const useCases = await prisma.useCase.findMany({
    where: {
      projectId,
      key: { in: useCaseKeys },
    },
    select: {
      id: true,
      key: true,
      title: true,
    },
  });

  if (useCases.length === 0) {
    throw new Error(`No use cases found with keys: ${useCaseKeys.join(', ')}`);
  }

  const notFound = useCaseKeys.filter(
    (key) => !useCases.find((uc) => uc.key === key),
  );
  if (notFound.length > 0) {
    throw new Error(`Use case(s) not found: ${notFound.join(', ')}`);
  }

  // Default confidence based on source
  const defaultConfidence: { [key: string]: number } = {
    MANUAL: 1.0,
    COMMIT_DERIVED: 0.8,
    AI_INFERRED: 0.5,
    PATTERN_MATCHED: 0.6,
    IMPORT_ANALYSIS: 0.7,
  };

  const finalConfidence = confidence ?? defaultConfidence[source] ?? 1.0;

  // Create or update mappings
  const results = [];

  for (const useCase of useCases) {
    // Check if mapping exists
    const existing = await prisma.fileUseCaseLink.findUnique({
      where: {
        projectId_filePath_useCaseId: {
          projectId,
          filePath,
          useCaseId: useCase.id,
        },
      },
    });

    if (existing) {
      // Update existing mapping
      const updated = await prisma.fileUseCaseLink.update({
        where: { id: existing.id },
        data: {
          occurrences: { increment: 1 },
          confidence: Math.max(existing.confidence, finalConfidence),
          source: source as MappingSource,
          lastSeenAt: new Date(),
        },
      });

      results.push({
        useCaseKey: useCase.key,
        useCaseTitle: useCase.title,
        action: 'updated',
        previousOccurrences: existing.occurrences,
        newOccurrences: updated.occurrences,
        previousConfidence: Math.round(existing.confidence * 100),
        newConfidence: Math.round(updated.confidence * 100),
      });
    } else {
      // Create new mapping
      await prisma.fileUseCaseLink.create({
        data: {
          projectId,
          filePath,
          useCaseId: useCase.id,
          source: source as MappingSource,
          confidence: finalConfidence,
        },
      });

      results.push({
        useCaseKey: useCase.key,
        useCaseTitle: useCase.title,
        action: 'created',
        confidence: Math.round(finalConfidence * 100),
      });
    }
  }

  const created = results.filter((r) => r.action === 'created').length;
  const updated = results.filter((r) => r.action === 'updated').length;

  const result = {
    success: true,
    projectId,
    projectName: project.name,
    filePath,
    source,
    summary: {
      created,
      updated,
      total: results.length,
      message: `${created} mapping(s) created, ${updated} mapping(s) updated`,
    },
    mappings: results,
  };

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(result, null, 2),
      },
    ],
  };
}
