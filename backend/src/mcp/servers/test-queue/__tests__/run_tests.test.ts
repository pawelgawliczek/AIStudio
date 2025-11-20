import * as childProcess from 'child_process';
import { PrismaClient } from '@prisma/client';
import { ValidationError, NotFoundError } from '../../../types';
import { handler } from '../run_tests';

// Mock child_process
jest.mock('child_process');

describe('run_tests Tool', () => {
  let prisma: PrismaClient;
  let mockExecSync: jest.MockedFunction<typeof childProcess.execSync>;

  // Use valid UUID format
  const TEST_STORY_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
  const TEST_ENTRY_ID = 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22';

  beforeEach(() => {
    // Use fake timers to mock sleep delays (5 seconds per retry)
    jest.useFakeTimers();

    prisma = new PrismaClient();
    mockExecSync = childProcess.execSync as jest.MockedFunction<typeof childProcess.execSync>;
    jest.clearAllMocks();

    // Default mock: successful test execution
    mockExecSync.mockReturnValue('Tests: 10 passed, 10 total\nTest Suites: 5 passed, 5 total');
  });

  afterEach(async () => {
    await prisma.$disconnect();
    jest.useRealTimers();
  });

  // ============================================================================
  // Input Validation
  // ============================================================================

  describe('Input Validation', () => {
    it('should throw ValidationError when storyId is missing', async () => {
      await expect(
        handler(prisma, { storyId: '' })
      ).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError when testType is invalid', async () => {
      await expect(
        handler(prisma, { storyId: TEST_STORY_ID, testType: 'invalid' as any })
      ).rejects.toThrow(ValidationError);

      await expect(
        handler(prisma, { storyId: TEST_STORY_ID, testType: 'invalid' as any })
      ).rejects.toThrow(/Invalid testType/);
    });

    it('should use default testType="all" when not provided', async () => {
      // Mock database
      const mockEntry = {
        id: TEST_ENTRY_ID,
        storyId: TEST_STORY_ID,
        status: 'running',
        story: { key: 'ST-45', title: 'Test Story' },
      };

      jest.spyOn(prisma.testQueue, 'findFirst').mockResolvedValue(mockEntry as any);
      jest.spyOn(prisma.testQueue, 'update').mockResolvedValue({} as any);

      const result = await handler(prisma, { storyId: TEST_STORY_ID });

      expect(result.testType).toBe('all');
    });
  });

  // ============================================================================
  // Story & Queue Validation
  // ============================================================================

  describe('Story and Queue Validation', () => {
    it('should throw NotFoundError when no running queue entry exists', async () => {
      jest.spyOn(prisma.testQueue, 'findFirst').mockResolvedValue(null);

      await expect(
        handler(prisma, { storyId: TEST_STORY_ID, testType: 'unit' })
      ).rejects.toThrow(NotFoundError);

      await expect(
        handler(prisma, { storyId: TEST_STORY_ID, testType: 'unit' })
      ).rejects.toThrow(/TestQueue/);
    });

    it('should throw NotFoundError when queue entry has wrong status', async () => {
      const mockEntry = {
        id: TEST_ENTRY_ID,
        storyId: TEST_STORY_ID,
        status: 'pending', // Wrong status
        story: { key: 'ST-45', title: 'Test Story' },
      };

      jest.spyOn(prisma.testQueue, 'findFirst').mockResolvedValue(null);

      await expect(
        handler(prisma, { storyId: TEST_STORY_ID, testType: 'unit' })
      ).rejects.toThrow(NotFoundError);
    });
  });

  // ============================================================================
  // Test Execution
  // ============================================================================

  describe('Test Execution', () => {
    beforeEach(() => {
      const mockEntry = {
        id: TEST_ENTRY_ID,
        storyId: TEST_STORY_ID,
        status: 'running',
        story: { key: 'ST-45', title: 'Test Story' },
        testResults: null,
      };

      jest.spyOn(prisma.testQueue, 'findFirst').mockResolvedValue(mockEntry as any);
      jest.spyOn(prisma.testQueue, 'update').mockResolvedValue({} as any);
    });

    it('should execute unit tests successfully', async () => {
      mockExecSync.mockReturnValue(
        'Tests: 10 passed, 10 total\nTest Suites: 5 passed, 5 total\nTime: 5.123s'
      );

      const result = await handler(prisma, {
        storyId: TEST_STORY_ID,
        testType: 'unit',
      });

      expect(result.success).toBe(true);
      expect(result.testType).toBe('unit');
      expect(result.testResults.passedTests).toBe(10);
      expect(result.testResults.totalTests).toBe(10);
      expect(result.testResults.failedTests).toBe(0);
      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining('npm test'),
        expect.objectContaining({
          cwd: '/opt/stack/AIStudio/backend',
        })
      );
    });

    it('should execute integration tests successfully', async () => {
      mockExecSync.mockReturnValue(
        'Tests: 5 passed, 5 total\nTest Suites: 3 passed, 3 total'
      );

      const result = await handler(prisma, {
        storyId: TEST_STORY_ID,
        testType: 'integration',
      });

      expect(result.success).toBe(true);
      expect(result.testType).toBe('integration');
      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining('integration'),
        expect.any(Object)
      );
    });

    it('should execute e2e tests successfully', async () => {
      mockExecSync.mockReturnValue('  23 passed (2m)');

      const result = await handler(prisma, {
        storyId: TEST_STORY_ID,
        testType: 'e2e',
      });

      expect(result.success).toBe(true);
      expect(result.testType).toBe('e2e');
      expect(result.testResults.passedTests).toBe(23);
      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining('playwright'),
        expect.objectContaining({
          cwd: '/opt/stack/AIStudio',
        })
      );
    });

    it('should execute all test types sequentially (testType=all)', async () => {
      let callCount = 0;
      mockExecSync.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return 'Tests: 10 passed, 10 total'; // unit
        if (callCount === 2) return 'Tests: 5 passed, 5 total'; // integration
        return '  23 passed (2m)'; // e2e
      });

      const result = await handler(prisma, {
        storyId: TEST_STORY_ID,
        testType: 'all',
      });

      expect(result.success).toBe(true);
      expect(result.testType).toBe('all');
      expect(result.testResults.totalTests).toBeGreaterThan(0);
      expect(mockExecSync).toHaveBeenCalledTimes(3);
    });

    it('should fail fast on first failure in "all" mode', async () => {
      // Unit tests always fail (all 3 retry attempts)
      mockExecSync.mockImplementation(() => {
        const error: any = new Error('Test failed');
        error.status = 1;
        error.stdout = 'Tests: 1 failed, 9 passed, 10 total';
        error.stderr = '';
        throw error;
      });

      const resultPromise = handler(prisma, {
        storyId: TEST_STORY_ID,
        testType: 'all',
      });

      // Fast-forward through all timer delays
      await jest.runAllTimersAsync();

      const result = await resultPromise;

      expect(result.success).toBe(false);
      expect(mockExecSync).toHaveBeenCalledTimes(3); // Will retry 3 times before fail-fast
      expect(result.failureReasons?.[0]).toContain('unit tests failed');
    });
  });

  // ============================================================================
  // Retry Logic
  // ============================================================================

  describe('Retry Logic', () => {
    beforeEach(() => {
      const mockEntry = {
        id: TEST_ENTRY_ID,
        storyId: TEST_STORY_ID,
        status: 'running',
        story: { key: 'ST-45', title: 'Test Story' },
        testResults: null,
      };

      jest.spyOn(prisma.testQueue, 'findFirst').mockResolvedValue(mockEntry as any);
      jest.spyOn(prisma.testQueue, 'update').mockResolvedValue({} as any);
    });

    it('should retry failed tests up to 3 times', async () => {
      mockExecSync.mockImplementation(() => {
        const error: any = new Error('Test failed');
        error.status = 1;
        error.stdout = 'Tests: 1 failed, 9 passed, 10 total';
        error.stderr = '';
        throw error;
      });

      const resultPromise = handler(prisma, {
        storyId: TEST_STORY_ID,
        testType: 'unit',
      });

      // Fast-forward through all timer delays
      await jest.runAllTimersAsync();

      const result = await resultPromise;

      expect(result.success).toBe(false);
      expect(result.testResults.attempts.length).toBe(3);
      expect(mockExecSync).toHaveBeenCalledTimes(3);
    });

    it('should succeed on second attempt (retry recovery)', async () => {
      let attemptCount = 0;
      mockExecSync.mockImplementation(() => {
        attemptCount++;
        if (attemptCount === 1) {
          // First attempt fails
          const error: any = new Error('Test failed');
          error.status = 1;
          error.stdout = 'Tests: 1 failed, 9 passed, 10 total';
          error.stderr = '';
          throw error;
        }
        // Second attempt succeeds
        return 'Tests: 10 passed, 10 total';
      });

      const resultPromise = handler(prisma, {
        storyId: TEST_STORY_ID,
        testType: 'unit',
      });

      // Fast-forward through all timer delays
      await jest.runAllTimersAsync();

      const result = await resultPromise;

      expect(result.success).toBe(true);
      expect(result.testResults.attempts.length).toBe(2);
      expect(result.testResults.attempts[0].result).toBe('failed');
      expect(result.testResults.attempts[1].result).toBe('passed');
      expect(mockExecSync).toHaveBeenCalledTimes(2);
    });

    it('should fail after 3 exhausted attempts', async () => {
      mockExecSync.mockImplementation(() => {
        const error: any = new Error('Test failed');
        error.status = 1;
        error.stdout = 'Tests: 2 failed, 8 passed, 10 total';
        error.stderr = '';
        throw error;
      });

      const resultPromise = handler(prisma, {
        storyId: TEST_STORY_ID,
        testType: 'unit',
      });

      // Fast-forward through all timer delays
      await jest.runAllTimersAsync();

      const result = await resultPromise;

      expect(result.success).toBe(false);
      expect(result.testResults.attempts.length).toBe(3);
      expect(result.testResults.attempts.every((a) => a.result === 'failed')).toBe(true);
    });
  });

  // ============================================================================
  // Result Parsing
  // ============================================================================

  describe('Test Result Parsing', () => {
    beforeEach(() => {
      const mockEntry = {
        id: TEST_ENTRY_ID,
        storyId: TEST_STORY_ID,
        status: 'running',
        story: { key: 'ST-45', title: 'Test Story' },
        testResults: null,
      };

      jest.spyOn(prisma.testQueue, 'findFirst').mockResolvedValue(mockEntry as any);
      jest.spyOn(prisma.testQueue, 'update').mockResolvedValue({} as any);
    });

    it('should parse Jest output correctly (pass/fail counts)', async () => {
      mockExecSync.mockReturnValue(
        'Tests: 2 failed, 1 skipped, 97 passed, 100 total\nTest Suites: 1 failed, 1 skipped, 18 passed, 20 total'
      );

      const result = await handler(prisma, {
        storyId: TEST_STORY_ID,
        testType: 'unit',
      });

      expect(result.testResults.totalTests).toBe(100);
      expect(result.testResults.passedTests).toBe(97);
      expect(result.testResults.failedTests).toBe(2);
      expect(result.testResults.skippedTests).toBe(1);
    });

    it('should parse Playwright output correctly', async () => {
      mockExecSync.mockReturnValue(
        'Running 25 tests using 2 workers\n  1 failed\n  2 skipped\n  22 passed (3m)'
      );

      const result = await handler(prisma, {
        storyId: TEST_STORY_ID,
        testType: 'e2e',
      });

      expect(result.testResults.passedTests).toBe(22);
      expect(result.testResults.failedTests).toBe(1);
      expect(result.testResults.skippedTests).toBe(2);
      expect(result.testResults.totalTests).toBe(25);
    });

    it('should calculate total duration across attempts', async () => {
      mockExecSync.mockReturnValue('Tests: 10 passed, 10 total');

      const result = await handler(prisma, {
        storyId: TEST_STORY_ID,
        testType: 'unit',
      });

      expect(result.testResults.duration).toBeGreaterThanOrEqual(0);
      expect(typeof result.testResults.duration).toBe('number');
    });
  });

  // ============================================================================
  // Timeout Handling
  // ============================================================================

  describe('Timeout Handling', () => {
    beforeEach(() => {
      const mockEntry = {
        id: TEST_ENTRY_ID,
        storyId: TEST_STORY_ID,
        status: 'running',
        story: { key: 'ST-45', title: 'Test Story' },
        testResults: null,
      };

      jest.spyOn(prisma.testQueue, 'findFirst').mockResolvedValue(mockEntry as any);
      jest.spyOn(prisma.testQueue, 'update').mockResolvedValue({} as any);
    });

    it('should timeout and mark as failed', async () => {
      mockExecSync.mockImplementation(() => {
        const error: any = new Error('Command timeout');
        error.killed = true;
        error.signal = 'SIGTERM';
        error.status = null;
        error.stdout = 'Partial output...';
        error.stderr = '';
        throw error;
      });

      const resultPromise = handler(prisma, {
        storyId: TEST_STORY_ID,
        testType: 'unit',
      });

      await jest.runAllTimersAsync();
      const result = await resultPromise;

      expect(result.success).toBe(false);
      expect(result.testResults.attempts[0].result).toBe('timeout');
      expect(result.testResults.attempts[0].errorMessage).toContain('timeout');
    });

    it('should capture partial output before timeout', async () => {
      mockExecSync.mockImplementation(() => {
        const error: any = new Error('Command timeout');
        error.killed = true;
        error.signal = 'SIGTERM';
        error.status = null;
        error.stdout = 'Tests started...\nRunning test 1...\nRunning test 2...';
        error.stderr = '';
        throw error;
      });

      const resultPromise = handler(prisma, {
        storyId: TEST_STORY_ID,
        testType: 'unit',
      });

      await jest.runAllTimersAsync();
      const result = await resultPromise;

      expect(result.testResults.output).toContain('Tests started');
      expect(result.testResults.output).toContain('Running test');
    });
  });

  // ============================================================================
  // Breaking Migration Detection
  // ============================================================================

  describe('Breaking Migration Detection', () => {
    it('should detect breaking migration from TestQueue metadata', async () => {
      const mockEntry = {
        id: TEST_ENTRY_ID,
        storyId: TEST_STORY_ID,
        status: 'running',
        story: { key: 'ST-45', title: 'Test Story' },
        testResults: {
          migrationDetails: {
            isBreaking: true,
            migrationCount: 2,
            schemaVersion: '20251120_add_fields',
          },
        },
      };

      jest.spyOn(prisma.testQueue, 'findFirst').mockResolvedValue(mockEntry as any);
      jest.spyOn(prisma.testQueue, 'update').mockResolvedValue({} as any);

      // Make tests fail
      mockExecSync.mockImplementation(() => {
        const error: any = new Error('Test failed');
        error.status = 1;
        error.stdout = 'Tests: 5 failed, 5 passed, 10 total';
        error.stderr = '';
        throw error;
      });

      const resultPromise = handler(prisma, {
        storyId: TEST_STORY_ID,
        testType: 'unit',
      });

      await jest.runAllTimersAsync();
      const result = await resultPromise;

      expect(result.success).toBe(false);
      expect(result.warnings).toBeDefined();
      expect(result.warnings?.[0]).toContain('Breaking schema migration');
      expect(result.testResults.migrationInfo).toBeDefined();
      expect(result.testResults.migrationInfo?.isBreaking).toBe(true);
    });

    it('should not warn if tests pass (even with breaking migration)', async () => {
      const mockEntry = {
        id: TEST_ENTRY_ID,
        storyId: TEST_STORY_ID,
        status: 'running',
        story: { key: 'ST-45', title: 'Test Story' },
        testResults: {
          migrationDetails: {
            isBreaking: true,
            migrationCount: 2,
          },
        },
      };

      jest.spyOn(prisma.testQueue, 'findFirst').mockResolvedValue(mockEntry as any);
      jest.spyOn(prisma.testQueue, 'update').mockResolvedValue({} as any);

      mockExecSync.mockReturnValue('Tests: 10 passed, 10 total');

      const result = await handler(prisma, {
        storyId: TEST_STORY_ID,
        testType: 'unit',
      });

      expect(result.success).toBe(true);
      expect(result.warnings).toBeUndefined();
      expect(result.testResults.migrationInfo).toBeUndefined();
    });

    it('should not warn if no breaking migration', async () => {
      const mockEntry = {
        id: TEST_ENTRY_ID,
        storyId: TEST_STORY_ID,
        status: 'running',
        story: { key: 'ST-45', title: 'Test Story' },
        testResults: null,
      };

      jest.spyOn(prisma.testQueue, 'findFirst').mockResolvedValue(mockEntry as any);
      jest.spyOn(prisma.testQueue, 'update').mockResolvedValue({} as any);

      // Make tests fail
      mockExecSync.mockImplementation(() => {
        const error: any = new Error('Test failed');
        error.status = 1;
        error.stdout = 'Tests: 2 failed, 8 passed, 10 total';
        error.stderr = '';
        throw error;
      });

      const resultPromise = handler(prisma, {
        storyId: TEST_STORY_ID,
        testType: 'unit',
      });

      await jest.runAllTimersAsync();
      const result = await resultPromise;

      expect(result.success).toBe(false);
      expect(result.warnings).toBeUndefined();
      expect(result.testResults.migrationInfo).toBeUndefined();
    });
  });

  // ============================================================================
  // Database Updates
  // ============================================================================

  describe('TestQueue Updates', () => {
    let mockUpdate: jest.SpyInstance;

    beforeEach(() => {
      const mockEntry = {
        id: TEST_ENTRY_ID,
        storyId: TEST_STORY_ID,
        status: 'running',
        story: { key: 'ST-45', title: 'Test Story' },
        testResults: null,
      };

      jest.spyOn(prisma.testQueue, 'findFirst').mockResolvedValue(mockEntry as any);
      mockUpdate = jest.spyOn(prisma.testQueue, 'update').mockResolvedValue({} as any);
    });

    it('should update status to "passed" on success', async () => {
      mockExecSync.mockReturnValue('Tests: 10 passed, 10 total');

      await handler(prisma, {
        storyId: TEST_STORY_ID,
        testType: 'unit',
      });

      expect(mockUpdate).toHaveBeenCalledWith({
        where: { id: TEST_ENTRY_ID },
        data: expect.objectContaining({
          status: 'passed',
          errorMessage: null,
        }),
      });
    });

    it('should update status to "failed" on failure', async () => {
      mockExecSync.mockImplementation(() => {
        const error: any = new Error('Test failed');
        error.status = 1;
        error.stdout = 'Tests: 3 failed, 7 passed, 10 total';
        error.stderr = '';
        throw error;
      });

      const promise = handler(prisma, {
        storyId: TEST_STORY_ID,
        testType: 'unit',
      });
      await jest.runAllTimersAsync();
      await promise;

      expect(mockUpdate).toHaveBeenCalledWith({
        where: { id: TEST_ENTRY_ID },
        data: expect.objectContaining({
          status: 'failed',
          errorMessage: expect.stringContaining('failed'),
        }),
      });
    });

    it('should populate testResults JSON field', async () => {
      mockExecSync.mockReturnValue('Tests: 10 passed, 10 total');

      await handler(prisma, {
        storyId: TEST_STORY_ID,
        testType: 'unit',
      });

      expect(mockUpdate).toHaveBeenCalledWith({
        where: { id: TEST_ENTRY_ID },
        data: expect.objectContaining({
          testResults: expect.objectContaining({
            testType: 'unit',
            success: true,
            totalTests: 10,
            passedTests: 10,
          }),
        }),
      });
    });

    it('should populate errorMessage on failure', async () => {
      mockExecSync.mockImplementation(() => {
        const error: any = new Error('Test failed');
        error.status = 1;
        error.stdout = 'Tests: 5 failed, 5 passed, 10 total';
        error.stderr = '';
        throw error;
      });

      const promise = handler(prisma, {
        storyId: TEST_STORY_ID,
        testType: 'unit',
      });
      await jest.runAllTimersAsync();
      await promise;

      expect(mockUpdate).toHaveBeenCalledWith({
        where: { id: TEST_ENTRY_ID },
        data: expect.objectContaining({
          errorMessage: expect.any(String),
        }),
      });

      const callArgs = mockUpdate.mock.calls[0][0];
      expect(callArgs.data.errorMessage).toMatch(/failed/i);
    });

    it('should set updatedAt timestamp', async () => {
      mockExecSync.mockReturnValue('Tests: 10 passed, 10 total');

      await handler(prisma, {
        storyId: TEST_STORY_ID,
        testType: 'unit',
      });

      expect(mockUpdate).toHaveBeenCalledWith({
        where: { id: TEST_ENTRY_ID },
        data: expect.objectContaining({
          updatedAt: expect.any(Date),
        }),
      });
    });
  });

  // ============================================================================
  // Response Validation
  // ============================================================================

  describe('Response Validation', () => {
    beforeEach(() => {
      const mockEntry = {
        id: TEST_ENTRY_ID,
        storyId: TEST_STORY_ID,
        status: 'running',
        story: { key: 'ST-45', title: 'Test Story' },
        testResults: null,
      };

      jest.spyOn(prisma.testQueue, 'findFirst').mockResolvedValue(mockEntry as any);
      jest.spyOn(prisma.testQueue, 'update').mockResolvedValue({} as any);
    });

    it('should return success=true on passed tests', async () => {
      mockExecSync.mockReturnValue('Tests: 10 passed, 10 total');

      const result = await handler(prisma, {
        storyId: TEST_STORY_ID,
        testType: 'unit',
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('passed');
    });

    it('should return success=false on failed tests', async () => {
      mockExecSync.mockImplementation(() => {
        const error: any = new Error('Test failed');
        error.status = 1;
        error.stdout = 'Tests: 3 failed, 7 passed, 10 total';
        error.stderr = '';
        throw error;
      });

      const resultPromise = handler(prisma, {
        storyId: TEST_STORY_ID,
        testType: 'unit',
      });
      await jest.runAllTimersAsync();
      const result = await resultPromise;

      expect(result.success).toBe(false);
      expect(result.message).toContain('failed');
    });

    it('should include all test attempt details', async () => {
      mockExecSync.mockReturnValue('Tests: 10 passed, 10 total');

      const result = await handler(prisma, {
        storyId: TEST_STORY_ID,
        testType: 'unit',
      });

      expect(result.testResults.attempts).toBeDefined();
      expect(result.testResults.attempts.length).toBeGreaterThan(0);
      expect(result.testResults.attempts[0]).toMatchObject({
        attempt: 1,
        result: 'passed',
        exitCode: 0,
        duration: expect.any(Number),
        timestamp: expect.any(String),
      });
    });

    it('should include warnings array with migration info when applicable', async () => {
      const mockEntry = {
        id: TEST_ENTRY_ID,
        storyId: TEST_STORY_ID,
        status: 'running',
        story: { key: 'ST-45', title: 'Test Story' },
        testResults: {
          migrationDetails: {
            isBreaking: true,
            migrationCount: 1,
          },
        },
      };

      jest.spyOn(prisma.testQueue, 'findFirst').mockResolvedValue(mockEntry as any);

      mockExecSync.mockImplementation(() => {
        const error: any = new Error('Test failed');
        error.status = 1;
        error.stdout = 'Tests: 2 failed, 8 passed, 10 total';
        error.stderr = '';
        throw error;
      });

      const resultPromise = handler(prisma, {
        storyId: TEST_STORY_ID,
        testType: 'unit',
      });
      await jest.runAllTimersAsync();
      const result = await resultPromise;

      expect(result.warnings).toBeDefined();
      expect(result.warnings?.length).toBeGreaterThan(0);
      expect(result.warnings?.[0]).toContain('Breaking schema migration');
    });
  });
});
