import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { PrismaClient, Prisma } from '@prisma/client';
import { getSystemUserId } from '../../utils';
import { ValidationError } from '../../types';

export const tool: Tool = {
  name: 'create_use_case',
  description: 'Create a new use case with initial version. Use cases describe business scenarios and workflows that need to be implemented or tested.',
  inputSchema: {
    type: 'object',
    properties: {
      projectId: {
        type: 'string',
        description: 'Project ID this use case belongs to',
      },
      key: {
        type: 'string',
        description: 'Use case key (unique within project, e.g., UC-AUTH-001, UC-BILLING-002)',
      },
      title: {
        type: 'string',
        description: 'Use case title (e.g., "User Login", "Password Reset Flow")',
      },
      area: {
        type: 'string',
        description: 'Feature area or component (e.g., "Authentication", "Billing", "Reporting")',
      },
      content: {
        type: 'string',
        description: 'Detailed use case content in markdown format (main flow, alternative flows, preconditions, postconditions, etc.)',
      },
      summary: {
        type: 'string',
        description: 'Brief summary of the use case (optional, max 500 chars)',
      },
    },
    required: ['projectId', 'key', 'title', 'content'],
  },
};

export const metadata = {
  category: 'use-cases',
  domain: 'planning',
  tags: ['use-case', 'requirements', 'documentation', 'ba'],
  version: '1.0.0',
  since: '2025-11-10',
};

export async function handler(prisma: PrismaClient, params: any) {
  const { projectId, key, title, area, content, summary } = params;

  try {
    // Validate required parameters
    if (!projectId || !key || !title || !content) {
      throw new ValidationError('Missing required parameters: projectId, key, title, content');
    }

    // Validate key format (should be UC-XXX-NNN)
    if (!/^UC-[A-Z0-9]+-\d+$/.test(key)) {
      throw new ValidationError(
        'Invalid use case key format. Expected format: UC-<COMPONENT>-<NUMBER> (e.g., UC-AUTH-001)',
      );
    }

    // Check if project exists
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, name: true },
    });

    if (!project) {
      throw new ValidationError(`Project with ID ${projectId} not found`);
    }

    // Check if key is unique within project
    const existing = await prisma.useCase.findUnique({
      where: {
        projectId_key: {
          projectId,
          key,
        },
      },
    });

    if (existing) {
      throw new ValidationError(
        `Use case with key ${key} already exists in project ${project.name}`,
      );
    }

    // Get system user ID
    const systemUserId = await getSystemUserId(prisma);

    // Create use case with initial version
    const useCase = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const newUseCase = await tx.useCase.create({
        data: {
          projectId,
          key,
          title,
          area,
        },
      });

      await tx.useCaseVersion.create({
        data: {
          useCaseId: newUseCase.id,
          version: 1,
          summary,
          content,
          createdById: systemUserId,
        },
      });

      return tx.useCase.findUnique({
        where: { id: newUseCase.id },
        include: {
          versions: {
            orderBy: { version: 'desc' },
            take: 1,
            include: {
              createdBy: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                },
              },
            },
          },
        },
      });
    });

    const latestVersion = useCase.versions[0];

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: true,
              message: `Use case ${key} created successfully`,
              useCase: {
                id: useCase.id,
                projectId: useCase.projectId,
                key: useCase.key,
                title: useCase.title,
                area: useCase.area,
                version: latestVersion.version,
                summary: latestVersion.summary,
                createdAt: useCase.createdAt,
                createdBy: latestVersion.createdBy.name,
              },
            },
            null,
            2,
          ),
        },
      ],
    };
  } catch (error: any) {
    if (error.name === 'ValidationError') {
      throw error;
    }
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: error.message || 'Failed to create use case',
          }, null, 2),
        },
      ],
      isError: true,
    };
  }
}
