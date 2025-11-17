import { NotFoundException, BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ProjectStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectsService } from './projects.service';

describe('ProjectsService', () => {
  let service: ProjectsService;
  let prismaService: PrismaService;

  const mockPrismaService = {
    project: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectsService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<ProjectsService>(ProjectsService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('should return an array of projects', async () => {
      const mockProjects = [
        {
          id: '1',
          name: 'Project 1',
          description: 'Description 1',
          status: ProjectStatus.active,
          createdAt: new Date(),
          updatedAt: new Date(),
          _count: { epics: 5, stories: 10, useCases: 3 },
        },
      ];

      mockPrismaService.project.findMany.mockResolvedValue(mockProjects);

      const result = await service.findAll();

      expect(result).toEqual(mockProjects);
      expect(mockPrismaService.project.findMany).toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('should return a single project', async () => {
      const mockProject = {
        id: '1',
        name: 'Project 1',
        description: 'Description 1',
        status: ProjectStatus.active,
        epics: [],
        _count: { epics: 0, stories: 0, useCases: 0, commits: 0, testCases: 0 },
      };

      mockPrismaService.project.findUnique.mockResolvedValue(mockProject);

      const result = await service.findOne('1');

      expect(result).toEqual(mockProject);
      expect(mockPrismaService.project.findUnique).toHaveBeenCalledWith({
        where: { id: '1' },
        include: expect.any(Object),
      });
    });

    it('should throw NotFoundException if project not found', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue(null);

      await expect(service.findOne('1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('should create a new project', async () => {
      const createProjectDto = {
        name: 'New Project',
        description: 'New Description',
      };

      const mockProject = {
        id: '1',
        ...createProjectDto,
        status: ProjectStatus.active,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaService.project.findUnique.mockResolvedValue(null);
      mockPrismaService.project.create.mockResolvedValue(mockProject);

      const result = await service.create(createProjectDto);

      expect(result).toEqual(mockProject);
      expect(mockPrismaService.project.create).toHaveBeenCalledWith({
        data: createProjectDto,
      });
    });

    it('should throw BadRequestException if project with same name exists', async () => {
      const createProjectDto = {
        name: 'Existing Project',
        description: 'Description',
      };

      mockPrismaService.project.findUnique.mockResolvedValue({ id: '1', name: 'Existing Project' });

      await expect(service.create(createProjectDto)).rejects.toThrow(BadRequestException);
    });
  });

  describe('update', () => {
    it('should update a project', async () => {
      const updateProjectDto = {
        name: 'Updated Project',
        description: 'Updated Description',
      };

      const existingProject = {
        id: '1',
        name: 'Old Project',
        description: 'Old Description',
      };

      const updatedProject = {
        ...existingProject,
        ...updateProjectDto,
      };

      mockPrismaService.project.findUnique
        .mockResolvedValueOnce(existingProject)
        .mockResolvedValueOnce(null);
      mockPrismaService.project.update.mockResolvedValue(updatedProject);

      const result = await service.update('1', updateProjectDto);

      expect(result).toEqual(updatedProject);
      expect(mockPrismaService.project.update).toHaveBeenCalledWith({
        where: { id: '1' },
        data: updateProjectDto,
      });
    });

    it('should throw NotFoundException if project not found', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue(null);

      await expect(service.update('1', { name: 'Updated' })).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if new name is already taken', async () => {
      const existingProject = {
        id: '1',
        name: 'Project 1',
      };

      const conflictingProject = {
        id: '2',
        name: 'Project 2',
      };

      mockPrismaService.project.findUnique
        .mockResolvedValueOnce(existingProject)
        .mockResolvedValueOnce(conflictingProject);

      await expect(service.update('1', { name: 'Project 2' })).rejects.toThrow(BadRequestException);
    });
  });

  describe('remove', () => {
    it('should delete a project', async () => {
      const mockProject = { id: '1', name: 'Project 1' };

      mockPrismaService.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaService.project.delete.mockResolvedValue(mockProject);

      const result = await service.remove('1');

      expect(result).toEqual({ message: 'Project deleted successfully' });
      expect(mockPrismaService.project.delete).toHaveBeenCalledWith({ where: { id: '1' } });
    });

    it('should throw NotFoundException if project not found', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue(null);

      await expect(service.remove('1')).rejects.toThrow(NotFoundException);
    });
  });
});
