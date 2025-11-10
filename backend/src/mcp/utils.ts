/**
 * MCP Server Utility Functions
 */

import { PrismaClient } from '@prisma/client';
import {
  MCPError,
  NotFoundError,
  ValidationError,
  DatabaseError,
  ProjectResponse,
  EpicResponse,
  StoryResponse,
} from './types';

/**
 * Format project for MCP response
 */
export function formatProject(project: any, includeCounts = false): ProjectResponse {
  return {
    id: project.id,
    name: project.name,
    description: project.description,
    repositoryUrl: project.repositoryUrl,
    status: project.status,
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
    ...(includeCounts && {
      epicCount: project._count?.epics || 0,
      storyCount: project._count?.stories || 0,
    }),
  };
}

/**
 * Format epic for MCP response
 */
export function formatEpic(epic: any, includeStoryCount = false): EpicResponse {
  return {
    id: epic.id,
    projectId: epic.projectId,
    key: epic.key,
    title: epic.title,
    description: epic.description,
    status: epic.status,
    priority: epic.priority,
    createdAt: epic.createdAt.toISOString(),
    updatedAt: epic.updatedAt.toISOString(),
    ...(includeStoryCount && {
      storyCount: epic._count?.stories || 0,
    }),
  };
}

/**
 * Format story for MCP response
 */
export function formatStory(story: any, includeRelations = false): StoryResponse {
  const formatted: StoryResponse = {
    id: story.id,
    projectId: story.projectId,
    epicId: story.epicId,
    key: story.key,
    type: story.type,
    title: story.title,
    description: story.description,
    status: story.status,
    businessImpact: story.businessImpact,
    businessComplexity: story.businessComplexity,
    technicalComplexity: story.technicalComplexity,
    estimatedTokenCost: story.estimatedTokenCost,
    assignedFrameworkId: story.assignedFrameworkId,
    createdAt: story.createdAt.toISOString(),
    updatedAt: story.updatedAt.toISOString(),
  };

  if (includeRelations) {
    if (story.subtasks) {
      formatted.subtasks = story.subtasks.map((subtask: any) => ({
        id: subtask.id,
        storyId: subtask.storyId,
        key: subtask.key,
        title: subtask.title,
        description: subtask.description,
        layer: subtask.layer,
        component: subtask.component,
        assigneeType: subtask.assigneeType,
        assigneeId: subtask.assigneeId,
        status: subtask.status,
        createdAt: subtask.createdAt.toISOString(),
        updatedAt: subtask.updatedAt.toISOString(),
      }));
    }

    if (story.useCaseLinks) {
      formatted.useCases = story.useCaseLinks.map((link: any) => ({
        id: link.useCase.id,
        projectId: link.useCase.projectId,
        key: link.useCase.key,
        title: link.useCase.title,
        area: link.useCase.area,
        latestVersion: link.useCase.versions?.[0]
          ? {
              version: link.useCase.versions[0].version,
              summary: link.useCase.versions[0].summary,
              content: link.useCase.versions[0].content,
            }
          : undefined,
      }));
    }

    if (story.commits) {
      formatted.commits = story.commits.map((commit: any) => ({
        hash: commit.hash,
        author: commit.author,
        timestamp: commit.timestamp.toISOString(),
        message: commit.message,
        files: commit.files?.map((file: any) => ({
          filePath: file.filePath,
          locAdded: file.locAdded,
          locDeleted: file.locDeleted,
        })),
      }));
    }
  }

  return formatted;
}

/**
 * Generate next key for entity (e.g., EP-1, ST-42)
 */
export async function generateNextKey(
  prisma: PrismaClient,
  type: 'epic' | 'story',
  projectId: string,
): Promise<string> {
  const prefix = type === 'epic' ? 'EP' : 'ST';

  // Find the highest existing key number
  const entities =
    type === 'epic'
      ? await prisma.epic.findMany({
          where: { projectId },
          select: { key: true },
          orderBy: { createdAt: 'desc' },
        })
      : await prisma.story.findMany({
          where: { projectId },
          select: { key: true },
          orderBy: { createdAt: 'desc' },
        });

  let maxNumber = 0;
  for (const entity of entities) {
    const match = entity.key.match(/^[A-Z]+-(\d+)$/);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > maxNumber) {
        maxNumber = num;
      }
    }
  }

  return `${prefix}-${maxNumber + 1}`;
}

/**
 * Validate required parameters
 */
export function validateRequired(params: any, required: string[]): void {
  const missing = required.filter((field) => !params[field]);
  if (missing.length > 0) {
    throw new ValidationError(`Missing required fields: ${missing.join(', ')}`);
  }
}

/**
 * Handle Prisma errors and convert to MCPError
 */
export function handlePrismaError(error: any, operation: string): never {
  console.error(`Prisma error during ${operation}:`, error);

  if (error.code === 'P2002') {
    throw new ValidationError(
      `A record with this ${error.meta?.target || 'field'} already exists`,
    );
  }

  if (error.code === 'P2003') {
    throw new ValidationError('Referenced record does not exist');
  }

  if (error.code === 'P2025') {
    throw new NotFoundError('Record', 'unknown');
  }

  throw new DatabaseError(`Database error during ${operation}: ${error.message}`);
}

/**
 * Get the default user ID (for MVP, we'll use a system user)
 * In production, this would come from authentication context
 */
export async function getSystemUserId(prisma: PrismaClient): Promise<string> {
  // Find or create a system user
  let systemUser = await prisma.user.findFirst({
    where: { email: 'system@aistudio.local' },
  });

  if (!systemUser) {
    // Create system user if it doesn't exist
    systemUser = await prisma.user.create({
      data: {
        email: 'system@aistudio.local',
        name: 'System User',
        password: 'not-used', // System user doesn't need a real password
        role: 'admin',
      },
    });
  }

  return systemUser.id;
}

/**
 * Safely parse JSON or return default
 */
export function safeJsonParse<T>(json: string, defaultValue: T): T {
  try {
    return JSON.parse(json);
  } catch {
    return defaultValue;
  }
}

/**
 * Format error for MCP response
 */
export function formatError(error: any): {
  error: string;
  code: string;
  statusCode: number;
} {
  if (error instanceof MCPError) {
    return {
      error: error.message,
      code: error.code,
      statusCode: error.statusCode,
    };
  }

  return {
    error: error.message || 'Internal server error',
    code: 'INTERNAL_ERROR',
    statusCode: 500,
  };
}
