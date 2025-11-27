import * as fs from 'fs';
import { Test, TestingModule } from '@nestjs/testing';
import { TestExecutionsService } from '../../test-executions/test-executions.service';
import { AppWebSocketGateway } from '../../websocket/websocket.gateway';
import { TestResultsReporterService } from '../test-results-reporter.service';

// Mock fs module
jest.mock('fs');

describe('TestResultsReporterService', () => {
  let service: TestResultsReporterService;
  let testExecutionsService: jest.Mocked<TestExecutionsService>;
  let websocketGateway: jest.Mocked<AppWebSocketGateway>;

  const mockTestExecutionsService = {
    create: jest.fn(),
    findOne: jest.fn(),
    findAll: jest.fn(),
  };

  const mockWebSocketGateway = {
    broadcastTestExecutionStarted: jest.fn(),
    broadcastTestExecutionCompleted: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TestResultsReporterService,
        {
          provide: TestExecutionsService,
          useValue: mockTestExecutionsService,
        },
        {
          provide: AppWebSocketGateway,
          useValue: mockWebSocketGateway,
        },
      ],
    }).compile();

    service = module.get<TestResultsReporterService>(TestResultsReporterService);
    testExecutionsService = module.get(TestExecutionsService);
    websocketGateway = module.get(AppWebSocketGateway);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('parseJestResults', () => {
    it('should parse valid Jest results successfully', async () => {
      const mockJestJson = JSON.stringify({
        success: true,
        numTotalTests: 2,
        numPassedTests: 1,
        numFailedTests: 1,
        numPendingTests: 0,
        testResults: [
          {
            name: 'test-file.test.ts',
            status: 'passed',
            duration: 123,
          },
          {
            name: 'test-file-2.test.ts',
            status: 'failed',
            duration: 456,
            failureMessage: 'Expected true to be false',
          },
        ],
      });

      (fs.readFileSync as jest.Mock).mockReturnValue(mockJestJson);

      const results = await service.parseJestResults('/path/to/jest-results.json');

      expect(results).toHaveLength(2);
      expect(results[0]).toMatchObject({
        testCaseTitle: 'test-file.test.ts',
        status: 'pass',
        durationMs: 123,
        testLevel: 'unit',
      });
      expect(results[1]).toMatchObject({
        testCaseTitle: 'test-file-2.test.ts',
        status: 'fail',
        durationMs: 456,
        errorMessage: 'Expected true to be false',
      });
    });

    it('should handle missing Jest results file', async () => {
      (fs.readFileSync as jest.Mock).mockImplementation(() => {
        throw new Error('ENOENT: no such file or directory');
      });

      await expect(service.parseJestResults('/path/to/missing.json')).rejects.toThrow();
    });

    it('should map Jest pending status to skip', async () => {
      const mockJestJson = JSON.stringify({
        success: true,
        numTotalTests: 1,
        numPassedTests: 0,
        numFailedTests: 0,
        numPendingTests: 1,
        testResults: [
          {
            name: 'pending-test.test.ts',
            status: 'pending',
            duration: 0,
          },
        ],
      });

      (fs.readFileSync as jest.Mock).mockReturnValue(mockJestJson);

      const results = await service.parseJestResults('/path/to/jest-results.json');

      expect(results[0].status).toBe('skip');
    });
  });

  describe('parsePlaywrightResults', () => {
    it('should parse valid Playwright results successfully', async () => {
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
            ],
          },
        ],
      });

      (fs.readFileSync as jest.Mock).mockReturnValue(mockPlaywrightJson);

      const results = await service.parsePlaywrightResults('/path/to/playwright-results.json');

      expect(results).toHaveLength(2);
      expect(results[0]).toMatchObject({
        testCaseTitle: 'Login Tests > should login successfully',
        status: 'pass',
        durationMs: 2500,
        testLevel: 'e2e',
      });
      expect(results[1]).toMatchObject({
        testCaseTitle: 'Login Tests > should fail with invalid credentials',
        status: 'fail',
        durationMs: 1200,
        errorMessage: 'Timeout waiting for element',
        stackTrace: 'at login.test.ts:45',
      });
    });

    it('should map Playwright timedOut status to error', async () => {
      const mockPlaywrightJson = JSON.stringify({
        suites: [
          {
            title: 'Timeout Tests',
            tests: [
              {
                title: 'should timeout',
                status: 'timedOut',
                duration: 30000,
              },
            ],
          },
        ],
      });

      (fs.readFileSync as jest.Mock).mockReturnValue(mockPlaywrightJson);

      const results = await service.parsePlaywrightResults('/path/to/playwright-results.json');

      expect(results[0].status).toBe('error');
    });
  });

  describe('reportTestExecution', () => {
    it('should report test execution and broadcast WebSocket events', async () => {
      const testData = {
        testCaseKey: 'TC-TEST-001',
        testCaseTitle: 'Login Test',
        testLevel: 'unit' as const,
        status: 'pass' as const,
        durationMs: 123,
        environment: 'docker',
      };

      const mockExecution = {
        id: 'execution-uuid-123',
        projectId: 'project-uuid',
        ...testData,
        executedAt: new Date(),
      };

      mockTestExecutionsService.create.mockResolvedValue(mockExecution as any);

      const result = await service.reportTestExecution(testData);

      // Verify test:started event was broadcast
      expect(websocketGateway.broadcastTestExecutionStarted).toHaveBeenCalledWith(
        'execution-uuid-123',
        'project-uuid',
        expect.objectContaining({
          testCaseKey: 'TC-TEST-001',
          testCaseTitle: 'Login Test',
        })
      );

      // Verify database record was created
      expect(testExecutionsService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          testCaseKey: 'TC-TEST-001',
          status: 'pass',
        })
      );

      // Verify test:completed event was broadcast
      expect(websocketGateway.broadcastTestExecutionCompleted).toHaveBeenCalledWith(
        'execution-uuid-123',
        'project-uuid',
        expect.objectContaining({
          status: 'pass',
          reportUrl: '/test-executions/execution-uuid-123',
        })
      );

      expect(result).toEqual(mockExecution);
    });

    it('should handle failed test execution reporting', async () => {
      const testData = {
        testCaseKey: 'TC-TEST-002',
        testCaseTitle: 'Failed Test',
        testLevel: 'integration' as const,
        status: 'fail' as const,
        durationMs: 456,
        errorMessage: 'Assertion failed',
        stackTrace: 'at test.ts:123',
        environment: 'local',
      };

      const mockExecution = {
        id: 'execution-uuid-456',
        projectId: 'project-uuid',
        ...testData,
        executedAt: new Date(),
      };

      mockTestExecutionsService.create.mockResolvedValue(mockExecution as any);

      await service.reportTestExecution(testData);

      expect(websocketGateway.broadcastTestExecutionCompleted).toHaveBeenCalledWith(
        'execution-uuid-456',
        'project-uuid',
        expect.objectContaining({
          status: 'fail',
          errorMessage: 'Assertion failed',
        })
      );
    });

    it('should handle database errors gracefully', async () => {
      const testData = {
        testCaseKey: 'TC-TEST-003',
        testCaseTitle: 'Error Test',
        testLevel: 'e2e' as const,
        status: 'pass' as const,
        durationMs: 789,
        environment: 'docker',
      };

      mockTestExecutionsService.create.mockRejectedValue(new Error('Database connection failed'));

      await expect(service.reportTestExecution(testData)).rejects.toThrow('Database connection failed');

      // Verify test:started was broadcast before error
      expect(websocketGateway.broadcastTestExecutionStarted).toHaveBeenCalled();
      // Verify test:completed was NOT broadcast due to error
      expect(websocketGateway.broadcastTestExecutionCompleted).not.toHaveBeenCalled();
    });
  });

  describe('edge cases', () => {
    it('should handle empty Jest results', async () => {
      const mockJestJson = JSON.stringify({
        success: true,
        numTotalTests: 0,
        numPassedTests: 0,
        numFailedTests: 0,
        numPendingTests: 0,
        testResults: [],
      });

      (fs.readFileSync as jest.Mock).mockReturnValue(mockJestJson);

      const results = await service.parseJestResults('/path/to/empty.json');

      expect(results).toHaveLength(0);
    });

    it('should handle malformed JSON gracefully', async () => {
      (fs.readFileSync as jest.Mock).mockReturnValue('{ invalid json');

      await expect(service.parseJestResults('/path/to/bad.json')).rejects.toThrow();
    });

    it('should generate test case keys from titles when missing', async () => {
      const testData = {
        testCaseKey: '', // Missing key
        testCaseTitle: 'My Test Case',
        testLevel: 'unit' as const,
        status: 'pass' as const,
        durationMs: 100,
        environment: 'docker',
      };

      const mockExecution = {
        id: 'execution-uuid',
        projectId: 'project-uuid',
        testCaseKey: 'TC-AUTO-001', // Auto-generated
        ...testData,
        executedAt: new Date(),
      };

      mockTestExecutionsService.create.mockResolvedValue(mockExecution as any);

      await service.reportTestExecution(testData);

      expect(testExecutionsService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          testCaseKey: expect.stringMatching(/^TC-/),
        })
      );
    });
  });
});
