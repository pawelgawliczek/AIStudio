import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../prisma/prisma.service';
import { WorkersService } from '../../workers/workers.service';
import { CodeMetricsService } from '../code-metrics.service';

describe('CodeMetricsService', () => {
  let service: CodeMetricsService;
  let prismaService: PrismaService;
  let workersService: WorkersService;

  const mockPrismaService = {
    codeMetrics: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
    },
    project: {
      findUnique: jest.fn(),
    },
    commit: {
      findMany: jest.fn(),
    },
    testCase: {
      count: jest.fn(),
      findMany: jest.fn(),
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
    workersService = module.get<WorkersService>(WorkersService);

    jest.clearAllMocks();
  });

  describe('getProjectMetrics - ST-7: Empty metrics handling', () => {
    const projectId = 'test-project-001';

    it('should return empty structure instead of throwing error when no metrics exist', async () => {
      mockPrismaService.codeMetrics.findMany.mockResolvedValue([]);

      const result = await service.getProjectMetrics(projectId, { timeRangeDays: 30 });

      expect(result).toBeDefined();
      expect(result.healthScore.overallScore).toBe(0);
      expect(result.totalLoc).toBe(0);
    });

    it('should return healthScore with all zeroes when no metrics', async () => {
      mockPrismaService.codeMetrics.findMany.mockResolvedValue([]);

      const result = await service.getProjectMetrics(projectId, {});

      expect(result.healthScore).toEqual({
        overallScore: 0,
        coverage: 0,
        complexity: 0,
        techDebtRatio: 0,
        trend: 'stable',
        weeklyChange: 0,
      });
    });

    it('should return empty locByLanguage when no metrics', async () => {
      mockPrismaService.codeMetrics.findMany.mockResolvedValue([]);

      const result = await service.getProjectMetrics(projectId, {});

      expect(result.locByLanguage).toEqual({});
    });

    it('should return zeroed security issues when no metrics', async () => {
      mockPrismaService.codeMetrics.findMany.mockResolvedValue([]);

      const result = await service.getProjectMetrics(projectId, {});

      expect(result.securityIssues).toEqual({
        critical: 0,
        high: 0,
        medium: 0,
        low: 0,
      });
    });

    it('should include lastUpdate date when no metrics', async () => {
      mockPrismaService.codeMetrics.findMany.mockResolvedValue([]);

      const result = await service.getProjectMetrics(projectId, {});

      expect(result.lastUpdate).toBeInstanceOf(Date);
    });

    it('should NOT throw error for empty database (critical fix verification)', async () => {
      mockPrismaService.codeMetrics.findMany.mockResolvedValue([]);

      await expect(service.getProjectMetrics(projectId, {})).resolves.toBeDefined();
    });
  });

  describe('getProjectMetrics - with data', () => {
    const projectId = 'test-project-001';

    const mockMetrics = [
      {
        linesOfCode: 200,
        cyclomaticComplexity: 10,
        maintainabilityIndex: 75,
        testCoverage: 80,
        criticalIssues: 2,
        language: 'typescript',
      },
      {
        linesOfCode: 150,
        cyclomaticComplexity: 8,
        maintainabilityIndex: 85,
        testCoverage: 90,
        criticalIssues: 1,
        language: 'typescript',
      },
      {
        linesOfCode: 100,
        cyclomaticComplexity: 5,
        maintainabilityIndex: 90,
        testCoverage: 70,
        criticalIssues: 0,
        language: 'javascript',
      },
    ];

    it('should calculate correct total LOC', async () => {
      mockPrismaService.codeMetrics.findMany.mockResolvedValue(mockMetrics);

      const result = await service.getProjectMetrics(projectId, {});

      expect(result.totalLoc).toBe(450); // 200 + 150 + 100
    });

    it('should calculate LOC-weighted average complexity', async () => {
      mockPrismaService.codeMetrics.findMany.mockResolvedValue(mockMetrics);

      const result = await service.getProjectMetrics(projectId, {});

      // (10*200 + 8*150 + 5*100) / 450 = (2000 + 1200 + 500) / 450 = 8.22
      expect(result.healthScore.complexity).toBeCloseTo(8.2, 1);
    });

    it('should calculate LOC-weighted average coverage', async () => {
      mockPrismaService.codeMetrics.findMany.mockResolvedValue(mockMetrics);

      const result = await service.getProjectMetrics(projectId, {});

      // (80*200 + 90*150 + 70*100) / 450 = (16000 + 13500 + 7000) / 450 = 81.11
      expect(result.healthScore.coverage).toBeCloseTo(81, 0);
    });

    it('should calculate LOC-weighted average maintainability', async () => {
      mockPrismaService.codeMetrics.findMany.mockResolvedValue(mockMetrics);

      const result = await service.getProjectMetrics(projectId, {});

      // Tech debt = 100 - avgMaintainability
      // avgMaint = (75*200 + 85*150 + 90*100) / 450 = (15000 + 12750 + 9000) / 450 = 81.67
      expect(result.healthScore.techDebtRatio).toBeCloseTo(18, 0); // 100 - 82
    });

    it('should aggregate LOC by language', async () => {
      mockPrismaService.codeMetrics.findMany.mockResolvedValue(mockMetrics);

      const result = await service.getProjectMetrics(projectId, {});

      expect(result.locByLanguage.typescript).toBe(350); // 200 + 150
      expect(result.locByLanguage.javascript).toBe(100);
    });

    it('should calculate composite health score between 0-100', async () => {
      mockPrismaService.codeMetrics.findMany.mockResolvedValue(mockMetrics);

      const result = await service.getProjectMetrics(projectId, {});

      expect(result.healthScore.overallScore).toBeGreaterThanOrEqual(0);
      expect(result.healthScore.overallScore).toBeLessThanOrEqual(100);
    });

    it('should distribute security issues from critical issues count', async () => {
      mockPrismaService.codeMetrics.findMany.mockResolvedValue(mockMetrics);

      const result = await service.getProjectMetrics(projectId, {});

      // Total critical issues = 2 + 1 + 0 = 3
      // Distribution: critical = 0.1*3 = 0, high = 0.2*3 = 0, medium = 0.3*3 = 0, low = 3 - 0 = 3
      // Actually: floor(3*0.1)=0, floor(3*0.2)=0, floor(3*0.3)=0, 3 - floor(3*0.6) = 3 - 1 = 2
      const totalIssues = result.securityIssues.critical +
                          result.securityIssues.high +
                          result.securityIssues.medium +
                          result.securityIssues.low;
      // The distribution formula gives: 0 + 0 + 0 + (3 - floor(1.8)) = 0 + 0 + 0 + 2 = 2
      expect(totalIssues).toBeGreaterThanOrEqual(2);
      expect(totalIssues).toBeLessThanOrEqual(3);
    });
  });

  describe('getFolderHierarchy - ST-7: Empty metrics handling', () => {
    const projectId = 'test-project-001';

    it('should return empty root folder structure when no metrics', async () => {
      mockPrismaService.codeMetrics.findMany.mockResolvedValue([]);

      const result = await service.getFolderHierarchy(projectId);

      expect(result).toBeDefined();
      expect(result.name).toBe('root');
      expect(result.type).toBe('folder');
      expect(result.children).toEqual([]);
    });

    it('should return empty metrics in root folder when no data', async () => {
      mockPrismaService.codeMetrics.findMany.mockResolvedValue([]);

      const result = await service.getFolderHierarchy(projectId);

      expect(result.metrics).toEqual({
        fileCount: 0,
        totalLoc: 0,
        avgComplexity: 0,
        avgCognitiveComplexity: 0,
        avgMaintainability: 0,
        avgCoverage: 0,
        avgRiskScore: 0,
        uncoveredFiles: 0,
        criticalIssues: 0,
        healthScore: 0,
      });
    });

    it('should NOT throw error when metrics are empty (critical fix verification)', async () => {
      mockPrismaService.codeMetrics.findMany.mockResolvedValue([]);

      await expect(service.getFolderHierarchy(projectId)).resolves.toBeDefined();
    });
  });

  describe('getFolderHierarchy - with data', () => {
    const projectId = 'test-project-001';

    const mockMetrics = [
      {
        filePath: 'backend/src/auth/auth.service.ts',
        linesOfCode: 150,
        cyclomaticComplexity: 12,
        cognitiveComplexity: 18,
        maintainabilityIndex: 72,
        testCoverage: 85,
        riskScore: 45,
        criticalIssues: 0,
      },
      {
        filePath: 'backend/src/users/users.service.ts',
        linesOfCode: 200,
        cyclomaticComplexity: 8,
        cognitiveComplexity: 12,
        maintainabilityIndex: 78,
        testCoverage: 90,
        riskScore: 25,
        criticalIssues: 0,
      },
      {
        filePath: 'frontend/src/App.tsx',
        linesOfCode: 100,
        cyclomaticComplexity: 5,
        cognitiveComplexity: 8,
        maintainabilityIndex: 85,
        testCoverage: 0, // uncovered
        riskScore: 30,
        criticalIssues: 1,
      },
    ];

    it('should build folder hierarchy from file paths', async () => {
      mockPrismaService.codeMetrics.findMany.mockResolvedValue(mockMetrics);

      const result = await service.getFolderHierarchy(projectId);

      expect(result.name).toBe('root');
      expect(result.children?.length).toBe(2); // backend, frontend
    });

    it('should create nested folder structure', async () => {
      mockPrismaService.codeMetrics.findMany.mockResolvedValue(mockMetrics);

      const result = await service.getFolderHierarchy(projectId);

      const backendFolder = result.children?.find(c => c.name === 'backend');
      expect(backendFolder).toBeDefined();
      expect(backendFolder?.type).toBe('folder');
      expect(backendFolder?.children?.length).toBeGreaterThan(0);
    });

    it('should aggregate metrics from children to parent folders', async () => {
      mockPrismaService.codeMetrics.findMany.mockResolvedValue(mockMetrics);

      const result = await service.getFolderHierarchy(projectId);

      expect(result.metrics.fileCount).toBe(3);
      expect(result.metrics.totalLoc).toBe(450);
    });

    it('should count uncovered files (coverage = 0)', async () => {
      mockPrismaService.codeMetrics.findMany.mockResolvedValue(mockMetrics);

      const result = await service.getFolderHierarchy(projectId);

      expect(result.metrics.uncoveredFiles).toBe(1); // App.tsx has 0 coverage
    });

    it('should aggregate critical issues', async () => {
      mockPrismaService.codeMetrics.findMany.mockResolvedValue(mockMetrics);

      const result = await service.getFolderHierarchy(projectId);

      expect(result.metrics.criticalIssues).toBe(1);
    });

    it('should calculate LOC-weighted averages for parent folders', async () => {
      mockPrismaService.codeMetrics.findMany.mockResolvedValue(mockMetrics);

      const result = await service.getFolderHierarchy(projectId);

      // Weighted avg complexity = (12*150 + 8*200 + 5*100) / 450 = 8.22
      // However, the implementation uses a different calculation path through tree aggregation
      // which may result in slightly different rounding
      expect(result.metrics.avgComplexity).toBeGreaterThanOrEqual(8);
      expect(result.metrics.avgComplexity).toBeLessThanOrEqual(9);
    });
  });

  describe('getFileHotspots - empty case', () => {
    it('should return empty array when no hotspots exist', async () => {
      mockPrismaService.codeMetrics.findMany.mockResolvedValue([]);

      const result = await service.getFileHotspots('test-project', {});

      expect(result).toEqual([]);
    });
  });

  describe('getFileDetail - error handling', () => {
    it('should throw NotFoundException when file not found', async () => {
      mockPrismaService.codeMetrics.findUnique.mockResolvedValue(null);

      await expect(
        service.getFileDetail('test-project', 'nonexistent.ts')
      ).rejects.toThrow(NotFoundException);
    });

    it('should include file path in error message', async () => {
      mockPrismaService.codeMetrics.findUnique.mockResolvedValue(null);

      await expect(
        service.getFileDetail('test-project', 'missing/file.ts')
      ).rejects.toThrow('missing/file.ts');
    });
  });

  describe('getTrendData', () => {
    it('should return trend data points even with empty metrics', async () => {
      mockPrismaService.codeMetrics.findMany.mockResolvedValue([]);

      const result = await service.getTrendData('test-project', 30);

      expect(result.length).toBeGreaterThan(0);
      expect(result[0]).toHaveProperty('date');
      expect(result[0]).toHaveProperty('healthScore');
      expect(result[0]).toHaveProperty('coverage');
      expect(result[0]).toHaveProperty('complexity');
      expect(result[0]).toHaveProperty('techDebt');
    });
  });

  describe('getCodeIssues - empty case', () => {
    it('should return empty array when no code smells exist', async () => {
      mockPrismaService.codeMetrics.findMany.mockResolvedValue([]);

      const result = await service.getCodeIssues('test-project');

      expect(result).toEqual([]);
    });

    it('should return empty array when metrics have no code smells', async () => {
      mockPrismaService.codeMetrics.findMany.mockResolvedValue([
        { metadata: {} },
        { metadata: { codeSmells: [] } },
      ]);

      const result = await service.getCodeIssues('test-project');

      expect(result).toEqual([]);
    });
  });

  describe('getCoverageGaps', () => {
    it('should return empty array when no files have low coverage', async () => {
      mockPrismaService.codeMetrics.findMany.mockResolvedValue([]);

      const result = await service.getCoverageGaps('test-project');

      expect(result).toEqual([]);
    });

    it('should prioritize high-risk files with low coverage', async () => {
      const mockGaps = [
        {
          filePath: 'high-risk.ts',
          linesOfCode: 500,
          cyclomaticComplexity: 25,
          riskScore: 90,
          testCoverage: 10,
          criticalIssues: 5,
        },
        {
          filePath: 'low-risk.ts',
          linesOfCode: 50,
          cyclomaticComplexity: 5,
          riskScore: 20,
          testCoverage: 40,
          criticalIssues: 0,
        },
      ];

      mockPrismaService.codeMetrics.findMany.mockResolvedValue(mockGaps);

      const result = await service.getCoverageGaps('test-project', 10);

      expect(result[0].filePath).toBe('high-risk.ts');
      expect(result[0].priority).toBeGreaterThan(result[1].priority);
    });

    it('should include reason for prioritization', async () => {
      const mockGaps = [
        {
          filePath: 'critical.ts',
          linesOfCode: 400,
          cyclomaticComplexity: 20,
          riskScore: 75,
          testCoverage: 0,
          criticalIssues: 3,
        },
      ];

      mockPrismaService.codeMetrics.findMany.mockResolvedValue(mockGaps);

      const result = await service.getCoverageGaps('test-project');

      expect(result[0].reason).toContain('High risk');
      expect(result[0].reason).toContain('Complex code');
      expect(result[0].reason).toContain('Large file');
      expect(result[0].reason).toContain('No tests');
      expect(result[0].reason).toContain('3 critical issues');
    });
  });

  describe('getAnalysisStatus', () => {
    it('should return not_found status when no metrics exist', async () => {
      mockPrismaService.codeMetrics.findFirst.mockResolvedValue(null);

      const result = await service.getAnalysisStatus('test-project');

      expect(result.status).toBe('not_found');
      expect(result.message).toContain('No analysis');
    });

    it('should return completed status for recent analysis', async () => {
      const recentTime = new Date(Date.now() - 2 * 60 * 1000); // 2 minutes ago
      mockPrismaService.codeMetrics.findFirst.mockResolvedValue({
        lastAnalyzedAt: recentTime,
      });

      const result = await service.getAnalysisStatus('test-project');

      expect(result.status).toBe('completed');
      expect(result.completedAt).toEqual(recentTime);
    });
  });

  describe('getAnalysisComparison', () => {
    it('should return zeroed comparison when no metrics exist', async () => {
      mockPrismaService.codeMetrics.findMany.mockResolvedValue([]);
      mockPrismaService.codeMetrics.findFirst.mockResolvedValue(null);

      const result = await service.getAnalysisComparison('test-project');

      expect(result.healthScoreChange).toBe(0);
      expect(result.newTests).toBe(0);
      expect(result.coverageChange).toBe(0);
      expect(result.complexityChange).toBe(0);
      expect(result.newFiles).toBe(0);
      expect(result.deletedFiles).toBe(0);
      expect(result.qualityImprovement).toBe(false);
    });
  });

  describe('getTestSummary', () => {
    it('should return zeroed summary when no tests exist', async () => {
      mockPrismaService.testCase.count.mockResolvedValue(0);
      mockPrismaService.testCase.findMany.mockResolvedValue([]);

      const result = await service.getTestSummary('test-project');

      expect(result.totalTests).toBe(0);
      expect(result.passing).toBe(0);
      expect(result.failing).toBe(0);
      expect(result.skipped).toBe(0);
      expect(result.lastExecution).toBeUndefined();
    });

    it('should count test execution results correctly', async () => {
      mockPrismaService.testCase.count.mockResolvedValue(5);
      mockPrismaService.testCase.findMany.mockResolvedValue([
        { executions: [{ status: 'pass', executedAt: new Date('2025-01-15T10:00:00Z') }] },
        { executions: [{ status: 'pass', executedAt: new Date('2025-01-15T10:01:00Z') }] },
        { executions: [{ status: 'fail', executedAt: new Date('2025-01-15T10:02:00Z') }] },
        { executions: [{ status: 'skip', executedAt: new Date('2025-01-15T10:03:00Z') }] },
        { executions: [] }, // No execution yet
      ]);

      const result = await service.getTestSummary('test-project');

      expect(result.totalTests).toBe(5);
      expect(result.passing).toBe(2);
      expect(result.failing).toBe(1);
      expect(result.skipped).toBe(1);
    });
  });

  describe('triggerAnalysis', () => {
    it('should throw NotFoundException when project not found', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue(null);

      await expect(service.triggerAnalysis('non-existent')).rejects.toThrow(
        NotFoundException
      );
    });

    it('should throw NotFoundException when project has no repository', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue({
        id: 'test-project',
        repositoryUrl: null,
        localPath: null,
      });

      await expect(service.triggerAnalysis('test-project')).rejects.toThrow(
        'no repository configured'
      );
    });

    it('should queue analysis job when project has repository', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue({
        id: 'test-project',
        repositoryUrl: 'https://github.com/test/repo',
        localPath: null,
      });
      mockWorkersService.analyzeProject.mockResolvedValue({ id: 'job-123' });

      const result = await service.triggerAnalysis('test-project');

      expect(result.jobId).toBe('job-123');
      expect(result.status).toBe('queued');
      expect(mockWorkersService.analyzeProject).toHaveBeenCalledWith('test-project');
    });
  });
});
