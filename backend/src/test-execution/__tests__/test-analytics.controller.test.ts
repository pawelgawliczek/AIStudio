import { Test, TestingModule } from '@nestjs/testing';
import { TestAnalyticsController } from '../test-analytics.controller';
import { TestAnalyticsService } from '../test-analytics.service';

describe('TestAnalyticsController', () => {
  let controller: TestAnalyticsController;
  let service: jest.Mocked<TestAnalyticsService>;

  const mockTestAnalyticsService = {
    getFlakyTests: jest.fn(),
    getTestPerformanceTrends: jest.fn(),
    getUseCaseCoverage: jest.fn(),
    getTestExecutionTrends: jest.fn(),
    getSlowTests: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TestAnalyticsController],
      providers: [
        {
          provide: TestAnalyticsService,
          useValue: mockTestAnalyticsService,
        },
      ],
    }).compile();

    controller = module.get<TestAnalyticsController>(TestAnalyticsController);
    service = module.get(TestAnalyticsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /test-analytics/project/:projectId/flaky-tests', () => {
    it('should return flaky tests with default parameters', async () => {
      const mockFlakyTests = [
        {
          testCaseKey: 'TC-AUTH-042',
          testCaseTitle: 'Login test',
          totalRuns: 100,
          failedRuns: 15,
          failRate: 0.15,
          lastFailure: new Date('2025-11-27'),
        },
      ];

      mockTestAnalyticsService.getFlakyTests.mockResolvedValue(mockFlakyTests);

      const result = await controller.getFlakyTests('project-uuid', 30);

      expect(result).toEqual(mockFlakyTests);
      expect(service.getFlakyTests).toHaveBeenCalledWith('project-uuid', 30);
    });

    it('should accept custom days parameter', async () => {
      mockTestAnalyticsService.getFlakyTests.mockResolvedValue([]);

      await controller.getFlakyTests('project-uuid', 7);

      expect(service.getFlakyTests).toHaveBeenCalledWith('project-uuid', 7);
    });

    it('should accept custom days parameter (90)', async () => {
      mockTestAnalyticsService.getFlakyTests.mockResolvedValue([]);

      await controller.getFlakyTests('project-uuid', 90);

      expect(service.getFlakyTests).toHaveBeenCalledWith('project-uuid', 90);
    });

    it('should handle empty results', async () => {
      mockTestAnalyticsService.getFlakyTests.mockResolvedValue([]);

      const result = await controller.getFlakyTests('project-uuid', 30);

      expect(result).toEqual([]);
    });

    it('should handle service errors', async () => {
      mockTestAnalyticsService.getFlakyTests.mockRejectedValue(new Error('Database error'));

      await expect(controller.getFlakyTests('project-uuid', 30)).rejects.toThrow('Database error');
    });
  });

  describe('GET /test-analytics/project/:projectId/performance', () => {
    it('should return performance trends with default days', async () => {
      const mockTrends = [
        {
          date: new Date('2025-11-27'),
          totalTests: 150,
          passed: 145,
          failed: 5,
          avgDurationMs: 2500,
          passRate: 0.967,
        },
      ];

      mockTestAnalyticsService.getTestPerformanceTrends.mockResolvedValue(mockTrends);

      const result = await controller.getPerformanceTrends('project-uuid', 30);

      expect(result).toEqual(mockTrends);
      expect(service.getTestPerformanceTrends).toHaveBeenCalledWith('project-uuid', 30);
    });

    it('should accept custom days parameter', async () => {
      mockTestAnalyticsService.getTestPerformanceTrends.mockResolvedValue([]);

      await controller.getPerformanceTrends('project-uuid', 90);

      expect(service.getTestPerformanceTrends).toHaveBeenCalledWith('project-uuid', 90);
    });

    it('should return trends for recent period', async () => {
      mockTestAnalyticsService.getTestPerformanceTrends.mockResolvedValue([]);

      await controller.getPerformanceTrends('project-uuid', 1);

      expect(service.getTestPerformanceTrends).toHaveBeenCalledWith('project-uuid', 1);
    });
  });

  describe('GET /test-analytics/project/:projectId/use-case-coverage', () => {
    it('should return use case coverage statistics', async () => {
      const mockCoverage = [
        {
          useCaseKey: 'UC-AUTH-001',
          useCaseTitle: 'User Authentication',
          totalTestCases: 10,
          passingTests: 9,
          failingTests: 1,
          coveragePercentage: 0.90,
        },
      ];

      mockTestAnalyticsService.getUseCaseCoverage.mockResolvedValue(mockCoverage);

      const result = await controller.getUseCaseCoverage('project-uuid');

      expect(result).toEqual(mockCoverage);
      expect(service.getUseCaseCoverage).toHaveBeenCalledWith('project-uuid');
    });

    it('should handle projects with no use cases', async () => {
      mockTestAnalyticsService.getUseCaseCoverage.mockResolvedValue([]);

      const result = await controller.getUseCaseCoverage('project-uuid');

      expect(result).toEqual([]);
    });
  });

  describe('GET /test-analytics/project/:projectId/trends', () => {
    it('should return execution trends with default days', async () => {
      const mockTrends = [
        {
          week: '2025-W48',
          totalExecutions: 500,
          passRate: 0.95,
          avgDuration: 1500,
        },
      ];

      mockTestAnalyticsService.getTestExecutionTrends.mockResolvedValue(mockTrends);

      const result = await controller.getExecutionTrends('project-uuid', 30);

      expect(result).toEqual(mockTrends);
      expect(service.getTestExecutionTrends).toHaveBeenCalledWith('project-uuid', 30);
    });

    it('should accept custom days parameter', async () => {
      mockTestAnalyticsService.getTestExecutionTrends.mockResolvedValue([]);

      await controller.getExecutionTrends('project-uuid', 14);

      expect(service.getTestExecutionTrends).toHaveBeenCalledWith('project-uuid', 14);
    });
  });

  describe('GET /test-analytics/project/:projectId/slow-tests', () => {
    it('should return slow tests with default limit', async () => {
      const mockSlowTests = [
        {
          testCaseKey: 'TC-E2E-001',
          testCaseTitle: 'Full checkout flow',
          avgDurationMs: 45000,
          maxDurationMs: 60000,
          executions: 25,
        },
      ];

      mockTestAnalyticsService.getSlowTests.mockResolvedValue(mockSlowTests);

      const result = await controller.getSlowTests('project-uuid', 10);

      expect(result).toEqual(mockSlowTests);
      expect(service.getSlowTests).toHaveBeenCalledWith('project-uuid', 10);
    });

    it('should accept custom limit parameter', async () => {
      mockTestAnalyticsService.getSlowTests.mockResolvedValue([]);

      await controller.getSlowTests('project-uuid', 20);

      expect(service.getSlowTests).toHaveBeenCalledWith('project-uuid', 20);
    });

    it('should handle limit of 1', async () => {
      const mockSlowTests = [
        {
          testCaseKey: 'TC-SLOWEST',
          testCaseTitle: 'Slowest test',
          avgDurationMs: 100000,
          maxDurationMs: 120000,
          executions: 5,
        },
      ];

      mockTestAnalyticsService.getSlowTests.mockResolvedValue(mockSlowTests);

      const result = await controller.getSlowTests('project-uuid', 1);

      expect(result).toHaveLength(1);
      expect(service.getSlowTests).toHaveBeenCalledWith('project-uuid', 1);
    });
  });

  describe('parameter validation', () => {
    it('should handle negative days parameter', async () => {
      // In real implementation, should validate and reject negative values
      mockTestAnalyticsService.getFlakyTests.mockResolvedValue([]);

      await controller.getFlakyTests('project-uuid', -1);

      // Verify service was called (validation would happen at DTO level)
      expect(service.getFlakyTests).toHaveBeenCalled();
    });

    it('should handle very large days parameter', async () => {
      mockTestAnalyticsService.getFlakyTests.mockResolvedValue([]);

      await controller.getFlakyTests('project-uuid', 365);

      expect(service.getFlakyTests).toHaveBeenCalledWith('project-uuid', 365);
    });

    it('should handle zero limit parameter', async () => {
      mockTestAnalyticsService.getSlowTests.mockResolvedValue([]);

      await controller.getSlowTests('project-uuid', 0);

      expect(service.getSlowTests).toHaveBeenCalledWith('project-uuid', 0);
    });
  });

  describe('error handling', () => {
    it('should propagate service errors', async () => {
      const error = new Error('Service unavailable');
      mockTestAnalyticsService.getFlakyTests.mockRejectedValue(error);

      await expect(controller.getFlakyTests('project-uuid', 30)).rejects.toThrow('Service unavailable');
    });

    it('should handle malformed project IDs', async () => {
      mockTestAnalyticsService.getUseCaseCoverage.mockRejectedValue(new Error('Invalid UUID'));

      await expect(controller.getUseCaseCoverage('not-a-uuid')).rejects.toThrow('Invalid UUID');
    });
  });
});
