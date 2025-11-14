import { PrismaClient } from '@prisma/client';
import { handler, tool } from './create_workflow';

describe('create_workflow MCP tool', () => {
  let prisma: PrismaClient;

  const mockPrismaClient = {
    project: {
      findUnique: jest.fn(),
    },
    coordinatorAgent: {
      findUnique: jest.fn(),
    },
    workflow: {
      create: jest.fn(),
    },
  };

  beforeEach(() => {
    prisma = mockPrismaClient as any;
    jest.clearAllMocks();
  });

  describe('tool definition', () => {
    it('should have correct name', () => {
      expect(tool.name).toBe('create_workflow');
    });

    it('should have description', () => {
      expect(tool.description).toBeDefined();
      expect(tool.description).toContain('workflow');
    });

    it('should require correct fields', () => {
      expect(tool.inputSchema.required).toContain('projectId');
      expect(tool.inputSchema.required).toContain('coordinatorId');
      expect(tool.inputSchema.required).toContain('name');
      expect(tool.inputSchema.required).toContain('triggerConfig');
    });
  });

  describe('handler', () => {
    const validParams = {
      projectId: 'proj-1',
      coordinatorId: 'coord-1',
      name: 'Software Development Workflow',
      description: 'Full workflow for software development',
      triggerConfig: {
        type: 'story_assigned',
        filters: { status: 'planning' },
        notifications: { email: true },
      },
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

    it('should throw error when coordinator does not exist', async () => {
      mockPrismaClient.project.findUnique.mockResolvedValue({
        id: 'proj-1',
        name: 'Test Project',
      });
      mockPrismaClient.coordinatorAgent.findUnique.mockResolvedValue(null);

      await expect(handler(prisma, validParams)).rejects.toThrow(
        'Coordinator with ID coord-1 not found',
      );
    });

    it('should throw error when coordinator does not belong to project', async () => {
      mockPrismaClient.project.findUnique.mockResolvedValue({
        id: 'proj-1',
        name: 'Test Project',
      });
      mockPrismaClient.coordinatorAgent.findUnique.mockResolvedValue({
        id: 'coord-1',
        projectId: 'proj-2', // Different project
      });

      await expect(handler(prisma, validParams)).rejects.toThrow(
        'Coordinator does not belong to the specified project',
      );
    });

    it('should throw error when triggerConfig.type is missing', async () => {
      mockPrismaClient.project.findUnique.mockResolvedValue({
        id: 'proj-1',
        name: 'Test Project',
      });
      mockPrismaClient.coordinatorAgent.findUnique.mockResolvedValue({
        id: 'coord-1',
        projectId: 'proj-1',
      });

      const invalidParams = {
        ...validParams,
        triggerConfig: { filters: {} },
      };

      await expect(handler(prisma, invalidParams as any)).rejects.toThrow(
        'triggerConfig.type is required',
      );
    });

    it('should create workflow successfully', async () => {
      const mockProject = {
        id: 'proj-1',
        name: 'Test Project',
      };

      const mockCoordinator = {
        id: 'coord-1',
        projectId: 'proj-1',
      };

      const mockWorkflow = {
        id: 'workflow-1',
        ...validParams,
        active: true,
        version: 'v1.0',
        createdAt: new Date('2025-11-13T10:00:00Z'),
        updatedAt: new Date('2025-11-13T10:00:00Z'),
      };

      mockPrismaClient.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaClient.coordinatorAgent.findUnique.mockResolvedValue(
        mockCoordinator,
      );
      mockPrismaClient.workflow.create.mockResolvedValue(mockWorkflow);

      const result = await handler(prisma, validParams);

      expect(result.id).toBe('workflow-1');
      expect(result.name).toBe('Software Development Workflow');
      expect(result.coordinatorId).toBe('coord-1');
      expect(result.triggerConfig).toEqual(validParams.triggerConfig);
      expect(result.active).toBe(true);
      expect(mockPrismaClient.workflow.create).toHaveBeenCalledWith({
        data: {
          projectId: 'proj-1',
          coordinatorId: 'coord-1',
          name: 'Software Development Workflow',
          description: 'Full workflow for software development',
          triggerConfig: validParams.triggerConfig,
          active: true,
          version: 'v1.0',
        },
      });
    });

    it('should accept custom active and version', async () => {
      const mockProject = { id: 'proj-1', name: 'Test' };
      const mockCoordinator = { id: 'coord-1', projectId: 'proj-1' };
      const mockWorkflow = {
        id: 'workflow-1',
        ...validParams,
        active: false,
        version: 'v2.0',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaClient.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaClient.coordinatorAgent.findUnique.mockResolvedValue(
        mockCoordinator,
      );
      mockPrismaClient.workflow.create.mockResolvedValue(mockWorkflow);

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
