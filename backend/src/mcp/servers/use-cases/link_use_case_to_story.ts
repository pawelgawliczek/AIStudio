import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { PrismaClient, UseCaseRelation } from '@prisma/client';
import { ValidationError } from '../../types';

export const tool: Tool = {
  name: 'link_use_case_to_story',
  description: 'Link a use case to a story with a specific relationship type (implements, modifies, or deprecates). This creates traceability from requirements to implementation.',
  inputSchema: {
    type: 'object',
    properties: {
      useCaseId: {
        type: 'string',
        description: 'Use case ID to link',
      },
      storyId: {
        type: 'string',
        description: 'Story ID to link to',
      },
      relation: {
        type: 'string',
        enum: ['implements', 'modifies', 'deprecates'],
        description: 'Relationship type: "implements" (story implements new use case), "modifies" (story modifies existing use case), "deprecates" (story deprecates old use case)',
      },
    },
    required: ['useCaseId', 'storyId', 'relation'],
  },
};

export const metadata = {
  category: 'use-cases',
  domain: 'planning',
  tags: ['use-case', 'story', 'link', 'traceability', 'requirements'],
  version: '1.0.0',
  since: '2025-11-10',
};

export async function handler(prisma: PrismaClient, params: any) {
  const { useCaseId, storyId, relation } = params;

  try {
    // Validate required parameters
    if (!useCaseId || !storyId || !relation) {
      throw new ValidationError('Missing required parameters: useCaseId, storyId, relation');
    }

    // Validate relation enum
    const validRelations: UseCaseRelation[] = ['implements', 'modifies', 'deprecates'];
    if (!validRelations.includes(relation)) {
      throw new ValidationError(
        `Invalid relation type: ${relation}. Must be one of: ${validRelations.join(', ')}`,
      );
    }

    // Check if use case exists
    const useCase = await prisma.useCase.findUnique({
      where: { id: useCaseId },
      select: {
        id: true,
        key: true,
        title: true,
        projectId: true,
      },
    });

    if (!useCase) {
      throw new ValidationError(`Use case with ID ${useCaseId} not found`);
    }

    // Check if story exists
    const story = await prisma.story.findUnique({
      where: { id: storyId },
      select: {
        id: true,
        key: true,
        title: true,
        projectId: true,
        status: true,
      },
    });

    if (!story) {
      throw new ValidationError(`Story with ID ${storyId} not found`);
    }

    // Verify both belong to the same project
    if (useCase.projectId !== story.projectId) {
      throw new ValidationError(
        `Use case and story belong to different projects. Use case project: ${useCase.projectId}, Story project: ${story.projectId}`,
      );
    }

    // Create or update link
    const link = await prisma.storyUseCaseLink.upsert({
      where: {
        storyId_useCaseId: {
          storyId,
          useCaseId,
        },
      },
      create: {
        storyId,
        useCaseId,
        relation,
      },
      update: {
        relation,
      },
    });

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: true,
              message: `Use case ${useCase.key} linked to story ${story.key}`,
              link: {
                useCase: {
                  id: useCase.id,
                  key: useCase.key,
                  title: useCase.title,
                },
                story: {
                  id: story.id,
                  key: story.key,
                  title: story.title,
                  status: story.status,
                },
                relation,
                createdAt: link.createdAt,
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
            error: error.message || 'Failed to link use case to story',
          }, null, 2),
        },
      ],
      isError: true,
    };
  }
}
