/**
 * Artifact Definitions MCP Tools Tests
 * Tests for create, update, delete, and list artifact definitions
 */

import { PrismaClient } from '@prisma/client';
import { handler as createHandler } from '../create_artifact_definition';
import { handler as updateHandler } from '../update_artifact_definition';
import { handler as deleteHandler } from '../delete_artifact_definition';
import { handler as listHandler } from '../list_artifact_definitions';

// Mock Prisma
const mockPrisma = {
  workflow: {
    findUnique: jest.fn(),
  },
  artifactDefinition: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
} as unknown as PrismaClient;

describe('Artifact Definition Tools', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('create_artifact_definition', () => {
    const mockWorkflow = {
      id: 'workflow-uuid',
      name: 'Test Workflow',
    };

    const mockDefinition = {
      id: 'def-uuid',
      workflowId: 'workflow-uuid',
      name: 'Architecture Document',
      key: 'ARCH_DOC',
      description: 'Architecture analysis document',
      type: 'markdown',
      schema: null,
      isMandatory: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('should create an artifact definition successfully', async () => {
      (mockPrisma.workflow.findUnique as jest.Mock).mockResolvedValue(mockWorkflow);
      (mockPrisma.artifactDefinition.findFirst as jest.Mock).mockResolvedValue(null);
      (mockPrisma.artifactDefinition.create as jest.Mock).mockResolvedValue(mockDefinition);

      const result = await createHandler(mockPrisma, {
        workflowId: 'workflow-uuid',
        name: 'Architecture Document',
        key: 'arch_doc',
        type: 'markdown',
        description: 'Architecture analysis document',
      });

      expect(result.id).toBe('def-uuid');
      expect(result.key).toBe('ARCH_DOC');
      expect(result.type).toBe('markdown');
      expect(mockPrisma.artifactDefinition.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            key: 'ARCH_DOC', // Should be uppercase
          }),
        }),
      );
    });

    it('should reject invalid artifact type', async () => {
      await expect(
        createHandler(mockPrisma, {
          workflowId: 'workflow-uuid',
          name: 'Test',
          key: 'TEST',
          type: 'invalid_type' as any,
        }),
      ).rejects.toThrow('Invalid artifact type');
    });

    it('should reject invalid key format', async () => {
      (mockPrisma.workflow.findUnique as jest.Mock).mockResolvedValue(mockWorkflow);

      await expect(
        createHandler(mockPrisma, {
          workflowId: 'workflow-uuid',
          name: 'Test',
          key: 'invalid-key-with-dashes',
          type: 'markdown',
        }),
      ).rejects.toThrow('Artifact key must contain only letters, numbers, and underscores');
    });

    it('should reject duplicate key in same workflow', async () => {
      (mockPrisma.workflow.findUnique as jest.Mock).mockResolvedValue(mockWorkflow);
      (mockPrisma.artifactDefinition.findFirst as jest.Mock).mockResolvedValue(mockDefinition);

      await expect(
        createHandler(mockPrisma, {
          workflowId: 'workflow-uuid',
          name: 'Test',
          key: 'ARCH_DOC',
          type: 'markdown',
        }),
      ).rejects.toThrow('already exists in this workflow');
    });

    it('should require mandatory fields', async () => {
      await expect(
        createHandler(mockPrisma, {
          workflowId: 'workflow-uuid',
          name: 'Test',
          // Missing key and type
        } as any),
      ).rejects.toThrow();
    });
  });

  describe('update_artifact_definition', () => {
    const mockDefinition = {
      id: 'def-uuid',
      workflowId: 'workflow-uuid',
      name: 'Architecture Document',
      key: 'ARCH_DOC',
      description: 'Updated description',
      type: 'markdown',
      schema: null,
      isMandatory: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      accessRules: [],
      _count: { artifacts: 0 },
    };

    it('should update definition successfully', async () => {
      (mockPrisma.artifactDefinition.findUnique as jest.Mock).mockResolvedValue(mockDefinition);
      (mockPrisma.artifactDefinition.update as jest.Mock).mockResolvedValue(mockDefinition);

      const result = await updateHandler(mockPrisma, {
        definitionId: 'def-uuid',
        description: 'Updated description',
        isMandatory: true,
      });

      expect(result.id).toBe('def-uuid');
      expect(mockPrisma.artifactDefinition.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'def-uuid' },
          data: expect.objectContaining({
            description: 'Updated description',
            isMandatory: true,
          }),
        }),
      );
    });

    it('should reject empty update', async () => {
      (mockPrisma.artifactDefinition.findUnique as jest.Mock).mockResolvedValue(mockDefinition);

      await expect(
        updateHandler(mockPrisma, {
          definitionId: 'def-uuid',
          // No fields to update
        }),
      ).rejects.toThrow('No fields provided for update');
    });

    it('should reject invalid type in update', async () => {
      (mockPrisma.artifactDefinition.findUnique as jest.Mock).mockResolvedValue(mockDefinition);

      await expect(
        updateHandler(mockPrisma, {
          definitionId: 'def-uuid',
          type: 'invalid_type' as any,
        }),
      ).rejects.toThrow('Invalid artifact type');
    });
  });

  describe('delete_artifact_definition', () => {
    const mockDefinition = {
      id: 'def-uuid',
      workflowId: 'workflow-uuid',
      name: 'Architecture Document',
      key: 'ARCH_DOC',
      _count: { artifacts: 5, accessRules: 3 },
    };

    it('should delete definition with cascade counts', async () => {
      (mockPrisma.artifactDefinition.findUnique as jest.Mock).mockResolvedValue(mockDefinition);
      (mockPrisma.artifactDefinition.delete as jest.Mock).mockResolvedValue({});

      const result = await deleteHandler(mockPrisma, {
        definitionId: 'def-uuid',
        confirm: true,
      });

      expect(result.cascadeDeleted.artifacts).toBe(5);
      expect(result.cascadeDeleted.accessRules).toBe(3);
      expect(result.message).toContain('deleted successfully');
    });

    it('should require confirmation', async () => {
      // When confirm is false, validateRequired treats it as missing (falsy)
      await expect(
        deleteHandler(mockPrisma, {
          definitionId: 'def-uuid',
          confirm: false,
        }),
      ).rejects.toThrow('confirm');
    });

    it('should fail for non-existent definition', async () => {
      (mockPrisma.artifactDefinition.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        deleteHandler(mockPrisma, {
          definitionId: 'non-existent',
          confirm: true,
        }),
      ).rejects.toThrow('not found');
    });
  });

  describe('list_artifact_definitions', () => {
    const mockDefinitions = [
      {
        id: 'def-1',
        workflowId: 'workflow-uuid',
        name: 'Architecture Document',
        key: 'ARCH_DOC',
        type: 'markdown',
        isMandatory: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        accessRules: [],
        _count: { artifacts: 2 },
      },
      {
        id: 'def-2',
        workflowId: 'workflow-uuid',
        name: 'Design Doc',
        key: 'DESIGN_DOC',
        type: 'markdown',
        isMandatory: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        accessRules: [],
        _count: { artifacts: 0 },
      },
    ];

    it('should list definitions with pagination', async () => {
      (mockPrisma.workflow.findUnique as jest.Mock).mockResolvedValue({ id: 'workflow-uuid' });
      (mockPrisma.artifactDefinition.count as jest.Mock).mockResolvedValue(2);
      (mockPrisma.artifactDefinition.findMany as jest.Mock).mockResolvedValue(mockDefinitions);

      const result = await listHandler(mockPrisma, {
        workflowId: 'workflow-uuid',
        page: 1,
        pageSize: 10,
      });

      expect(result.data).toHaveLength(2);
      expect(result.pagination.total).toBe(2);
      expect(result.pagination.hasNext).toBe(false);
    });

    it('should fail for non-existent workflow', async () => {
      (mockPrisma.workflow.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        listHandler(mockPrisma, {
          workflowId: 'non-existent',
        }),
      ).rejects.toThrow('not found');
    });
  });
});
