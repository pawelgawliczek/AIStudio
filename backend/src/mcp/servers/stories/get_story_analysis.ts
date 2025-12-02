/**
 * Get Story Analysis Tool
 * Retrieves the 4 analysis fields from a story:
 * - architectAnalysis
 * - baAnalysis
 * - designerAnalysis
 * - contextExploration
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { PrismaClient } from '@prisma/client';
import {
  NotFoundError,
} from '../../types';
import {
  validateRequired,
  handlePrismaError,
} from '../../utils';

export const tool: Tool = {
  name: 'get_story_analysis',
  description: `Get analysis fields for a story.

**DEPRECATED (ST-152):** These fields are deprecated. Use the Artifact system instead:
- list_artifacts({ workflowRunId }) to get analysis artifacts
- get_artifact({ definitionKey: "ARCH_ANALYSIS", workflowRunId }) for specific analysis
- open_artifact_session() for interactive editing`,
  inputSchema: {
    type: 'object',
    properties: {
      storyId: {
        type: 'string',
        description: 'Story UUID',
      },
    },
    required: ['storyId'],
  },
};

export const metadata = {
  category: 'stories',
  domain: 'project_management',
  tags: ['story', 'analysis', 'architect', 'ba', 'designer', 'explorer'],
  version: '1.0.0',
  since: 'ST-26',
};

export interface GetStoryAnalysisParams {
  storyId: string;
}

export interface StoryAnalysisResponse {
  storyId: string;
  storyKey: string;
  title: string;
  analysis: {
    architectAnalysis: string | null;
    baAnalysis: string | null;
    designerAnalysis: string | null;
    contextExploration: string | null;
  };
  /** @deprecated ST-152 - Use Artifact system instead */
  _deprecationWarning?: string;
}

export async function handler(
  prisma: PrismaClient,
  params: GetStoryAnalysisParams,
): Promise<StoryAnalysisResponse> {
  try {
    validateRequired(params, ['storyId']);

    const story = await prisma.story.findUnique({
      where: { id: params.storyId },
      select: {
        id: true,
        key: true,
        title: true,
        architectAnalysis: true,
        baAnalysis: true,
        designerAnalysis: true,
        contextExploration: true,
      },
    });

    if (!story) {
      throw new NotFoundError('Story', params.storyId);
    }

    return {
      storyId: story.id,
      storyKey: story.key,
      title: story.title,
      analysis: {
        architectAnalysis: story.architectAnalysis,
        baAnalysis: story.baAnalysis,
        designerAnalysis: story.designerAnalysis,
        contextExploration: story.contextExploration,
      },
      _deprecationWarning: 'These analysis fields are deprecated (ST-152). Use the Artifact system instead: list_artifacts(), get_artifact(), or open_artifact_session().',
    };
  } catch (error: any) {
    if (error.name === 'MCPError') {
      throw error;
    }
    throw handlePrismaError(error, 'get_story_analysis');
  }
}
