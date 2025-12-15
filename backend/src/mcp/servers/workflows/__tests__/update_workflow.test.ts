import { PrismaClient } from '@prisma/client';
import { handler, tool } from '../update_workflow';

describe('update_workflow MCP tool', () => {
  let prisma: PrismaClient;

  const mockPrismaClient = {
    workflow: {
      findUnique: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
    },
    workflowVersion: {
      create: jest.fn(),
    },
    $transaction: jest.fn().mockImplementation(async (operations: any) => {
      if (typeof operations === 'function') {
        return operations(mockPrismaClient);
      }
      return Promise.all(operations);
    }),
  };

  beforeEach(() => {
    prisma = mockPrismaClient as any;
    jest.clearAllMocks();
    // Re-setup $transaction mock after clear
    mockPrismaClient.$transaction.mockImplementation(async (operations: any) => {
      if (typeof operations === 'function') {
        return operations(mockPrismaClient);
      }
      return Promise.all(operations);
    });
  });

  describe('tool definition', () => {
    it('should have correct name', () => {
      expect(tool.name).toBe('update_workflow');
    });

    it('should have description', () => {
      expect(tool.description).toBeDefined();
      expect(tool.description).toContain('Update');
      expect(tool.description).toContain('workflow');
    });

    it('should require workflowId', () => {
      expect(tool.inputSchema.required).toContain('workflowId');
    });

    it('should not require any other fields (partial update)', () => {
      expect(tool.inputSchema.required).toEqual(['workflowId']);
    });
  });

  describe('handler', () => {
    const existingWorkflow = {
      id: 'workflow-1',
      projectId: 'proj-1',
      name: 'Software Development Workflow',
      description: 'Main development workflow',
      version: 'v1.0',
      triggerConfig: {
        type: 'manual',
        filters: {},
        notifications: {},
      },
      active: true,
      createdAt: new Date('2025-11-13T10:00:00Z'),
      updatedAt: new Date('2025-11-14T10:00:00Z'),
    };

    it('should throw error when workflowId is missing', async () => {
      await expect(handler(prisma, {} as any)).rejects.toThrow(
        'Missing required fields: workflowId',
      );
    });

    it('should throw error when workflow does not exist', async () => {
      mockPrismaClient.workflow.findUnique.mockResolvedValue(null);

      await expect(
        handler(prisma, { workflowId: 'workflow-999' }),
      ).rejects.toThrow('Workflow with ID workflow-999 not found');
    });

    it('should update workflow name', async () => {
      const updatedWorkflow = {
        ...existingWorkflow,
        name: 'Software Development Workflow v2',
        updatedAt: new Date('2025-11-14T12:00:00Z'),
      };

      mockPrismaClient.workflow.findUnique.mockResolvedValue(existingWorkflow);
      mockPrismaClient.workflow.update.mockResolvedValue(updatedWorkflow);

      const result = await handler(prisma, {
        workflowId: 'workflow-1',
        name: 'Software Development Workflow v2',
      });

      expect(result.name).toBe('Software Development Workflow v2');
      expect(mockPrismaClient.workflow.update).toHaveBeenCalledWith({
        where: { id: 'workflow-1' },
        data: { name: 'Software Development Workflow v2' },
      });
    });

    it('should update workflow description', async () => {
      const updatedWorkflow = {
        ...existingWorkflow,
        description: 'Updated workflow description',
        updatedAt: new Date('2025-11-14T12:00:00Z'),
      };

      mockPrismaClient.workflow.findUnique.mockResolvedValue(existingWorkflow);
      mockPrismaClient.workflow.update.mockResolvedValue(updatedWorkflow);

      const result = await handler(prisma, {
        workflowId: 'workflow-1',
        description: 'Updated workflow description',
      });

      expect(result.description).toBe('Updated workflow description');
    });

    it('should update triggerConfig', async () => {
      const newTriggerConfig = {
        type: 'story_assigned',
        filters: { storyType: 'feature' },
        notifications: { slack: true },
      };

      const updatedWorkflow = {
        ...existingWorkflow,
        triggerConfig: newTriggerConfig,
        updatedAt: new Date('2025-11-14T12:00:00Z'),
      };

      mockPrismaClient.workflow.findUnique.mockResolvedValue(existingWorkflow);
      mockPrismaClient.workflow.update.mockResolvedValue(updatedWorkflow);

      const result = await handler(prisma, {
        workflowId: 'workflow-1',
        triggerConfig: newTriggerConfig,
      });

      expect(result.triggerConfig).toEqual(newTriggerConfig);
    });

    it('should throw error when triggerConfig.type is missing', async () => {
      const invalidTriggerConfig = {
        filters: { storyType: 'feature' },
      };

      mockPrismaClient.workflow.findUnique.mockResolvedValue(existingWorkflow);

      await expect(
        handler(prisma, {
          workflowId: 'workflow-1',
          triggerConfig: invalidTriggerConfig as any,
        }),
      ).rejects.toThrow('triggerConfig.type is required');
    });

    it('should update active status', async () => {
      const updatedWorkflow = {
        ...existingWorkflow,
        active: false,
        updatedAt: new Date('2025-11-14T12:00:00Z'),
      };

      mockPrismaClient.workflow.findUnique.mockResolvedValue(existingWorkflow);
      mockPrismaClient.workflow.update.mockResolvedValue(updatedWorkflow);

      const result = await handler(prisma, {
        workflowId: 'workflow-1',
        active: false,
      });

      expect(result.active).toBe(false);
    });

    it('should update version', async () => {
      const updatedWorkflow = {
        ...existingWorkflow,
        version: 'v2.0',
        updatedAt: new Date('2025-11-14T12:00:00Z'),
      };

      mockPrismaClient.workflow.findUnique.mockResolvedValue(existingWorkflow);
      mockPrismaClient.workflow.update.mockResolvedValue(updatedWorkflow);

      const result = await handler(prisma, {
        workflowId: 'workflow-1',
        version: 'v2.0',
      });

      expect(result.version).toBe('v2.0');
    });

    it('should update multiple fields at once', async () => {
      const newTriggerConfig = {
        type: 'webhook',
        filters: { source: 'github' },
        notifications: { email: true },
      };

      const updatedWorkflow = {
        ...existingWorkflow,
        name: 'Workflow v2',
        description: 'Updated description',
        triggerConfig: newTriggerConfig,
        version: 'v2.0',
        active: false,
        updatedAt: new Date('2025-11-14T12:00:00Z'),
      };

      mockPrismaClient.workflow.findUnique.mockResolvedValue(existingWorkflow);
      mockPrismaClient.workflow.update.mockResolvedValue(updatedWorkflow);

      const result = await handler(prisma, {
        workflowId: 'workflow-1',
        name: 'Workflow v2',
        description: 'Updated description',
        triggerConfig: newTriggerConfig,
        version: 'v2.0',
        active: false,
      });

      expect(result.name).toBe('Workflow v2');
      expect(result.description).toBe('Updated description');
      expect(result.triggerConfig).toEqual(newTriggerConfig);
      expect(result.version).toBe('v2.0');
      expect(result.active).toBe(false);
    });

    it('should only update provided fields (partial update)', async () => {
      const updatedWorkflow = {
        ...existingWorkflow,
        name: 'New Name',
        updatedAt: new Date('2025-11-14T12:00:00Z'),
      };

      mockPrismaClient.workflow.findUnique.mockResolvedValue(existingWorkflow);
      mockPrismaClient.workflow.update.mockResolvedValue(updatedWorkflow);

      await handler(prisma, {
        workflowId: 'workflow-1',
        name: 'New Name',
      });

      const updateCall = mockPrismaClient.workflow.update.mock.calls[0][0];
      expect(updateCall.data).toEqual({ name: 'New Name' });
      expect(updateCall.data).not.toHaveProperty('description');
      expect(updateCall.data).not.toHaveProperty('triggerConfig');
    });

    it('should throw error when no fields to update', async () => {
      mockPrismaClient.workflow.findUnique.mockResolvedValue(existingWorkflow);

      await expect(
        handler(prisma, { workflowId: 'workflow-1' }),
      ).rejects.toThrow('No fields to update');
    });
  });
});
