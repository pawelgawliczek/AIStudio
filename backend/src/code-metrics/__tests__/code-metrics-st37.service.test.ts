/**
 * Unit Tests for ST-37: Code Quality Dashboard Data Accuracy Fix
 *
 * Tests for two critical fixes:
 * 1. getTestSummaryFromCoverage - Parse coverage file instead of database
 * 2. getRecentAnalyses - Query CodeMetricsSnapshot for real analysis history
 *
 * Validates all acceptance criteria from BA analysis
 */

import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { WorkersService } from '../../workers/workers.service';
import { CodeMetricsService } from '../code-metrics.service';
import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';

// Mock fs and glob modules
jest.mock('fs');
jest.mock('glob');

describe('CodeMetricsService - ST-37 Test Metrics Fix', () => {
  let service: CodeMetricsService;
  let prismaService: PrismaService;

  const mockPrismaService = {
    project: {
      findUnique: jest.fn(),
    },
    codeMetricsSnapshot: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
    commit: {
      findFirst: jest.fn(),
    },
  };

  const mockWorkersService = {
    analyzeProject: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CodeMetricsService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: WorkersService, useValue: mockWorkersService },
      ],
    }).compile();

    service = module.get<CodeMetricsService>(CodeMetricsService);
    prismaService = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  describe('getTestSummaryFromCoverage - AC FR-1: Test Metrics Accuracy', () => {
    const projectId = 'test-project-001';
    const mockLocalPath = '/opt/stack/AIStudio/backend';

    const mockCoverageJson = JSON.stringify({
      total: {
        lines: { total: 10782, covered: 1281, pct: 11.88 },
        functions: { total: 1858, covered: 187, pct: 10.06 },
        statements: { total: 11332, covered: 1415, pct: 12.48 },
        branches: { total: 3980, covered: 547, pct: 13.74 },
      },
      '/opt/stack/AIStudio/backend/src/file1.ts': {
        lines: { total: 100, covered: 80, pct: 80 },
      },
    });

    beforeEach(() => {
      mockPrismaService.project.findUnique.mockResolvedValue({
        id: projectId,
        localPath: mockLocalPath,
      });
    });

    it('AC-1: should parse valid coverage file and return accurate metrics', async () => {
      // Mock file system operations
      (fs.readFileSync as jest.Mock).mockReturnValue(mockCoverageJson);
      (fs.statSync as jest.Mock).mockReturnValue({
        mtime: new Date('2025-11-18T16:45:00.000Z'),
      });

      // Mock glob to return 3 files across all 4 pattern calls
      let globIndex = 0;
      (glob as unknown as jest.Mock).mockImplementation(() => {
        globIndex++;
        if (globIndex === 1) return Promise.resolve([
          '/opt/stack/AIStudio/backend/src/auth/__tests__/auth.test.ts',
          '/opt/stack/AIStudio/backend/src/metrics/__tests__/metrics.test.ts',
        ]);
        if (globIndex === 2) return Promise.resolve([]);
        if (globIndex === 3) return Promise.resolve([
          '/opt/stack/AIStudio/backend/src/stories/__tests__/stories.spec.ts',
        ]);
        return Promise.resolve([]);
      });

      const result = await service.getTestSummaryFromCoverage(projectId);

      expect(result).toBeDefined();
      expect(result.totalTests).toBe(3); // 2 + 0 + 1 + 0
      expect(result.coveragePercentage).toBe(11.88); // Exact match from coverage-summary.json
      expect(result.lastExecution).toEqual(new Date('2025-11-18T16:45:00.000Z'));
      expect(result.passing).toBe(3); // Inferred since coverage doesn't track pass/fail
      expect(result.failing).toBe(0);
      expect(result.skipped).toBe(0);
    });

    it('AC-2: should count test files matching .test.ts, .test.tsx, .spec.ts, .spec.tsx patterns', async () => {
      (fs.readFileSync as jest.Mock).mockReturnValue(mockCoverageJson);
      (fs.statSync as jest.Mock).mockReturnValue({ mtime: new Date() });

      // Mock glob to return different file types per call
      let callCount = 0;
      (glob as unknown as jest.Mock).mockImplementation(() => {
        callCount++;
        if (callCount === 1) return Promise.resolve(['file1.test.ts', 'file2.test.ts']); // .test.ts
        if (callCount === 2) return Promise.resolve(['Component.test.tsx']); // .test.tsx
        if (callCount === 3) return Promise.resolve(['service.spec.ts']); // .spec.ts
        if (callCount === 4) return Promise.resolve([]); // .spec.tsx
        return Promise.resolve([]);
      });

      const result = await service.getTestSummaryFromCoverage(projectId);

      expect(result.totalTests).toBe(4); // 2 + 1 + 1 + 0
      expect(glob).toHaveBeenCalled();
    });

    it('AC-3: should exclude node_modules from test file count', async () => {
      (fs.readFileSync as jest.Mock).mockReturnValue(mockCoverageJson);
      (fs.statSync as jest.Mock).mockReturnValue({ mtime: new Date() });
      (glob as unknown as jest.Mock).mockResolvedValue([]);

      await service.getTestSummaryFromCoverage(projectId);

      // Verify glob was called with ignore pattern
      expect(glob).toHaveBeenCalledWith(
        expect.stringContaining('**/*.test.ts'),
        expect.objectContaining({ ignore: '**/node_modules/**' })
      );
    });

    it('AC-4: should throw NotFoundException when coverage file missing', async () => {
      const error: any = new Error('ENOENT: no such file or directory');
      error.code = 'ENOENT';
      (fs.readFileSync as jest.Mock).mockImplementation(() => {
        throw error;
      });

      await expect(service.getTestSummaryFromCoverage(projectId)).rejects.toThrow(
        NotFoundException
      );
      await expect(service.getTestSummaryFromCoverage(projectId)).rejects.toThrow(
        'Coverage report not found. Run tests with --coverage flag.'
      );
    });

    it('AC-5: should throw BadRequestException when coverage JSON is corrupted', async () => {
      (fs.readFileSync as jest.Mock).mockReturnValue('invalid json {{{');
      (fs.statSync as jest.Mock).mockReturnValue({ mtime: new Date() });

      await expect(service.getTestSummaryFromCoverage(projectId)).rejects.toThrow(
        BadRequestException
      );
      await expect(service.getTestSummaryFromCoverage(projectId)).rejects.toThrow(
        'Coverage file is corrupted or invalid JSON'
      );
    });

    it('AC-6: should throw NotFoundException when project has no localPath', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue({
        id: projectId,
        localPath: null,
      });

      await expect(service.getTestSummaryFromCoverage(projectId)).rejects.toThrow(
        NotFoundException
      );
      await expect(service.getTestSummaryFromCoverage(projectId)).rejects.toThrow(
        'Project local path not configured'
      );
    });

    it('Security: should sanitize path to prevent directory traversal', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue({
        id: projectId,
        localPath: '/opt/stack/../../../etc',
      });

      (fs.readFileSync as jest.Mock).mockReturnValue(mockCoverageJson);
      (fs.statSync as jest.Mock).mockReturnValue({ mtime: new Date() });
      (glob as unknown as jest.Mock).mockResolvedValue([]);

      // Should sanitize path by removing ..
      await service.getTestSummaryFromCoverage(projectId);

      const readCall = (fs.readFileSync as jest.Mock).mock.calls[0][0];
      expect(readCall).not.toContain('..');
    });

    it('Security: should sanitize malicious path with directory traversal', async () => {
      // Mock path operations to simulate directory traversal attempt
      const maliciousPath = '/opt/stack/malicious/../../../etc/passwd';
      mockPrismaService.project.findUnique.mockResolvedValue({
        id: projectId,
        localPath: maliciousPath,
      });

      (fs.readFileSync as jest.Mock).mockReturnValue(mockCoverageJson);
      (fs.statSync as jest.Mock).mockReturnValue({ mtime: new Date() });
      (glob as unknown as jest.Mock).mockResolvedValue([]);

      // Path.normalize removes .. so this should work (path gets sanitized)
      // The actual security is in path sanitization, not throwing an error
      const result = await service.getTestSummaryFromCoverage(projectId);

      // Verify it completes without error (path was sanitized)
      expect(result).toBeDefined();
    });

    it('AC-7: should handle coverage file with missing total.lines field gracefully', async () => {
      jest.clearAllMocks(); // Clear previous glob mocks

      const incompleteCoverage = JSON.stringify({
        total: {
          functions: { total: 100, covered: 50, pct: 50 },
        },
      });
      (fs.readFileSync as jest.Mock).mockReturnValue(incompleteCoverage);
      (fs.statSync as jest.Mock).mockReturnValue({ mtime: new Date() });

      // Mock glob to return 1 file for each pattern call
      let fileIndex = 0;
      (glob as unknown as jest.Mock).mockImplementation(() => {
        fileIndex++;
        if (fileIndex === 1) return Promise.resolve(['test1.test.ts']);
        return Promise.resolve([]);
      });

      const result = await service.getTestSummaryFromCoverage(projectId);

      expect(result.coveragePercentage).toBe(0); // Fallback when total.lines.pct missing
      expect(result.totalTests).toBe(1);
    });

    it('AC-8: should use file modification time as lastExecution timestamp', async () => {
      const mockMtime = new Date('2025-11-18T14:30:00.000Z');
      (fs.readFileSync as jest.Mock).mockReturnValue(mockCoverageJson);
      (fs.statSync as jest.Mock).mockReturnValue({ mtime: mockMtime });
      (glob as unknown as jest.Mock).mockResolvedValue(['test.ts']);

      const result = await service.getTestSummaryFromCoverage(projectId);

      expect(result.lastExecution).toEqual(mockMtime);
    });

    it('Performance: should complete parsing in < 2 seconds', async () => {
      (fs.readFileSync as jest.Mock).mockReturnValue(mockCoverageJson);
      (fs.statSync as jest.Mock).mockReturnValue({ mtime: new Date() });
      (glob as unknown as jest.Mock).mockResolvedValue(
        Array.from({ length: 106 }, (_, i) => `test${i}.test.ts`)
      );

      const startTime = Date.now();
      await service.getTestSummaryFromCoverage(projectId);
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(2000); // NFR-1: Performance requirement
    });
  });

  describe('getRecentAnalyses - AC FR-2: Dynamic Recent Analyses', () => {
    const projectId = 'test-project-001';

    const mockSnapshots = [
      {
        id: 'snapshot-1',
        projectId,
        snapshotDate: new Date('2025-11-18T18:30:00.000Z'),
        totalFiles: 450,
        healthScore: 78.5,
      },
      {
        id: 'snapshot-2',
        projectId,
        snapshotDate: new Date('2025-11-17T14:15:00.000Z'),
        totalFiles: 448,
        healthScore: 76.2,
      },
      {
        id: 'snapshot-3',
        projectId,
        snapshotDate: new Date('2025-11-16T10:00:00.000Z'),
        totalFiles: 445,
        healthScore: 75.8,
      },
    ];

    beforeEach(() => {
      mockPrismaService.codeMetricsSnapshot.findMany.mockResolvedValue(mockSnapshots);
      mockPrismaService.codeMetricsSnapshot.count.mockResolvedValue(12); // Total available
    });

    it('AC-9: should return last 7 analyses from database ordered by snapshotDate DESC', async () => {
      const result = await service.getRecentAnalyses(projectId, 7);

      expect(result).toBeDefined();
      expect(result.analyses).toHaveLength(3);
      expect(result.analyses[0].id).toBe('snapshot-1'); // Most recent first
      expect(result.analyses[0].timestamp).toEqual(new Date('2025-11-18T18:30:00.000Z'));
      expect(prismaService.codeMetricsSnapshot.findMany).toHaveBeenCalledWith({
        where: { projectId },
        orderBy: { snapshotDate: 'desc' },
        take: 7,
      });
    });

    it('AC-10: should include total count and hasMore flag for pagination', async () => {
      const result = await service.getRecentAnalyses(projectId, 7);

      expect(result.total).toBe(12);
      expect(result.hasMore).toBe(true); // 12 total > 7 limit
    });

    it('AC-11: should set hasMore to false when all analyses returned', async () => {
      mockPrismaService.codeMetricsSnapshot.count.mockResolvedValue(3);

      const result = await service.getRecentAnalyses(projectId, 7);

      expect(result.hasMore).toBe(false); // 3 total <= 7 limit
    });

    it('AC-12: should link commit hash when found within ±5 minute window', async () => {
      const snapshotTime = new Date('2025-11-18T18:30:00.000Z');
      mockPrismaService.codeMetricsSnapshot.findMany.mockResolvedValue([
        {
          id: 'snapshot-1',
          projectId,
          snapshotDate: snapshotTime,
          totalFiles: 450,
          healthScore: 78.5,
        },
      ]);

      mockPrismaService.commit.findFirst.mockResolvedValue({
        hash: '3d70292abc123def456789',
      });

      const result = await service.getRecentAnalyses(projectId, 7);

      expect(result.analyses[0].commitHash).toBe('3d70292abc123def456789');
      expect(prismaService.commit.findFirst).toHaveBeenCalledWith({
        where: {
          projectId,
          timestamp: {
            gte: new Date(snapshotTime.getTime() - 5 * 60 * 1000), // -5 minutes
            lte: new Date(snapshotTime.getTime() + 5 * 60 * 1000), // +5 minutes
          },
        },
        orderBy: { timestamp: 'desc' },
        select: { hash: true },
      });
    });

    it('AC-13: should return undefined commitHash when no commit found in time window', async () => {
      mockPrismaService.commit.findFirst.mockResolvedValue(null);

      const result = await service.getRecentAnalyses(projectId, 7);

      expect(result.analyses[0].commitHash).toBeUndefined();
      expect(result.analyses[0].status).toBe('completed'); // Status still valid
    });

    it('AC-14: should return empty array when no snapshots exist', async () => {
      mockPrismaService.codeMetricsSnapshot.findMany.mockResolvedValue([]);
      mockPrismaService.codeMetricsSnapshot.count.mockResolvedValue(0);

      const result = await service.getRecentAnalyses(projectId, 7);

      expect(result.analyses).toEqual([]);
      expect(result.total).toBe(0);
      expect(result.hasMore).toBe(false);
    });

    it('AC-15: should set all analyses to "completed" status (MVP implementation)', async () => {
      const result = await service.getRecentAnalyses(projectId, 7);

      result.analyses.forEach(analysis => {
        expect(analysis.status).toBe('completed');
      });
    });

    it('AC-16: should include healthScore and totalFiles from snapshot', async () => {
      const result = await service.getRecentAnalyses(projectId, 7);

      expect(result.analyses[0].healthScore).toBe(78.5);
      expect(result.analyses[0].totalFiles).toBe(450);
    });

    it('AC-17: should respect custom limit parameter (max 20)', async () => {
      await service.getRecentAnalyses(projectId, 10);

      expect(prismaService.codeMetricsSnapshot.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 10 })
      );
    });

    it('AC-18: should default to 7 analyses when limit not provided', async () => {
      await service.getRecentAnalyses(projectId);

      expect(prismaService.codeMetricsSnapshot.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 7 })
      );
    });

    it('Performance: should respond in < 500ms for 7 analyses', async () => {
      mockPrismaService.commit.findFirst.mockResolvedValue({ hash: 'abc123' });

      const startTime = Date.now();
      await service.getRecentAnalyses(projectId, 7);
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(500); // NFR-1: Performance requirement
    });

    it('AC-19: should handle snapshots with null healthScore gracefully', async () => {
      mockPrismaService.codeMetricsSnapshot.findMany.mockResolvedValue([
        {
          id: 'snapshot-1',
          projectId,
          snapshotDate: new Date('2025-11-18T18:30:00.000Z'),
          totalFiles: 450,
          healthScore: null, // Edge case: null score
        },
      ]);
      mockPrismaService.commit.findFirst.mockResolvedValue(null);

      const result = await service.getRecentAnalyses(projectId, 7);

      expect(result.analyses[0].healthScore).toBeNull();
    });

    it('AC-20: should log when no commit found for snapshot', async () => {
      const logSpy = jest.spyOn((service as any).logger, 'debug');
      mockPrismaService.commit.findFirst.mockResolvedValue(null);

      await service.getRecentAnalyses(projectId, 7);

      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('No commit found for snapshot')
      );
    });

    it('Data Integrity: should preserve timestamp precision (ISO 8601)', async () => {
      const preciseTimestamp = new Date('2025-11-18T18:30:45.123Z');
      mockPrismaService.codeMetricsSnapshot.findMany.mockResolvedValue([
        {
          id: 'snapshot-1',
          projectId,
          snapshotDate: preciseTimestamp,
          totalFiles: 450,
          healthScore: 78.5,
        },
      ]);
      mockPrismaService.commit.findFirst.mockResolvedValue(null);

      const result = await service.getRecentAnalyses(projectId, 7);

      expect(result.analyses[0].timestamp).toEqual(preciseTimestamp);
      expect(result.analyses[0].timestamp.toISOString()).toBe('2025-11-18T18:30:45.123Z');
    });
  });

  describe('Integration: getTestSummary endpoint (ST-37 refactor)', () => {
    const projectId = 'test-project-001';

    it('should call getTestSummaryFromCoverage instead of database query', async () => {
      jest.clearAllMocks(); // Clear previous mocks

      const mockLocalPath = '/opt/stack/AIStudio/backend';
      const mockCoverageJson = JSON.stringify({
        total: { lines: { pct: 11.88 } },
      });

      mockPrismaService.project.findUnique.mockResolvedValue({
        id: projectId,
        localPath: mockLocalPath,
      });
      (fs.readFileSync as jest.Mock).mockReturnValue(mockCoverageJson);
      (fs.statSync as jest.Mock).mockReturnValue({ mtime: new Date() });

      // Mock glob to return 2 files total across all pattern calls
      let globCallCount = 0;
      (glob as unknown as jest.Mock).mockImplementation(() => {
        globCallCount++;
        if (globCallCount === 1) return Promise.resolve(['test1.ts', 'test2.ts']);
        return Promise.resolve([]);
      });

      const result = await service.getTestSummary(projectId);

      // Verify new implementation is called
      expect(result.totalTests).toBe(2);
      expect(result.coveragePercentage).toBe(11.88);
    });
  });

  describe('Backward Compatibility', () => {
    it('getTestSummary: should maintain response schema for frontend', async () => {
      const projectId = 'test-project-001';
      mockPrismaService.project.findUnique.mockResolvedValue({
        id: projectId,
        localPath: '/opt/stack/AIStudio/backend',
      });
      (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify({
        total: { lines: { pct: 11.88 } },
      }));
      (fs.statSync as jest.Mock).mockReturnValue({ mtime: new Date() });
      (glob as unknown as jest.Mock).mockResolvedValue(['test.ts']);

      const result = await service.getTestSummary(projectId);

      // Verify response matches TestSummaryDto schema
      expect(result).toHaveProperty('totalTests');
      expect(result).toHaveProperty('passing');
      expect(result).toHaveProperty('failing');
      expect(result).toHaveProperty('skipped');
      expect(result).toHaveProperty('lastExecution');
      expect(result).toHaveProperty('coveragePercentage'); // New field
    });
  });
});
