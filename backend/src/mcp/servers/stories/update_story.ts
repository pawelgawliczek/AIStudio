/**
 * Update Story Tool
 * Updates an existing story (title, description, status, complexity, framework)
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { PrismaClient } from '@prisma/client';
import {
  UpdateStoryParams,
  StoryResponse,
  NotFoundError,
} from '../../types';
import {
  formatStory,
  validateRequired,
  handlePrismaError,
} from '../../utils';

export const tool: Tool = {
  name: 'update_story',
  description: `Update an existing story (title, description, status, complexity, framework).

**DEPRECATED (ST-152):** The analysis fields (architectAnalysis, baAnalysis, designerAnalysis, contextExploration) are deprecated.
Use the Artifact system instead:
- upload_artifact({ definitionKey: "ARCH_ANALYSIS", workflowRunId, content }) for architect analysis
- open_artifact_session() for interactive artifact editing`,
  inputSchema: {
    type: 'object',
    properties: {
      storyId: {
        type: 'string',
        description: 'Story UUID',
      },
      title: {
        type: 'string',
        description: 'New story title',
      },
      description: {
        type: 'string',
        description: 'New story description',
      },
      status: {
        type: 'string',
        enum: ['planning', 'analysis', 'architecture', 'design', 'impl', 'review', 'qa', 'done'],
        description: 'New story status',
      },
      businessImpact: {
        type: 'number',
        description: 'Business impact score (1-10)',
      },
      businessComplexity: {
        type: 'number',
        description: 'Business complexity score (1-10)',
      },
      technicalComplexity: {
        type: 'number',
        description: 'Technical complexity score (1-10)',
      },
      assignedFrameworkId: {
        type: 'string',
        description: 'Framework UUID to assign this story to',
      },
      contextExploration: {
        type: 'string',
        description: '@deprecated Use Artifact system instead (ST-152)',
      },
      baAnalysis: {
        type: 'string',
        description: '@deprecated Use Artifact system instead (ST-152)',
      },
      designerAnalysis: {
        type: 'string',
        description: '@deprecated Use Artifact system instead (ST-152)',
      },
      architectAnalysis: {
        type: 'string',
        description: '@deprecated Use Artifact system instead (ST-152)',
      },
    },
    required: ['storyId'],
  },
};

export const metadata = {
  category: 'stories',
  domain: 'project_management',
  tags: ['story', 'update', 'modify'],
  version: '1.0.0',
  since: 'sprint-3',
};

export async function handler(
  prisma: PrismaClient,
  params: UpdateStoryParams,
): Promise<StoryResponse> {
  try {
    validateRequired(params, ['storyId']);

    // Verify story exists
    const existingStory = await prisma.story.findUnique({
      where: { id: params.storyId },
    });

    if (!existingStory) {
      throw new NotFoundError('Story', params.storyId);
    }

    // Verify framework exists if provided
    if (params.assignedFrameworkId) {
      const framework = await prisma.agentFramework.findUnique({
        where: { id: params.assignedFrameworkId },
      });

      if (!framework) {
        throw new NotFoundError('Framework', params.assignedFrameworkId);
      }
    }

    // Build update data object (only include provided fields)
    const updateData: any = {};

    if (params.title !== undefined) updateData.title = params.title;
    if (params.description !== undefined) updateData.description = params.description;
    if (params.status !== undefined) updateData.status = params.status;
    if (params.businessImpact !== undefined)
      updateData.businessImpact = params.businessImpact;
    if (params.businessComplexity !== undefined)
      updateData.businessComplexity = params.businessComplexity;
    if (params.technicalComplexity !== undefined)
      updateData.technicalComplexity = params.technicalComplexity;
    if (params.assignedFrameworkId !== undefined)
      updateData.assignedFrameworkId = params.assignedFrameworkId;

    // Workflow component analysis fields (DEPRECATED - ST-152)
    const deprecatedFieldsUsed: string[] = [];
    if (params.contextExploration !== undefined) {
      updateData.contextExploration = params.contextExploration;
      deprecatedFieldsUsed.push('contextExploration');
    }
    if (params.baAnalysis !== undefined) {
      updateData.baAnalysis = params.baAnalysis;
      deprecatedFieldsUsed.push('baAnalysis');
    }
    if (params.designerAnalysis !== undefined) {
      updateData.designerAnalysis = params.designerAnalysis;
      deprecatedFieldsUsed.push('designerAnalysis');
    }
    if (params.architectAnalysis !== undefined) {
      updateData.architectAnalysis = params.architectAnalysis;
      deprecatedFieldsUsed.push('architectAnalysis');
    }

    // Update story
    const updatedStory = await prisma.story.update({
      where: { id: params.storyId },
      data: updateData,
    });

    const response = formatStory(updatedStory);

    // Add deprecation warning if deprecated fields were used
    if (deprecatedFieldsUsed.length > 0) {
      (response as any)._deprecationWarning = `Fields [${deprecatedFieldsUsed.join(', ')}] are deprecated (ST-152). Use the Artifact system instead: upload_artifact() or open_artifact_session()`;
    }

    return response;
  } catch (error: any) {
    if (error.name === 'MCPError') {
      throw error;
    }
    throw handlePrismaError(error, 'update_story');
  }
}
