import { PrismaClient } from '@prisma/client';
import { NotFoundError, ValidationError } from '../../../types';
import { handler, tool } from '../get_component_instructions';

describe('get_component_instructions MCP tool', () => {
  let prisma: PrismaClient;

  const mockPrismaClient = {
    component: {
      findUnique: jest.fn(),
    },
  };

  beforeEach(() => {
    prisma = mockPrismaClient as any;
    jest.clearAllMocks();
  });

  describe('tool definition', () => {
    it('should have correct name', () => {
      expect(tool.name).toBe('get_component_instructions');
    });

    it('should have description', () => {
      expect(tool.description).toBeDefined();
      expect(tool.description).toContain('instructions');
      expect(tool.description).toContain('component');
    });

    it('should require componentId field', () => {
      expect(tool.inputSchema.required).toContain('componentId');
    });
  });

  describe('handler validation', () => {
    it('should throw error when componentId is missing', async () => {
      await expect(handler(prisma, {} as any)).rejects.toThrow(
        'Missing required fields: componentId',
      );
    });
  });

  describe('handler success', () => {
    const mockComponent = {
      id: 'comp-123',
      name: 'Business Analyst',
      description: 'Analyzes business requirements',
      inputInstructions: 'Read story details from database...',
      operationInstructions: 'Analyze requirements, create use cases...',
      outputInstructions: 'Save analysis to Story.baAnalysis field...',
      config: {
        modelId: 'claude-sonnet-4-5-20250929',
        temperature: 0.4,
        maxInputTokens: 30000,
        maxOutputTokens: 4000,
      },
      tools: ['get_story', 'create_use_case', 'update_story'],
      subtaskConfig: { createSubtask: true, layer: 'analysis' },
      onFailure: 'retry',
      active: true,
    };

    it('should return full instructions for active component', async () => {
      mockPrismaClient.component.findUnique.mockResolvedValue(mockComponent);

      const result = await handler(prisma, { componentId: 'comp-123' });

      expect(result.componentId).toBe('comp-123');
      expect(result.componentName).toBe('Business Analyst');
      expect(result.description).toBe('Analyzes business requirements');
      expect(result.inputInstructions).toBe('Read story details from database...');
      expect(result.operationInstructions).toBe('Analyze requirements, create use cases...');
      expect(result.outputInstructions).toBe('Save analysis to Story.baAnalysis field...');
      expect(result.config).toEqual(mockComponent.config);
      expect(result.tools).toEqual(['get_story', 'create_use_case', 'update_story']);
      expect(result.subtaskConfig).toEqual({ createSubtask: true, layer: 'analysis' });
      expect(result.onFailure).toBe('retry');
    });

    it('should include all required fields in response', async () => {
      mockPrismaClient.component.findUnique.mockResolvedValue(mockComponent);

      const result = await handler(prisma, { componentId: 'comp-123' });

      expect(result).toHaveProperty('componentId');
      expect(result).toHaveProperty('componentName');
      expect(result).toHaveProperty('description');
      expect(result).toHaveProperty('inputInstructions');
      expect(result).toHaveProperty('operationInstructions');
      expect(result).toHaveProperty('outputInstructions');
      expect(result).toHaveProperty('config');
      expect(result).toHaveProperty('tools');
      expect(result).toHaveProperty('onFailure');
    });

    it('should call prisma with correct query', async () => {
      mockPrismaClient.component.findUnique.mockResolvedValue(mockComponent);

      await handler(prisma, { componentId: 'comp-123' });

      expect(mockPrismaClient.component.findUnique).toHaveBeenCalledWith({
        where: { id: 'comp-123' },
        select: {
          id: true,
          name: true,
          description: true,
          inputInstructions: true,
          operationInstructions: true,
          outputInstructions: true,
          config: true,
          tools: true,
          subtaskConfig: true,
          onFailure: true,
          active: true,
        },
      });
    });
  });

  describe('handler error cases', () => {
    it('should throw NotFound error if component does not exist', async () => {
      mockPrismaClient.component.findUnique.mockResolvedValue(null);

      await expect(handler(prisma, { componentId: 'nonexistent' })).rejects.toThrow(
        NotFoundError,
      );
      await expect(handler(prisma, { componentId: 'nonexistent' })).rejects.toThrow(
        'Component',
      );
    });

    it('should throw ValidationError if component is inactive', async () => {
      const inactiveComponent = {
        id: 'comp-456',
        name: 'Old Component',
        description: 'Deprecated',
        inputInstructions: 'test',
        operationInstructions: 'test',
        outputInstructions: 'test',
        config: {},
        tools: [],
        subtaskConfig: null,
        onFailure: 'stop',
        active: false,
      };

      mockPrismaClient.component.findUnique.mockResolvedValue(inactiveComponent);

      await expect(handler(prisma, { componentId: 'comp-456' })).rejects.toThrow(
        ValidationError,
      );
      await expect(handler(prisma, { componentId: 'comp-456' })).rejects.toThrow(
        'inactive',
      );
    });

    it('should throw ValidationError if inputInstructions is empty', async () => {
      const invalidComponent = {
        id: 'comp-789',
        name: 'Invalid Component',
        description: 'Missing instructions',
        inputInstructions: '',
        operationInstructions: 'test',
        outputInstructions: 'test',
        config: {},
        tools: [],
        subtaskConfig: null,
        onFailure: 'stop',
        active: true,
      };

      mockPrismaClient.component.findUnique.mockResolvedValue(invalidComponent);

      await expect(handler(prisma, { componentId: 'comp-789' })).rejects.toThrow(
        ValidationError,
      );
      await expect(handler(prisma, { componentId: 'comp-789' })).rejects.toThrow(
        'incomplete instructions',
      );
    });

    it('should throw ValidationError if operationInstructions is null', async () => {
      const invalidComponent = {
        id: 'comp-789',
        name: 'Invalid Component',
        description: 'Missing instructions',
        inputInstructions: 'test',
        operationInstructions: null,
        outputInstructions: 'test',
        config: {},
        tools: [],
        subtaskConfig: null,
        onFailure: 'stop',
        active: true,
      };

      mockPrismaClient.component.findUnique.mockResolvedValue(invalidComponent);

      await expect(handler(prisma, { componentId: 'comp-789' })).rejects.toThrow(
        ValidationError,
      );
    });

    it('should throw ValidationError if outputInstructions is missing', async () => {
      const invalidComponent = {
        id: 'comp-789',
        name: 'Invalid Component',
        description: 'Missing instructions',
        inputInstructions: 'test',
        operationInstructions: 'test',
        outputInstructions: '',
        config: {},
        tools: [],
        subtaskConfig: null,
        onFailure: 'stop',
        active: true,
      };

      mockPrismaClient.component.findUnique.mockResolvedValue(invalidComponent);

      await expect(handler(prisma, { componentId: 'comp-789' })).rejects.toThrow(
        ValidationError,
      );
    });

    it('should propagate database errors', async () => {
      const dbError = new Error('Database connection failed');
      mockPrismaClient.component.findUnique.mockRejectedValue(dbError);

      await expect(handler(prisma, { componentId: 'comp-123' })).rejects.toThrow(
        'Database connection failed',
      );
    });
  });
});
