/**
 * ST-18: Tests for Code Metrics Snapshot Trend Data
 *
 * Tests the getTrendData() method to ensure it:
 * 1. Queries real historical snapshots (not mocked data)
 * 2. Returns stable dates from database
 * 3. Contains no Math.random() values
 * 4. Handles empty snapshot cases gracefully
 */

import { Test, TestingModule } from '@nestjs/testing';
import { CodeMetricsService } from '../code-metrics.service';
import { PrismaService } from '../../prisma/prisma.service';
import { WorkersService } from '../../workers/workers.service';

describe('CodeMetricsService - getTrendData (ST-18)', () => {
  let service: CodeMetricsService;
  let prisma: PrismaService;

  const mockProjectId = '345a29ee-d6ab-477d-8079-c5dda0844d77';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CodeMetricsService,
        {
          provide: PrismaService,
          useValue: {
            codeMetricsSnapshot: {
              findMany: jest.fn(),
            },
            codeMetrics: {
              aggregate: jest.fn(),
              findMany: jest.fn(),
            },
            project: {
              findUnique: jest.fn(),
            },
          },
        },
        {
          provide: WorkersService,
          useValue: {
            analyzeProject: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<CodeMetricsService>(CodeMetricsService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Real Snapshot Query', () => {
    it('should query code_metrics_snapshots table', async () => {
      // Arrange
      const mockSnapshots = [
        {
          id: '1',
          projectId: mockProjectId,
          snapshotDate: new Date('2025-11-16T10:00:00Z'),
          totalFiles: 500,
          totalLOC: 80000,
          avgComplexity: 8.5,
          avgCoverage: 65.0,
          healthScore: 75.0,
          techDebtRatio: 15.0,
          metadata: null,
          analysisRunId: null,
          createdAt: new Date('2025-11-16T10:00:00Z'),
        },
        {
          id: '2',
          projectId: mockProjectId,
          snapshotDate: new Date('2025-11-17T10:00:00Z'),
          totalFiles: 510,
          totalLOC: 81000,
          avgComplexity: 8.3,
          avgCoverage: 66.5,
          healthScore: 76.0,
          techDebtRatio: 14.5,
          metadata: null,
          analysisRunId: null,
          createdAt: new Date('2025-11-17T10:00:00Z'),
        },
      ];

      (prisma.codeMetricsSnapshot.findMany as jest.Mock).mockResolvedValue(mockSnapshots);

      // Act
      const result = await service.getTrendData(mockProjectId, 30);

      // Assert
      expect(prisma.codeMetricsSnapshot.findMany).toHaveBeenCalledWith({
        where: {
          projectId: mockProjectId,
          snapshotDate: {
            gte: expect.any(Date),
          },
        },
        orderBy: {
          snapshotDate: 'asc',
        },
      });

      expect(result).toHaveLength(2);
    });

    it('should return stable dates from database (not recalculated)', async () => {
      // Arrange
      const fixedDate = new Date('2025-11-16T10:00:00Z');
      const mockSnapshots = [
        {
          id: '1',
          projectId: mockProjectId,
          snapshotDate: fixedDate,
          totalFiles: 500,
          totalLOC: 80000,
          avgComplexity: 8.5,
          avgCoverage: 65.0,
          healthScore: 75.0,
          techDebtRatio: 15.0,
          metadata: null,
          analysisRunId: null,
          createdAt: fixedDate,
        },
      ];

      (prisma.codeMetricsSnapshot.findMany as jest.Mock).mockResolvedValue(mockSnapshots);

      // Act - Call twice to verify dates don't change
      const result1 = await service.getTrendData(mockProjectId, 30);
      const result2 = await service.getTrendData(mockProjectId, 30);

      // Assert
      expect(result1[0].date).toEqual(fixedDate);
      expect(result2[0].date).toEqual(fixedDate);
      expect(result1[0].date.toISOString()).toBe(result2[0].date.toISOString());
    });

    it('should return real values without Math.random() noise', async () => {
      // Arrange
      const mockSnapshots = [
        {
          id: '1',
          projectId: mockProjectId,
          snapshotDate: new Date('2025-11-16T10:00:00Z'),
          totalFiles: 500,
          totalLOC: 80000,
          avgComplexity: 8.5,
          avgCoverage: 65.0,
          healthScore: 75.0,
          techDebtRatio: 15.0,
          metadata: null,
          analysisRunId: null,
          createdAt: new Date('2025-11-16T10:00:00Z'),
        },
      ];

      (prisma.codeMetricsSnapshot.findMany as jest.Mock).mockResolvedValue(mockSnapshots);

      // Act - Call multiple times
      const result1 = await service.getTrendData(mockProjectId, 30);
      const result2 = await service.getTrendData(mockProjectId, 30);
      const result3 = await service.getTrendData(mockProjectId, 30);

      // Assert - Values should be identical across calls (no random noise)
      expect(result1[0].healthScore).toBe(result2[0].healthScore);
      expect(result2[0].healthScore).toBe(result3[0].healthScore);
      expect(result1[0].coverage).toBe(result2[0].coverage);
      expect(result2[0].coverage).toBe(result3[0].coverage);
      expect(result1[0].complexity).toBe(result2[0].complexity);
      expect(result2[0].complexity).toBe(result3[0].complexity);
      expect(result1[0].techDebt).toBe(result2[0].techDebt);
      expect(result2[0].techDebt).toBe(result3[0].techDebt);
    });
  });

  describe('Data Transformation', () => {
    it('should map snapshot fields correctly to TrendDataPointDto', async () => {
      // Arrange
      const mockSnapshots = [
        {
          id: '1',
          projectId: mockProjectId,
          snapshotDate: new Date('2025-11-16T10:00:00Z'),
          totalFiles: 500,
          totalLOC: 80000,
          avgComplexity: 8.5,
          avgCoverage: 65.0,
          healthScore: 75.0,
          techDebtRatio: 15.0,
          metadata: null,
          analysisRunId: null,
          createdAt: new Date('2025-11-16T10:00:00Z'),
        },
      ];

      (prisma.codeMetricsSnapshot.findMany as jest.Mock).mockResolvedValue(mockSnapshots);

      // Act
      const result = await service.getTrendData(mockProjectId, 30);

      // Assert
      expect(result[0]).toEqual({
        date: mockSnapshots[0].snapshotDate,
        healthScore: mockSnapshots[0].healthScore,
        coverage: mockSnapshots[0].avgCoverage,
        complexity: mockSnapshots[0].avgComplexity,
        techDebt: mockSnapshots[0].techDebtRatio,
      });
    });
  });

  describe('Edge Cases', () => {
    it('should return empty array when no snapshots exist', async () => {
      // Arrange
      (prisma.codeMetricsSnapshot.findMany as jest.Mock).mockResolvedValue([]);

      // Act
      const result = await service.getTrendData(mockProjectId, 30);

      // Assert
      expect(result).toEqual([]);
      expect(result).toHaveLength(0);
    });

    it('should handle single snapshot correctly', async () => {
      // Arrange
      const mockSnapshots = [
        {
          id: '1',
          projectId: mockProjectId,
          snapshotDate: new Date('2025-11-18T10:00:00Z'),
          totalFiles: 500,
          totalLOC: 80000,
          avgComplexity: 8.5,
          avgCoverage: 65.0,
          healthScore: 75.0,
          techDebtRatio: 15.0,
          metadata: null,
          analysisRunId: null,
          createdAt: new Date('2025-11-18T10:00:00Z'),
        },
      ];

      (prisma.codeMetricsSnapshot.findMany as jest.Mock).mockResolvedValue(mockSnapshots);

      // Act
      const result = await service.getTrendData(mockProjectId, 30);

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].date).toEqual(mockSnapshots[0].snapshotDate);
    });

    it('should respect the days parameter', async () => {
      // Arrange
      const mockSnapshots = [
        {
          id: '1',
          projectId: mockProjectId,
          snapshotDate: new Date('2025-11-11T10:00:00Z'),
          totalFiles: 500,
          totalLOC: 80000,
          avgComplexity: 8.5,
          avgCoverage: 65.0,
          healthScore: 75.0,
          techDebtRatio: 15.0,
          metadata: null,
          analysisRunId: null,
          createdAt: new Date('2025-11-11T10:00:00Z'),
        },
      ];

      (prisma.codeMetricsSnapshot.findMany as jest.Mock).mockResolvedValue(mockSnapshots);

      // Act
      await service.getTrendData(mockProjectId, 7);

      // Assert
      const callArgs = (prisma.codeMetricsSnapshot.findMany as jest.Mock).mock.calls[0][0];
      const startDate = callArgs.where.snapshotDate.gte;
      const daysAgo = Math.floor((new Date().getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

      // Allow 1 day tolerance for test execution time
      expect(daysAgo).toBeGreaterThanOrEqual(6);
      expect(daysAgo).toBeLessThanOrEqual(7);
    });

    it('should return snapshots ordered by date ascending', async () => {
      // Arrange
      const mockSnapshots = [
        {
          id: '1',
          projectId: mockProjectId,
          snapshotDate: new Date('2025-11-14T10:00:00Z'),
          totalFiles: 500,
          totalLOC: 80000,
          avgComplexity: 8.5,
          avgCoverage: 65.0,
          healthScore: 75.0,
          techDebtRatio: 15.0,
          metadata: null,
          analysisRunId: null,
          createdAt: new Date('2025-11-14T10:00:00Z'),
        },
        {
          id: '2',
          projectId: mockProjectId,
          snapshotDate: new Date('2025-11-16T10:00:00Z'),
          totalFiles: 510,
          totalLOC: 81000,
          avgComplexity: 8.3,
          avgCoverage: 66.5,
          healthScore: 76.0,
          techDebtRatio: 14.5,
          metadata: null,
          analysisRunId: null,
          createdAt: new Date('2025-11-16T10:00:00Z'),
        },
        {
          id: '3',
          projectId: mockProjectId,
          snapshotDate: new Date('2025-11-18T10:00:00Z'),
          totalFiles: 520,
          totalLOC: 82000,
          avgComplexity: 8.1,
          avgCoverage: 68.0,
          healthScore: 77.0,
          techDebtRatio: 14.0,
          metadata: null,
          analysisRunId: null,
          createdAt: new Date('2025-11-18T10:00:00Z'),
        },
      ];

      (prisma.codeMetricsSnapshot.findMany as jest.Mock).mockResolvedValue(mockSnapshots);

      // Act
      const result = await service.getTrendData(mockProjectId, 30);

      // Assert
      expect(result).toHaveLength(3);
      expect(result[0].date.getTime()).toBeLessThan(result[1].date.getTime());
      expect(result[1].date.getTime()).toBeLessThan(result[2].date.getTime());
    });
  });
});
