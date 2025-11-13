import { PrismaClient } from '@prisma/client';
import { Tool } from '@modelcontextprotocol/sdk/types.js';

export const tool: Tool = {
  name: 'store_artifact',
  description: 'Store component output artifact (code, report, log, etc.) to S3 storage. Returns artifact ID and download URL.',
  inputSchema: {
    type: 'object',
    properties: {
      runId: {
        type: 'string',
        description: 'Workflow run ID (required)',
      },
      componentId: {
        type: 'string',
        description: 'Component ID (required)',
      },
      artifactType: {
        type: 'string',
        enum: ['code', 'report', 'log', 'diff', 'test_results', 'other'],
        description: 'Type of artifact (required)',
      },
      data: {
        type: ['object', 'string'],
        description: 'Artifact data (object or string) (required)',
      },
      metadata: {
        type: 'object',
        description: 'Artifact metadata',
        properties: {
          format: {
            type: 'string',
            enum: ['json', 'markdown', 'code', 'text', 'html'],
            description: 'Data format',
          },
          filename: {
            type: 'string',
            description: 'Suggested filename',
          },
          size: {
            type: 'number',
            description: 'Size in bytes',
          },
          mimeType: {
            type: 'string',
            description: 'MIME type',
          },
          language: {
            type: 'string',
            description: 'Programming language (for code artifacts)',
          },
        },
      },
    },
    required: ['runId', 'componentId', 'artifactType', 'data'],
  },
};

export const metadata = {
  category: 'execution',
  domain: 'Workflow Execution',
  tags: ['artifact', 'storage', 's3', 'output'],
  version: '1.0.0',
  since: '2025-11-13',
};

export async function handler(prisma: PrismaClient, params: any) {
  // Validate required fields
  if (!params.runId) {
    throw new Error('runId is required');
  }
  if (!params.componentId) {
    throw new Error('componentId is required');
  }
  if (!params.artifactType) {
    throw new Error('artifactType is required');
  }
  if (!params.data) {
    throw new Error('data is required');
  }

  const validTypes = ['code', 'report', 'log', 'diff', 'test_results', 'other'];
  if (!validTypes.includes(params.artifactType)) {
    throw new Error(`artifactType must be one of: ${validTypes.join(', ')}`);
  }

  // Verify workflow run exists
  const workflowRun = await prisma.workflowRun.findUnique({
    where: { id: params.runId },
  });

  if (!workflowRun) {
    throw new Error(`Workflow run with ID ${params.runId} not found`);
  }

  // Verify component exists
  const component = await prisma.component.findUnique({
    where: { id: params.componentId },
  });

  if (!component) {
    throw new Error(`Component with ID ${params.componentId} not found`);
  }

  // Find the component run
  const componentRun = await prisma.componentRun.findFirst({
    where: {
      workflowRunId: params.runId,
      componentId: params.componentId,
    },
    orderBy: {
      startedAt: 'desc',
    },
  });

  if (!componentRun) {
    throw new Error(`No component execution found for runId ${params.runId} and componentId ${params.componentId}`);
  }

  // Prepare artifact data
  const artifactMetadata = params.metadata || {};
  const format = artifactMetadata.format || (typeof params.data === 'string' ? 'text' : 'json');
  const dataString = typeof params.data === 'string' ? params.data : JSON.stringify(params.data, null, 2);
  const size = artifactMetadata.size || Buffer.byteLength(dataString, 'utf8');
  const timestamp = Date.now();
  const filename =
    artifactMetadata.filename || `${params.artifactType}-${component.name.toLowerCase().replace(/\s+/g, '-')}-${timestamp}.${format === 'json' ? 'json' : format === 'markdown' ? 'md' : 'txt'}`;

  // Generate S3 key
  const s3Key = `workflow-runs/${params.runId}/components/${params.componentId}/${filename}`;

  // TODO: Upload to S3 when S3Service is implemented
  // For now, store in database as JSON
  // const s3Service = new S3Service();
  // await s3Service.uploadArtifact(s3Key, dataString);

  // Store artifact metadata in database (using artifactsS3Keys array in ComponentRun)
  const artifactRecord = {
    s3Key,
    artifactType: params.artifactType,
    format,
    size,
    filename,
    mimeType: artifactMetadata.mimeType || `application/${format}`,
    language: artifactMetadata.language || null,
    uploadedAt: new Date().toISOString(),
    data: params.data, // Store data in database until S3 is set up
  };

  // Update component run with artifact reference
  const existingArtifacts = Array.isArray(componentRun.artifacts) ? componentRun.artifacts : [];
  await prisma.componentRun.update({
    where: { id: componentRun.id },
    data: {
      artifacts: [...existingArtifacts, artifactRecord],
    },
  });

  return {
    success: true,
    artifactId: s3Key, // Using S3 key as artifact ID
    s3Key,
    componentRunId: componentRun.id,
    runId: params.runId,
    componentId: params.componentId,
    componentName: component.name,
    artifactType: params.artifactType,
    filename,
    format,
    size,
    uploadedAt: artifactRecord.uploadedAt,
    // TODO: Generate presigned URL when S3 is set up
    downloadUrl: null, // Will be populated by S3Service
    message: `Artifact "${filename}" stored successfully. Type: ${params.artifactType}, Size: ${size} bytes`,
    note: 'S3 upload pending - artifact stored in database temporarily',
  };
}
