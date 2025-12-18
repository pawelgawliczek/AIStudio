/**
 * Quota Validation Utility (ST-177)
 * Shared quota enforcement logic for artifacts
 *
 * Extracted from TranscriptsService to avoid duplication.
 * Used by: upload_artifact_from_file, TranscriptsService
 */

import { PrismaClient } from '@prisma/client';
import { ValidationError } from '../types/';

// Quota limits
const MAX_PER_RUN_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_PER_PROJECT_SIZE = 100 * 1024 * 1024; // 100MB

/**
 * Validate artifact quota for workflow run and project
 *
 * @param prisma - Prisma client instance
 * @param workflowRunId - Workflow run UUID
 * @param projectId - Project UUID
 * @param newSize - Size of new artifact in bytes
 * @throws ValidationError if quota exceeded
 */
export async function validateArtifactQuota(
  prisma: PrismaClient,
  workflowRunId: string,
  projectId: string,
  newSize: number,
): Promise<void> {
  // 1. Check per-run quota
  const runTotal = await prisma.artifact.aggregate({
    where: {
      workflowRunId,
    },
    _sum: { size: true },
  });

  const runSize = (runTotal._sum.size || 0) + newSize;
  if (runSize > MAX_PER_RUN_SIZE) {
    const existingMB = ((runTotal._sum.size || 0) / (1024 * 1024)).toFixed(2);
    const newMB = (newSize / (1024 * 1024)).toFixed(2);
    const totalMB = (runSize / (1024 * 1024)).toFixed(2);

    throw new ValidationError(
      `Workflow run quota exceeded (10MB limit). ` +
        `Existing: ${existingMB} MB, New: ${newMB} MB, Total: ${totalMB} MB`,
    );
  }

  // 2. Check per-project quota
  const projectTotal = await prisma.artifact.aggregate({
    where: {
      workflowRun: { projectId },
    },
    _sum: { size: true },
  });

  const projectSize = (projectTotal._sum.size || 0) + newSize;
  if (projectSize > MAX_PER_PROJECT_SIZE) {
    const existingMB = ((projectTotal._sum.size || 0) / (1024 * 1024)).toFixed(2);
    const newMB = (newSize / (1024 * 1024)).toFixed(2);
    const totalMB = (projectSize / (1024 * 1024)).toFixed(2);

    throw new ValidationError(
      `Project quota exceeded (100MB limit). ` +
        `Existing: ${existingMB} MB, New: ${newMB} MB, Total: ${totalMB} MB`,
    );
  }
}
