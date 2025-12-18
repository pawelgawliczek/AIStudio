/**
 * Project Tools Unit Tests
 */

import { PrismaClient } from '@prisma/client';
import { ValidationError, NotFoundError } from '../types/';
import {
  bootstrapProject,
  createProject,
  listProjects,
  getProject,
} from './project.tools';

// Mock Prisma Client
jest.mock('@prisma/client', () => {
  const mPrismaClient = {
    project: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
    },
    epic: {
      create: jest.fn(),
    },
    agentFramework: {
      create: jest.fn(),
    },
    user: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    $transaction: jest.fn(),
    $connect: jest.fn(),
    $disconnect: jest.fn(),
  };
  return { PrismaClient: jest.fn(() => mPrismaClient) };
});

describe('Project Tools', () => {
  let prisma: PrismaClient;

  beforeEach(() => {
    prisma = new PrismaClient();
    jest.clearAllMocks();
  });

  describe('bootstrapProject', () => {
    it('should create a project with default epic and framework', async () => {
      const mockProject = {
        id: 'project-1',
        name: 'Test Project',
        description: 'AI Studio project: Test Project',
        repositoryUrl: null,
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
        _count: { epics: 1, stories: 0 },
      };

      const mockEpic = {
        id: 'epic-1',
        projectId: 'project-1',
        key: 'EP-1',
        title: 'Initial Development',
        description: 'Default epic for initial project setup and stories',
        status: 'planning',
        priority: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockFramework = {
        id: 'framework-1',
        projectId: 'project-1',
        name: 'Single Agent',
        description: 'Default single-agent framework for story implementation',
        config: { agents: ['developer'], sequence: ['developer'], routing: 'sequential' },
        active: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockUser = {
        id: 'user-1',
        email: 'system@aistudio.local',
        name: 'System User',
        password: 'not-used',
        role: 'admin',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (prisma.project.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.user.findFirst as jest.Mock).mockResolvedValue(mockUser);
      (prisma.$transaction as jest.Mock).mockResolvedValue({
        project: mockProject,
        defaultEpic: mockEpic,
        defaultFramework: mockFramework,
      });

      const result = await bootstrapProject(prisma, {
        name: 'Test Project',
      });

      expect(result.project.id).toBe('project-1');
      expect(result.project.name).toBe('Test Project');
      expect(result.defaultEpic.key).toBe('EP-1');
      expect(result.defaultFramework.name).toBe('Single Agent');
      expect(result.message).toContain('bootstrapped successfully');
    });

    it('should throw ValidationError if project name already exists', async () => {
      const existingProject = {
        id: 'project-1',
        name: 'Existing Project',
        status: 'active',
      };

      (prisma.project.findUnique as jest.Mock).mockResolvedValue(existingProject);

      await expect(
        bootstrapProject(prisma, { name: 'Existing Project' }),
      ).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError if name is missing', async () => {
      await expect(bootstrapProject(prisma, {} as any)).rejects.toThrow(ValidationError);
    });
  });

  describe('createProject', () => {
    it('should create a new project', async () => {
      const mockProject = {
        id: 'project-1',
        name: 'New Project',
        description: 'A test project',
        repositoryUrl: 'https://github.com/test/repo',
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
        _count: { epics: 0, stories: 0 },
      };

      (prisma.project.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.project.create as jest.Mock).mockResolvedValue(mockProject);

      const result = await createProject(prisma, {
        name: 'New Project',
        description: 'A test project',
        repositoryUrl: 'https://github.com/test/repo',
      });

      expect(result.id).toBe('project-1');
      expect(result.name).toBe('New Project');
      expect(result.description).toBe('A test project');
    });

    it('should throw ValidationError if project name already exists', async () => {
      const existingProject = {
        id: 'project-1',
        name: 'Existing Project',
      };

      (prisma.project.findUnique as jest.Mock).mockResolvedValue(existingProject);

      await expect(
        createProject(prisma, { name: 'Existing Project' }),
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('listProjects', () => {
    it('should list all projects', async () => {
      const mockProjects = [
        {
          id: 'project-1',
          name: 'Project 1',
          description: 'First project',
          repositoryUrl: null,
          status: 'active',
          createdAt: new Date(),
          updatedAt: new Date(),
          _count: { epics: 2, stories: 5 },
        },
        {
          id: 'project-2',
          name: 'Project 2',
          description: 'Second project',
          repositoryUrl: null,
          status: 'active',
          createdAt: new Date(),
          updatedAt: new Date(),
          _count: { epics: 1, stories: 3 },
        },
      ];

      (prisma.project.findMany as jest.Mock).mockResolvedValue(mockProjects);

      const result = await listProjects(prisma);

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('Project 1');
      expect(result[0].epicCount).toBe(2);
      expect(result[0].storyCount).toBe(5);
    });

    it('should filter projects by status', async () => {
      const mockProjects = [
        {
          id: 'project-1',
          name: 'Active Project',
          status: 'active',
          createdAt: new Date(),
          updatedAt: new Date(),
          _count: { epics: 1, stories: 2 },
        },
      ];

      (prisma.project.findMany as jest.Mock).mockResolvedValue(mockProjects);

      const result = await listProjects(prisma, { status: 'active' });

      expect(result).toHaveLength(1);
      expect(result[0].status).toBe('active');
    });
  });

  describe('getProject', () => {
    it('should get a project by ID', async () => {
      const mockProject = {
        id: 'project-1',
        name: 'Test Project',
        description: 'A test project',
        repositoryUrl: null,
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
        _count: { epics: 3, stories: 10 },
      };

      (prisma.project.findUnique as jest.Mock).mockResolvedValue(mockProject);

      const result = await getProject(prisma, { projectId: 'project-1' });

      expect(result.id).toBe('project-1');
      expect(result.name).toBe('Test Project');
      expect(result.epicCount).toBe(3);
      expect(result.storyCount).toBe(10);
    });

    it('should throw NotFoundError if project does not exist', async () => {
      (prisma.project.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(getProject(prisma, { projectId: 'nonexistent' })).rejects.toThrow(
        NotFoundError,
      );
    });

    it('should throw ValidationError if projectId is missing', async () => {
      await expect(getProject(prisma, {} as any)).rejects.toThrow(ValidationError);
    });
  });
});
