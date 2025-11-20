import { PrismaClient } from '@prisma/client';
import { handler, tool } from '../update_coordinator';

describe('update_coordinator MCP tool', () => {
  let prisma: PrismaClient;

  const mockPrismaClient = {
    coordinatorAgent: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    component: {
      findMany: jest.fn(),
    },
  };

  beforeEach(() => {
    prisma = mockPrismaClient as any;
    jest.clearAllMocks();
  });

  describe('tool definition', () => {
    it('should have correct name', () => {
      expect(tool.name).toBe('update_coordinator');
    });

    it('should have description', () => {
      expect(tool.description).toBeDefined();
      expect(tool.description).toContain('Update');
      expect(tool.description).toContain('coordinator');
    });

    it('should require coordinatorId', () => {
      expect(tool.inputSchema.required).toContain('coordinatorId');
    });

    it('should not require any other fields (partial update)', () => {
      expect(tool.inputSchema.required).toEqual(['coordinatorId']);
    });
  });

  describe('handler', () => {
    const existingCoordinator = {
      id: 'coord-1',
      projectId: 'proj-1',
      name: 'Software Development PM',
      description: 'Orchestrates software development workflow',
      domain: 'software-development',
      coordinatorInstructions: 'You are the PM coordinator...',
      flowDiagram: 'PM → [Complexity Assessment]...',
      config: {
        modelId: 'claude-sonnet-4-5-20250929',
        temperature: 0.4,
        maxInputTokens: 50000,
        maxOutputTokens: 8000,
      },
      tools: ['get_workflow_context', 'record_component_start'],
      decisionStrategy: 'adaptive',
      componentIds: ['comp-1', 'comp-2', 'comp-3'],
      active: true,
      version: 'v1.0',
      createdAt: new Date('2025-11-13T10:00:00Z'),
      updatedAt: new Date('2025-11-14T10:00:00Z'),
    };

    it('should throw error when coordinatorId is missing', async () => {
      await expect(handler(prisma, {} as any)).rejects.toThrow(
        'Missing required fields: coordinatorId',
      );
    });

    it('should throw error when coordinator does not exist', async () => {
      mockPrismaClient.coordinatorAgent.findUnique.mockResolvedValue(null);

      await expect(
        handler(prisma, { coordinatorId: 'coord-999' }),
      ).rejects.toThrow('Coordinator with ID coord-999 not found');
    });

    it('should update coordinator name', async () => {
      const updatedCoordinator = {
        ...existingCoordinator,
        name: 'Software Development PM v2',
        updatedAt: new Date('2025-11-14T12:00:00Z'),
      };

      mockPrismaClient.coordinatorAgent.findUnique.mockResolvedValue(
        existingCoordinator,
      );
      mockPrismaClient.coordinatorAgent.update.mockResolvedValue(
        updatedCoordinator,
      );

      const result = await handler(prisma, {
        coordinatorId: 'coord-1',
        name: 'Software Development PM v2',
      });

      expect(result.name).toBe('Software Development PM v2');
      expect(mockPrismaClient.coordinatorAgent.update).toHaveBeenCalledWith({
        where: { id: 'coord-1' },
        data: { name: 'Software Development PM v2' },
      });
    });

    it('should update coordinator instructions', async () => {
      const newInstructions = 'Updated PM coordinator instructions...';
      const mockComponents = [
        { id: 'comp-1', name: 'Explore' },
        { id: 'comp-2', name: 'BA' },
        { id: 'comp-3', name: 'Architect' },
      ];
      const updatedCoordinator = {
        ...existingCoordinator,
        coordinatorInstructions: newInstructions,
        updatedAt: new Date('2025-11-14T12:00:00Z'),
      };

      mockPrismaClient.coordinatorAgent.findUnique.mockResolvedValue(
        existingCoordinator,
      );
      mockPrismaClient.component.findMany.mockResolvedValue(mockComponents);
      mockPrismaClient.coordinatorAgent.update.mockResolvedValue(
        updatedCoordinator,
      );

      const result = await handler(prisma, {
        coordinatorId: 'coord-1',
        coordinatorInstructions: newInstructions,
      });

      expect(result.coordinatorInstructions).toBe(newInstructions);
    });

    it('should update decision strategy', async () => {
      const mockComponents = [
        { id: 'comp-1', name: 'Explore' },
        { id: 'comp-2', name: 'BA' },
        { id: 'comp-3', name: 'Architect' },
      ];
      const updatedCoordinator = {
        ...existingCoordinator,
        decisionStrategy: 'sequential',
        updatedAt: new Date('2025-11-14T12:00:00Z'),
      };

      mockPrismaClient.coordinatorAgent.findUnique.mockResolvedValue(
        existingCoordinator,
      );
      mockPrismaClient.component.findMany.mockResolvedValue(mockComponents);
      mockPrismaClient.coordinatorAgent.update.mockResolvedValue(
        updatedCoordinator,
      );

      const result = await handler(prisma, {
        coordinatorId: 'coord-1',
        decisionStrategy: 'sequential',
      });

      expect(result.decisionStrategy).toBe('sequential');
    });

    it('should update config', async () => {
      const newConfig = {
        modelId: 'claude-opus-4-20250514',
        temperature: 0.7,
        maxInputTokens: 100000,
        maxOutputTokens: 16000,
        timeout: 1200,
      };

      const updatedCoordinator = {
        ...existingCoordinator,
        config: newConfig,
        updatedAt: new Date('2025-11-14T12:00:00Z'),
      };

      mockPrismaClient.coordinatorAgent.findUnique.mockResolvedValue(
        existingCoordinator,
      );
      mockPrismaClient.coordinatorAgent.update.mockResolvedValue(
        updatedCoordinator,
      );

      const result = await handler(prisma, {
        coordinatorId: 'coord-1',
        config: newConfig,
      });

      expect(result.config).toEqual(newConfig);
    });

    it('should update tools', async () => {
      const newTools = [
        'get_workflow_context',
        'record_component_start',
        'record_component_complete',
        'update_workflow_status',
      ];

      const updatedCoordinator = {
        ...existingCoordinator,
        tools: newTools,
        updatedAt: new Date('2025-11-14T12:00:00Z'),
      };

      mockPrismaClient.coordinatorAgent.findUnique.mockResolvedValue(
        existingCoordinator,
      );
      mockPrismaClient.coordinatorAgent.update.mockResolvedValue(
        updatedCoordinator,
      );

      const result = await handler(prisma, {
        coordinatorId: 'coord-1',
        tools: newTools,
      });

      expect(result.tools).toEqual(newTools);
    });

    it('should update componentIds and regenerate flow diagram', async () => {
      const newComponentIds = ['comp-1', 'comp-2', 'comp-3', 'comp-4'];
      const mockComponents = [
        { id: 'comp-1', name: 'Explore' },
        { id: 'comp-2', name: 'BA' },
        { id: 'comp-3', name: 'Architect' },
        { id: 'comp-4', name: 'Developer' },
      ];

      const updatedCoordinator = {
        ...existingCoordinator,
        componentIds: newComponentIds,
        flowDiagram: 'PM → [Complexity Assessment]\n  ├─ Trivial (BC≤3,TC≤3): Developer\n  ├─ Simple (BC≤5,TC≤5): Developer → Architect\n  ├─ Medium (BC≤7,TC≤7): Explore → BA → Architect → Developer\n  ├─ Complex (BC>7,TC>7): Explore → BA → Architect → Developer\n  └─ Critical: Full Workflow + Validation',
        updatedAt: new Date('2025-11-14T12:00:00Z'),
      };

      mockPrismaClient.coordinatorAgent.findUnique.mockResolvedValue(
        existingCoordinator,
      );
      mockPrismaClient.component.findMany.mockResolvedValue(mockComponents);
      mockPrismaClient.coordinatorAgent.update.mockResolvedValue(
        updatedCoordinator,
      );

      const result = await handler(prisma, {
        coordinatorId: 'coord-1',
        componentIds: newComponentIds,
      });

      expect(result.componentIds).toEqual(newComponentIds);
      expect(result.flowDiagram).toBeDefined();
      expect(mockPrismaClient.component.findMany).toHaveBeenCalledWith({
        where: {
          id: { in: newComponentIds },
          projectId: 'proj-1',
        },
        select: { id: true, name: true },
      });
    });

    it('should throw error when componentIds do not exist', async () => {
      const invalidComponentIds = ['comp-1', 'comp-2', 'comp-999'];

      mockPrismaClient.coordinatorAgent.findUnique.mockResolvedValue(
        existingCoordinator,
      );
      mockPrismaClient.component.findMany.mockResolvedValue([
        { id: 'comp-1', name: 'Explore' },
        { id: 'comp-2', name: 'BA' },
      ]);

      await expect(
        handler(prisma, {
          coordinatorId: 'coord-1',
          componentIds: invalidComponentIds,
        }),
      ).rejects.toThrow(
        'One or more component IDs not found or do not belong to the project',
      );
    });

    it('should update active status', async () => {
      const updatedCoordinator = {
        ...existingCoordinator,
        active: false,
        updatedAt: new Date('2025-11-14T12:00:00Z'),
      };

      mockPrismaClient.coordinatorAgent.findUnique.mockResolvedValue(
        existingCoordinator,
      );
      mockPrismaClient.coordinatorAgent.update.mockResolvedValue(
        updatedCoordinator,
      );

      const result = await handler(prisma, {
        coordinatorId: 'coord-1',
        active: false,
      });

      expect(result.active).toBe(false);
    });

    it('should update multiple fields at once', async () => {
      const updatedCoordinator = {
        ...existingCoordinator,
        name: 'PM v2',
        description: 'Updated description',
        version: 'v2.0',
        active: false,
        updatedAt: new Date('2025-11-14T12:00:00Z'),
      };

      mockPrismaClient.coordinatorAgent.findUnique.mockResolvedValue(
        existingCoordinator,
      );
      mockPrismaClient.coordinatorAgent.update.mockResolvedValue(
        updatedCoordinator,
      );

      const result = await handler(prisma, {
        coordinatorId: 'coord-1',
        name: 'PM v2',
        description: 'Updated description',
        version: 'v2.0',
        active: false,
      });

      expect(result.name).toBe('PM v2');
      expect(result.description).toBe('Updated description');
      expect(result.version).toBe('v2.0');
      expect(result.active).toBe(false);
    });

    it('should only update provided fields (partial update)', async () => {
      const updatedCoordinator = {
        ...existingCoordinator,
        name: 'New Name',
        updatedAt: new Date('2025-11-14T12:00:00Z'),
      };

      mockPrismaClient.coordinatorAgent.findUnique.mockResolvedValue(
        existingCoordinator,
      );
      mockPrismaClient.coordinatorAgent.update.mockResolvedValue(
        updatedCoordinator,
      );

      await handler(prisma, {
        coordinatorId: 'coord-1',
        name: 'New Name',
      });

      const updateCall =
        mockPrismaClient.coordinatorAgent.update.mock.calls[0][0];
      expect(updateCall.data).toEqual({ name: 'New Name' });
      expect(updateCall.data).not.toHaveProperty('description');
      expect(updateCall.data).not.toHaveProperty('tools');
    });

    it('should throw error when no fields to update', async () => {
      mockPrismaClient.coordinatorAgent.findUnique.mockResolvedValue(
        existingCoordinator,
      );

      await expect(
        handler(prisma, { coordinatorId: 'coord-1' }),
      ).rejects.toThrow('No fields to update');
    });
  });
});
