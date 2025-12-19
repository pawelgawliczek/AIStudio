/**
 * Unit tests for ProjectsService - ST-355
 *
 * Tests cover project management and taxonomy operations:
 * - CRUD operations
 * - Taxonomy management (add, remove, rename, merge)
 * - Validation and conflict detection
 * - Use case updates during taxonomy changes
 */

import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { normalizeArea, findSimilarAreas } from '../../use-cases/taxonomy.util';
import { ProjectsService } from '../projects.service';

jest.mock('../../use-cases/taxonomy.util', () => ({
  normalizeArea: jest.fn((area) => area.trim()),
  findSimilarAreas: jest.fn(() => []),
  SIMILARITY_THRESHOLD: 3,
}));

describe('ProjectsService', () => {
  let service: ProjectsService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      project: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      useCase: {
        count: jest.fn(),
        updateMany: jest.fn(),
      },
      $transaction: jest.fn((callback) => callback(mockPrisma)),
    };

    service = new ProjectsService(mockPrisma as PrismaClient);
    jest.clearAllMocks();
  });

  // ==========================================================================
  // GROUP 1: Project CRUD Operations
  // ==========================================================================

  describe('findAll', () => {
    it('should return all projects with counts', async () => {
      const mockProjects = [
        {
          id: 'proj-1',
          name: 'Project 1',
          createdAt: new Date('2025-01-01'),
          _count: { epics: 5, stories: 10, useCases: 3 },
        },
      ];

      mockPrisma.project.findMany.mockResolvedValue(mockProjects);

      const result = await service.findAll();

      expect(result).toEqual(mockProjects);
      expect(mockPrisma.project.findMany).toHaveBeenCalledWith({
        orderBy: { createdAt: 'desc' },
        include: {
          _count: {
            select: {
              epics: true,
              stories: true,
              useCases: true,
            },
          },
        },
      });
    });
  });

  describe('findOne', () => {
    it('should return project with details', async () => {
      const mockProject = {
        id: 'proj-1',
        name: 'Test Project',
        epics: [],
        _count: { epics: 0, stories: 0, useCases: 0, commits: 0, testCases: 0 },
      };

      mockPrisma.project.findUnique.mockResolvedValue(mockProject);

      const result = await service.findOne('proj-1');

      expect(result).toEqual(mockProject);
    });

    it('should throw NotFoundException when project not found', async () => {
      mockPrisma.project.findUnique.mockResolvedValue(null);

      await expect(service.findOne('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('should create project successfully', async () => {
      const createDto = { name: 'New Project', description: 'Test' };
      const mockProject = { id: 'proj-1', ...createDto };

      mockPrisma.project.findUnique.mockResolvedValue(null);
      mockPrisma.project.create.mockResolvedValue(mockProject);

      const result = await service.create(createDto);

      expect(result).toEqual(mockProject);
      expect(mockPrisma.project.create).toHaveBeenCalledWith({ data: createDto });
    });

    it('should throw error when project name already exists', async () => {
      const createDto = { name: 'Existing Project' };

      mockPrisma.project.findUnique.mockResolvedValue({ id: 'proj-1', name: 'Existing Project' });

      await expect(service.create(createDto)).rejects.toThrow(BadRequestException);
    });
  });

  describe('update', () => {
    it('should update project successfully', async () => {
      const updateDto = { description: 'Updated description' };
      const existingProject = { id: 'proj-1', name: 'Test Project' };
      const updatedProject = { ...existingProject, ...updateDto };

      mockPrisma.project.findUnique.mockResolvedValue(existingProject);
      mockPrisma.project.update.mockResolvedValue(updatedProject);

      const result = await service.update('proj-1', updateDto);

      expect(result).toEqual(updatedProject);
    });

    it('should throw NotFoundException when project not found', async () => {
      mockPrisma.project.findUnique.mockResolvedValue(null);

      await expect(service.update('nonexistent', {})).rejects.toThrow(NotFoundException);
    });

    it('should throw error when updating name to existing name', async () => {
      const existingProject = { id: 'proj-1', name: 'Project 1' };
      const updateDto = { name: 'Project 2' };

      mockPrisma.project.findUnique
        .mockResolvedValueOnce(existingProject)
        .mockResolvedValueOnce({ id: 'proj-2', name: 'Project 2' });

      await expect(service.update('proj-1', updateDto)).rejects.toThrow(BadRequestException);
    });

    it('should allow updating to same name', async () => {
      const existingProject = { id: 'proj-1', name: 'Test Project' };
      const updateDto = { name: 'Test Project', description: 'Updated' };

      mockPrisma.project.findUnique.mockResolvedValue(existingProject);
      mockPrisma.project.update.mockResolvedValue({ ...existingProject, ...updateDto });

      const result = await service.update('proj-1', updateDto);

      expect(result.name).toBe('Test Project');
    });
  });

  describe('remove', () => {
    it('should delete project successfully', async () => {
      const mockProject = { id: 'proj-1', name: 'Test Project' };

      mockPrisma.project.findUnique.mockResolvedValue(mockProject);
      mockPrisma.project.delete.mockResolvedValue(mockProject);

      const result = await service.remove('proj-1');

      expect(result.message).toBe('Project deleted successfully');
      expect(mockPrisma.project.delete).toHaveBeenCalledWith({ where: { id: 'proj-1' } });
    });

    it('should throw NotFoundException when project not found', async () => {
      mockPrisma.project.findUnique.mockResolvedValue(null);

      await expect(service.remove('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  // ==========================================================================
  // GROUP 2: Taxonomy Listing
  // ==========================================================================

  describe('listTaxonomy', () => {
    it('should return taxonomy with usage counts', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({
        taxonomy: ['Authentication', 'Payments', 'Reporting'],
      });

      mockPrisma.useCase.count
        .mockResolvedValueOnce(5)
        .mockResolvedValueOnce(3)
        .mockResolvedValueOnce(0);

      const result = await service.listTaxonomy('proj-1');

      expect(result).toEqual([
        { area: 'Authentication', usageCount: 5 },
        { area: 'Payments', usageCount: 3 },
        { area: 'Reporting', usageCount: 0 },
      ]);
    });

    it('should throw NotFoundException when project not found', async () => {
      mockPrisma.project.findUnique.mockResolvedValue(null);

      await expect(service.listTaxonomy('nonexistent')).rejects.toThrow(NotFoundException);
    });

    it('should handle empty taxonomy', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({ taxonomy: [] });

      const result = await service.listTaxonomy('proj-1');

      expect(result).toEqual([]);
    });
  });

  // ==========================================================================
  // GROUP 3: Add Taxonomy Area
  // ==========================================================================

  describe('addTaxonomyArea', () => {
    beforeEach(() => {
      (normalizeArea as jest.Mock).mockImplementation((area) => area.trim());
    });

    it('should add new area successfully', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({
        taxonomy: ['Authentication'],
      });
      mockPrisma.project.update.mockResolvedValue({
        taxonomy: ['Authentication', 'Payments'],
      });

      (findSimilarAreas as jest.Mock).mockReturnValue([]);

      const result = await service.addTaxonomyArea('proj-1', 'Payments');

      expect(result.added).toBe('Payments');
      expect(result.taxonomy).toContain('Payments');
    });

    it('should throw error when area already exists', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({
        taxonomy: ['Authentication'],
      });

      await expect(service.addTaxonomyArea('proj-1', 'authentication')).rejects.toThrow(
        BadRequestException
      );
    });

    it('should throw error for empty area name', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({ taxonomy: [] });

      (normalizeArea as jest.Mock).mockReturnValueOnce('');

      await expect(service.addTaxonomyArea('proj-1', '   ')).rejects.toThrow(
        BadRequestException
      );
    });

    it('should throw error when similar area exists without force', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({
        taxonomy: ['Authentication'],
      });

      (findSimilarAreas as jest.Mock).mockReturnValue([
        { area: 'Authentication', distance: 2 },
      ]);

      await expect(service.addTaxonomyArea('proj-1', 'Authentications')).rejects.toThrow(
        BadRequestException
      );
    });

    it('should add area with force when similar exists', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({
        taxonomy: ['Authentication'],
      });
      mockPrisma.project.update.mockResolvedValue({
        taxonomy: ['Authentication', 'Authentications'],
      });

      (findSimilarAreas as jest.Mock).mockReturnValue([
        { area: 'Authentication', distance: 2 },
      ]);

      const result = await service.addTaxonomyArea('proj-1', 'Authentications', true);

      expect(result.added).toBe('Authentications');
      expect(result.warnings).toBeDefined();
    });
  });

  // ==========================================================================
  // GROUP 4: Remove Taxonomy Area
  // ==========================================================================

  describe('removeTaxonomyArea', () => {
    beforeEach(() => {
      (normalizeArea as jest.Mock).mockImplementation((area) => area.trim());
    });

    it('should remove area successfully when not in use', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({
        taxonomy: ['Authentication', 'Payments'],
      });
      mockPrisma.useCase.count.mockResolvedValue(0);
      mockPrisma.project.update.mockResolvedValue({
        taxonomy: ['Authentication'],
      });

      const result = await service.removeTaxonomyArea('proj-1', 'Payments');

      expect(result.removed).toBe('Payments');
      expect(result.taxonomy).not.toContain('Payments');
    });

    it('should throw error when area not found', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({
        taxonomy: ['Authentication'],
      });

      await expect(service.removeTaxonomyArea('proj-1', 'NonExistent')).rejects.toThrow(
        NotFoundException
      );
    });

    it('should throw error when area is in use without force', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({
        taxonomy: ['Authentication'],
      });
      mockPrisma.useCase.count.mockResolvedValue(5);

      await expect(service.removeTaxonomyArea('proj-1', 'Authentication')).rejects.toThrow(
        BadRequestException
      );
    });

    it('should remove area with force when in use', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({
        taxonomy: ['Authentication'],
      });
      mockPrisma.useCase.count.mockResolvedValue(5);
      mockPrisma.project.update.mockResolvedValue({ taxonomy: [] });

      const result = await service.removeTaxonomyArea('proj-1', 'Authentication', true);

      expect(result.removed).toBe('Authentication');
      expect(result.warnings).toBeDefined();
    });
  });

  // ==========================================================================
  // GROUP 5: Rename Taxonomy Area
  // ==========================================================================

  describe('renameTaxonomyArea', () => {
    beforeEach(() => {
      (normalizeArea as jest.Mock).mockImplementation((area) => area.trim());
    });

    it('should rename area and update use cases', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({
        taxonomy: ['Authentication'],
      });
      mockPrisma.useCase.updateMany.mockResolvedValue({ count: 7 });

      const result = await service.renameTaxonomyArea('proj-1', 'Authentication', 'Auth');

      expect(result.renamed.from).toBe('Authentication');
      expect(result.renamed.to).toBe('Auth');
      expect(mockPrisma.useCase.updateMany).toHaveBeenCalledWith({
        where: { projectId: 'proj-1', area: 'Authentication' },
        data: { area: 'Auth' },
      });
    });

    it('should throw error when area not found', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({
        taxonomy: ['Authentication'],
      });

      await expect(
        service.renameTaxonomyArea('proj-1', 'NonExistent', 'New')
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw error when new name already exists', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({
        taxonomy: ['Authentication', 'Payments'],
      });

      await expect(
        service.renameTaxonomyArea('proj-1', 'Authentication', 'Payments')
      ).rejects.toThrow(BadRequestException);
    });

    it('should use transaction for atomic update', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({
        taxonomy: ['Authentication'],
      });
      mockPrisma.useCase.updateMany.mockResolvedValue({ count: 0 });

      await service.renameTaxonomyArea('proj-1', 'Authentication', 'Auth');

      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // GROUP 6: Merge Taxonomy Areas
  // ==========================================================================

  describe('mergeTaxonomyAreas', () => {
    beforeEach(() => {
      (normalizeArea as jest.Mock).mockImplementation((area) => area.trim());
    });

    it('should merge multiple areas into target', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({
        taxonomy: ['Authentication', 'Login', 'SignIn'],
      });
      mockPrisma.useCase.updateMany.mockResolvedValue({ count: 5 });

      const result = await service.mergeTaxonomyAreas(
        'proj-1',
        ['Login', 'SignIn'],
        'Authentication'
      );

      expect(result.merged.from).toEqual(['Login', 'SignIn']);
      expect(result.merged.to).toBe('Authentication');
      expect(mockPrisma.useCase.updateMany).toHaveBeenCalledWith({
        where: { projectId: 'proj-1', area: { in: ['Login', 'SignIn'] } },
        data: { area: 'Authentication' },
      });
    });

    it('should throw error when less than 2 source areas', async () => {
      await expect(
        service.mergeTaxonomyAreas('proj-1', ['Authentication'], 'Auth')
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw error when source area not found', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({
        taxonomy: ['Authentication'],
      });

      await expect(
        service.mergeTaxonomyAreas('proj-1', ['Authentication', 'NonExistent'], 'Auth')
      ).rejects.toThrow(NotFoundException);
    });

    it('should create target area if it does not exist', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({
        taxonomy: ['Login', 'SignIn'],
      });
      mockPrisma.useCase.updateMany.mockResolvedValue({ count: 3 });

      const result = await service.mergeTaxonomyAreas(
        'proj-1',
        ['Login', 'SignIn'],
        'Authentication'
      );

      expect(result.taxonomy).toContain('Authentication');
      expect(result.taxonomy).not.toContain('Login');
      expect(result.taxonomy).not.toContain('SignIn');
    });

    it('should use transaction for atomic update', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({
        taxonomy: ['Login', 'SignIn'],
      });
      mockPrisma.useCase.updateMany.mockResolvedValue({ count: 2 });

      await service.mergeTaxonomyAreas('proj-1', ['Login', 'SignIn'], 'Authentication');

      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // GROUP 7: Validate Taxonomy Area
  // ==========================================================================

  describe('validateTaxonomyArea', () => {
    beforeEach(() => {
      (normalizeArea as jest.Mock).mockImplementation((area) => area.trim());
    });

    it('should return valid for exact match', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({
        taxonomy: ['Authentication'],
      });

      const result = await service.validateTaxonomyArea('proj-1', 'Authentication');

      expect(result.valid).toBe(true);
      expect(result.exactMatch).toBe(true);
    });

    it('should return invalid with suggestions for non-existent area', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({
        taxonomy: ['Authentication'],
      });

      (findSimilarAreas as jest.Mock).mockReturnValue([
        { area: 'Authentication', distance: 2 },
      ]);

      const result = await service.validateTaxonomyArea('proj-1', 'Authentications');

      expect(result.valid).toBe(false);
      expect(result.exactMatch).toBe(false);
      expect(result.suggestions).toHaveLength(1);
    });
  });

  // ==========================================================================
  // GROUP 8: Suggest Taxonomy Areas
  // ==========================================================================

  describe('suggestTaxonomyAreas', () => {
    it('should return similar areas', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({
        taxonomy: ['Authentication', 'Authorization'],
      });

      (findSimilarAreas as jest.Mock).mockReturnValue([
        { area: 'Authentication', distance: 2 },
        { area: 'Authorization', distance: 5 },
      ]);

      const result = await service.suggestTaxonomyAreas('proj-1', 'Auth');

      expect(result).toHaveLength(2);
    });

    it('should throw NotFoundException when project not found', async () => {
      mockPrisma.project.findUnique.mockResolvedValue(null);

      await expect(service.suggestTaxonomyAreas('nonexistent', 'Auth')).rejects.toThrow(
        NotFoundException
      );
    });
  });

  // ==========================================================================
  // GROUP 9: Edge Cases
  // ==========================================================================

  describe('Edge Cases', () => {
    it('should handle null taxonomy as empty array', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({
        taxonomy: null,
      });

      const result = await service.listTaxonomy('proj-1');

      expect(result).toEqual([]);
    });

    it('should handle case-insensitive area matching', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({
        taxonomy: ['Authentication'],
      });

      await expect(service.addTaxonomyArea('proj-1', 'AUTHENTICATION')).rejects.toThrow(
        BadRequestException
      );
    });

    it('should trim whitespace from area names', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({
        taxonomy: [],
      });
      mockPrisma.project.update.mockResolvedValue({
        taxonomy: ['Authentication'],
      });

      (normalizeArea as jest.Mock).mockReturnValue('Authentication');
      (findSimilarAreas as jest.Mock).mockReturnValue([]);

      const result = await service.addTaxonomyArea('proj-1', '  Authentication  ');

      expect(result.added).toBe('Authentication');
    });
  });
});
