import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { MappingSource } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ImpactAnalysisService } from './impact-analysis.service';

describe('ImpactAnalysisService', () => {
  let service: ImpactAnalysisService;
  let prisma: PrismaService;

  const mockPrismaService = {
    project: {
      findUnique: jest.fn(),
    },
    fileUseCaseLink: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    useCase: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    testCase: {
      findMany: jest.fn(),
    },
    codeMetrics: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
    },
    commitFile: {
      findMany: jest.fn(),
    },
    commit: {
      findUnique: jest.fn(),
    },
    storyUseCaseLink: {
      findMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ImpactAnalysisService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<ImpactAnalysisService>(ImpactAnalysisService);
    prisma = module.get<PrismaService>(PrismaService);

    // Reset all mocks before each test
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getAffectedUseCases', () => {
    it('should throw NotFoundException if project does not exist', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue(null);

      await expect(
        service.getAffectedUseCases({
          projectId: 'non-existent',
          filePaths: ['file1.ts'],
        }),
      ).rejects.toThrow(NotFoundException);

      expect(mockPrismaService.project.findUnique).toHaveBeenCalledWith({
        where: { id: 'non-existent' },
      });
    });

    it('should return empty results when no mappings exist', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue({
        id: 'proj-1',
        name: 'Test Project',
      });
      mockPrismaService.fileUseCaseLink.findMany.mockResolvedValue([]);

      const result = await service.getAffectedUseCases({
        projectId: 'proj-1',
        filePaths: ['file1.ts'],
      });

      expect(result.affectedUseCases).toHaveLength(0);
      expect(result.summary.totalUseCases).toBe(0);
      expect(result.summary.recommendation).toBe('No use cases affected.');
    });

    it('should return affected use cases with correct risk levels', async () => {
      const mockProject = {
        id: 'proj-1',
        name: 'Test Project',
      };

      const mockMappings = [
        {
          useCaseId: 'uc-1',
          filePath: 'backend/src/auth/login.service.ts',
          confidence: 0.85,
          source: MappingSource.COMMIT_DERIVED,
          lastSeenAt: new Date(),
          occurrences: 12,
          useCase: {
            id: 'uc-1',
            key: 'UC-AUTH-001',
            title: 'User Login',
            area: 'Authentication',
            storyLinks: [
              {
                story: {
                  key: 'ST-45',
                  title: 'Implement SSO',
                  status: 'in_progress',
                },
              },
            ],
          },
        },
      ];

      const mockCodeMetrics = [
        {
          filePath: 'backend/src/auth/login.service.ts',
          cyclomaticComplexity: 12,
          maintainabilityIndex: 55,
          riskScore: 65,
        },
      ];

      mockPrismaService.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaService.fileUseCaseLink.findMany.mockResolvedValue(
        mockMappings,
      );
      mockPrismaService.testCase.findMany.mockResolvedValue([
        {
          executions: [
            {
              coveragePercentage: 65.0,
            },
          ],
        },
      ]);
      mockPrismaService.codeMetrics.findMany.mockResolvedValue(
        mockCodeMetrics,
      );

      const result = await service.getAffectedUseCases({
        projectId: 'proj-1',
        filePaths: ['backend/src/auth/login.service.ts'],
      });

      expect(result.affectedUseCases).toHaveLength(1);
      expect(result.affectedUseCases[0].useCaseKey).toBe('UC-AUTH-001');
      expect(result.affectedUseCases[0].riskLevel).toBe('high');
      expect(result.affectedUseCases[0].testCoverage).toBe(65);
      expect(result.summary.highRisk).toBe(1);
      expect(result.summary.recommendation).toContain('High impact');
    });

    it('should filter by minimum confidence', async () => {
      const mockProject = { id: 'proj-1', name: 'Test' };
      const mockMappings = [
        {
          useCaseId: 'uc-1',
          filePath: 'file1.ts',
          confidence: 0.4, // Below threshold
          source: MappingSource.AI_INFERRED,
          lastSeenAt: new Date(),
          occurrences: 1,
          useCase: {
            id: 'uc-1',
            key: 'UC-001',
            title: 'Test',
            area: null,
            storyLinks: [],
          },
        },
      ];

      mockPrismaService.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaService.fileUseCaseLink.findMany.mockResolvedValue([]);

      await service.getAffectedUseCases({
        projectId: 'proj-1',
        filePaths: ['file1.ts'],
        minConfidence: 0.5,
      });

      expect(mockPrismaService.fileUseCaseLink.findMany).toHaveBeenCalledWith({
        where: {
          projectId: 'proj-1',
          filePath: { in: ['file1.ts'] },
          confidence: { gte: 0.5 },
        },
        include: expect.any(Object),
        orderBy: { confidence: 'desc' },
      });
    });

    it('should calculate medium risk level correctly', async () => {
      const mockProject = { id: 'proj-1', name: 'Test' };
      const mockMappings = [
        {
          useCaseId: 'uc-1',
          filePath: 'file1.ts',
          confidence: 0.65,
          source: MappingSource.COMMIT_DERIVED,
          lastSeenAt: new Date(),
          occurrences: 5,
          useCase: {
            id: 'uc-1',
            key: 'UC-001',
            title: 'Test',
            area: null,
            storyLinks: [],
          },
        },
      ];

      const mockMetrics = [
        {
          filePath: 'file1.ts',
          cyclomaticComplexity: 8,
          maintainabilityIndex: 65,
          riskScore: 35,
        },
      ];

      mockPrismaService.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaService.fileUseCaseLink.findMany.mockResolvedValue(
        mockMappings,
      );
      mockPrismaService.testCase.findMany.mockResolvedValue([]);
      mockPrismaService.codeMetrics.findMany.mockResolvedValue(mockMetrics);

      const result = await service.getAffectedUseCases({
        projectId: 'proj-1',
        filePaths: ['file1.ts'],
      });

      expect(result.affectedUseCases[0].riskLevel).toBe('medium');
      expect(result.summary.mediumRisk).toBe(1);
    });
  });

  describe('getImplementingFiles', () => {
    it('should throw NotFoundException if use case does not exist', async () => {
      mockPrismaService.useCase.findFirst.mockResolvedValue(null);

      await expect(
        service.getImplementingFiles({
          projectId: 'proj-1',
          useCaseKey: 'UC-NONEXISTENT',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should return implementing files with metrics', async () => {
      const mockUseCase = {
        id: 'uc-1',
        key: 'UC-AUTH-001',
        title: 'User Login',
        area: 'Authentication',
        storyLinks: [
          {
            story: {
              key: 'ST-45',
              title: 'Implement SSO',
              status: 'in_progress',
            },
          },
        ],
      };

      const mockMappings = [
        {
          filePath: 'backend/src/auth/login.service.ts',
          confidence: 0.85,
          source: MappingSource.COMMIT_DERIVED,
          lastSeenAt: new Date(),
          occurrences: 12,
        },
      ];

      const mockMetrics = {
        linesOfCode: 245,
        cyclomaticComplexity: 8.5,
        maintainabilityIndex: 72,
        testCoverage: 85.0,
        churnRate: 3,
        riskScore: 24.5,
      };

      const mockCommits = [
        {
          commit: {
            hash: 'abc1234567890',
            message: 'Fix login validation',
            author: 'john@example.com',
            timestamp: new Date('2025-11-10T10:30:00Z'),
          },
        },
      ];

      mockPrismaService.useCase.findFirst.mockResolvedValue(mockUseCase);
      mockPrismaService.fileUseCaseLink.findMany.mockResolvedValue(
        mockMappings,
      );
      mockPrismaService.codeMetrics.findFirst.mockResolvedValue(mockMetrics);
      mockPrismaService.commitFile.findMany.mockResolvedValue(mockCommits);

      const result = await service.getImplementingFiles({
        projectId: 'proj-1',
        useCaseKey: 'UC-AUTH-001',
        includeMetrics: true,
      });

      expect(result.implementingFiles).toHaveLength(1);
      expect(result.implementingFiles[0].filePath).toBe(
        'backend/src/auth/login.service.ts',
      );
      expect(result.implementingFiles[0].metrics).toEqual({
        linesOfCode: 245,
        cyclomaticComplexity: 8.5,
        maintainabilityIndex: 72,
        testCoverage: 85.0,
        churnRate: 3,
        riskScore: 24.5,
      });
      expect(result.implementingFiles[0].recentCommits).toHaveLength(1);
      expect(result.summary.totalFiles).toBe(1);
      expect(result.summary.totalLOC).toBe(245);
    });

    it('should find use case by ID or key', async () => {
      const mockUseCase = {
        id: 'uc-1',
        key: 'UC-001',
        title: 'Test',
        area: null,
        storyLinks: [],
      };

      mockPrismaService.useCase.findFirst.mockResolvedValue(mockUseCase);
      mockPrismaService.fileUseCaseLink.findMany.mockResolvedValue([]);

      // Test with useCaseId
      await service.getImplementingFiles({
        projectId: 'proj-1',
        useCaseId: 'uc-1',
      });

      expect(mockPrismaService.useCase.findFirst).toHaveBeenCalledWith({
        where: {
          projectId: 'proj-1',
          id: 'uc-1',
        },
        include: expect.any(Object),
      });

      jest.clearAllMocks();
      mockPrismaService.useCase.findFirst.mockResolvedValue(mockUseCase);
      mockPrismaService.fileUseCaseLink.findMany.mockResolvedValue([]);

      // Test with useCaseKey
      await service.getImplementingFiles({
        projectId: 'proj-1',
        useCaseKey: 'UC-001',
      });

      expect(mockPrismaService.useCase.findFirst).toHaveBeenCalledWith({
        where: {
          projectId: 'proj-1',
          key: 'UC-001',
        },
        include: expect.any(Object),
      });
    });

    it('should calculate summary statistics correctly', async () => {
      const mockUseCase = {
        id: 'uc-1',
        key: 'UC-001',
        title: 'Test',
        area: null,
        storyLinks: [],
      };

      const mockMappings = [
        {
          filePath: 'file1.ts',
          confidence: 0.8,
          source: MappingSource.COMMIT_DERIVED,
          lastSeenAt: new Date(),
          occurrences: 5,
        },
        {
          filePath: 'file2.ts',
          confidence: 0.9,
          source: MappingSource.MANUAL,
          lastSeenAt: new Date(),
          occurrences: 10,
        },
      ];

      mockPrismaService.useCase.findFirst.mockResolvedValue(mockUseCase);
      mockPrismaService.fileUseCaseLink.findMany.mockResolvedValue(
        mockMappings,
      );

      // First file metrics
      mockPrismaService.codeMetrics.findFirst
        .mockResolvedValueOnce({
          linesOfCode: 100,
          cyclomaticComplexity: 5,
          maintainabilityIndex: 80,
          testCoverage: 90,
          churnRate: 2,
          riskScore: 20,
        })
        // Second file metrics
        .mockResolvedValueOnce({
          linesOfCode: 200,
          cyclomaticComplexity: 10,
          maintainabilityIndex: 70,
          testCoverage: 80,
          churnRate: 4,
          riskScore: 30,
        });

      mockPrismaService.commitFile.findMany.mockResolvedValue([]);

      const result = await service.getImplementingFiles({
        projectId: 'proj-1',
        useCaseId: 'uc-1',
      });

      expect(result.summary.totalFiles).toBe(2);
      expect(result.summary.totalLOC).toBe(300);
      expect(result.summary.avgComplexity).toBeCloseTo(7.5, 1);
      expect(result.summary.avgMaintainability).toBe(75);
      expect(result.summary.avgTestCoverage).toBeCloseTo(85, 1);
      expect(result.summary.avgConfidence).toBeCloseTo(0.85, 2);
    });

    it('should skip metrics when includeMetrics is false', async () => {
      const mockUseCase = {
        id: 'uc-1',
        key: 'UC-001',
        title: 'Test',
        area: null,
        storyLinks: [],
      };

      const mockMappings = [
        {
          filePath: 'file1.ts',
          confidence: 0.8,
          source: MappingSource.COMMIT_DERIVED,
          lastSeenAt: new Date(),
          occurrences: 5,
        },
      ];

      mockPrismaService.useCase.findFirst.mockResolvedValue(mockUseCase);
      mockPrismaService.fileUseCaseLink.findMany.mockResolvedValue(
        mockMappings,
      );

      const result = await service.getImplementingFiles({
        projectId: 'proj-1',
        useCaseId: 'uc-1',
        includeMetrics: false,
      });

      expect(result.implementingFiles[0].metrics).toBeUndefined();
      expect(result.implementingFiles[0].recentCommits).toBeUndefined();
      expect(mockPrismaService.codeMetrics.findFirst).not.toHaveBeenCalled();
      expect(mockPrismaService.commitFile.findMany).not.toHaveBeenCalled();
    });
  });

  describe('createOrUpdateMapping', () => {
    it('should create new mapping when it does not exist', async () => {
      mockPrismaService.fileUseCaseLink.findUnique.mockResolvedValue(null);
      mockPrismaService.fileUseCaseLink.create.mockResolvedValue({
        id: 'mapping-1',
        projectId: 'proj-1',
        filePath: 'file1.ts',
        useCaseId: 'uc-1',
        source: MappingSource.MANUAL,
        confidence: 1.0,
      });

      await service.createOrUpdateMapping({
        projectId: 'proj-1',
        filePath: 'file1.ts',
        useCaseId: 'uc-1',
        source: MappingSource.MANUAL,
      });

      expect(mockPrismaService.fileUseCaseLink.create).toHaveBeenCalledWith({
        data: {
          projectId: 'proj-1',
          filePath: 'file1.ts',
          useCaseId: 'uc-1',
          source: MappingSource.MANUAL,
          confidence: 1.0,
        },
      });
    });

    it('should update existing mapping and increment occurrences', async () => {
      const existingMapping = {
        id: 'mapping-1',
        projectId: 'proj-1',
        filePath: 'file1.ts',
        useCaseId: 'uc-1',
        source: MappingSource.COMMIT_DERIVED,
        confidence: 0.7,
        occurrences: 5,
      };

      mockPrismaService.fileUseCaseLink.findUnique.mockResolvedValue(
        existingMapping,
      );
      mockPrismaService.fileUseCaseLink.update.mockResolvedValue({
        ...existingMapping,
        confidence: 0.85,
        occurrences: 6,
      });

      await service.createOrUpdateMapping({
        projectId: 'proj-1',
        filePath: 'file1.ts',
        useCaseId: 'uc-1',
        source: MappingSource.COMMIT_DERIVED,
        confidence: 0.85,
      });

      expect(mockPrismaService.fileUseCaseLink.update).toHaveBeenCalledWith({
        where: { id: 'mapping-1' },
        data: {
          occurrences: { increment: 1 },
          confidence: 0.85, // Higher confidence
          source: MappingSource.COMMIT_DERIVED,
          lastSeenAt: expect.any(Date),
        },
      });
    });

    it('should use default confidence of 1.0 when not provided', async () => {
      mockPrismaService.fileUseCaseLink.findUnique.mockResolvedValue(null);
      mockPrismaService.fileUseCaseLink.create.mockResolvedValue({});

      await service.createOrUpdateMapping({
        projectId: 'proj-1',
        filePath: 'file1.ts',
        useCaseId: 'uc-1',
        source: MappingSource.MANUAL,
      });

      expect(mockPrismaService.fileUseCaseLink.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          confidence: 1.0,
        }),
      });
    });
  });

  describe('createMappingsFromCommit', () => {
    it('should return 0 when commit has no story', async () => {
      mockPrismaService.commit.findUnique.mockResolvedValue({
        hash: 'abc123',
        projectId: 'proj-1',
        storyId: null,
        story: null,
        files: [],
      });

      const count = await service.createMappingsFromCommit('abc123');

      expect(count).toBe(0);
      expect(mockPrismaService.fileUseCaseLink.create).not.toHaveBeenCalled();
    });

    it('should return 0 when story has no use case links', async () => {
      mockPrismaService.commit.findUnique.mockResolvedValue({
        hash: 'abc123',
        projectId: 'proj-1',
        storyId: 'story-1',
        story: {
          useCaseLinks: [],
        },
        files: [{ filePath: 'file1.ts' }],
      });

      const count = await service.createMappingsFromCommit('abc123');

      expect(count).toBe(0);
    });

    it('should create mappings for all file-usecase combinations', async () => {
      mockPrismaService.commit.findUnique.mockResolvedValue({
        hash: 'abc123',
        projectId: 'proj-1',
        storyId: 'story-1',
        story: {
          useCaseLinks: [
            { useCaseId: 'uc-1' },
            { useCaseId: 'uc-2' },
          ],
        },
        files: [
          { filePath: 'file1.ts' },
          { filePath: 'file2.ts' },
        ],
      });

      mockPrismaService.fileUseCaseLink.findUnique.mockResolvedValue(null);
      mockPrismaService.fileUseCaseLink.create.mockResolvedValue({});

      const count = await service.createMappingsFromCommit('abc123');

      // 2 files × 2 use cases = 4 mappings
      expect(count).toBe(4);
      expect(mockPrismaService.fileUseCaseLink.create).toHaveBeenCalledTimes(
        4,
      );
    });

    it('should update existing mappings instead of creating duplicates', async () => {
      mockPrismaService.commit.findUnique.mockResolvedValue({
        hash: 'abc123',
        projectId: 'proj-1',
        storyId: 'story-1',
        story: {
          useCaseLinks: [{ useCaseId: 'uc-1' }],
        },
        files: [{ filePath: 'file1.ts' }],
      });

      mockPrismaService.fileUseCaseLink.findUnique.mockResolvedValue({
        id: 'existing-1',
        occurrences: 3,
        confidence: 0.8,
      });
      mockPrismaService.fileUseCaseLink.update.mockResolvedValue({});

      const count = await service.createMappingsFromCommit('abc123');

      expect(count).toBe(0); // No new mappings created
      expect(mockPrismaService.fileUseCaseLink.update).toHaveBeenCalledWith({
        where: { id: 'existing-1' },
        data: {
          occurrences: { increment: 1 },
          confidence: 0.8, // Math.max(existing.confidence, 0.8)
          source: 'COMMIT_DERIVED',
          lastSeenAt: expect.any(Date),
        },
      });
    });
  });
});
