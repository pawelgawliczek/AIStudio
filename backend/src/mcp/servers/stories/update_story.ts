/**
 * Update Story Tool
 * Updates an existing story (title, description, status, complexity, framework)
 *
 * ST-188: Added story key resolution support (accepts ST-123 or UUID)
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { PrismaClient } from '@prisma/client';
import { requestArtifactMove } from '../../services/websocket-gateway.instance';
import { resolveStory } from '../../shared/resolve-identifiers';
import {
  UpdateStoryParams,
  StoryResponse,
  NotFoundError,
} from '../../types';
import {
  formatStory,
  validateRequired,
  handlePrismaError,
  autoTruncateSummary,
} from '../../utils';

export const tool: Tool = {
  name: 'update_story',
  description: 'Update story fields by ID or key (ST-123). Accepts title, description, status, complexity scores.',
  inputSchema: {
    type: 'object',
    properties: {
      story: {
        type: 'string',
        description: 'Story key (e.g., ST-123) or UUID',
      },
      storyId: {
        type: 'string',
        description: 'Story UUID (deprecated - use story param instead)',
      },
      title: {
        type: 'string',
        description: 'New story title',
      },
      description: {
        type: 'string',
        description: 'New story description',
      },
      summary: {
        type: 'string',
        description:
          'AI-generated 2-sentence summary (max 300 chars). If description changes and no summary provided, auto-regenerates from description.',
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
      epicId: {
        type: 'string',
        description: 'Epic UUID to assign this story to (use null to unassign)',
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
    required: [],  // Either story or storyId required, validated in handler
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
  params: UpdateStoryParams & { story?: string },
): Promise<StoryResponse> {
  try {
    // ST-188: Resolve story key or UUID
    const storyInput = params.story || params.storyId;
    if (!storyInput) {
      throw new Error('Either story or storyId is required');
    }

    const resolved = await resolveStory(prisma, storyInput);
    if (!resolved) {
      throw new NotFoundError('Story', storyInput);
    }
    const storyId = resolved.id;

    // Verify story exists (get full story data)
    const existingStory = await prisma.story.findUnique({
      where: { id: storyId },
    });

    if (!existingStory) {
      throw new NotFoundError('Story', storyId);
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

    // Verify epic exists if provided (null is allowed to unassign)
    if (params.epicId !== undefined && params.epicId !== null) {
      const epic = await prisma.epic.findUnique({
        where: { id: params.epicId },
      });

      if (!epic) {
        throw new NotFoundError('Epic', params.epicId);
      }
    }

    // Build update data object (only include provided fields)
    const updateData: any = {};

    if (params.title !== undefined) updateData.title = params.title;
    if (params.description !== undefined) updateData.description = params.description;

    // Handle summary: if explicitly provided, use it; if description changed, auto-regenerate
    if (params.summary !== undefined) {
      updateData.summary = params.summary?.slice(0, 300) || null;
    } else if (params.description !== undefined) {
      // Description changed but no summary provided - auto-regenerate
      updateData.summary = autoTruncateSummary(params.description);
    }

    if (params.status !== undefined) updateData.status = params.status;
    if (params.businessImpact !== undefined)
      updateData.businessImpact = params.businessImpact;
    if (params.businessComplexity !== undefined)
      updateData.businessComplexity = params.businessComplexity;
    if (params.technicalComplexity !== undefined)
      updateData.technicalComplexity = params.technicalComplexity;
    if (params.assignedFrameworkId !== undefined)
      updateData.assignedFrameworkId = params.assignedFrameworkId;
    if (params.epicId !== undefined)
      updateData.epicId = params.epicId;

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

    // ST-363: Check if epicId is changing and trigger artifact move
    const epicIdChanged = params.epicId !== undefined && params.epicId !== existingStory.epicId;
    let newEpicKey: string | null = null;

    if (epicIdChanged && params.epicId !== null) {
      // Fetch the new epic to get its key
      const newEpic = await prisma.epic.findUnique({
        where: { id: params.epicId },
        select: { key: true },
      });
      if (newEpic) {
        newEpicKey = newEpic.key;
      }
    }

    // Update story
    const updatedStory = await prisma.story.update({
      where: { id: storyId },
      data: updateData,
    });

    const response = formatStory(updatedStory);

    // Add deprecation warning if deprecated fields were used
    if (deprecatedFieldsUsed.length > 0) {
      (response as any)._deprecationWarning = `Fields [${deprecatedFieldsUsed.join(', ')}] are deprecated (ST-152). Use the Artifact system instead: upload_artifact() or open_artifact_session()`;
    }

    // ST-363: Trigger artifact move if epicId changed
    if (epicIdChanged) {
      const storyKey = existingStory.key;
      const oldPath = `docs/${storyKey}`;
      const newPath = newEpicKey
        ? `docs/${newEpicKey}/${storyKey}`
        : `docs/unassigned/${storyKey}`;

      // Fire-and-forget artifact move request (don't block the response)
      requestArtifactMove({
        storyKey,
        storyId,
        epicKey: newEpicKey,
        oldPath,
        newPath,
      }).catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        console.warn(`[ST-363] Failed to request artifact move for ${storyKey}: ${message}`);
      });
    }

    return response;
  } catch (error: any) {
    if (error.name === 'MCPError') {
      throw error;
    }
    throw handlePrismaError(error, 'update_story');
  }
}
