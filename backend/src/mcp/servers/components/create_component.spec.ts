import { PrismaClient } from '@prisma/client';
import { handler, tool } from './create_component';

describe('create_component MCP tool', () => {
  let prisma: PrismaClient;

  const mockPrismaClient = {
    project: {
      findUnique: jest.fn(),
    },
    component: {
      create: jest.fn(),
    },
  };

  beforeEach(() => {
    prisma = mockPrismaClient as any;
    jest.clearAllMocks();
  });

  describe('tool definition', () => {
    it('should have correct name', () => {
      expect(tool.name).toBe('create_component');
    });

    it('should have description', () => {
      expect(tool.description).toBeDefined();
      expect(tool.description).toContain('component');
      expect(tool.description).toContain('3 instruction sets');
    });

    it('should require correct fields', () => {
      expect(tool.inputSchema.required).toContain('projectId');
      expect(tool.inputSchema.required).toContain('name');
      expect(tool.inputSchema.required).toContain('inputInstructions');
      expect(tool.inputSchema.required).toContain('operationInstructions');
      expect(tool.inputSchema.required).toContain('outputInstructions');
      expect(tool.inputSchema.required).toContain('config');
      expect(tool.inputSchema.required).toContain('tools');
    });
  });

  describe('handler', () => {
    const validParams = {
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
      tools: ['get_story', 'search_use_cases', 'get_file_health'],
    };

    it('should throw error when projectId is missing', async () => {
      const { projectId, ...params } = validParams;
      await expect(handler(prisma, params as any)).rejects.toThrow(
        'Missing required fields: projectId',
      );
    });

    it('should throw error when project does not exist', async () => {
      mockPrismaClient.project.findUnique.mockResolvedValue(null);

      await expect(handler(prisma, validParams)).rejects.toThrow(
        'Project with ID proj-1 not found',
      );
    });

    it('should throw error when config.modelId is missing', async () => {
      mockPrismaClient.project.findUnique.mockResolvedValue({
        id: 'proj-1',
        name: 'Test Project',
      });

      const invalidParams = {
        ...validParams,
        config: { temperature: 0.3 },
      };

      await expect(handler(prisma, invalidParams as any)).rejects.toThrow(
        'config.modelId is required',
      );
    });

    it('should create component successfully', async () => {
      const mockProject = {
        id: 'proj-1',
        name: 'Test Project',
      };

      const mockComponent = {
        id: 'comp-1',
        ...validParams,
        subtaskConfig: {},
        onFailure: 'stop',
        tags: [],
        active: true,
        version: 'v1.0',
        createdAt: new Date('2025-11-13T10:00:00Z'),
        updatedAt: new Date('2025-11-13T10:00:00Z'),
      };

      mockPrismaClient.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaClient.component.create.mockResolvedValue(mockComponent);

      const result = await handler(prisma, validParams);

      expect(result.id).toBe('comp-1');
      expect(result.name).toBe('Context Explore');
      expect(result.inputInstructions).toBe('Read story details...');
      expect(result.operationInstructions).toBe('Search codebase...');
      expect(result.outputInstructions).toBe(
        'Store in Story.contextExploration...',
      );
      expect(result.active).toBe(true);
      expect(mockPrismaClient.component.create).toHaveBeenCalledWith({
        data: {
          projectId: 'proj-1',
          name: 'Context Explore',
          description: 'Explores codebase context',
          inputInstructions: 'Read story details...',
          operationInstructions: 'Search codebase...',
          outputInstructions: 'Store in Story.contextExploration...',
          config: validParams.config,
          tools: validParams.tools,
          subtaskConfig: {},
          onFailure: 'stop',
          tags: [],
          active: true,
          version: 'v1.0',
        },
      });
    });

    it('should accept custom onFailure strategy', async () => {
      const mockProject = { id: 'proj-1', name: 'Test' };
      const mockComponent = {
        id: 'comp-1',
        ...validParams,
        subtaskConfig: {},
        onFailure: 'skip',
        tags: [],
        active: true,
        version: 'v1.0',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaClient.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaClient.component.create.mockResolvedValue(mockComponent);

      const customParams = {
        ...validParams,
        onFailure: 'skip' as const,
      };

      const result = await handler(prisma, customParams);

      expect(result.onFailure).toBe('skip');
    });

    it('should accept tags and subtaskConfig', async () => {
      const mockProject = { id: 'proj-1', name: 'Test' };
      const mockComponent = {
        id: 'comp-1',
        ...validParams,
        subtaskConfig: { createSubtask: true, layer: 'backend' },
        onFailure: 'stop',
        tags: ['explore', 'analysis'],
        active: true,
        version: 'v1.0',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaClient.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaClient.component.create.mockResolvedValue(mockComponent);

      const customParams = {
        ...validParams,
        tags: ['explore', 'analysis'],
        subtaskConfig: { createSubtask: true, layer: 'backend' },
      };

      const result = await handler(prisma, customParams);

      expect(result.tags).toEqual(['explore', 'analysis']);
      expect(result.subtaskConfig).toEqual({
        createSubtask: true,
        layer: 'backend',
      });
    });
  });
});
