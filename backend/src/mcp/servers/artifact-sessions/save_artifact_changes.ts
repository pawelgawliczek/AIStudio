/**
 * Save Artifact Changes Tool
 * ST-152: Persist changes made in artifact editing session
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { PrismaClient } from '@prisma/client';
import {
  NotFoundError,
  ValidationError,
} from '../../types';
import { validateRequired, handlePrismaError } from '../../utils';
import { handler as uploadArtifactHandler } from '../artifacts/upload_artifact';

export const tool: Tool = {
  name: 'save_artifact_changes',
  description: `Save modified content back to the artifact from an editing session.

Extracts final content from session output or accepts direct content parameter.
Auto-increments artifact version on save.

**Content Extraction:**
- Looks for code blocks matching artifact type: \`\`\`markdown ... \`\`\`
- Falls back to generic code blocks: \`\`\` ... \`\`\`
- Or provide content directly via the content parameter`,
  inputSchema: {
    type: 'object',
    properties: {
      jobId: {
        type: 'string',
        description: 'Job ID from open_artifact_session',
      },
      content: {
        type: 'string',
        description: 'Override content to save (optional - extracted from job output if not provided)',
      },
      extractFromOutput: {
        type: 'boolean',
        description: 'Extract content from job output (default: true if content not provided)',
      },
    },
    required: ['jobId'],
  },
};

export const metadata = {
  category: 'artifact_sessions',
  domain: 'story_runner',
  tags: ['artifact', 'session', 'save', 'st-152'],
  version: '1.0.0',
  since: 'ST-152',
};

interface SaveArtifactChangesParams {
  jobId: string;
  content?: string;
  extractFromOutput?: boolean;
}

interface SaveArtifactChangesResponse {
  success: boolean;
  artifactId?: string;
  artifactKey?: string;
  previousVersion?: number;
  newVersion?: number;
  size?: number;
  error?: string;
}

/**
 * Extract artifact content from session output
 * Looks for code blocks with type markers or generic code blocks
 */
function extractArtifactContent(output: string, type: string): string | null {
  if (!output) return null;

  // Try type-specific code block first: ```markdown ... ```
  const typePattern = new RegExp(`\`\`\`${type}\\n([\\s\\S]*?)\\n\`\`\``, 'i');
  const typeMatch = output.match(typePattern);
  if (typeMatch && typeMatch[1]) {
    return typeMatch[1].trim();
  }

  // Try with just the type (no newline required after type)
  const typePatternAlt = new RegExp(`\`\`\`${type}([\\s\\S]*?)\`\`\``, 'i');
  const typeMatchAlt = output.match(typePatternAlt);
  if (typeMatchAlt && typeMatchAlt[1]) {
    return typeMatchAlt[1].trim();
  }

  // Fallback: look for generic code block with content
  const genericPattern = /```\n?([\s\S]*?)\n?```/;
  const genericMatch = output.match(genericPattern);
  if (genericMatch && genericMatch[1]) {
    return genericMatch[1].trim();
  }

  return null;
}

export async function handler(
  prisma: PrismaClient,
  params: SaveArtifactChangesParams,
): Promise<SaveArtifactChangesResponse> {
  try {
    validateRequired(params, ['jobId']);

    const { jobId, content: providedContent, extractFromOutput } = params;

    // Get job details
    const job = await prisma.remoteJob.findUnique({
      where: { id: jobId },
    });

    if (!job) {
      throw new NotFoundError('RemoteJob', jobId);
    }

    // Verify this is an artifact session job
    if (job.jobType !== 'artifact-session') {
      throw new ValidationError(
        `Job ${jobId} is not an artifact session (type: ${job.jobType})`,
      );
    }

    // Extract artifact info from job params
    const jobParams = job.params as Record<string, unknown>;
    const artifactId = jobParams.artifactId as string;
    const workflowRunId = jobParams.workflowRunId as string;

    if (!artifactId || !workflowRunId) {
      throw new ValidationError(
        'Job params missing artifactId or workflowRunId',
      );
    }

    // Get the artifact to know its definition and current version
    const artifact = await prisma.artifact.findUnique({
      where: { id: artifactId },
      include: { definition: true },
    });

    if (!artifact) {
      throw new NotFoundError('Artifact', artifactId);
    }

    // Determine content to save
    let contentToSave = providedContent;

    if (!contentToSave && extractFromOutput !== false) {
      // Try to extract from job output
      const jobResult = job.result as Record<string, unknown> | null;
      const output = jobResult?.output as string | undefined;

      if (output) {
        const artifactType = artifact.definition?.type || 'markdown';
        contentToSave = extractArtifactContent(output, artifactType);
      }
    }

    if (!contentToSave) {
      throw new ValidationError(
        'No content to save. Either provide content parameter or ensure job output contains formatted content in code blocks.',
      );
    }

    // Save using upload_artifact handler (auto-increments version)
    const result = await uploadArtifactHandler(prisma, {
      definitionId: artifact.definitionId,
      workflowRunId,
      content: contentToSave,
    });

    return {
      success: true,
      artifactId: artifact.id,
      artifactKey: artifact.definition?.key,
      previousVersion: artifact.version,
      newVersion: result.version,
      size: result.size,
    };
  } catch (error: any) {
    if (error.name === 'MCPError') {
      throw error;
    }
    throw handlePrismaError(error, 'save_artifact_changes');
  }
}
