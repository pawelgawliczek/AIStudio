/**
 * ST-18: Tests for Snapshot Creation in Code Analysis Worker
 *
 * Tests the createSnapshot() method to ensure it:
 * 1. Creates snapshots after each analysis
 * 2. Stores correct aggregated metrics
 * 3. Handles errors gracefully without failing analysis
 */

import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../../prisma/prisma.service';
import { CodeAnalysisProcessor } from '../code-analysis.processor';

describe('CodeAnalysisProcessor - Snapshot Creation (ST-18)', () => {
  let processor: CodeAnalysisProcessor;
  let prisma: PrismaService;

  const mockProjectId = '345a29ee-d6ab-477d-8079-c5dda0844d77';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CodeAnalysisProcessor,
        {
          provide: PrismaService,
          useValue: {
            codeMetrics: {
              aggregate: jest.fn(),
              findMany: jest.fn(),
              findFirst: jest.fn(),
              upsert: jest.fn(),
            },
            codeMetricsSnapshot: {
              create: jest.fn(),
            },
            project: {
              findUnique: jest.fn(),
            },
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'OPENAI_API_KEY') return 'mock-key';
              return null;
            }),
          },
        },
      ],
    }).compile();

    processor = module.get<CodeAnalysisProcessor>(CodeAnalysisProcessor);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Snapshot Creation', () => {
    it('should create snapshot with correct aggregated metrics', async () => {
      // Arrange
      const mockStats = {
        _avg: {
          maintainabilityIndex: 75.0,
          cyclomaticComplexity: 8.5,
          testCoverage: 65.0,
        },
        _sum: {
          codeSmellCount: 50,
          linesOfCode: 80000,
        },
        _count: {
          filePath: 500,
        },
      };

      const expectedHealthScore = 75.0 - 0 - 5; // maintainability - complexityPenalty - smellPenalty
      const expectedTechDebt = 100 - 75.0; // 100 - maintainability

      (prisma.codeMetrics.aggregate as jest.Mock).mockResolvedValue(mockStats);
      (prisma.codeMetricsSnapshot.create as jest.Mock).mockResolvedValue({
        id: 'snapshot-1',
        projectId: mockProjectId,
        snapshotDate: new Date(),
      });

      // Act - Call updateProjectHealth which calls createSnapshot
      await (processor as any).updateProjectHealth(mockProjectId);

      // Assert
      expect(prisma.codeMetricsSnapshot.create).toHaveBeenCalledWith({
        data: {
          projectId: mockProjectId,
          snapshotDate: expect.any(Date),
          totalFiles: 500,
          totalLOC: 80000,
          avgComplexity: 8.5,
          avgCoverage: 65.0,
          healthScore: expectedHealthScore,
          techDebtRatio: expectedTechDebt,
        },
      });
    });

    it('should calculate tech debt ratio from maintainability index', async () => {
      // Arrange
      const mockStats = {
        _avg: {
          maintainabilityIndex: 80.0,
          cyclomaticComplexity: 5.0,
          testCoverage: 70.0,
        },
        _sum: {
          codeSmellCount: 20,
          linesOfCode: 50000,
        },
        _count: {
          filePath: 300,
        },
      };

      (prisma.codeMetrics.aggregate as jest.Mock).mockResolvedValue(mockStats);
      (prisma.codeMetricsSnapshot.create as jest.Mock).mockResolvedValue({
        id: 'snapshot-1',
        projectId: mockProjectId,
      });

      // Act
      await (processor as any).updateProjectHealth(mockProjectId);

      // Assert
      const createCall = (prisma.codeMetricsSnapshot.create as jest.Mock).mock.calls[0][0];
      expect(createCall.data.techDebtRatio).toBe(20.0); // 100 - 80
    });

    it('should handle zero/null values gracefully', async () => {
      // Arrange
      const mockStats = {
        _avg: {
          maintainabilityIndex: 0,
          cyclomaticComplexity: 0,
          testCoverage: 0,
        },
        _sum: {
          codeSmellCount: 0,
          linesOfCode: 0,
        },
        _count: {
          filePath: 0,
        },
      };

      (prisma.codeMetrics.aggregate as jest.Mock).mockResolvedValue(mockStats);
      (prisma.codeMetricsSnapshot.create as jest.Mock).mockResolvedValue({
        id: 'snapshot-1',
        projectId: mockProjectId,
      });

      // Act
      await (processor as any).updateProjectHealth(mockProjectId);

      // Assert
      expect(prisma.codeMetricsSnapshot.create).toHaveBeenCalledWith({
        data: {
          projectId: mockProjectId,
          snapshotDate: expect.any(Date),
          totalFiles: 0,
          totalLOC: 0,
          avgComplexity: 0,
          avgCoverage: 0,
          healthScore: 0,
          techDebtRatio: 100, // 100 - 0
        },
      });
    });

    it('should not fail analysis if snapshot creation fails', async () => {
      // Arrange
      const mockStats = {
        _avg: {
          maintainabilityIndex: 75.0,
          cyclomaticComplexity: 8.5,
          testCoverage: 65.0,
        },
        _sum: {
          codeSmellCount: 50,
          linesOfCode: 80000,
        },
        _count: {
          filePath: 500,
        },
      };

      (prisma.codeMetrics.aggregate as jest.Mock).mockResolvedValue(mockStats);
      (prisma.codeMetricsSnapshot.create as jest.Mock).mockRejectedValue(
        new Error('Database constraint violation')
      );

      // Act & Assert - Should not throw error
      await expect(
        (processor as any).updateProjectHealth(mockProjectId)
      ).resolves.not.toThrow();
    });

    it('should use current timestamp for snapshotDate', async () => {
      // Arrange
      const beforeTest = new Date();
      const mockStats = {
        _avg: {
          maintainabilityIndex: 75.0,
          cyclomaticComplexity: 8.5,
          testCoverage: 65.0,
        },
        _sum: {
          codeSmellCount: 50,
          linesOfCode: 80000,
        },
        _count: {
          filePath: 500,
        },
      };

      (prisma.codeMetrics.aggregate as jest.Mock).mockResolvedValue(mockStats);
      (prisma.codeMetricsSnapshot.create as jest.Mock).mockResolvedValue({
        id: 'snapshot-1',
        projectId: mockProjectId,
      });

      // Act
      await (processor as any).updateProjectHealth(mockProjectId);
      const afterTest = new Date();

      // Assert
      const createCall = (prisma.codeMetricsSnapshot.create as jest.Mock).mock.calls[0][0];
      const snapshotDate = createCall.data.snapshotDate;

      expect(snapshotDate.getTime()).toBeGreaterThanOrEqual(beforeTest.getTime());
      expect(snapshotDate.getTime()).toBeLessThanOrEqual(afterTest.getTime());
    });
  });

  describe('Health Score Calculation', () => {
    it('should apply complexity penalty correctly', async () => {
      // Arrange
      const mockStats = {
        _avg: {
          maintainabilityIndex: 75.0,
          cyclomaticComplexity: 25.0, // High complexity (penalty = min(20, 25-10) = 15)
          testCoverage: 65.0,
        },
        _sum: {
          codeSmellCount: 0,
          linesOfCode: 80000,
        },
        _count: {
          filePath: 500,
        },
      };

      (prisma.codeMetrics.aggregate as jest.Mock).mockResolvedValue(mockStats);
      (prisma.codeMetricsSnapshot.create as jest.Mock).mockResolvedValue({
        id: 'snapshot-1',
        projectId: mockProjectId,
      });

      // Act
      await (processor as any).updateProjectHealth(mockProjectId);

      // Assert
      const createCall = (prisma.codeMetricsSnapshot.create as jest.Mock).mock.calls[0][0];
      // healthScore = 75 - 15 - 0 = 60
      expect(createCall.data.healthScore).toBe(60.0);
    });

    it('should apply smell penalty correctly', async () => {
      // Arrange
      const mockStats = {
        _avg: {
          maintainabilityIndex: 75.0,
          cyclomaticComplexity: 5.0, // Low complexity (no penalty)
          testCoverage: 65.0,
        },
        _sum: {
          codeSmellCount: 150, // High smell count (penalty = min(20, 150/10) = 15)
          linesOfCode: 80000,
        },
        _count: {
          filePath: 500,
        },
      };

      (prisma.codeMetrics.aggregate as jest.Mock).mockResolvedValue(mockStats);
      (prisma.codeMetricsSnapshot.create as jest.Mock).mockResolvedValue({
        id: 'snapshot-1',
        projectId: mockProjectId,
      });

      // Act
      await (processor as any).updateProjectHealth(mockProjectId);

      // Assert
      const createCall = (prisma.codeMetricsSnapshot.create as jest.Mock).mock.calls[0][0];
      // healthScore = 75 - 0 - 15 = 60
      expect(createCall.data.healthScore).toBe(60.0);
    });

    it('should never return negative health score', async () => {
      // Arrange
      const mockStats = {
        _avg: {
          maintainabilityIndex: 30.0,
          cyclomaticComplexity: 30.0, // Max penalty 20
          testCoverage: 10.0,
        },
        _sum: {
          codeSmellCount: 300, // Max penalty 20
          linesOfCode: 10000,
        },
        _count: {
          filePath: 100,
        },
      };

      (prisma.codeMetrics.aggregate as jest.Mock).mockResolvedValue(mockStats);
      (prisma.codeMetricsSnapshot.create as jest.Mock).mockResolvedValue({
        id: 'snapshot-1',
        projectId: mockProjectId,
      });

      // Act
      await (processor as any).updateProjectHealth(mockProjectId);

      // Assert
      const createCall = (prisma.codeMetricsSnapshot.create as jest.Mock).mock.calls[0][0];
      // healthScore = max(0, 30 - 20 - 20) = 0
      expect(createCall.data.healthScore).toBeGreaterThanOrEqual(0);
    });

    it('should never return health score above 100', async () => {
      // Arrange
      const mockStats = {
        _avg: {
          maintainabilityIndex: 100.0,
          cyclomaticComplexity: 1.0, // No penalty
          testCoverage: 100.0,
        },
        _sum: {
          codeSmellCount: 0, // No penalty
          linesOfCode: 100000,
        },
        _count: {
          filePath: 1000,
        },
      };

      (prisma.codeMetrics.aggregate as jest.Mock).mockResolvedValue(mockStats);
      (prisma.codeMetricsSnapshot.create as jest.Mock).mockResolvedValue({
        id: 'snapshot-1',
        projectId: mockProjectId,
      });

      // Act
      await (processor as any).updateProjectHealth(mockProjectId);

      // Assert
      const createCall = (prisma.codeMetricsSnapshot.create as jest.Mock).mock.calls[0][0];
      expect(createCall.data.healthScore).toBeLessThanOrEqual(100);
    });
  });
});
