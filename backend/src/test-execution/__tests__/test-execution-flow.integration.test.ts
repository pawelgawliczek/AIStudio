import * as fs from 'fs';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { PrismaService } from '../../prisma/prisma.service';
import { TestExecutionsService } from '../../test-executions/test-executions.service';
import { AppWebSocketGateway } from '../../websocket/websocket.gateway';
import { TestAnalyticsController } from '../test-analytics.controller';
import { TestAnalyticsService } from '../test-analytics.service';
import { TestResultsReporterService } from '../test-results-reporter.service';

// Mock fs module
jest.mock('fs');

describe('Test Execution Flow Integration (ST-128)', () => {
  let app: INestApplication;
  let reporterService: TestResultsReporterService;
  let analyticsService: TestAnalyticsService;
  let prismaService: PrismaService;
  let websocketGateway: AppWebSocketGateway;

  const mockPrismaService = {
    testExecution: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    testCase: {
      findMany: jest.fn(),
    },
    $queryRaw: jest.fn(),
  };

  const mockWebSocketGateway = {
    broadcastTestExecutionStarted: jest.fn(),
    broadcastTestExecutionCompleted: jest.fn(),
  };

  const mockTestExecutionsService = {
    create: jest.fn(),
    findOne: jest.fn(),
    findAll: jest.fn(),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [TestAnalyticsController],
      providers: [
        TestResultsReporterService,
        TestAnalyticsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: AppWebSocketGateway,
          useValue: mockWebSocketGateway,
        },
        {
          provide: TestExecutionsService,
          useValue: mockTestExecutionsService,
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    reporterService = moduleFixture.get<TestResultsReporterService>(TestResultsReporterService);
    analyticsService = moduleFixture.get<TestAnalyticsService>(TestAnalyticsService);
    prismaService = moduleFixture.get<PrismaService>(PrismaService);
    websocketGateway = moduleFixture.get<AppWebSocketGateway>(AppWebSocketGateway);
  });

  afterAll(async () => {
    await app.close();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('End-to-End Test Execution Flow', () => {
    it('should complete full test execution workflow: parse → report → notify → query', async () => {
      // STEP 1: Parse Jest results from JSON file
      const mockJestJson = JSON.stringify({
        success: true,
        numTotalTests: 2,
        numPassedTests: 1,
        numFailedTests: 1,
        testResults: [
          {
            name: 'auth.test.ts',
            status: 'passed',
            duration: 2400,
          },
          {
            name: 'checkout.test.ts',
            status: 'failed',
            duration: 12800,
            failureMessage: 'Element not found',
          },
        ],
      });

      (fs.readFileSync as jest.Mock).mockReturnValue(mockJestJson);

      const parsedResults = await reporterService.parseJestResults('/path/to/jest-results.json');

      expect(parsedResults).toHaveLength(2);
      expect(parsedResults[0].status).toBe('pass');
      expect(parsedResults[1].status).toBe('fail');

      // STEP 2: Report test executions to database with WebSocket notifications
      const mockExecution1 = {
        id: 'exec-uuid-1',
        projectId: 'project-uuid',
        testCaseKey: 'TC-AUTH-042',
        testCaseTitle: 'auth.test.ts',
        status: 'pass',
        durationMs: 2400,
        executedAt: new Date(),
      };

      const mockExecution2 = {
        id: 'exec-uuid-2',
        projectId: 'project-uuid',
        testCaseKey: 'TC-E2E-015',
        testCaseTitle: 'checkout.test.ts',
        status: 'fail',
        durationMs: 12800,
        errorMessage: 'Element not found',
        executedAt: new Date(),
      };

      mockTestExecutionsService.create
        .mockResolvedValueOnce(mockExecution1)
        .mockResolvedValueOnce(mockExecution2);

      await reporterService.reportTestExecution(parsedResults[0]);
      await reporterService.reportTestExecution(parsedResults[1]);

      // Verify WebSocket events were broadcast
      expect(websocketGateway.broadcastTestExecutionStarted).toHaveBeenCalledTimes(2);
      expect(websocketGateway.broadcastTestExecutionCompleted).toHaveBeenCalledTimes(2);

      expect(websocketGateway.broadcastTestExecutionCompleted).toHaveBeenNthCalledWith(
        1,
        'exec-uuid-1',
        'project-uuid',
        expect.objectContaining({
          status: 'pass',
          reportUrl: '/test-executions/exec-uuid-1',
        })
      );

      expect(websocketGateway.broadcastTestExecutionCompleted).toHaveBeenNthCalledWith(
        2,
        'exec-uuid-2',
        'project-uuid',
        expect.objectContaining({
          status: 'fail',
          errorMessage: 'Element not found',
          reportUrl: '/test-executions/exec-uuid-2',
        })
      );

      // STEP 3: Query analytics endpoints
      const mockFlakyTests = [
        {
          test_case_key: 'TC-E2E-015',
          test_case_title: 'checkout.test.ts',
          total_runs: 10,
          failed_runs: 5,
          fail_rate: 0.50,
          last_failure: new Date(),
        },
      ];

      mockPrismaService.$queryRaw.mockResolvedValue(mockFlakyTests);

      // Query flaky tests via API
      const response = await request(app.getHttpServer())
        .get('/test-analytics/project/project-uuid/flaky-tests')
        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0]).toMatchObject({
        testCaseKey: 'TC-E2E-015',
        failRate: 0.50,
      });
    });

    it('should handle mixed test results (pass, fail, skip)', async () => {
      const mockPlaywrightJson = JSON.stringify({
        suites: [
          {
            title: 'Login Tests',
            tests: [
              {
                title: 'should login successfully',
                status: 'passed',
                duration: 2500,
              },
              {
                title: 'should fail with invalid credentials',
                status: 'failed',
                duration: 1200,
                error: {
                  message: 'Timeout waiting for element',
                  stack: 'at login.test.ts:45',
                },
              },
              {
                title: 'should skip pending test',
                status: 'skipped',
                duration: 0,
              },
            ],
          },
        ],
      });

      (fs.readFileSync as jest.Mock).mockReturnValue(mockPlaywrightJson);

      const results = await reporterService.parsePlaywrightResults('/path/to/playwright.json');

      expect(results).toHaveLength(3);
      expect(results[0].status).toBe('pass');
      expect(results[1].status).toBe('fail');
      expect(results[2].status).toBe('skip');

      // Report all results
      const mockExecutions = results.map((result, i) => ({
        id: `exec-uuid-${i}`,
        projectId: 'project-uuid',
        ...result,
        executedAt: new Date(),
      }));

      mockTestExecutionsService.create
        .mockResolvedValueOnce(mockExecutions[0])
        .mockResolvedValueOnce(mockExecutions[1])
        .mockResolvedValueOnce(mockExecutions[2]);

      for (const result of results) {
        await reporterService.reportTestExecution(result);
      }

      expect(mockTestExecutionsService.create).toHaveBeenCalledTimes(3);
      expect(websocketGateway.broadcastTestExecutionCompleted).toHaveBeenCalledTimes(3);
    });
  });

  describe('Analytics API Integration', () => {
    it('should query flaky tests with custom parameters', async () => {
      mockPrismaService.$queryRaw.mockResolvedValue([]);

      await request(app.getHttpServer())
        .get('/test-analytics/project/project-uuid/flaky-tests?days=7&threshold=0.20')
        .expect(200);

      expect(prismaService.$queryRaw).toHaveBeenCalled();
    });

    it('should query performance trends', async () => {
      const mockTrends = [
        {
          date: new Date('2025-11-27'),
          total_tests: 150,
          passed: 145,
          failed: 5,
          avg_duration_ms: 2500,
          pass_rate: 0.967,
        },
      ];

      mockPrismaService.$queryRaw.mockResolvedValue(mockTrends);

      const response = await request(app.getHttpServer())
        .get('/test-analytics/project/project-uuid/performance?days=30')
        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0]).toMatchObject({
        totalTests: 150,
        passRate: 0.967,
      });
    });

    it('should query use case coverage', async () => {
      const mockCoverage = [
        {
          use_case_key: 'UC-AUTH-001',
          use_case_title: 'User Authentication',
          total_test_cases: 10,
          passing_tests: 9,
          failing_tests: 1,
          coverage_percentage: 0.90,
        },
      ];

      mockPrismaService.$queryRaw.mockResolvedValue(mockCoverage);

      const response = await request(app.getHttpServer())
        .get('/test-analytics/project/project-uuid/use-case-coverage')
        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0]).toMatchObject({
        useCaseKey: 'UC-AUTH-001',
        coveragePercentage: 0.90,
      });
    });

    it('should query slow tests', async () => {
      const mockSlowTests = [
        {
          test_case_key: 'TC-E2E-001',
          test_case_title: 'Full checkout flow',
          avg_duration_ms: 45000,
          max_duration_ms: 60000,
          executions: 25,
        },
      ];

      mockPrismaService.$queryRaw.mockResolvedValue(mockSlowTests);

      const response = await request(app.getHttpServer())
        .get('/test-analytics/project/project-uuid/slow-tests?limit=5')
        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0]).toMatchObject({
        testCaseKey: 'TC-E2E-001',
        avgDurationMs: 45000,
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      mockPrismaService.$queryRaw.mockRejectedValue(new Error('Database connection failed'));

      await request(app.getHttpServer())
        .get('/test-analytics/project/project-uuid/flaky-tests')
        .expect(500);
    });

    it('should handle invalid project IDs', async () => {
      mockPrismaService.$queryRaw.mockResolvedValue([]);

      await request(app.getHttpServer())
        .get('/test-analytics/project/invalid-uuid/flaky-tests')
        .expect(200) // Returns empty array, not error
        .expect([]);
    });

    it('should handle malformed JSON test results', async () => {
      (fs.readFileSync as jest.Mock).mockReturnValue('{ invalid json');

      await expect(
        reporterService.parseJestResults('/path/to/bad.json')
      ).rejects.toThrow();
    });
  });

  describe('WebSocket Event Flow', () => {
    it('should broadcast events in correct order: started → completed', async () => {
      const testData = {
        testCaseKey: 'TC-TEST-001',
        testCaseTitle: 'Integration Test',
        testLevel: 'integration' as const,
        status: 'pass' as const,
        durationMs: 3000,
        environment: 'docker',
      };

      const mockExecution = {
        id: 'exec-uuid-123',
        projectId: 'project-uuid',
        ...testData,
        executedAt: new Date(),
      };

      mockTestExecutionsService.create.mockResolvedValue(mockExecution);

      await reporterService.reportTestExecution(testData);

      // Verify event order
      const calls = (websocketGateway.broadcastTestExecutionStarted as jest.Mock).mock.invocationCallOrder;
      const calls2 = (websocketGateway.broadcastTestExecutionCompleted as jest.Mock).mock.invocationCallOrder;

      expect(calls[0]).toBeLessThan(calls2[0]); // started called before completed
    });
  });
});
