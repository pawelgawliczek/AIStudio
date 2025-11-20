import { PrismaClient } from '@prisma/client';
import { handler, tool } from '../update_component';

describe('update_component MCP tool', () => {
  let prisma: PrismaClient;

  const mockPrismaClient = {
    component: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };

  beforeEach(() => {
    prisma = mockPrismaClient as any;
    jest.clearAllMocks();
  });

  describe('tool definition', () => {
    it('should have correct name', () => {
      expect(tool.name).toBe('update_component');
    });

    it('should have description', () => {
      expect(tool.description).toBeDefined();
      expect(tool.description).toContain('Update');
      expect(tool.description).toContain('component');
    });

    it('should require componentId', () => {
      expect(tool.inputSchema.required).toContain('componentId');
    });

    it('should not require any other fields (partial update)', () => {
      expect(tool.inputSchema.required).toEqual(['componentId']);
    });
  });

  describe('handler', () => {
    const existingComponent = {
      id: 'comp-1',
      projectId: 'proj-1',
      name: 'Context Explore',
      description: 'Explores codebase context',
      inputInstructions: 'Read story details...',
      operationInstructions: 'Search codebase...',
      outputInstructions: 'Store in Story.contextExploration...',
      config: {
        modelId: 'claude-sonnet-4-5-20250929',
        temperature: 0.4,
        maxInputTokens: 30000,
        maxOutputTokens: 4000,
      },
      tools: ['get_story', 'search_use_cases'],
      subtaskConfig: {},
      onFailure: 'stop',
      tags: ['explore'],
      active: true,
      version: 'v1.0',
      createdAt: new Date('2025-11-13T10:00:00Z'),
      updatedAt: new Date('2025-11-14T10:00:00Z'),
    };

    it('should throw error when componentId is missing', async () => {
      await expect(handler(prisma, {} as any)).rejects.toThrow(
        'Missing required fields: componentId',
      );
    });

    it('should throw error when component does not exist', async () => {
      mockPrismaClient.component.findUnique.mockResolvedValue(null);

      await expect(
        handler(prisma, { componentId: 'comp-999' }),
      ).rejects.toThrow('Component with ID comp-999 not found');
    });

    it('should update component name', async () => {
      const updatedComponent = {
        ...existingComponent,
        name: 'Context Explorer v2',
        updatedAt: new Date('2025-11-14T12:00:00Z'),
      };

      mockPrismaClient.component.findUnique.mockResolvedValue(
        existingComponent,
      );
      mockPrismaClient.component.update.mockResolvedValue(updatedComponent);

      const result = await handler(prisma, {
        componentId: 'comp-1',
        name: 'Context Explorer v2',
      });

      expect(result.name).toBe('Context Explorer v2');
      expect(mockPrismaClient.component.update).toHaveBeenCalledWith({
        where: { id: 'comp-1' },
        data: { name: 'Context Explorer v2' },
      });
    });

    it('should update component instructions', async () => {
      const updatedComponent = {
        ...existingComponent,
        inputInstructions: 'New input instructions',
        operationInstructions: 'New operation instructions',
        outputInstructions: 'New output instructions',
        updatedAt: new Date('2025-11-14T12:00:00Z'),
      };

      mockPrismaClient.component.findUnique.mockResolvedValue(
        existingComponent,
      );
      mockPrismaClient.component.update.mockResolvedValue(updatedComponent);

      const result = await handler(prisma, {
        componentId: 'comp-1',
        inputInstructions: 'New input instructions',
        operationInstructions: 'New operation instructions',
        outputInstructions: 'New output instructions',
      });

      expect(result.inputInstructions).toBe('New input instructions');
      expect(result.operationInstructions).toBe('New operation instructions');
      expect(result.outputInstructions).toBe('New output instructions');
    });

    it('should update component config', async () => {
      const newConfig = {
        modelId: 'claude-opus-4-20250514',
        temperature: 0.7,
        maxInputTokens: 50000,
        maxOutputTokens: 8000,
        timeout: 600,
      };

      const updatedComponent = {
        ...existingComponent,
        config: newConfig,
        updatedAt: new Date('2025-11-14T12:00:00Z'),
      };

      mockPrismaClient.component.findUnique.mockResolvedValue(
        existingComponent,
      );
      mockPrismaClient.component.update.mockResolvedValue(updatedComponent);

      const result = await handler(prisma, {
        componentId: 'comp-1',
        config: newConfig,
      });

      expect(result.config).toEqual(newConfig);
    });

    it('should update component tools', async () => {
      const newTools = [
        'get_story',
        'search_use_cases',
        'get_file_dependencies',
        'get_file_health',
      ];

      const updatedComponent = {
        ...existingComponent,
        tools: newTools,
        updatedAt: new Date('2025-11-14T12:00:00Z'),
      };

      mockPrismaClient.component.findUnique.mockResolvedValue(
        existingComponent,
      );
      mockPrismaClient.component.update.mockResolvedValue(updatedComponent);

      const result = await handler(prisma, {
        componentId: 'comp-1',
        tools: newTools,
      });

      expect(result.tools).toEqual(newTools);
    });

    it('should update onFailure strategy', async () => {
      const updatedComponent = {
        ...existingComponent,
        onFailure: 'retry',
        updatedAt: new Date('2025-11-14T12:00:00Z'),
      };

      mockPrismaClient.component.findUnique.mockResolvedValue(
        existingComponent,
      );
      mockPrismaClient.component.update.mockResolvedValue(updatedComponent);

      const result = await handler(prisma, {
        componentId: 'comp-1',
        onFailure: 'retry',
      });

      expect(result.onFailure).toBe('retry');
    });

    it('should update active status', async () => {
      const updatedComponent = {
        ...existingComponent,
        active: false,
        updatedAt: new Date('2025-11-14T12:00:00Z'),
      };

      mockPrismaClient.component.findUnique.mockResolvedValue(
        existingComponent,
      );
      mockPrismaClient.component.update.mockResolvedValue(updatedComponent);

      const result = await handler(prisma, {
        componentId: 'comp-1',
        active: false,
      });

      expect(result.active).toBe(false);
    });

    it('should update tags', async () => {
      const newTags = ['explore', 'analysis', 'context'];

      const updatedComponent = {
        ...existingComponent,
        tags: newTags,
        updatedAt: new Date('2025-11-14T12:00:00Z'),
      };

      mockPrismaClient.component.findUnique.mockResolvedValue(
        existingComponent,
      );
      mockPrismaClient.component.update.mockResolvedValue(updatedComponent);

      const result = await handler(prisma, {
        componentId: 'comp-1',
        tags: newTags,
      });

      expect(result.tags).toEqual(newTags);
    });

    it('should update subtaskConfig', async () => {
      const newSubtaskConfig = {
        createSubtask: true,
        layer: 'frontend',
        assignee: 'agent-123',
      };

      const updatedComponent = {
        ...existingComponent,
        subtaskConfig: newSubtaskConfig,
        updatedAt: new Date('2025-11-14T12:00:00Z'),
      };

      mockPrismaClient.component.findUnique.mockResolvedValue(
        existingComponent,
      );
      mockPrismaClient.component.update.mockResolvedValue(updatedComponent);

      const result = await handler(prisma, {
        componentId: 'comp-1',
        subtaskConfig: newSubtaskConfig,
      });

      expect(result.subtaskConfig).toEqual(newSubtaskConfig);
    });

    it('should update multiple fields at once', async () => {
      const updatedComponent = {
        ...existingComponent,
        name: 'Context Explorer v2',
        description: 'Updated description',
        version: 'v2.0',
        active: false,
        updatedAt: new Date('2025-11-14T12:00:00Z'),
      };

      mockPrismaClient.component.findUnique.mockResolvedValue(
        existingComponent,
      );
      mockPrismaClient.component.update.mockResolvedValue(updatedComponent);

      const result = await handler(prisma, {
        componentId: 'comp-1',
        name: 'Context Explorer v2',
        description: 'Updated description',
        version: 'v2.0',
        active: false,
      });

      expect(result.name).toBe('Context Explorer v2');
      expect(result.description).toBe('Updated description');
      expect(result.version).toBe('v2.0');
      expect(result.active).toBe(false);
    });

    it('should only update provided fields (partial update)', async () => {
      const updatedComponent = {
        ...existingComponent,
        name: 'New Name',
        updatedAt: new Date('2025-11-14T12:00:00Z'),
      };

      mockPrismaClient.component.findUnique.mockResolvedValue(
        existingComponent,
      );
      mockPrismaClient.component.update.mockResolvedValue(updatedComponent);

      await handler(prisma, {
        componentId: 'comp-1',
        name: 'New Name',
      });

      const updateCall = mockPrismaClient.component.update.mock.calls[0][0];
      expect(updateCall.data).toEqual({ name: 'New Name' });
      expect(updateCall.data).not.toHaveProperty('description');
      expect(updateCall.data).not.toHaveProperty('tools');
    });

    it('should throw error when no fields to update', async () => {
      mockPrismaClient.component.findUnique.mockResolvedValue(
        existingComponent,
      );

      await expect(
        handler(prisma, { componentId: 'comp-1' }),
      ).rejects.toThrow('No fields to update');
    });
  });
});
