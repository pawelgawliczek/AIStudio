/**
 * Tests for CodeMetricsController
 * CRITICAL: Tests for all 12 endpoints
 */

import { Test, TestingModule } from '@nestjs/testing';
import { CodeMetricsController } from '../code-metrics.controller';
import { CodeMetricsService } from '../code-metrics.service';
import { HttpStatus } from '@nestjs/common';

describe('CodeMetricsController', () => {
  let controller: CodeMetricsController;
  let service: CodeMetricsService;

  const mockCodeMetricsService = {
    getProjectMetrics: jest.fn(),
    getFileHotspots: jest.fn(),
    getTrendData: jest.fn(),
    getCodeIssues: jest.fn(),
    getFileDetail: jest.fn(),
    triggerAnalysis: jest.fn(),
    getFolderHierarchy: jest.fn(),
    getCoverageGaps: jest.fn(),
    getAnalysisStatus: jest.fn(),
    getAnalysisComparison: jest.fn(),
    getTestSummary: jest.fn(),
    getFileChanges: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CodeMetricsController],
      providers: [
        {
          provide: CodeMetricsService,
          useValue: mockCodeMetricsService,
        },
      ],
    }).compile();

    controller = module.get<CodeMetricsController>(CodeMetricsController);
    service = module.get<CodeMetricsService>(CodeMetricsService);

    jest.clearAllMocks();
  });

  describe('GET /code-metrics/project/:projectId', () => {
    const projectId = 'test-project-001';

    const mockProjectMetrics = {
      healthScore: {
        overallScore: 75,
        coverage: 80,
        complexity: 8,
        techDebtRatio: 15,
        trend: 'improving',
        weeklyChange: 2,
      },
      totalLoc: 10000,
      locByLanguage: { typescript: 8000, javascript: 2000 },
      securityIssues: { critical: 1, high: 2, medium: 5, low: 10 },
      lastUpdate: new Date('2025-01-15T10:00:00Z'),
    };

    it('should return project metrics for valid projectId', async () => {
      mockCodeMetricsService.getProjectMetrics.mockResolvedValue(mockProjectMetrics);

      const result = await controller.getProjectMetrics(projectId, {});

      expect(result).toEqual(mockProjectMetrics);
      expect(service.getProjectMetrics).toHaveBeenCalledWith(projectId, {});
    });

    it('should pass query parameters to service', async () => {
      const query = { timeRangeDays: 30 };
      mockCodeMetricsService.getProjectMetrics.mockResolvedValue(mockProjectMetrics);

      await controller.getProjectMetrics(projectId, query);

      expect(service.getProjectMetrics).toHaveBeenCalledWith(projectId, query);
    });

    it('should handle service errors', async () => {
      const errorMessage = 'Failed to fetch metrics';
      mockCodeMetricsService.getProjectMetrics.mockRejectedValue(new Error(errorMessage));

      await expect(controller.getProjectMetrics(projectId, {})).rejects.toThrow(errorMessage);
    });

    it('should return metrics with empty data when no metrics exist', async () => {
      const emptyMetrics = {
        healthScore: {
          overallScore: 0,
          coverage: 0,
          complexity: 0,
          techDebtRatio: 0,
          trend: 'stable',
          weeklyChange: 0,
        },
        totalLoc: 0,
        locByLanguage: {},
        securityIssues: { critical: 0, high: 0, medium: 0, low: 0 },
        lastUpdate: new Date(),
      };
      mockCodeMetricsService.getProjectMetrics.mockResolvedValue(emptyMetrics);

      const result = await controller.getProjectMetrics(projectId, {});

      expect(result).toEqual(emptyMetrics);
    });
  });

  describe('GET /code-metrics/project/:projectId/hotspots', () => {
    const projectId = 'test-project-001';

    const mockHotspots = [
      {
        filePath: 'backend/src/auth/password-reset.ts',
        riskScore: 85.5,
        complexity: 25,
        churnCount: 45,
        coverage: 30,
        loc: 500,
        lastModified: new Date('2025-01-15T10:00:00Z'),
        criticalIssues: 3,
      },
      {
        filePath: 'frontend/src/App.tsx',
        riskScore: 45.2,
        complexity: 15,
        churnCount: 20,
        coverage: 75,
        loc: 300,
        lastModified: new Date('2025-01-14T09:00:00Z'),
        criticalIssues: 0,
      },
    ];

    it('should return file hotspots for valid projectId', async () => {
      mockCodeMetricsService.getFileHotspots.mockResolvedValue(mockHotspots);

      const result = await controller.getFileHotspots(projectId, {});

      expect(result).toEqual(mockHotspots);
      expect(service.getFileHotspots).toHaveBeenCalledWith(projectId, {});
    });

    it('should pass query parameters for filtering', async () => {
      const query = { minRiskScore: 50, limit: 10 };
      mockCodeMetricsService.getFileHotspots.mockResolvedValue(mockHotspots);

      await controller.getFileHotspots(projectId, query);

      expect(service.getFileHotspots).toHaveBeenCalledWith(projectId, query);
    });

    it('should return empty array when no hotspots exist', async () => {
      mockCodeMetricsService.getFileHotspots.mockResolvedValue([]);

      const result = await controller.getFileHotspots(projectId, {});

      expect(result).toEqual([]);
    });

    it('should handle service errors', async () => {
      mockCodeMetricsService.getFileHotspots.mockRejectedValue(new Error('Database error'));

      await expect(controller.getFileHotspots(projectId, {})).rejects.toThrow('Database error');
    });
  });

  describe('GET /code-metrics/project/:projectId/trends', () => {
    const projectId = 'test-project-001';

    const mockTrendData = [
      {
        date: new Date('2025-01-01'),
        healthScore: 70,
        coverage: 75,
        complexity: 8,
        techDebt: 20,
      },
      {
        date: new Date('2025-01-02'),
        healthScore: 72,
        coverage: 76,
        complexity: 8,
        techDebt: 19,
      },
    ];

    it('should return trend data for valid projectId', async () => {
      mockCodeMetricsService.getTrendData.mockResolvedValue(mockTrendData);

      const result = await controller.getTrendData(projectId, 30);

      expect(result).toEqual(mockTrendData);
      expect(service.getTrendData).toHaveBeenCalledWith(projectId, 30);
    });

    it('should use default 30 days when days not provided', async () => {
      mockCodeMetricsService.getTrendData.mockResolvedValue(mockTrendData);

      await controller.getTrendData(projectId, undefined);

      expect(service.getTrendData).toHaveBeenCalledWith(projectId, 30);
    });

    it('should accept custom days parameter', async () => {
      mockCodeMetricsService.getTrendData.mockResolvedValue(mockTrendData);

      await controller.getTrendData(projectId, 60);

      expect(service.getTrendData).toHaveBeenCalledWith(projectId, 60);
    });

    it('should handle service errors', async () => {
      mockCodeMetricsService.getTrendData.mockRejectedValue(new Error('No trend data'));

      await expect(controller.getTrendData(projectId, 30)).rejects.toThrow('No trend data');
    });
  });

  describe('GET /code-metrics/project/:projectId/issues', () => {
    const projectId = 'test-project-001';

    const mockCodeIssues = [
      {
        severity: 'critical',
        type: 'complexity',
        count: 5,
        filesAffected: 3,
        sampleFiles: ['file1.ts', 'file2.ts', 'file3.ts'],
      },
      {
        severity: 'high',
        type: 'duplication',
        count: 12,
        filesAffected: 8,
        sampleFiles: ['file4.ts', 'file5.ts'],
      },
    ];

    it('should return code issues for valid projectId', async () => {
      mockCodeMetricsService.getCodeIssues.mockResolvedValue(mockCodeIssues);

      const result = await controller.getCodeIssues(projectId);

      expect(result).toEqual(mockCodeIssues);
      expect(service.getCodeIssues).toHaveBeenCalledWith(projectId);
    });

    it('should return empty array when no issues exist', async () => {
      mockCodeMetricsService.getCodeIssues.mockResolvedValue([]);

      const result = await controller.getCodeIssues(projectId);

      expect(result).toEqual([]);
    });

    it('should handle service errors', async () => {
      mockCodeMetricsService.getCodeIssues.mockRejectedValue(new Error('Failed to fetch issues'));

      await expect(controller.getCodeIssues(projectId)).rejects.toThrow('Failed to fetch issues');
    });
  });

  describe('GET /code-metrics/file/:projectId', () => {
    const projectId = 'test-project-001';
    const filePath = 'backend/src/auth/password-reset.ts';

    const mockFileDetail = {
      filePath: 'backend/src/auth/password-reset.ts',
      language: 'typescript',
      riskScore: 85.5,
      loc: 500,
      complexity: 25,
      cognitiveComplexity: 32,
      maintainabilityIndex: 45,
      coverage: 30,
      churnCount: 45,
      linesChanged: 250,
      churnRate: 5.5,
      lastModified: new Date('2025-01-15T10:00:00Z'),
      recentChanges: [
        { storyKey: 'ST-123', date: new Date('2025-01-15'), linesChanged: 50 },
      ],
      issues: [{ severity: 'critical', type: 'complexity', message: 'Too complex', line: 42 }],
      imports: ['express', '../utils/validation'],
      importedBy: ['backend/src/auth/auth.controller.ts'],
      couplingScore: 'high',
    };

    it('should return file details for valid projectId and filePath', async () => {
      mockCodeMetricsService.getFileDetail.mockResolvedValue(mockFileDetail);

      const result = await controller.getFileDetail(projectId, filePath);

      expect(result).toEqual(mockFileDetail);
      expect(service.getFileDetail).toHaveBeenCalledWith(projectId, filePath);
    });

    it('should handle URL encoded file paths', async () => {
      const encodedPath = encodeURIComponent(filePath);
      mockCodeMetricsService.getFileDetail.mockResolvedValue(mockFileDetail);

      await controller.getFileDetail(projectId, encodedPath);

      expect(service.getFileDetail).toHaveBeenCalledWith(projectId, encodedPath);
    });

    it('should throw NotFoundException when file not found', async () => {
      const notFoundError = new Error('File not found: nonexistent.ts');
      notFoundError.name = 'NotFoundException';
      mockCodeMetricsService.getFileDetail.mockRejectedValue(notFoundError);

      await expect(controller.getFileDetail(projectId, 'nonexistent.ts')).rejects.toThrow(
        'File not found'
      );
    });

    it('should handle service errors', async () => {
      mockCodeMetricsService.getFileDetail.mockRejectedValue(new Error('Database error'));

      await expect(controller.getFileDetail(projectId, filePath)).rejects.toThrow(
        'Database error'
      );
    });
  });

  describe('POST /code-metrics/project/:projectId/analyze', () => {
    const projectId = 'test-project-001';

    const mockAnalysisResponse = {
      jobId: 'job-abc-123',
      status: 'queued',
      message: 'Analysis job started successfully',
    };

    it('should trigger analysis and return job info', async () => {
      mockCodeMetricsService.triggerAnalysis.mockResolvedValue(mockAnalysisResponse);

      const result = await controller.triggerAnalysis(projectId);

      expect(result).toEqual(mockAnalysisResponse);
      expect(service.triggerAnalysis).toHaveBeenCalledWith(projectId);
    });

    it('should return HTTP 202 Accepted status (via decorator)', async () => {
      mockCodeMetricsService.triggerAnalysis.mockResolvedValue(mockAnalysisResponse);

      const result = await controller.triggerAnalysis(projectId);

      // The actual HTTP status is set by @HttpCode(HttpStatus.ACCEPTED) decorator
      expect(result.status).toBe('queued');
    });

    it('should throw NotFoundException when project not found', async () => {
      const notFoundError = new Error('Project not found');
      notFoundError.name = 'NotFoundException';
      mockCodeMetricsService.triggerAnalysis.mockRejectedValue(notFoundError);

      await expect(controller.triggerAnalysis(projectId)).rejects.toThrow('Project not found');
    });

    it('should throw BadRequestException when project has no repository', async () => {
      const badRequestError = new Error('Project has no repository path configured');
      badRequestError.name = 'BadRequestException';
      mockCodeMetricsService.triggerAnalysis.mockRejectedValue(badRequestError);

      await expect(controller.triggerAnalysis(projectId)).rejects.toThrow(
        'no repository path configured'
      );
    });

    it('should throw ConflictException when analysis already running', async () => {
      const conflictError = new Error('Analysis already running for this project');
      conflictError.name = 'ConflictException';
      mockCodeMetricsService.triggerAnalysis.mockRejectedValue(conflictError);

      await expect(controller.triggerAnalysis(projectId)).rejects.toThrow('already running');
    });
  });

  describe('GET /code-metrics/project/:projectId/hierarchy', () => {
    const projectId = 'test-project-001';

    const mockHierarchy = {
      name: 'root',
      path: '',
      type: 'folder' as const,
      metrics: {
        fileCount: 10,
        totalLoc: 5000,
        avgComplexity: 8,
        avgCognitiveComplexity: 12,
        avgMaintainability: 75,
        avgCoverage: 80,
        avgRiskScore: 40,
        uncoveredFiles: 2,
        criticalIssues: 3,
        healthScore: 75,
      },
      children: [
        {
          name: 'backend',
          path: 'backend',
          type: 'folder' as const,
          metrics: {
            fileCount: 5,
            totalLoc: 3000,
            avgComplexity: 10,
            avgCognitiveComplexity: 15,
            avgMaintainability: 70,
            avgCoverage: 75,
            avgRiskScore: 50,
            uncoveredFiles: 1,
            criticalIssues: 2,
            healthScore: 70,
          },
          children: [],
        },
      ],
    };

    it('should return folder hierarchy for valid projectId', async () => {
      mockCodeMetricsService.getFolderHierarchy.mockResolvedValue(mockHierarchy);

      const result = await controller.getFolderHierarchy(projectId);

      expect(result).toEqual(mockHierarchy);
      expect(service.getFolderHierarchy).toHaveBeenCalledWith(projectId);
    });

    it('should return empty hierarchy when no files exist', async () => {
      const emptyHierarchy = {
        name: 'root',
        path: '',
        type: 'folder' as const,
        metrics: {
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
        },
        children: [],
      };
      mockCodeMetricsService.getFolderHierarchy.mockResolvedValue(emptyHierarchy);

      const result = await controller.getFolderHierarchy(projectId);

      expect(result).toEqual(emptyHierarchy);
    });

    it('should handle service errors', async () => {
      mockCodeMetricsService.getFolderHierarchy.mockRejectedValue(
        new Error('Failed to build hierarchy')
      );

      await expect(controller.getFolderHierarchy(projectId)).rejects.toThrow(
        'Failed to build hierarchy'
      );
    });
  });

  describe('GET /code-metrics/project/:projectId/coverage-gaps', () => {
    const projectId = 'test-project-001';

    const mockCoverageGaps = [
      {
        filePath: 'backend/src/critical-service.ts',
        loc: 800,
        complexity: 30,
        riskScore: 95,
        coverage: 10,
        priority: 950,
        reason: 'High risk, Complex code, Large file, Low coverage',
      },
      {
        filePath: 'frontend/src/utils/helper.ts',
        loc: 200,
        complexity: 15,
        riskScore: 60,
        coverage: 40,
        priority: 360,
        reason: 'High risk, Complex code',
      },
    ];

    it('should return coverage gaps for valid projectId', async () => {
      mockCodeMetricsService.getCoverageGaps.mockResolvedValue(mockCoverageGaps);

      const result = await controller.getCoverageGaps(projectId, 20);

      expect(result).toEqual(mockCoverageGaps);
      expect(service.getCoverageGaps).toHaveBeenCalledWith(projectId, 20);
    });

    it('should use default limit of 20 when not provided', async () => {
      mockCodeMetricsService.getCoverageGaps.mockResolvedValue(mockCoverageGaps);

      await controller.getCoverageGaps(projectId, undefined);

      expect(service.getCoverageGaps).toHaveBeenCalledWith(projectId, 20);
    });

    it('should accept custom limit parameter', async () => {
      mockCodeMetricsService.getCoverageGaps.mockResolvedValue(mockCoverageGaps);

      await controller.getCoverageGaps(projectId, 50);

      expect(service.getCoverageGaps).toHaveBeenCalledWith(projectId, 50);
    });

    it('should return empty array when no gaps exist', async () => {
      mockCodeMetricsService.getCoverageGaps.mockResolvedValue([]);

      const result = await controller.getCoverageGaps(projectId, 20);

      expect(result).toEqual([]);
    });

    it('should handle service errors', async () => {
      mockCodeMetricsService.getCoverageGaps.mockRejectedValue(
        new Error('Failed to fetch coverage gaps')
      );

      await expect(controller.getCoverageGaps(projectId, 20)).rejects.toThrow(
        'Failed to fetch coverage gaps'
      );
    });
  });

  describe('GET /code-metrics/project/:projectId/analysis-status', () => {
    const projectId = 'test-project-001';

    it('should return running status', async () => {
      const runningStatus = {
        status: 'running' as const,
        progress: 45,
        message: 'Analyzing files...',
        startedAt: new Date('2025-01-15T10:00:00Z'),
      };
      mockCodeMetricsService.getAnalysisStatus.mockResolvedValue(runningStatus);

      const result = await controller.getAnalysisStatus(projectId);

      expect(result).toEqual(runningStatus);
      expect(service.getAnalysisStatus).toHaveBeenCalledWith(projectId);
    });

    it('should return completed status', async () => {
      const completedStatus = {
        status: 'completed' as const,
        progress: 100,
        message: 'Analysis completed successfully',
        startedAt: new Date('2025-01-15T10:00:00Z'),
        completedAt: new Date('2025-01-15T10:15:00Z'),
      };
      mockCodeMetricsService.getAnalysisStatus.mockResolvedValue(completedStatus);

      const result = await controller.getAnalysisStatus(projectId);

      expect(result).toEqual(completedStatus);
    });

    it('should return queued status', async () => {
      const queuedStatus = {
        status: 'queued' as const,
        message: 'Analysis queued',
      };
      mockCodeMetricsService.getAnalysisStatus.mockResolvedValue(queuedStatus);

      const result = await controller.getAnalysisStatus(projectId);

      expect(result.status).toBe('queued');
    });

    it('should return failed status', async () => {
      const failedStatus = {
        status: 'failed' as const,
        message: 'Analysis failed: Repository not accessible',
        startedAt: new Date('2025-01-15T10:00:00Z'),
      };
      mockCodeMetricsService.getAnalysisStatus.mockResolvedValue(failedStatus);

      const result = await controller.getAnalysisStatus(projectId);

      expect(result.status).toBe('failed');
    });

    it('should return not_found status when no analysis exists', async () => {
      const notFoundStatus = {
        status: 'not_found' as const,
        message: 'No analysis has been run for this project',
      };
      mockCodeMetricsService.getAnalysisStatus.mockResolvedValue(notFoundStatus);

      const result = await controller.getAnalysisStatus(projectId);

      expect(result.status).toBe('not_found');
    });

    it('should handle service errors', async () => {
      mockCodeMetricsService.getAnalysisStatus.mockRejectedValue(new Error('Database error'));

      await expect(controller.getAnalysisStatus(projectId)).rejects.toThrow('Database error');
    });
  });

  describe('GET /code-metrics/project/:projectId/comparison', () => {
    const projectId = 'test-project-001';

    const mockComparison = {
      healthScoreChange: 3,
      newTests: 15,
      coverageChange: 5,
      complexityChange: -2,
      newFiles: 8,
      deletedFiles: 2,
      qualityImprovement: true,
      lastAnalysis: new Date('2025-01-14T10:00:00Z'),
    };

    it('should return comparison data showing improvement', async () => {
      mockCodeMetricsService.getAnalysisComparison.mockResolvedValue(mockComparison);

      const result = await controller.getAnalysisComparison(projectId);

      expect(result).toEqual(mockComparison);
      expect(result.qualityImprovement).toBe(true);
      expect(service.getAnalysisComparison).toHaveBeenCalledWith(projectId);
    });

    it('should return comparison showing decline', async () => {
      const declineComparison = {
        ...mockComparison,
        healthScoreChange: -5,
        coverageChange: -3,
        qualityImprovement: false,
      };
      mockCodeMetricsService.getAnalysisComparison.mockResolvedValue(declineComparison);

      const result = await controller.getAnalysisComparison(projectId);

      expect(result.qualityImprovement).toBe(false);
      expect(result.healthScoreChange).toBe(-5);
    });

    it('should return zeroed comparison when no previous analysis', async () => {
      const zeroComparison = {
        healthScoreChange: 0,
        newTests: 0,
        coverageChange: 0,
        complexityChange: 0,
        newFiles: 0,
        deletedFiles: 0,
        qualityImprovement: false,
      };
      mockCodeMetricsService.getAnalysisComparison.mockResolvedValue(zeroComparison);

      const result = await controller.getAnalysisComparison(projectId);

      expect(result).toEqual(zeroComparison);
    });

    it('should handle service errors', async () => {
      mockCodeMetricsService.getAnalysisComparison.mockRejectedValue(
        new Error('Failed to compare analyses')
      );

      await expect(controller.getAnalysisComparison(projectId)).rejects.toThrow(
        'Failed to compare analyses'
      );
    });
  });

  describe('GET /code-metrics/project/:projectId/test-summary', () => {
    const projectId = 'test-project-001';

    const mockTestSummary = {
      totalTests: 150,
      passing: 142,
      failing: 5,
      skipped: 3,
      lastExecution: new Date('2025-01-15T10:30:00Z'),
    };

    it('should return test summary with all counts', async () => {
      mockCodeMetricsService.getTestSummary.mockResolvedValue(mockTestSummary);

      const result = await controller.getTestSummary(projectId);

      expect(result).toEqual(mockTestSummary);
      expect(service.getTestSummary).toHaveBeenCalledWith(projectId);
    });

    it('should return zeroed summary when no tests exist', async () => {
      const zeroSummary = {
        totalTests: 0,
        passing: 0,
        failing: 0,
        skipped: 0,
      };
      mockCodeMetricsService.getTestSummary.mockResolvedValue(zeroSummary);

      const result = await controller.getTestSummary(projectId);

      expect(result.totalTests).toBe(0);
      expect(result.lastExecution).toBeUndefined();
    });

    it('should handle summary with all passing tests', async () => {
      const allPassingSummary = {
        totalTests: 100,
        passing: 100,
        failing: 0,
        skipped: 0,
        lastExecution: new Date('2025-01-15T10:30:00Z'),
      };
      mockCodeMetricsService.getTestSummary.mockResolvedValue(allPassingSummary);

      const result = await controller.getTestSummary(projectId);

      expect(result.passing).toBe(100);
      expect(result.failing).toBe(0);
    });

    it('should handle summary with failing tests', async () => {
      const failingSummary = {
        totalTests: 50,
        passing: 35,
        failing: 15,
        skipped: 0,
        lastExecution: new Date('2025-01-15T10:30:00Z'),
      };
      mockCodeMetricsService.getTestSummary.mockResolvedValue(failingSummary);

      const result = await controller.getTestSummary(projectId);

      expect(result.failing).toBe(15);
    });

    it('should handle service errors', async () => {
      mockCodeMetricsService.getTestSummary.mockRejectedValue(
        new Error('Failed to fetch test summary')
      );

      await expect(controller.getTestSummary(projectId)).rejects.toThrow(
        'Failed to fetch test summary'
      );
    });
  });

  describe('GET /code-metrics/project/:projectId/file-changes', () => {
    const projectId = 'test-project-001';

    const mockFileChanges = {
      files: [
        {
          filePath: 'backend/src/service.ts',
          status: 'modified',
          language: 'typescript',
          current: {
            linesOfCode: 250,
            cyclomaticComplexity: 12,
            cognitiveComplexity: 18,
            maintainabilityIndex: 75,
            testCoverage: 80,
            riskScore: 40,
          },
          previous: {
            linesOfCode: 200,
            cyclomaticComplexity: 10,
            cognitiveComplexity: 15,
            maintainabilityIndex: 78,
            testCoverage: 75,
            riskScore: 35,
          },
          changes: {
            linesOfCode: 50,
            cyclomaticComplexity: 2,
            cognitiveComplexity: 3,
            maintainabilityIndex: -3,
            testCoverage: 5,
            riskScore: 5,
          },
        },
        {
          filePath: 'frontend/src/new-component.tsx',
          status: 'added',
          language: 'typescript',
          current: {
            linesOfCode: 100,
            cyclomaticComplexity: 5,
            cognitiveComplexity: 8,
            maintainabilityIndex: 85,
            testCoverage: 90,
            riskScore: 20,
          },
          previous: null,
          changes: null,
        },
      ],
    };

    it('should return file changes for valid projectId', async () => {
      mockCodeMetricsService.getFileChanges.mockResolvedValue(mockFileChanges);

      const result = await controller.getFileChanges(projectId);

      expect(result).toEqual(mockFileChanges);
      expect(service.getFileChanges).toHaveBeenCalledWith(projectId);
    });

    it('should handle modified files with metrics changes', async () => {
      mockCodeMetricsService.getFileChanges.mockResolvedValue(mockFileChanges);

      const result = await controller.getFileChanges(projectId);

      const modifiedFile = result.files.find((f: any) => f.status === 'modified');
      expect(modifiedFile).toBeDefined();
      expect(modifiedFile.changes).not.toBeNull();
    });

    it('should handle added files with no previous metrics', async () => {
      mockCodeMetricsService.getFileChanges.mockResolvedValue(mockFileChanges);

      const result = await controller.getFileChanges(projectId);

      const addedFile = result.files.find((f: any) => f.status === 'added');
      expect(addedFile).toBeDefined();
      expect(addedFile.previous).toBeNull();
    });

    it('should handle deleted files', async () => {
      const changesWithDeleted = {
        files: [
          {
            filePath: 'old-file.ts',
            status: 'deleted',
            language: 'typescript',
            current: null,
            previous: {
              linesOfCode: 150,
              cyclomaticComplexity: 8,
              cognitiveComplexity: 12,
              maintainabilityIndex: 70,
              testCoverage: 60,
              riskScore: 45,
            },
            changes: null,
          },
        ],
      };
      mockCodeMetricsService.getFileChanges.mockResolvedValue(changesWithDeleted);

      const result = await controller.getFileChanges(projectId);

      const deletedFile = result.files.find((f: any) => f.status === 'deleted');
      expect(deletedFile).toBeDefined();
      expect(deletedFile.current).toBeNull();
    });

    it('should return empty files array when no changes', async () => {
      const noChanges = { files: [] };
      mockCodeMetricsService.getFileChanges.mockResolvedValue(noChanges);

      const result = await controller.getFileChanges(projectId);

      expect(result.files).toEqual([]);
    });

    it('should handle service errors', async () => {
      mockCodeMetricsService.getFileChanges.mockRejectedValue(
        new Error('Failed to fetch file changes')
      );

      await expect(controller.getFileChanges(projectId)).rejects.toThrow(
        'Failed to fetch file changes'
      );
    });
  });

  describe('Controller integration', () => {
    it('should have proper dependency injection', () => {
      expect(controller).toBeDefined();
      expect(service).toBeDefined();
    });

    it('should call service methods through controller', async () => {
      const projectId = 'test-project';
      mockCodeMetricsService.getProjectMetrics.mockResolvedValue({});

      await controller.getProjectMetrics(projectId, {});

      expect(service.getProjectMetrics).toHaveBeenCalledTimes(1);
    });

    it('should propagate service exceptions to HTTP layer', async () => {
      mockCodeMetricsService.getProjectMetrics.mockRejectedValue(new Error('Service error'));

      await expect(controller.getProjectMetrics('test', {})).rejects.toThrow('Service error');
    });
  });
});
