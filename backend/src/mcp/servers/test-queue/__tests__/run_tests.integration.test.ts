import { PrismaClient } from '@prisma/client';
import { handler } from '../run_tests';

/**
 * Integration tests for run_tests MCP tool
 *
 * These tests actually execute real test commands (unlike unit tests which mock execSync).
 * They are slower and should be skipped in CI if needed via SKIP_INTEGRATION env var.
 *
 * Run with: npm test run_tests.integration.test.ts
 */

// Skip these tests in CI or if explicitly requested
const describeIntegration = process.env.SKIP_INTEGRATION === 'true' ? describe.skip : describe;

describeIntegration('run_tests Integration Tests', () => {
  let prisma: PrismaClient;

  // Use valid UUIDs
  const TEST_STORY_ID = 'integration-test-story-id-0000000000';
  const TEST_ENTRY_ID = 'integration-test-entry-id-0000000000';

  // Longer timeout for real test execution
  jest.setTimeout(120000); // 2 minutes

  beforeAll(() => {
    prisma = new PrismaClient();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('Real Jest Execution', () => {
    it('should execute a real simple Jest test and parse results', async () => {
      // Create a mock queue entry
      const mockEntry = {
        id: TEST_ENTRY_ID,
        storyId: TEST_STORY_ID,
        status: 'running',
        story: { key: 'INT-TEST-1', title: 'Integration Test' },
        testResults: null,
      };

      jest.spyOn(prisma.testQueue, 'findFirst').mockResolvedValue(mockEntry as any);
      const mockUpdate = jest.spyOn(prisma.testQueue, 'update').mockResolvedValue({} as any);

      // Execute with real Jest (will run a small subset of tests)
      const result = await handler(prisma, {
        storyId: TEST_STORY_ID,
        testType: 'unit',
      });

      // Verify structure
      expect(result.success).toBeDefined();
      expect(result.testResults).toBeDefined();
      expect(result.testResults.totalTests).toBeGreaterThan(0);
      expect(result.testResults.duration).toBeGreaterThan(0);
      expect(result.testResults.attempts).toHaveLength(1);

      // Verify database was updated
      expect(mockUpdate).toHaveBeenCalled();
    });
  });

  describe('JSON Output Parsing', () => {
    it('should correctly parse JSON output from Jest', async () => {
      const mockEntry = {
        id: TEST_ENTRY_ID,
        storyId: TEST_STORY_ID,
        status: 'running',
        story: { key: 'INT-TEST-2', title: 'JSON Parsing Test' },
        testResults: null,
      };

      jest.spyOn(prisma.testQueue, 'findFirst').mockResolvedValue(mockEntry as any);
      jest.spyOn(prisma.testQueue, 'update').mockResolvedValue({} as any);

      const result = await handler(prisma, {
        storyId: TEST_STORY_ID,
        testType: 'unit',
      });

      // If JSON parsing works, we should have accurate counts
      expect(result.testResults.passedTests).toBeGreaterThanOrEqual(0);
      expect(result.testResults.failedTests).toBeGreaterThanOrEqual(0);
      expect(result.testResults.totalTests).toBe(
        result.testResults.passedTests + result.testResults.failedTests + result.testResults.skippedTests
      );
    });
  });

  describe('Retry Logic with Real Commands', () => {
    it('should handle real command failures and retries', async () => {
      const mockEntry = {
        id: TEST_ENTRY_ID,
        storyId: TEST_STORY_ID,
        status: 'running',
        story: { key: 'INT-TEST-3', title: 'Retry Test' },
        testResults: null,
      };

      jest.spyOn(prisma.testQueue, 'findFirst').mockResolvedValue(mockEntry as any);
      jest.spyOn(prisma.testQueue, 'update').mockResolvedValue({} as any);

      // Run tests with a pattern that might not match anything
      // This should fail but demonstrate retry logic
      const result = await handler(prisma, {
        storyId: TEST_STORY_ID,
        testType: 'unit',
      });

      // Should have at least one attempt
      expect(result.testResults.attempts.length).toBeGreaterThanOrEqual(1);
      expect(result.testResults.attempts.length).toBeLessThanOrEqual(3);

      // Each attempt should have proper structure
      for (const attempt of result.testResults.attempts) {
        expect(attempt.attempt).toBeGreaterThan(0);
        expect(attempt.result).toMatch(/passed|failed|timeout/);
        expect(attempt.duration).toBeGreaterThanOrEqual(0);
        expect(attempt.timestamp).toBeTruthy();
      }
    });
  });

  describe('Output Capture', () => {
    it('should capture real test output', async () => {
      const mockEntry = {
        id: TEST_ENTRY_ID,
        storyId: TEST_STORY_ID,
        status: 'running',
        story: { key: 'INT-TEST-4', title: 'Output Capture Test' },
        testResults: null,
      };

      jest.spyOn(prisma.testQueue, 'findFirst').mockResolvedValue(mockEntry as any);
      jest.spyOn(prisma.testQueue, 'update').mockResolvedValue({} as any);

      const result = await handler(prisma, {
        storyId: TEST_STORY_ID,
        testType: 'unit',
      });

      // Output should contain test information
      expect(result.testResults.output).toBeTruthy();
      expect(result.testResults.output.length).toBeGreaterThan(0);

      // Output should be truncated if too long (max 1000 lines)
      const lineCount = result.testResults.output.split('\n').length;
      expect(lineCount).toBeLessThanOrEqual(1000);
    });
  });

  describe('Error Handling', () => {
    it('should handle test execution errors gracefully', async () => {
      const mockEntry = {
        id: TEST_ENTRY_ID,
        storyId: TEST_STORY_ID,
        status: 'running',
        story: { key: 'INT-TEST-5', title: 'Error Handling Test' },
        testResults: null,
      };

      jest.spyOn(prisma.testQueue, 'findFirst').mockResolvedValue(mockEntry as any);
      jest.spyOn(prisma.testQueue, 'update').mockResolvedValue({} as any);

      // Run tests - even if some fail, the handler should not throw
      const result = await handler(prisma, {
        storyId: TEST_STORY_ID,
        testType: 'unit',
      });

      // Should always return a result
      expect(result).toBeDefined();
      expect(result.testResults).toBeDefined();
      expect(result.storyId).toBe(TEST_STORY_ID);
    });
  });
});
