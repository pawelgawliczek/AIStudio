/**
 * Service Tests for Taxonomy Integration in UseCasesService
 * Tests create/update use case with taxonomy validation
 */

import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateUseCaseDto, UpdateUseCaseDto } from '../dto';
import { UseCasesService } from '../use-cases.service';

// Mock OpenAI module
jest.mock('openai', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    embeddings: {
      create: jest.fn().mockResolvedValue({
        data: [{ embedding: Array(1536).fill(0.1) }],
      }),
    },
  })),
}));

describe('UseCasesService - Taxonomy Integration', () => {
  let service: UseCasesService;
  let prismaService: PrismaService;

  const mockPrismaService = {
    project: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    useCase: {
      create: jest.fn(),
      update: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    useCaseVersion: {
      create: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn(),
    $queryRaw: jest.fn(),
    $executeRaw: jest.fn(),
  };

  const mockProject = {
    id: 'project-1',
    name: 'Test Project',
    taxonomy: ['Authentication', 'Authorization', 'User Management', 'Reporting'],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockUseCase = {
    id: 'use-case-1',
    projectId: 'project-1',
    key: 'UC-TEST-001',
    title: 'User Login',
    area: 'Authentication',
    componentId: null,
    layerId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockUseCaseWithRelations = {
    ...mockUseCase,
    versions: [{
      id: 'version-1',
      version: 1,
      summary: 'Test summary',
      content: 'Test content',
      createdAt: new Date(),
      linkedStoryId: null,
      linkedDefectId: null,
      createdBy: {
        id: 'user-1',
        name: 'Test User',
        email: 'test@example.com',
      },
    }],
    storyLinks: [],
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UseCasesService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<UseCasesService>(UseCasesService);
    prismaService = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
    mockPrismaService.$transaction.mockImplementation(async (callback: any) => {
      if (typeof callback === 'function') {
        return callback(mockPrismaService);
      }
      return Promise.all(callback);
    });
  });

  describe('Create Use Case with Taxonomy', () => {
    const createDto: CreateUseCaseDto = {
      projectId: 'project-1',
      key: 'UC-TEST-001',
      title: 'User Login',
      summary: 'Allow users to log in',
      content: 'Detailed login flow',
      area: 'Authentication',
      createdById: 'user-1',
    };

    it('should create use case with valid area', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaService.useCase.create.mockResolvedValue(mockUseCase);
      mockPrismaService.useCase.findUnique
        .mockResolvedValueOnce(null) // First call in create (check for existing)
        .mockResolvedValueOnce(mockUseCaseWithRelations); // Second call in findOne
      mockPrismaService.useCaseVersion.create.mockResolvedValue({});
      mockPrismaService.$queryRaw.mockResolvedValue([{ nextval: 1 }]);

      const result = await service.create(createDto);

      expect(result.area).toBe('Authentication');
      expect(mockPrismaService.useCase.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            area: 'Authentication',
          }),
        })
      );
    });

    it('should normalize area before validation', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaService.useCase.create.mockResolvedValue(mockUseCase);
      mockPrismaService.useCase.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(mockUseCaseWithRelations);
      mockPrismaService.useCaseVersion.create.mockResolvedValue({});
      mockPrismaService.$queryRaw.mockResolvedValue([{ nextval: 1 }]);

      await service.create({
        ...createDto,
        area: '  authentication  ', // Should be normalized
      });

      expect(mockPrismaService.useCase.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            area: 'Authentication',
          }),
        })
      );
    });

    it('should reject use case with similar area (not exact match)', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue(mockProject);

      await expect(
        service.create({
          ...createDto,
          area: 'Authentcation', // Typo, should be rejected
        })
      ).rejects.toThrow(BadRequestException);
    });

    it('should provide suggestions for similar areas', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue(mockProject);

      try {
        await service.create({
          ...createDto,
          area: 'Authentcation',
        });
        fail('Should have thrown BadRequestException');
      } catch (error: any) {
        expect(error).toBeInstanceOf(BadRequestException);
        expect(error.message).toContain('similar');
        expect(error.response.suggestions).toBeDefined();
        expect(error.response.suggestions).toContain('Authentication');
      }
    });

    it('should auto-add new area to taxonomy when enabled', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaService.project.update.mockResolvedValue({
        ...mockProject,
        taxonomy: [...mockProject.taxonomy, 'New Area'],
      });
      mockPrismaService.useCase.create.mockResolvedValue({
        ...mockUseCase,
        area: 'New Area',
      });
      mockPrismaService.useCase.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          ...mockUseCaseWithRelations,
          area: 'New Area',
        });
      mockPrismaService.useCaseVersion.create.mockResolvedValue({});
      mockPrismaService.$queryRaw.mockResolvedValue([{ nextval: 1 }]);

      const result = await service.create({
        ...createDto,
        area: 'New Area',
        autoAddArea: true,
      });

      expect(result.area).toBe('New Area');
      expect(mockPrismaService.project.update).toHaveBeenCalledWith({
        where: { id: 'project-1' },
        data: {
          taxonomy: expect.arrayContaining(['New Area']),
        },
      });
    });

    it('should reject new area when autoAddArea is false', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue(mockProject);

      await expect(
        service.create({
          ...createDto,
          area: 'New Area',
          autoAddArea: false,
        })
      ).rejects.toThrow(BadRequestException);
    });

    it('should handle project with no taxonomy', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue({
        ...mockProject,
        taxonomy: null,
      });
      mockPrismaService.project.update.mockResolvedValue(mockProject);
      mockPrismaService.useCase.create.mockResolvedValue(mockUseCase);
      mockPrismaService.useCase.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(mockUseCaseWithRelations);
      mockPrismaService.useCaseVersion.create.mockResolvedValue({});
      mockPrismaService.$queryRaw.mockResolvedValue([{ nextval: 1 }]);

      const result = await service.create({
        ...createDto,
        autoAddArea: true,
      });

      expect(result.area).toBe('Authentication');
      expect(mockPrismaService.project.update).toHaveBeenCalledWith({
        where: { id: 'project-1' },
        data: {
          taxonomy: ['Authentication'],
        },
      });
    });

    it('should handle project with empty taxonomy', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue({
        ...mockProject,
        taxonomy: [],
      });
      mockPrismaService.project.update.mockResolvedValue(mockProject);
      mockPrismaService.useCase.create.mockResolvedValue(mockUseCase);
      mockPrismaService.useCase.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(mockUseCaseWithRelations);
      mockPrismaService.useCaseVersion.create.mockResolvedValue({});
      mockPrismaService.$queryRaw.mockResolvedValue([{ nextval: 1 }]);

      const result = await service.create({
        ...createDto,
        autoAddArea: true,
      });

      expect(result.area).toBe('Authentication');
    });

    it('should fail for non-existent project', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue(null);

      await expect(service.create(createDto)).rejects.toThrow(NotFoundException);
    });
  });

  describe('Update Use Case Area', () => {
    const updateDto: UpdateUseCaseDto = {
      area: 'Authorization',
    };

    it('should update use case area to valid area', async () => {
      mockPrismaService.useCase.findUnique
        .mockResolvedValueOnce({ ...mockUseCase, versions: [] }) // First call in update
        .mockResolvedValueOnce({ ...mockUseCaseWithRelations, area: 'Authorization' }); // Second call in findOne
      mockPrismaService.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaService.useCase.update.mockResolvedValue({
        ...mockUseCase,
        area: 'Authorization',
      });

      const result = await service.update('use-case-1', updateDto);

      expect(result.area).toBe('Authorization');
    });

    it('should normalize area before validation on update', async () => {
      mockPrismaService.useCase.findUnique
        .mockResolvedValueOnce({ ...mockUseCase, versions: [] })
        .mockResolvedValueOnce({ ...mockUseCaseWithRelations, area: 'Authorization' });
      mockPrismaService.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaService.useCase.update.mockResolvedValue(mockUseCase);

      await service.update('use-case-1', {
        area: '  AUTHORIZATION  ',
      });

      expect(mockPrismaService.useCase.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            area: 'Authorization',
          }),
        })
      );
    });

    it('should reject update with similar area', async () => {
      mockPrismaService.useCase.findUnique.mockResolvedValue({
        ...mockUseCase,
        versions: [],
      });
      mockPrismaService.project.findUnique.mockResolvedValue(mockProject);

      await expect(
        service.update('use-case-1', {
          area: 'Authoriztion', // Typo
        })
      ).rejects.toThrow(BadRequestException);
    });

    it('should allow new area with autoAddArea flag', async () => {
      mockPrismaService.useCase.findUnique
        .mockResolvedValueOnce({ ...mockUseCase, versions: [] })
        .mockResolvedValueOnce({ ...mockUseCaseWithRelations, area: 'New Area' });
      mockPrismaService.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaService.project.update.mockResolvedValue(mockProject);
      mockPrismaService.useCase.update.mockResolvedValue({
        ...mockUseCase,
        area: 'New Area',
      });

      const result = await service.update('use-case-1', {
        area: 'New Area',
        autoAddArea: true,
      });

      expect(result.area).toBe('New Area');
    });

    it('should fail for non-existent use case', async () => {
      mockPrismaService.useCase.findUnique.mockResolvedValue(null);

      await expect(
        service.update('non-existent', updateDto)
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('Validation Helper Methods', () => {
    it('should validate area exists in taxonomy', async () => {
      const isValid = await service.validateArea('project-1', 'Authentication');
      expect(isValid).toBe(true);
    });

    it('should reject invalid area', async () => {
      const isValid = await service.validateArea('project-1', 'Invalid Area');
      expect(isValid).toBe(false);
    });

    it('should get similar areas for suggestion', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue(mockProject);

      const suggestions = await service.getSimilarAreas('project-1', 'Authentcation');
      expect(suggestions).toHaveLength(1);
      expect(suggestions[0].area).toBe('Authentication');
    });

    it('should return empty array when no similar areas', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue(mockProject);

      const suggestions = await service.getSimilarAreas('project-1', 'Completely Different');
      expect(suggestions).toEqual([]);
    });
  });

  describe('Bulk Operations', () => {
    it('should update multiple use cases when area is renamed', async () => {
      mockPrismaService.useCase.findMany.mockResolvedValue([
        mockUseCase,
        { ...mockUseCase, id: 'use-case-2' },
      ]);

      const count = await service.bulkUpdateArea('project-1', 'Authentication', 'Security');

      expect(count).toBe(2);
      expect(mockPrismaService.useCase.update).toHaveBeenCalledTimes(2);
    });

    it('should handle no use cases found for area', async () => {
      mockPrismaService.useCase.findMany.mockResolvedValue([]);

      const count = await service.bulkUpdateArea('project-1', 'NonExistent', 'New');

      expect(count).toBe(0);
    });
  });

  describe('Edge Cases', () => {
    const createDto: CreateUseCaseDto = {
      projectId: 'project-1',
      key: 'UC-TEST-001',
      title: 'User Login',
      summary: 'Allow users to log in',
      content: 'Detailed login flow',
      area: 'Authentication',
      createdById: 'user-1',
    };

    it('should handle unicode characters in area names', async () => {
      const projectWithUnicode = {
        ...mockProject,
        taxonomy: ['Café Management', 'Naïve Bayes'],
      };
      mockPrismaService.project.findUnique.mockResolvedValue(projectWithUnicode);
      mockPrismaService.useCase.create.mockResolvedValue({
        ...mockUseCase,
        area: 'Café Management',
      });
      mockPrismaService.useCase.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          ...mockUseCaseWithRelations,
          area: 'Café Management',
        });
      mockPrismaService.useCaseVersion.create.mockResolvedValue({});
      mockPrismaService.$queryRaw.mockResolvedValue([{ nextval: 1 }]);

      const result = await service.create({
        ...createDto,
        area: 'Café Management',
      });

      expect(result.area).toBe('Café Management');
    });

    it('should handle special characters in area names', async () => {
      const projectWithSpecial = {
        ...mockProject,
        taxonomy: ['API/Gateway', 'User_Auth'],
      };
      mockPrismaService.project.findUnique.mockResolvedValue(projectWithSpecial);
      mockPrismaService.useCase.create.mockResolvedValue({
        ...mockUseCase,
        area: 'API/Gateway',
      });
      mockPrismaService.useCase.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          ...mockUseCaseWithRelations,
          area: 'API/Gateway',
        });
      mockPrismaService.useCaseVersion.create.mockResolvedValue({});
      mockPrismaService.$queryRaw.mockResolvedValue([{ nextval: 1 }]);

      const result = await service.create({
        ...createDto,
        area: 'API/Gateway',
      });

      expect(result.area).toBe('API/Gateway');
    });

    it('should handle very long area names', async () => {
      const longArea = 'A'.repeat(200);
      const projectWithLong = {
        ...mockProject,
        taxonomy: [longArea],
      };
      mockPrismaService.project.findUnique.mockResolvedValue(projectWithLong);
      mockPrismaService.useCase.create.mockResolvedValue({
        ...mockUseCase,
        area: longArea,
      });
      mockPrismaService.useCase.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          ...mockUseCaseWithRelations,
          area: longArea,
        });
      mockPrismaService.useCaseVersion.create.mockResolvedValue({});
      mockPrismaService.$queryRaw.mockResolvedValue([{ nextval: 1 }]);

      const result = await service.create({
        ...createDto,
        area: longArea,
      });

      expect(result.area).toBe(longArea);
    });

    it('should handle empty area string', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue(mockProject);

      await expect(
        service.create({
          ...createDto,
          area: '   ',
        })
      ).rejects.toThrow(BadRequestException);
    });

    it('should handle case-insensitive matching', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaService.useCase.create.mockResolvedValue(mockUseCase);
      mockPrismaService.useCase.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(mockUseCaseWithRelations);
      mockPrismaService.useCaseVersion.create.mockResolvedValue({});
      mockPrismaService.$queryRaw.mockResolvedValue([{ nextval: 1 }]);

      const result = await service.create({
        ...createDto,
        area: 'AUTHENTICATION',
      });

      expect(result.area).toBe('Authentication'); // Should match normalized
    });
  });
});
