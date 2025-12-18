/**
 * Artifact Content MCP Tools Tests
 * Tests for upload_artifact, get_artifact, and list_artifacts
 */

import { PrismaClient } from '@prisma/client';
import { handler as getHandler } from '../get_artifact';
import { handler as listHandler } from '../list_artifacts';
import { handler as uploadHandler } from '../create_artifact';

// Mock Prisma
const mockPrisma = {
  workflowRun: {
    findUnique: jest.fn(),
  },
  artifactDefinition: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
  },
  artifact: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },
} as unknown as PrismaClient;

describe('Artifact Content Tools', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('upload_artifact', () => {
    const mockWorkflowRun = {
      id: 'run-uuid',
      workflowId: 'workflow-uuid',
      workflow: { id: 'workflow-uuid', name: 'Test Workflow' },
    };

    const mockDefinition = {
      id: 'def-uuid',
      workflowId: 'workflow-uuid',
      name: 'Architecture Document',
      key: 'ARCH_DOC',
      type: 'markdown',
      schema: null,
    };

    const mockArtifact = {
      id: 'artifact-uuid',
      definitionId: 'def-uuid',
      workflowRunId: 'run-uuid',
      content: '# Architecture\n\nThis is the architecture document.',
      contentType: 'text/markdown',
      size: 50,
      version: 1,
      createdByComponentId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      definition: mockDefinition,
      createdByComponent: null,
    };

    it('should create new artifact successfully', async () => {
      (mockPrisma.workflowRun.findUnique as jest.Mock).mockResolvedValue(mockWorkflowRun);
      (mockPrisma.artifactDefinition.findFirst as jest.Mock).mockResolvedValue(mockDefinition);
      (mockPrisma.artifactDefinition.findUnique as jest.Mock).mockResolvedValue(mockDefinition);
      (mockPrisma.artifact.findFirst as jest.Mock).mockResolvedValue(null); // No existing artifact
      (mockPrisma.artifact.create as jest.Mock).mockResolvedValue(mockArtifact);

      const result = await uploadHandler(mockPrisma, {
        workflowRunId: 'run-uuid',
        definitionKey: 'ARCH_DOC',
        content: '# Architecture\n\nThis is the architecture document.',
      });

      expect(result.id).toBe('artifact-uuid');
      expect(result.currentVersion).toBe(1);
      expect(result.contentType).toBe('text/markdown');
      expect(mockPrisma.artifact.create).toHaveBeenCalled();
    });

    it('should update existing artifact and increment version', async () => {
      const existingArtifact = { ...mockArtifact, version: 1 };
      const updatedArtifact = { ...mockArtifact, version: 2 };

      (mockPrisma.workflowRun.findUnique as jest.Mock).mockResolvedValue(mockWorkflowRun);
      (mockPrisma.artifactDefinition.findUnique as jest.Mock).mockResolvedValue(mockDefinition);
      (mockPrisma.artifact.findFirst as jest.Mock).mockResolvedValue(existingArtifact);
      (mockPrisma.artifact.update as jest.Mock).mockResolvedValue(updatedArtifact);

      const result = await uploadHandler(mockPrisma, {
        workflowRunId: 'run-uuid',
        definitionId: 'def-uuid',
        content: '# Updated Architecture\n\nNew content.',
      });

      expect(result.currentVersion).toBe(2);
      expect(mockPrisma.artifact.update).toHaveBeenCalled();
    });

    it('should validate JSON content for json-type definitions', async () => {
      const jsonDefinition = { ...mockDefinition, type: 'json' };

      (mockPrisma.workflowRun.findUnique as jest.Mock).mockResolvedValue(mockWorkflowRun);
      (mockPrisma.artifactDefinition.findUnique as jest.Mock).mockResolvedValue(jsonDefinition);

      await expect(
        uploadHandler(mockPrisma, {
          workflowRunId: 'run-uuid',
          definitionId: 'def-uuid',
          content: 'not valid json',
        }),
      ).rejects.toThrow('Content must be valid JSON');
    });

    it('should accept valid JSON for json-type definitions', async () => {
      const jsonDefinition = { ...mockDefinition, type: 'json' };
      const jsonArtifact = {
        ...mockArtifact,
        content: '{"key": "value"}',
        contentType: 'application/json',
      };

      (mockPrisma.workflowRun.findUnique as jest.Mock).mockResolvedValue(mockWorkflowRun);
      (mockPrisma.artifactDefinition.findUnique as jest.Mock).mockResolvedValue(jsonDefinition);
      (mockPrisma.artifact.findFirst as jest.Mock).mockResolvedValue(null);
      (mockPrisma.artifact.create as jest.Mock).mockResolvedValue(jsonArtifact);

      const result = await uploadHandler(mockPrisma, {
        workflowRunId: 'run-uuid',
        definitionId: 'def-uuid',
        content: '{"key": "value"}',
      });

      expect(result.contentType).toBe('application/json');
    });

    it('should reject when definition belongs to different workflow', async () => {
      const differentWorkflowDef = { ...mockDefinition, workflowId: 'different-workflow' };

      (mockPrisma.workflowRun.findUnique as jest.Mock).mockResolvedValue(mockWorkflowRun);
      (mockPrisma.artifactDefinition.findUnique as jest.Mock).mockResolvedValue(differentWorkflowDef);

      await expect(
        uploadHandler(mockPrisma, {
          workflowRunId: 'run-uuid',
          definitionId: 'def-uuid',
          content: 'test content',
        }),
      ).rejects.toThrow('must belong to the same workflow');
    });
  });

  describe('get_artifact', () => {
    const mockArtifact = {
      id: 'artifact-uuid',
      definitionId: 'def-uuid',
      workflowRunId: 'run-uuid',
      content: '# Architecture Document',
      contentType: 'text/markdown',
      size: 25,
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
      definition: { id: 'def-uuid', name: 'Architecture Document', key: 'ARCH_DOC', type: 'markdown' },
      createdByComponent: null,
      workflowRun: { id: 'run-uuid' },
    };

    it('should get artifact by ID', async () => {
      (mockPrisma.artifact.findUnique as jest.Mock).mockResolvedValue(mockArtifact);

      const result = await getHandler(mockPrisma, {
        artifactId: 'artifact-uuid',
      });

      expect(result.id).toBe('artifact-uuid');
      expect(result.content).toBe('# Architecture Document');
    });

    it('should get artifact by definitionKey + workflowRunId', async () => {
      const mockRun = { id: 'run-uuid', workflowId: 'workflow-uuid' };
      const mockDef = { id: 'def-uuid', key: 'ARCH_DOC' };

      (mockPrisma.workflowRun.findUnique as jest.Mock).mockResolvedValue(mockRun);
      (mockPrisma.artifactDefinition.findFirst as jest.Mock).mockResolvedValue(mockDef);
      (mockPrisma.artifact.findFirst as jest.Mock).mockResolvedValue(mockArtifact);

      const result = await getHandler(mockPrisma, {
        definitionKey: 'ARCH_DOC',
        workflowRunId: 'run-uuid',
      });

      expect(result.id).toBe('artifact-uuid');
    });

    it('should exclude content when includeContent is false', async () => {
      (mockPrisma.artifact.findUnique as jest.Mock).mockResolvedValue(mockArtifact);

      const result = await getHandler(mockPrisma, {
        artifactId: 'artifact-uuid',
        includeContent: false,
      });

      expect(result.content).toBe('[content omitted]');
    });

    it('should fail for non-existent artifact', async () => {
      (mockPrisma.artifact.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        getHandler(mockPrisma, {
          artifactId: 'non-existent',
        }),
      ).rejects.toThrow('not found');
    });

    it('should require either artifactId or definitionKey + workflowRunId', async () => {
      await expect(getHandler(mockPrisma, {})).rejects.toThrow(
        'Either artifactId or (definitionKey + workflowRunId) must be provided',
      );
    });
  });

  describe('list_artifacts', () => {
    const mockArtifacts = [
      {
        id: 'artifact-1',
        definitionId: 'def-1',
        workflowRunId: 'run-uuid',
        content: '# Doc 1',
        contentType: 'text/markdown',
        size: 10,
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        definition: { id: 'def-1', name: 'Doc 1', key: 'DOC_1', type: 'markdown' },
        createdByComponent: null,
      },
      {
        id: 'artifact-2',
        definitionId: 'def-2',
        workflowRunId: 'run-uuid',
        content: '{"data": "value"}',
        contentType: 'application/json',
        size: 20,
        version: 2,
        createdAt: new Date(),
        updatedAt: new Date(),
        definition: { id: 'def-2', name: 'Doc 2', key: 'DOC_2', type: 'json' },
        createdByComponent: { id: 'comp-uuid', name: 'Architect' },
      },
    ];

    it('should list artifacts with pagination', async () => {
      (mockPrisma.workflowRun.findUnique as jest.Mock).mockResolvedValue({ id: 'run-uuid', workflowId: 'wf-uuid' });
      (mockPrisma.artifact.count as jest.Mock).mockResolvedValue(2);
      (mockPrisma.artifact.findMany as jest.Mock).mockResolvedValue(mockArtifacts);

      const result = await listHandler(mockPrisma, {
        workflowRunId: 'run-uuid',
        page: 1,
        pageSize: 10,
      });

      expect(result.data).toHaveLength(2);
      expect(result.pagination.total).toBe(2);
    });

    it('should exclude content by default', async () => {
      (mockPrisma.workflowRun.findUnique as jest.Mock).mockResolvedValue({ id: 'run-uuid', workflowId: 'wf-uuid' });
      (mockPrisma.artifact.count as jest.Mock).mockResolvedValue(1);
      (mockPrisma.artifact.findMany as jest.Mock).mockResolvedValue([mockArtifacts[0]]);

      const result = await listHandler(mockPrisma, {
        workflowRunId: 'run-uuid',
      });

      expect(result.data[0].content).toContain('bytes');
    });

    it('should include content when requested', async () => {
      (mockPrisma.workflowRun.findUnique as jest.Mock).mockResolvedValue({ id: 'run-uuid', workflowId: 'wf-uuid' });
      (mockPrisma.artifact.count as jest.Mock).mockResolvedValue(1);
      (mockPrisma.artifact.findMany as jest.Mock).mockResolvedValue([mockArtifacts[0]]);

      const result = await listHandler(mockPrisma, {
        workflowRunId: 'run-uuid',
        includeContent: true,
      });

      expect(result.data[0].content).toBe('# Doc 1');
    });

    it('should filter by definition key', async () => {
      const mockDef = { id: 'def-1', key: 'DOC_1' };

      (mockPrisma.workflowRun.findUnique as jest.Mock).mockResolvedValue({ id: 'run-uuid', workflowId: 'wf-uuid' });
      (mockPrisma.artifactDefinition.findFirst as jest.Mock).mockResolvedValue(mockDef);
      (mockPrisma.artifact.count as jest.Mock).mockResolvedValue(1);
      (mockPrisma.artifact.findMany as jest.Mock).mockResolvedValue([mockArtifacts[0]]);

      const result = await listHandler(mockPrisma, {
        workflowRunId: 'run-uuid',
        definitionKey: 'DOC_1',
      });

      expect(result.data).toHaveLength(1);
    });

    it('should fail for non-existent workflow run', async () => {
      (mockPrisma.workflowRun.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        listHandler(mockPrisma, {
          workflowRunId: 'non-existent',
        }),
      ).rejects.toThrow('not found');
    });
  });
});
