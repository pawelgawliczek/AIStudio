import { PrismaClient } from '@prisma/client';
import { handler, tool } from './create_coordinator';

describe('create_coordinator MCP tool', () => {
  let prisma: PrismaClient;

  const mockPrismaClient = {
    project: {
      findUnique: jest.fn(),
    },
    component: {
      findMany: jest.fn(),
    },
    coordinatorAgent: {
      create: jest.fn(),
    },
  };

  beforeEach(() => {
    prisma = mockPrismaClient as any;
    jest.clearAllMocks();
  });

  describe('tool definition', () => {
    it('should have correct name', () => {
      expect(tool.name).toBe('create_coordinator');
    });

    it('should have description', () => {
      expect(tool.description).toBeDefined();
      expect(tool.description).toContain('coordinator');
    });

    it('should require correct fields', () => {
      expect(tool.inputSchema.required).toContain('projectId');
      expect(tool.inputSchema.required).toContain('name');
      expect(tool.inputSchema.required).toContain('description');
      expect(tool.inputSchema.required).toContain('domain');
      expect(tool.inputSchema.required).toContain('coordinatorInstructions');
      expect(tool.inputSchema.required).toContain('config');
      expect(tool.inputSchema.required).toContain('tools');
      expect(tool.inputSchema.required).toContain('decisionStrategy');
    });
  });

  describe('handler', () => {
    const validParams = {
      projectId: 'proj-1',
      name: 'Software Dev Coordinator',
      description: 'Orchestrates software development workflow',
      domain: 'software-development',
      coordinatorInstructions: 'Instructions here...',
      config: {
        modelId: 'claude-sonnet-4-5-20250929',
        temperature: 0.3,
        maxInputTokens: 30000,
        maxOutputTokens: 4000,
      },
      tools: ['get_story', 'update_story', 'start_workflow_run'],
      decisionStrategy: 'adaptive' as const,
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

    it('should create coordinator successfully', async () => {
      const mockProject = {
        id: 'proj-1',
        name: 'Test Project',
      };

      const mockCoordinator = {
        id: 'coord-1',
        ...validParams,
        componentIds: [],
        active: true,
        version: 'v1.0',
        createdAt: new Date('2025-11-13T10:00:00Z'),
        updatedAt: new Date('2025-11-13T10:00:00Z'),
      };

      mockPrismaClient.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaClient.coordinatorAgent.create.mockResolvedValue(
        mockCoordinator,
      );

      const result = await handler(prisma, validParams);

      expect(result.id).toBe('coord-1');
      expect(result.name).toBe('Software Dev Coordinator');
      expect(result.domain).toBe('software-development');
      expect(result.active).toBe(true);
      expect(mockPrismaClient.coordinatorAgent.create).toHaveBeenCalledWith({
        data: {
          projectId: 'proj-1',
          name: 'Software Dev Coordinator',
          description: 'Orchestrates software development workflow',
          domain: 'software-development',
          coordinatorInstructions: 'Instructions here...',
          config: validParams.config,
          tools: validParams.tools,
          decisionStrategy: 'adaptive',
          componentIds: [],
          active: true,
          version: 'v1.0',
        },
      });
    });

    it('should validate componentIds belong to project', async () => {
      mockPrismaClient.project.findUnique.mockResolvedValue({
        id: 'proj-1',
        name: 'Test',
      });
      mockPrismaClient.component.findMany.mockResolvedValue([
        { id: 'comp-1', projectId: 'proj-1' },
      ]);

      const paramsWithComponents = {
        ...validParams,
        componentIds: ['comp-1', 'comp-2'],
      };

      await expect(handler(prisma, paramsWithComponents)).rejects.toThrow(
        'One or more component IDs not found or do not belong to the project',
      );
    });

    it('should accept custom active and version', async () => {
      const mockProject = { id: 'proj-1', name: 'Test' };
      const mockCoordinator = {
        id: 'coord-1',
        ...validParams,
        componentIds: [],
        active: false,
        version: 'v2.0',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaClient.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaClient.coordinatorAgent.create.mockResolvedValue(
        mockCoordinator,
      );

      const customParams = {
        ...validParams,
        active: false,
        version: 'v2.0',
      };

      const result = await handler(prisma, customParams);

      expect(result.active).toBe(false);
      expect(result.version).toBe('v2.0');
    });
  });
});
