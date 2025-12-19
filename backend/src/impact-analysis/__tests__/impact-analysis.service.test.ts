/**
 * Unit tests for ImpactAnalysisService
 * Tests file-to-usecase mappings and impact analysis
 */

import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { MappingSource } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ImpactAnalysisService } from '../impact-analysis.service';

describe('ImpactAnalysisService', () => {
  let service: ImpactAnalysisService;
  let mockPrisma: any;

  const mockProject = {
    id: 'proj-123',
    name: 'Test Project',
  };

  const mockUseCase = {
    id: 'uc-123',
    key: 'UC-001',
    title: 'User Authentication',
    area: 'auth',
    storyLinks: [],
  };

  beforeEach(async () => {
    mockPrisma = {
      project: {
        findUnique: jest.fn(),
      },
      useCase: {
        findFirst: jest.fn(),
      },
      fileUseCaseLink: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      codeMetrics: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
      },
      testCase: {
        findMany: jest.fn(),
      },
      commitFile: {
        findMany: jest.fn(),
      },
      commit: {
        findUnique: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ImpactAnalysisService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<ImpactAnalysisService>(ImpactAnalysisService);
    jest.clearAllMocks();
  });

  // ==========================================================================
  // getAffectedUseCases Tests
  // ==========================================================================

  describe('getAffectedUseCases', () => {
    it('should throw NotFoundException if project not found', async () => {
      mockPrisma.project.findUnique.mockResolvedValue(null);

      await expect(service.getAffectedUseCases({
        projectId: 'invalid',
        filePaths: ['test.ts'],
      })).rejects.toThrow(NotFoundException);
    });

    it('should return empty results when no mappings found', async () => {
      mockPrisma.project.findUnique.mockResolvedValue(mockProject);
      mockPrisma.fileUseCaseLink.findMany.mockResolvedValue([]);

      const result = await service.getAffectedUseCases({
        projectId: 'proj-123',
        filePaths: ['test.ts'],
      });

      expect(result.affectedUseCases).toHaveLength(0);
      expect(result.summary.totalUseCases).toBe(0);
      expect(result.summary.recommendation).toContain('No use cases affected');
    });

    it('should find affected use cases for file paths', async () => {
      mockPrisma.project.findUnique.mockResolvedValue(mockProject);
      mockPrisma.fileUseCaseLink.findMany.mockResolvedValue([
        {
          useCaseId: 'uc-123',
          filePath: 'auth.service.ts',
          confidence: 0.9,
          source: MappingSource.COMMIT_DERIVED,
          lastSeenAt: new Date(),
          occurrences: 5,
          useCase: {
            ...mockUseCase,
            storyLinks: [
              { story: { key: 'ST-1', title: 'Story 1', status: 'impl' } },
            ],
          },
        },
      ]);
      mockPrisma.codeMetrics.findMany.mockResolvedValue([
        {
          filePath: 'auth.service.ts',
          cyclomaticComplexity: 5,
          maintainabilityIndex: 80,
          riskScore: 20,
        },
      ]);
      mockPrisma.testCase.findMany.mockResolvedValue([]);

      const result = await service.getAffectedUseCases({
        projectId: 'proj-123',
        filePaths: ['auth.service.ts'],
      });

      expect(result.affectedUseCases).toHaveLength(1);
      expect(result.affectedUseCases[0].useCaseKey).toBe('UC-001');
      expect(result.affectedUseCases[0].confidence).toBe(0.9);
      expect(result.affectedUseCases[0].riskLevel).toBe('low');
    });

    it('should filter by minimum confidence', async () => {
      mockPrisma.project.findUnique.mockResolvedValue(mockProject);
      mockPrisma.fileUseCaseLink.findMany.mockResolvedValue([]);

      await service.getAffectedUseCases({
        projectId: 'proj-123',
        filePaths: ['test.ts'],
        minConfidence: 0.8,
      });

      expect(mockPrisma.fileUseCaseLink.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            confidence: { gte: 0.8 },
          }),
        })
      );
    });

    it('should calculate high risk level for complex files with high confidence', async () => {
      mockPrisma.project.findUnique.mockResolvedValue(mockProject);
      mockPrisma.fileUseCaseLink.findMany.mockResolvedValue([
        {
          useCaseId: 'uc-123',
          filePath: 'complex.ts',
          confidence: 0.9,
          source: MappingSource.MANUAL,
          lastSeenAt: new Date(),
          occurrences: 10,
          useCase: { ...mockUseCase, storyLinks: [] },
        },
      ]);
      mockPrisma.codeMetrics.findMany.mockResolvedValue([
        {
          filePath: 'complex.ts',
          cyclomaticComplexity: 15,
          maintainabilityIndex: 50,
          riskScore: 60,
        },
      ]);
      mockPrisma.testCase.findMany.mockResolvedValue([
        {
          executions: [{ coveragePercentage: 50 }],
        },
      ]);

      const result = await service.getAffectedUseCases({
        projectId: 'proj-123',
        filePaths: ['complex.ts'],
      });

      expect(result.affectedUseCases[0].riskLevel).toBe('high');
      expect(result.summary.highRisk).toBe(1);
      expect(result.summary.recommendation).toContain('High impact');
    });

    it('should calculate medium risk level', async () => {
      mockPrisma.project.findUnique.mockResolvedValue(mockProject);
      mockPrisma.fileUseCaseLink.findMany.mockResolvedValue([
        {
          useCaseId: 'uc-123',
          filePath: 'medium.ts',
          confidence: 0.7,
          source: MappingSource.COMMIT_DERIVED,
          lastSeenAt: new Date(),
          occurrences: 3,
          useCase: { ...mockUseCase, storyLinks: [] },
        },
      ]);
      mockPrisma.codeMetrics.findMany.mockResolvedValue([
        {
          filePath: 'medium.ts',
          cyclomaticComplexity: 8,
          maintainabilityIndex: 65,
          riskScore: 35,
        },
      ]);
      mockPrisma.testCase.findMany.mockResolvedValue([]);

      const result = await service.getAffectedUseCases({
        projectId: 'proj-123',
        filePaths: ['medium.ts'],
      });

      expect(result.affectedUseCases[0].riskLevel).toBe('medium');
      expect(result.summary.mediumRisk).toBe(1);
    });

    it('should aggregate files for same use case', async () => {
      mockPrisma.project.findUnique.mockResolvedValue(mockProject);
      mockPrisma.fileUseCaseLink.findMany.mockResolvedValue([
        {
          useCaseId: 'uc-123',
          filePath: 'file1.ts',
          confidence: 0.8,
          source: MappingSource.COMMIT_DERIVED,
          lastSeenAt: new Date(),
          occurrences: 2,
          useCase: { ...mockUseCase, storyLinks: [] },
        },
        {
          useCaseId: 'uc-123',
          filePath: 'file2.ts',
          confidence: 0.9,
          source: MappingSource.MANUAL,
          lastSeenAt: new Date(),
          occurrences: 3,
          useCase: { ...mockUseCase, storyLinks: [] },
        },
      ]);
      mockPrisma.codeMetrics.findMany.mockResolvedValue([]);
      mockPrisma.testCase.findMany.mockResolvedValue([]);

      const result = await service.getAffectedUseCases({
        projectId: 'proj-123',
        filePaths: ['file1.ts', 'file2.ts'],
      });

      expect(result.affectedUseCases).toHaveLength(1);
      expect(result.affectedUseCases[0].affectedByFiles).toHaveLength(2);
      expect(result.affectedUseCases[0].confidence).toBe(0.9); // Max confidence
    });
  });

  // ==========================================================================
  // getImplementingFiles Tests
  // ==========================================================================

  describe('getImplementingFiles', () => {
    it('should throw NotFoundException if use case not found', async () => {
      mockPrisma.useCase.findFirst.mockResolvedValue(null);

      await expect(service.getImplementingFiles({
        projectId: 'proj-123',
        useCaseId: 'invalid',
      })).rejects.toThrow(NotFoundException);
    });

    it('should find implementing files by use case ID', async () => {
      mockPrisma.useCase.findFirst.mockResolvedValue({
        ...mockUseCase,
        storyLinks: [],
      });
      mockPrisma.fileUseCaseLink.findMany.mockResolvedValue([
        {
          filePath: 'auth.service.ts',
          confidence: 0.85,
          source: MappingSource.COMMIT_DERIVED,
          lastSeenAt: new Date(),
          occurrences: 5,
        },
      ]);
      mockPrisma.codeMetrics.findFirst.mockResolvedValue(null);
      mockPrisma.commitFile.findMany.mockResolvedValue([]);

      const result = await service.getImplementingFiles({
        projectId: 'proj-123',
        useCaseId: 'uc-123',
      });

      expect(result.useCase.id).toBe('uc-123');
      expect(result.implementingFiles).toHaveLength(1);
      expect(result.implementingFiles[0].filePath).toBe('auth.service.ts');
    });

    it('should find implementing files by use case key', async () => {
      mockPrisma.useCase.findFirst.mockResolvedValue({
        ...mockUseCase,
        storyLinks: [],
      });
      mockPrisma.fileUseCaseLink.findMany.mockResolvedValue([]);

      const result = await service.getImplementingFiles({
        projectId: 'proj-123',
        useCaseKey: 'UC-001',
      });

      expect(mockPrisma.useCase.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            key: 'UC-001',
          }),
        })
      );
    });

    it('should include code metrics when requested', async () => {
      mockPrisma.useCase.findFirst.mockResolvedValue({
        ...mockUseCase,
        storyLinks: [],
      });
      mockPrisma.fileUseCaseLink.findMany.mockResolvedValue([
        {
          filePath: 'test.ts',
          confidence: 0.9,
          source: MappingSource.MANUAL,
          lastSeenAt: new Date(),
          occurrences: 1,
        },
      ]);
      mockPrisma.codeMetrics.findFirst.mockResolvedValue({
        linesOfCode: 150,
        cyclomaticComplexity: 8,
        maintainabilityIndex: 75,
        testCoverage: 80,
        churnRate: 2,
        riskScore: 25,
      });
      mockPrisma.commitFile.findMany.mockResolvedValue([
        {
          commit: {
            hash: 'abc123',
            message: 'Test commit',
            author: 'dev@test.com',
            timestamp: new Date(),
          },
        },
      ]);

      const result = await service.getImplementingFiles({
        projectId: 'proj-123',
        useCaseId: 'uc-123',
        includeMetrics: true,
      });

      expect(result.implementingFiles[0].metrics).toBeDefined();
      expect(result.implementingFiles[0].metrics?.linesOfCode).toBe(150);
      expect(result.implementingFiles[0].recentCommits).toHaveLength(1);
    });

    it('should calculate summary statistics', async () => {
      mockPrisma.useCase.findFirst.mockResolvedValue({
        ...mockUseCase,
        storyLinks: [],
      });
      mockPrisma.fileUseCaseLink.findMany.mockResolvedValue([
        {
          filePath: 'file1.ts',
          confidence: 0.8,
          source: MappingSource.COMMIT_DERIVED,
          lastSeenAt: new Date(),
          occurrences: 2,
        },
        {
          filePath: 'file2.ts',
          confidence: 0.9,
          source: MappingSource.MANUAL,
          lastSeenAt: new Date(),
          occurrences: 3,
        },
      ]);
      mockPrisma.codeMetrics.findFirst
        .mockResolvedValueOnce({
          linesOfCode: 100,
          cyclomaticComplexity: 5,
          maintainabilityIndex: 80,
          testCoverage: 90,
          churnRate: 1,
          riskScore: 20,
        })
        .mockResolvedValueOnce({
          linesOfCode: 200,
          cyclomaticComplexity: 10,
          maintainabilityIndex: 70,
          testCoverage: 70,
          churnRate: 2,
          riskScore: 30,
        });
      mockPrisma.commitFile.findMany.mockResolvedValue([]);

      const result = await service.getImplementingFiles({
        projectId: 'proj-123',
        useCaseId: 'uc-123',
        includeMetrics: true,
      });

      expect(result.summary.totalFiles).toBe(2);
      expect(result.summary.totalLOC).toBe(300);
      expect(result.summary.avgComplexity).toBeCloseTo(7.5, 1);
      expect(result.summary.avgMaintainability).toBeCloseTo(75, 1);
      expect(result.summary.avgTestCoverage).toBeCloseTo(80, 1);
      expect(result.summary.avgConfidence).toBeCloseTo(0.85, 2);
    });

    it('should identify high risk files in summary', async () => {
      mockPrisma.useCase.findFirst.mockResolvedValue({
        ...mockUseCase,
        storyLinks: [],
      });
      mockPrisma.fileUseCaseLink.findMany.mockResolvedValue([
        {
          filePath: 'risky.ts',
          confidence: 0.9,
          source: MappingSource.COMMIT_DERIVED,
          lastSeenAt: new Date(),
          occurrences: 5,
        },
      ]);
      mockPrisma.codeMetrics.findFirst.mockResolvedValue({
        linesOfCode: 500,
        cyclomaticComplexity: 20,
        maintainabilityIndex: 40,
        testCoverage: 30,
        churnRate: 5,
        riskScore: 80,
      });
      mockPrisma.commitFile.findMany.mockResolvedValue([]);

      const result = await service.getImplementingFiles({
        projectId: 'proj-123',
        useCaseId: 'uc-123',
        includeMetrics: true,
      });

      expect(result.summary.highRiskFiles).toBe(1);
      expect(result.summary.recommendation).toContain('high-risk');
    });

    it('should recommend more tests when coverage is low', async () => {
      mockPrisma.useCase.findFirst.mockResolvedValue({
        ...mockUseCase,
        storyLinks: [],
      });
      mockPrisma.fileUseCaseLink.findMany.mockResolvedValue([
        {
          filePath: 'test.ts',
          confidence: 0.8,
          source: MappingSource.COMMIT_DERIVED,
          lastSeenAt: new Date(),
          occurrences: 1,
        },
      ]);
      mockPrisma.codeMetrics.findFirst.mockResolvedValue({
        linesOfCode: 100,
        cyclomaticComplexity: 5,
        maintainabilityIndex: 75,
        testCoverage: 50,
        churnRate: 1,
        riskScore: 25,
      });
      mockPrisma.commitFile.findMany.mockResolvedValue([]);

      const result = await service.getImplementingFiles({
        projectId: 'proj-123',
        useCaseId: 'uc-123',
        includeMetrics: true,
      });

      expect(result.summary.recommendation).toContain('test coverage');
    });
  });

  // ==========================================================================
  // calculateUseCaseTestCoverage Tests
  // ==========================================================================

  describe('calculateUseCaseTestCoverage', () => {
    it('should return 0 when no test cases exist', async () => {
      mockPrisma.testCase.findMany.mockResolvedValue([]);

      const coverage = await (service as any).calculateUseCaseTestCoverage('uc-123');

      expect(coverage).toBe(0);
    });

    it('should calculate average coverage from test executions', async () => {
      mockPrisma.testCase.findMany.mockResolvedValue([
        { executions: [{ coveragePercentage: 80 }] },
        { executions: [{ coveragePercentage: 90 }] },
      ]);

      const coverage = await (service as any).calculateUseCaseTestCoverage('uc-123');

      expect(coverage).toBe(85);
    });

    it('should return 0 when no executions have coverage', async () => {
      mockPrisma.testCase.findMany.mockResolvedValue([
        { executions: [] },
        { executions: [{ coveragePercentage: null }] },
      ]);

      const coverage = await (service as any).calculateUseCaseTestCoverage('uc-123');

      expect(coverage).toBe(0);
    });
  });

  // ==========================================================================
  // createOrUpdateMapping Tests
  // ==========================================================================

  describe('createOrUpdateMapping', () => {
    it('should create new mapping when none exists', async () => {
      mockPrisma.fileUseCaseLink.findUnique.mockResolvedValue(null);
      mockPrisma.fileUseCaseLink.create.mockResolvedValue({ id: 'link-123' });

      const created = await service.createOrUpdateMapping({
        projectId: 'proj-123',
        filePath: 'test.ts',
        useCaseId: 'uc-123',
        source: MappingSource.MANUAL,
        confidence: 0.95,
      });

      expect(created).toBe(true);
      expect(mockPrisma.fileUseCaseLink.create).toHaveBeenCalledWith({
        data: {
          projectId: 'proj-123',
          filePath: 'test.ts',
          useCaseId: 'uc-123',
          source: MappingSource.MANUAL,
          confidence: 0.95,
        },
      });
    });

    it('should update existing mapping', async () => {
      mockPrisma.fileUseCaseLink.findUnique.mockResolvedValue({
        id: 'link-123',
        occurrences: 2,
        confidence: 0.7,
      });
      mockPrisma.fileUseCaseLink.update.mockResolvedValue({ id: 'link-123' });

      const created = await service.createOrUpdateMapping({
        projectId: 'proj-123',
        filePath: 'test.ts',
        useCaseId: 'uc-123',
        source: MappingSource.COMMIT_DERIVED,
        confidence: 0.9,
      });

      expect(created).toBe(false);
      expect(mockPrisma.fileUseCaseLink.update).toHaveBeenCalledWith({
        where: { id: 'link-123' },
        data: {
          occurrences: { increment: 1 },
          confidence: 0.9, // Max of existing 0.7 and new 0.9
          source: MappingSource.COMMIT_DERIVED,
          lastSeenAt: expect.any(Date),
        },
      });
    });

    it('should use default confidence of 1.0', async () => {
      mockPrisma.fileUseCaseLink.findUnique.mockResolvedValue(null);
      mockPrisma.fileUseCaseLink.create.mockResolvedValue({ id: 'link-123' });

      await service.createOrUpdateMapping({
        projectId: 'proj-123',
        filePath: 'test.ts',
        useCaseId: 'uc-123',
        source: MappingSource.MANUAL,
      });

      expect(mockPrisma.fileUseCaseLink.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            confidence: 1.0,
          }),
        })
      );
    });
  });

  // ==========================================================================
  // createMappingsFromCommit Tests
  // ==========================================================================

  describe('createMappingsFromCommit', () => {
    it('should return 0 when commit not found', async () => {
      mockPrisma.commit.findUnique.mockResolvedValue(null);

      const count = await service.createMappingsFromCommit('abc123');

      expect(count).toBe(0);
    });

    it('should return 0 when commit has no story', async () => {
      mockPrisma.commit.findUnique.mockResolvedValue({
        hash: 'abc123',
        files: [],
        story: null,
      });

      const count = await service.createMappingsFromCommit('abc123');

      expect(count).toBe(0);
    });

    it('should return 0 when story has no use case links', async () => {
      mockPrisma.commit.findUnique.mockResolvedValue({
        hash: 'abc123',
        files: [],
        story: { useCaseLinks: [] },
      });

      const count = await service.createMappingsFromCommit('abc123');

      expect(count).toBe(0);
    });

    it('should create mappings for all file-usecase combinations', async () => {
      mockPrisma.commit.findUnique.mockResolvedValue({
        hash: 'abc123',
        projectId: 'proj-123',
        files: [
          { filePath: 'file1.ts' },
          { filePath: 'file2.ts' },
        ],
        story: {
          useCaseLinks: [
            { useCaseId: 'uc-1' },
            { useCaseId: 'uc-2' },
          ],
        },
      });
      mockPrisma.fileUseCaseLink.findUnique.mockResolvedValue(null);
      mockPrisma.fileUseCaseLink.create.mockResolvedValue({ id: 'link' });

      const count = await service.createMappingsFromCommit('abc123');

      expect(count).toBe(4); // 2 files × 2 use cases
      expect(mockPrisma.fileUseCaseLink.create).toHaveBeenCalledTimes(4);
    });

    it('should use COMMIT_DERIVED source with 0.8 confidence', async () => {
      mockPrisma.commit.findUnique.mockResolvedValue({
        hash: 'abc123',
        projectId: 'proj-123',
        files: [{ filePath: 'file1.ts' }],
        story: {
          useCaseLinks: [{ useCaseId: 'uc-1' }],
        },
      });
      mockPrisma.fileUseCaseLink.findUnique.mockResolvedValue(null);
      mockPrisma.fileUseCaseLink.create.mockResolvedValue({ id: 'link' });

      await service.createMappingsFromCommit('abc123');

      expect(mockPrisma.fileUseCaseLink.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            source: 'COMMIT_DERIVED',
            confidence: 0.8,
          }),
        })
      );
    });

    it('should count only newly created mappings', async () => {
      mockPrisma.commit.findUnique.mockResolvedValue({
        hash: 'abc123',
        projectId: 'proj-123',
        files: [{ filePath: 'file1.ts' }],
        story: {
          useCaseLinks: [
            { useCaseId: 'uc-1' },
            { useCaseId: 'uc-2' },
          ],
        },
      });
      mockPrisma.fileUseCaseLink.findUnique
        .mockResolvedValueOnce(null) // uc-1: new
        .mockResolvedValueOnce({ id: 'existing' }); // uc-2: existing
      mockPrisma.fileUseCaseLink.create.mockResolvedValue({ id: 'new' });
      mockPrisma.fileUseCaseLink.update.mockResolvedValue({ id: 'updated' });

      const count = await service.createMappingsFromCommit('abc123');

      expect(count).toBe(1); // Only the newly created one
    });
  });
});
