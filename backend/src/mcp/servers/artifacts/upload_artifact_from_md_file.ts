/**
 * Upload Artifact From Markdown File Tool (ST-307)
 * Uploads text/markdown artifact content from a file on the laptop with redaction
 *
 * This tool reads text/markdown files via RemoteRunner (laptop agent), applies
 * sensitive data redaction, and uploads to the database.
 * Security: File path validation, quota enforcement, sensitive data redaction.
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { PrismaClient } from '@prisma/client';
import {
  UploadArtifactFromFileParams,
  UploadArtifactFromFileResponse,
  NotFoundError,
  ValidationError,
} from '../../types';
import { validateRequired } from '../../utils';
import { redactSensitiveData } from '../../utils/content-security';
import { validateArtifactQuota } from '../../utils/quota-validation';
import { RemoteRunner } from '../../utils/remote-runner';
import { handler as createArtifact } from './create_artifact';

export const tool: Tool = {
  name: 'upload_artifact_from_md_file',
  description:
    'Upload text/markdown artifact content from a file on the laptop. Reads file via remote agent, applies security redaction for sensitive data (API keys, emails, etc.), and uploads to database. For binary files (images, PDFs), use upload_artifact_from_binary_file instead.',
  inputSchema: {
    type: 'object',
    properties: {
      filePath: {
        type: 'string',
        description: 'Absolute path to file (must be in ~/.claude/projects/ directory)',
      },
      definitionId: {
        type: 'string',
        description: 'Artifact Definition UUID (provide this OR definitionKey)',
      },
      definitionKey: {
        type: 'string',
        description: 'Artifact key (e.g., "THE_PLAN"). Uses workflowRunId to look up definition.',
      },
      workflowRunId: {
        type: 'string',
        description: 'Workflow Run UUID (required)',
      },
      componentId: {
        type: 'string',
        description: 'Component UUID that is creating this artifact (optional)',
      },
      maxFileSize: {
        type: 'number',
        description: 'Maximum file size in bytes (default: 2MB, max: 2MB)',
      },
    },
    required: ['filePath', 'workflowRunId'],
  },
};

export const metadata = {
  category: 'artifacts',
  domain: 'story_runner',
  tags: ['artifact', 'upload', 'file', 'remote', 'laptop', 'markdown', 'text'],
  version: '1.0.0',
  since: 'ST-307',
};

interface ReadFileResult {
  content: string;
  size: number;
}

const DEFAULT_MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB

export async function handler(
  prisma: PrismaClient,
  params: UploadArtifactFromFileParams,
): Promise<UploadArtifactFromFileResponse> {
  // 1. Validate required parameters
  validateRequired(params as unknown as Record<string, unknown>, ['filePath', 'workflowRunId']);

  const maxFileSize = params.maxFileSize || DEFAULT_MAX_FILE_SIZE;

  // Ensure maxFileSize doesn't exceed 2MB
  if (maxFileSize > DEFAULT_MAX_FILE_SIZE) {
    throw new ValidationError(
      `maxFileSize cannot exceed ${DEFAULT_MAX_FILE_SIZE} bytes (2MB)`,
    );
  }

  // 2. Verify workflow run exists and get project context
  const workflowRun = await prisma.workflowRun.findUnique({
    where: { id: params.workflowRunId },
    include: { workflow: true },
  });

  if (!workflowRun) {
    throw new NotFoundError('WorkflowRun', params.workflowRunId);
  }

  const projectId = workflowRun.workflow.projectId;

  // 3. Validate quota BEFORE reading file (fast-fail with estimated size)
  await validateArtifactQuota(prisma, params.workflowRunId, projectId, maxFileSize);

  // 4. Read file via RemoteRunner
  const runner = new RemoteRunner();

  const readResult = await runner.execute<ReadFileResult>('read-file', [
    '--path',
    params.filePath,
    '--max-size',
    maxFileSize.toString(),
  ]);

  // 5. Handle agent offline scenario
  if (!readResult.executed) {
    return {
      success: true,
      agentOffline: true,
      fallbackCommand:
        readResult.fallbackCommand ||
        `claude code "Upload ${params.filePath} to artifact system"`,
      message: 'Agent offline. Please run the fallback command manually.',
    };
  }

  // 6. Handle read failure
  if (!readResult.success || !readResult.result) {
    return {
      success: false,
      message: readResult.error || 'Failed to read file from remote agent',
    };
  }

  const { content, size } = readResult.result;

  // 7. Validate quota with actual file size
  await validateArtifactQuota(prisma, params.workflowRunId, projectId, size);

  // 8. Redact sensitive data
  const { redactedContent, redactionApplied, redactionCount, patterns } =
    redactSensitiveData(content);

  // Log warning if redaction occurred
  if (redactionApplied) {
    console.warn(
      `[upload_artifact_from_md_file] Redacted ${redactionCount} sensitive data pattern(s) ` +
        `from file ${params.filePath}. Patterns: ${patterns.join(', ')}`,
    );
  }

  // 9. Call existing create_artifact handler with redacted content
  const artifact = await createArtifact(prisma, {
    definitionId: params.definitionId,
    definitionKey: params.definitionKey,
    workflowRunId: params.workflowRunId,
    content: redactedContent,
    componentId: params.componentId,
  });

  return {
    success: true,
    artifact,
    message: `Successfully uploaded artifact from ${params.filePath}` +
      (redactionApplied ? ` (${redactionCount} sensitive pattern(s) redacted)` : ''),
  };
}
