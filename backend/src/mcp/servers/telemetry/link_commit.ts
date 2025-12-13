import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { PrismaClient } from '@prisma/client';
import { ImpactAnalysisService } from '../../../impact-analysis/impact-analysis.service';

export const tool: Tool = {
  name: 'link_commit',
  description: 'Link a git commit to a story or epic. Tracks code changes and calculates metrics.',
  inputSchema: {
    type: 'object',
    properties: {
      hash: {
        type: 'string',
        description: 'Git commit hash (SHA-1, 40 characters)',
      },
      projectId: {
        type: 'string',
        description: 'Project ID',
      },
      author: {
        type: 'string',
        description: 'Commit author (name <email> format)',
      },
      timestamp: {
        type: 'string',
        description: 'ISO 8601 timestamp of commit',
      },
      message: {
        type: 'string',
        description: 'Commit message',
      },
      storyId: {
        type: 'string',
        description: 'Story ID to link to (optional)',
      },
      epicId: {
        type: 'string',
        description: 'Epic ID to link to (optional)',
      },
      files: {
        type: 'array',
        description: 'Array of files changed in commit (optional)',
        items: {
          type: 'object',
          properties: {
            filePath: {
              type: 'string',
              description: 'File path relative to repository root',
            },
            locAdded: {
              type: 'number',
              description: 'Lines of code added',
            },
            locDeleted: {
              type: 'number',
              description: 'Lines of code deleted',
            },
            complexityBefore: {
              type: 'number',
              description: 'Cyclomatic complexity before change (optional)',
            },
            complexityAfter: {
              type: 'number',
              description: 'Cyclomatic complexity after change (optional)',
            },
            coverageBefore: {
              type: 'number',
              description: 'Test coverage before change (optional)',
            },
            coverageAfter: {
              type: 'number',
              description: 'Test coverage after change (optional)',
            },
          },
          required: ['filePath', 'locAdded', 'locDeleted'],
        },
      },
    },
    required: ['hash', 'projectId', 'author', 'timestamp', 'message'],
  },
};

export const metadata = {
  category: 'telemetry',
  domain: 'Telemetry & Git Integration',
  tags: ['telemetry', 'git', 'commits', 'tracking', 'loc'],
  version: '1.0.0',
  since: '2025-11-10',
};

export async function handler(prisma: PrismaClient, params: any) {
  // Validate required fields
  if (!params.hash) {
    throw new Error('hash is required');
  }
  if (!params.projectId) {
    throw new Error('projectId is required');
  }
  if (!params.author) {
    throw new Error('author is required');
  }
  if (!params.timestamp) {
    throw new Error('timestamp is required');
  }
  if (!params.message) {
    throw new Error('message is required');
  }

  // Verify project exists
  const project = await prisma.project.findUnique({
    where: { id: params.projectId },
  });
  if (!project) {
    throw new Error(`Project with ID ${params.projectId} not found`);
  }

  // Check if commit already exists
  const existingCommit = await prisma.commit.findUnique({
    where: { hash: params.hash },
  });

  let commit;
  if (existingCommit) {
    // Update existing commit
    commit = await prisma.commit.update({
      where: { hash: params.hash },
      data: {
        storyId: params.storyId || null,
        epicId: params.epicId || null,
      },
      include: {
        project: true,
        story: true,
        epic: true,
        files: true,
      },
    });
  } else {
    // Create new commit
    commit = await prisma.commit.create({
      data: {
        hash: params.hash,
        projectId: params.projectId,
        author: params.author,
        timestamp: new Date(params.timestamp),
        message: params.message,
        storyId: params.storyId || null,
        epicId: params.epicId || null,
        files: params.files
          ? {
              create: params.files.map((file: any) => ({
                filePath: file.filePath,
                locAdded: file.locAdded,
                locDeleted: file.locDeleted,
                complexityBefore: file.complexityBefore || null,
                complexityAfter: file.complexityAfter || null,
                coverageBefore: file.coverageBefore || null,
                coverageAfter: file.coverageAfter || null,
              })),
            }
          : undefined,
      },
      include: {
        project: true,
        story: true,
        epic: true,
        files: true,
      },
    });
  }

  const totalLOC = commit.files.reduce(
    (acc, file) => ({
      added: acc.added + file.locAdded,
      deleted: acc.deleted + file.locDeleted,
    }),
    { added: 0, deleted: 0 },
  );

  // Automatically create file-to-usecase mappings using ImpactAnalysisService
  const impactService = new ImpactAnalysisService(prisma as any);
  const fileMappingsCreated = await impactService.createMappingsFromCommit(
    params.hash,
  );

  return {
    success: true,
    commit: {
      hash: commit.hash,
      projectId: commit.projectId,
      author: commit.author,
      timestamp: commit.timestamp.toISOString(),
      message: commit.message,
      storyId: commit.storyId,
      storyKey: commit.story?.key,
      epicId: commit.epicId,
      epicKey: commit.epic?.key,
      filesChanged: commit.files.length,
      linesAdded: totalLOC.added,
      linesDeleted: totalLOC.deleted,
      netLines: totalLOC.added - totalLOC.deleted,
    },
    fileMappings: {
      created: fileMappingsCreated,
      message:
        fileMappingsCreated > 0
          ? `Created ${fileMappingsCreated} file-to-usecase mapping(s)`
          : 'No use cases linked to story',
    },
    message: existingCommit
      ? `Commit ${params.hash.substring(0, 7)} updated successfully`
      : `Commit ${params.hash.substring(0, 7)} linked successfully`,
  };
}
