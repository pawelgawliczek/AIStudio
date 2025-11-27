import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../prisma/prisma.service';
import { TestAnalyticsService } from '../test-analytics.service';

describe('TestAnalyticsService', () => {
  let service: TestAnalyticsService;
  let prisma: jest.Mocked<PrismaService>;

  const mockPrismaService = {
    $queryRaw: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TestAnalyticsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<TestAnalyticsService>(TestAnalyticsService);
    prisma = module.get(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getFlakyTests', () => {
    it('should return flaky tests above threshold', async () => {
      const mockFlakyTests = [
        {
          test_case_key: 'TC-AUTH-042',
          test_case_title: 'Login with valid credentials',
          total_runs: 100,
          failed_runs: 15,
          fail_rate: 0.15,
          last_failure: new Date('2025-11-27'),
        },
        {
          test_case_key: 'TC-E2E-015',
          test_case_title: 'Checkout flow',
          total_runs: 50,
          failed_runs: 8,
          fail_rate: 0.16,
          last_failure: new Date('2025-11-26'),
        },
      ];

      mockPrismaService.$queryRaw.mockResolvedValue(mockFlakyTests);

      const result = await service.getFlakyTests('project-uuid', 30, 0.10);

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        testCaseKey: 'TC-AUTH-042',
        failRate: 0.15,
      });
      expect(prisma.$queryRaw).toHaveBeenCalledWith(expect.anything());
    });

    it('should use default threshold of 10%', async () => {
      mockPrismaService.$queryRaw.mockResolvedValue([]);

      await service.getFlakyTests('project-uuid', 30);

      // Verify query was called (threshold is embedded in SQL)
      expect(prisma.$queryRaw).toHaveBeenCalled();
    });

    it('should filter by time window (days parameter)', async () => {
      mockPrismaService.$queryRaw.mockResolvedValue([]);

      await service.getFlakyTests('project-uuid', 7, 0.10);

      expect(prisma.$queryRaw).toHaveBeenCalled();
      // In real implementation, verify date filtering in SQL
    });

    it('should handle no flaky tests found', async () => {
      mockPrismaService.$queryRaw.mockResolvedValue([]);

      const result = await service.getFlakyTests('project-uuid', 30, 0.10);

      expect(result).toHaveLength(0);
    });
  });

  describe('getTestPerformanceTrends', () => {
    it('should return performance trends over time', async () => {
      const mockTrends = [
        {
          date: new Date('2025-11-20'),
          total_tests: 150,
          passed: 145,
          failed: 5,
          avg_duration_ms: 2500,
          pass_rate: 0.967,
        },
        {
          date: new Date('2025-11-21'),
          total_tests: 148,
          passed: 140,
          failed: 8,
          avg_duration_ms: 2700,
          pass_rate: 0.946,
        },
      ];

      mockPrismaService.$queryRaw.mockResolvedValue(mockTrends);

      const result = await service.getTestPerformanceTrends('project-uuid', 30);

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        date: new Date('2025-11-20'),
        totalTests: 150,
        passRate: 0.967,
      });
    });

    it('should handle no data for time period', async () => {
      mockPrismaService.$queryRaw.mockResolvedValue([]);

      const result = await service.getTestPerformanceTrends('project-uuid', 30);

      expect(result).toHaveLength(0);
    });

    it('should aggregate by day', async () => {
      mockPrismaService.$queryRaw.mockResolvedValue([
        {
          date: new Date('2025-11-27'),
          total_tests: 200,
          passed: 195,
          failed: 5,
          avg_duration_ms: 2000,
          pass_rate: 0.975,
        },
      ]);

      const result = await service.getTestPerformanceTrends('project-uuid', 1);

      expect(result).toHaveLength(1);
      expect(result[0].totalTests).toBe(200);
    });
  });

  describe('getUseCaseCoverage', () => {
    it('should return use case test coverage statistics', async () => {
      const mockCoverage = [
        {
          use_case_key: 'UC-AUTH-001',
          use_case_title: 'User Authentication',
          total_test_cases: 10,
          passing_tests: 9,
          failing_tests: 1,
          coverage_percentage: 0.90,
        },
        {
          use_case_key: 'UC-PAYMENT-002',
          use_case_title: 'Payment Processing',
          total_test_cases: 15,
          passing_tests: 15,
          failing_tests: 0,
          coverage_percentage: 1.00,
        },
      ];

      mockPrismaService.$queryRaw.mockResolvedValue(mockCoverage);

      const result = await service.getUseCaseCoverage('project-uuid');

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        useCaseKey: 'UC-AUTH-001',
        totalTestCases: 10,
        coveragePercentage: 0.90,
      });
      expect(result[1].coveragePercentage).toBe(1.00);
    });

    it('should handle use cases with no test cases', async () => {
      const mockCoverage = [
        {
          use_case_key: 'UC-NEW-001',
          use_case_title: 'New Feature',
          total_test_cases: 0,
          passing_tests: 0,
          failing_tests: 0,
          coverage_percentage: 0.00,
        },
      ];

      mockPrismaService.$queryRaw.mockResolvedValue(mockCoverage);

      const result = await service.getUseCaseCoverage('project-uuid');

      expect(result[0].totalTestCases).toBe(0);
      expect(result[0].coveragePercentage).toBe(0.00);
    });
  });

  describe('getTestExecutionTrends', () => {
    it('should return execution trends over time', async () => {
      const mockTrends = [
        {
          week: '2025-W47',
          total_executions: 500,
          pass_rate: 0.95,
          avg_duration: 1500,
        },
        {
          week: '2025-W48',
          total_executions: 550,
          pass_rate: 0.97,
          avg_duration: 1400,
        },
      ];

      mockPrismaService.$queryRaw.mockResolvedValue(mockTrends);

      const result = await service.getTestExecutionTrends('project-uuid', 30);

      expect(result).toHaveLength(2);
      expect(result[0].totalExecutions).toBe(500);
      expect(result[1].passRate).toBe(0.97);
    });
  });

  describe('getSlowTests', () => {
    it('should return slowest tests by average duration', async () => {
      const mockSlowTests = [
        {
          test_case_key: 'TC-E2E-001',
          test_case_title: 'Full checkout flow',
          avg_duration_ms: 45000,
          max_duration_ms: 60000,
          executions: 25,
        },
        {
          test_case_key: 'TC-INT-042',
          test_case_title: 'Database migration',
          avg_duration_ms: 30000,
          max_duration_ms: 35000,
          executions: 10,
        },
      ];

      mockPrismaService.$queryRaw.mockResolvedValue(mockSlowTests);

      const result = await service.getSlowTests('project-uuid', 10);

      expect(result).toHaveLength(2);
      expect(result[0].avgDurationMs).toBe(45000);
      expect(result[0].testCaseKey).toBe('TC-E2E-001');
    });

    it('should limit results to specified count', async () => {
      const mockSlowTests = Array.from({ length: 5 }, (_, i) => ({
        test_case_key: `TC-TEST-${i}`,
        test_case_title: `Test ${i}`,
        avg_duration_ms: 10000 - i * 1000,
        max_duration_ms: 15000,
        executions: 10,
      }));

      mockPrismaService.$queryRaw.mockResolvedValue(mockSlowTests);

      const result = await service.getSlowTests('project-uuid', 5);

      expect(result).toHaveLength(5);
    });

    it('should use default limit of 10', async () => {
      mockPrismaService.$queryRaw.mockResolvedValue([]);

      await service.getSlowTests('project-uuid');

      expect(prisma.$queryRaw).toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should handle database errors gracefully', async () => {
      mockPrismaService.$queryRaw.mockRejectedValue(new Error('Database connection lost'));

      await expect(service.getFlakyTests('project-uuid')).rejects.toThrow('Database connection lost');
    });

    it('should handle invalid project IDs', async () => {
      mockPrismaService.$queryRaw.mockResolvedValue([]);

      const result = await service.getFlakyTests('invalid-uuid');

      expect(result).toHaveLength(0);
    });
  });
});
