/**
 * Upload Artifact From Binary File Tool (ST-307)
 * Uploads binary artifact content (images, PDFs, etc.) from files on the laptop
 *
 * This tool reads binary files via RemoteRunner (laptop agent), base64 encodes them,
 * and uploads to the database. Does NOT apply text redaction (binary files).
 * Security: File path validation, extension allowlist, quota enforcement, size limits.
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { PrismaClient } from '@prisma/client';
import {
  UploadArtifactFromBinaryFileParams,
  UploadArtifactFromBinaryFileResponse,
  NotFoundError,
  ValidationError,
} from '../../types';
import { validateRequired } from '../../utils';
import { validateArtifactQuota } from '../../utils/quota-validation';
import { RemoteRunner } from '../../utils/remote-runner';
import { handler as createArtifact } from './create_artifact';

export const tool: Tool = {
  name: 'upload_artifact_from_binary_file',
  description:
    'Upload binary artifact content (images, PDFs, etc.) from a file on the laptop. Reads file via remote agent as base64-encoded data. Does NOT apply text redaction. Supports: png, jpg, jpeg, gif, pdf, svg. Max 5MB.',
  inputSchema: {
    type: 'object',
    properties: {
      filePath: {
        type: 'string',
        description: 'Absolute path to binary file (must be in ~/.claude/projects/ directory)',
      },
      definitionId: {
        type: 'string',
        description: 'Artifact Definition UUID (provide this OR definitionKey)',
      },
      definitionKey: {
        type: 'string',
        description: 'Artifact key (e.g., "SCREENSHOT", "DIAGRAM"). Uses workflowRunId to look up definition.',
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
        description: 'Maximum file size in bytes (default: 5MB, max: 5MB)',
      },
      contentType: {
        type: 'string',
        description: 'MIME type override (auto-detected from file extension if not provided)',
      },
    },
    required: ['filePath', 'workflowRunId'],
  },
};

export const metadata = {
  category: 'artifacts',
  domain: 'story_runner',
  tags: ['artifact', 'upload', 'file', 'remote', 'laptop', 'binary', 'image', 'pdf'],
  version: '1.0.0',
  since: 'ST-307',
};

interface ReadBinaryFileResult {
  content: string; // Base64-encoded binary data
  size: number;
  originalSize: number;
}

const DEFAULT_MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB for binary files

// ST-307: Security - Allowlist of supported binary file extensions
const ALLOWED_BINARY_EXTENSIONS = [
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.pdf',
  '.svg',
  '.webp',
  '.bmp',
] as const;

// ST-307: MIME type detection from file extension
const EXTENSION_TO_MIME_TYPE: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.pdf': 'application/pdf',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.bmp': 'image/bmp',
};

export async function handler(
  prisma: PrismaClient,
  params: UploadArtifactFromBinaryFileParams,
): Promise<UploadArtifactFromBinaryFileResponse> {
  // 1. Validate required parameters
  validateRequired(params as unknown as Record<string, unknown>, ['filePath', 'workflowRunId']);

  const maxFileSize = params.maxFileSize || DEFAULT_MAX_FILE_SIZE;

  // Ensure maxFileSize doesn't exceed 5MB
  if (maxFileSize > DEFAULT_MAX_FILE_SIZE) {
    throw new ValidationError(
      `maxFileSize cannot exceed ${DEFAULT_MAX_FILE_SIZE} bytes (5MB)`,
    );
  }

  // 2. Validate file extension (security: allowlist)
  const fileExtension = params.filePath.toLowerCase().substring(params.filePath.lastIndexOf('.'));

  if (!ALLOWED_BINARY_EXTENSIONS.includes(fileExtension as any)) {
    throw new ValidationError(
      `File extension '${fileExtension}' not supported. Allowed extensions: ${ALLOWED_BINARY_EXTENSIONS.join(', ')}`,
    );
  }

  // 3. Auto-detect MIME type from extension
  const detectedMimeType = EXTENSION_TO_MIME_TYPE[fileExtension] || 'application/octet-stream';
  const contentType = params.contentType || detectedMimeType;

  // 4. Verify workflow run exists and get project context
  const workflowRun = await prisma.workflowRun.findUnique({
    where: { id: params.workflowRunId },
    include: { workflow: true },
  });

  if (!workflowRun) {
    throw new NotFoundError('WorkflowRun', params.workflowRunId);
  }

  const projectId = workflowRun.workflow.projectId;

  // 5. Validate quota BEFORE reading file (fast-fail with estimated size)
  // Note: Base64 encoding increases size by ~33%, so we check with inflated estimate
  const estimatedBase64Size = Math.ceil(maxFileSize * 1.34);
  await validateArtifactQuota(prisma, params.workflowRunId, projectId, estimatedBase64Size);

  // 6. Read file via RemoteRunner
  const runner = new RemoteRunner();

  const readResult = await runner.execute<ReadBinaryFileResult>('read-binary-file', [
    '--path',
    params.filePath,
    '--max-size',
    maxFileSize.toString(),
  ]);

  // 7. Handle agent offline scenario
  if (!readResult.executed) {
    return {
      success: true,
      agentOffline: true,
      fallbackCommand:
        readResult.fallbackCommand ||
        `claude code "Upload binary file ${params.filePath} to artifact system"`,
      message: 'Agent offline. Please run the fallback command manually.',
    };
  }

  // 8. Handle read failure
  if (!readResult.success || !readResult.result) {
    return {
      success: false,
      message: readResult.error || 'Failed to read binary file from remote agent',
    };
  }

  const { content, size, originalSize } = readResult.result;

  // 9. Validate quota with actual base64 size
  await validateArtifactQuota(prisma, params.workflowRunId, projectId, size);

  // 10. Call create_artifact handler with base64 content
  // Note: No redaction for binary files - they're already encoded
  const artifact = await createArtifact(prisma, {
    definitionId: params.definitionId,
    definitionKey: params.definitionKey,
    workflowRunId: params.workflowRunId,
    content, // Base64-encoded binary data
    contentType,
    componentId: params.componentId,
  });

  return {
    success: true,
    artifact,
    message: `Successfully uploaded binary artifact from ${params.filePath}`,
    metadata: {
      originalSize,
      base64Size: size,
      detectedMimeType,
    },
  };
}
