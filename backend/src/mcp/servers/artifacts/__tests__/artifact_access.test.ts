/**
 * Artifact Access MCP Tools Tests
 * Tests for set_artifact_access and remove_artifact_access
 */

import { PrismaClient } from '@prisma/client';
import { handler as setHandler } from '../set_artifact_access';
import { handler as removeHandler } from '../remove_artifact_access';

// Mock Prisma
const mockPrisma = {
  artifactDefinition: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
  },
  workflowState: {
    findUnique: jest.fn(),
  },
  artifactAccess: {
    upsert: jest.fn(),
    findUnique: jest.fn(),
    delete: jest.fn(),
  },
} as unknown as PrismaClient;

describe('Artifact Access Tools', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('set_artifact_access', () => {
    const mockDefinition = {
      id: 'def-uuid',
      workflowId: 'workflow-uuid',
      name: 'Architecture Document',
      key: 'ARCH_DOC',
    };

    const mockState = {
      id: 'state-uuid',
      workflowId: 'workflow-uuid',
      name: 'Architecture',
      order: 1,
    };

    const mockAccess = {
      id: 'access-uuid',
      definitionId: 'def-uuid',
      stateId: 'state-uuid',
      accessType: 'write',
      createdAt: new Date(),
      state: mockState,
      definition: mockDefinition,
    };

    it('should set access using definitionId', async () => {
      (mockPrisma.artifactDefinition.findUnique as jest.Mock).mockResolvedValue(mockDefinition);
      (mockPrisma.workflowState.findUnique as jest.Mock).mockResolvedValue(mockState);
      (mockPrisma.artifactAccess.upsert as jest.Mock).mockResolvedValue(mockAccess);

      const result = await setHandler(mockPrisma, {
        definitionId: 'def-uuid',
        stateId: 'state-uuid',
        accessType: 'write',
      });

      expect(result.accessType).toBe('write');
      expect(result.stateId).toBe('state-uuid');
      expect(mockPrisma.artifactAccess.upsert).toHaveBeenCalled();
    });

    it('should set access using definitionKey + workflowId', async () => {
      (mockPrisma.artifactDefinition.findFirst as jest.Mock).mockResolvedValue(mockDefinition);
      (mockPrisma.artifactDefinition.findUnique as jest.Mock).mockResolvedValue(mockDefinition);
      (mockPrisma.workflowState.findUnique as jest.Mock).mockResolvedValue(mockState);
      (mockPrisma.artifactAccess.upsert as jest.Mock).mockResolvedValue(mockAccess);

      const result = await setHandler(mockPrisma, {
        definitionKey: 'ARCH_DOC',
        workflowId: 'workflow-uuid',
        stateId: 'state-uuid',
        accessType: 'write',
      });

      expect(result.accessType).toBe('write');
      expect(mockPrisma.artifactDefinition.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            key: 'ARCH_DOC',
          }),
        }),
      );
    });

    it('should reject invalid access type', async () => {
      await expect(
        setHandler(mockPrisma, {
          definitionId: 'def-uuid',
          stateId: 'state-uuid',
          accessType: 'invalid' as any,
        }),
      ).rejects.toThrow('Invalid access type');
    });

    it('should require workflowId when using definitionKey', async () => {
      await expect(
        setHandler(mockPrisma, {
          definitionKey: 'ARCH_DOC',
          stateId: 'state-uuid',
          accessType: 'read',
        }),
      ).rejects.toThrow('workflowId is required when using definitionKey');
    });

    it('should reject when state belongs to different workflow', async () => {
      const differentWorkflowState = {
        id: 'state-uuid',
        workflowId: 'different-workflow-uuid',
        name: 'Other State',
        order: 1,
      };

      (mockPrisma.artifactDefinition.findUnique as jest.Mock).mockResolvedValue(mockDefinition);
      (mockPrisma.workflowState.findUnique as jest.Mock).mockResolvedValue(differentWorkflowState);

      await expect(
        setHandler(mockPrisma, {
          definitionId: 'def-uuid',
          stateId: 'state-uuid',
          accessType: 'read',
        }),
      ).rejects.toThrow('State must belong to the same workflow');
    });
  });

  describe('remove_artifact_access', () => {
    const mockAccess = {
      id: 'access-uuid',
      definitionId: 'def-uuid',
      stateId: 'state-uuid',
      accessType: 'write',
      definition: {
        name: 'Architecture Document',
      },
      state: {
        name: 'Architecture',
      },
    };

    it('should remove access successfully', async () => {
      (mockPrisma.artifactAccess.findUnique as jest.Mock).mockResolvedValue(mockAccess);
      (mockPrisma.artifactAccess.delete as jest.Mock).mockResolvedValue({});

      const result = await removeHandler(mockPrisma, {
        definitionId: 'def-uuid',
        stateId: 'state-uuid',
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('Access removed');
    });

    it('should fail for non-existent access rule', async () => {
      (mockPrisma.artifactAccess.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        removeHandler(mockPrisma, {
          definitionId: 'def-uuid',
          stateId: 'state-uuid',
        }),
      ).rejects.toThrow('not found');
    });

    it('should remove access using definitionKey + workflowId', async () => {
      const mockDefinition = {
        id: 'def-uuid',
        workflowId: 'workflow-uuid',
        key: 'ARCH_DOC',
      };

      (mockPrisma.artifactDefinition.findFirst as jest.Mock).mockResolvedValue(mockDefinition);
      (mockPrisma.artifactAccess.findUnique as jest.Mock).mockResolvedValue(mockAccess);
      (mockPrisma.artifactAccess.delete as jest.Mock).mockResolvedValue({});

      const result = await removeHandler(mockPrisma, {
        definitionKey: 'ARCH_DOC',
        workflowId: 'workflow-uuid',
        stateId: 'state-uuid',
      });

      expect(result.success).toBe(true);
    });
  });
});
