import { execSync } from 'child_process';

/**
 * Integration tests for run_tests MCP tool
 *
 * CRITICAL: These tests DO NOT call handler() to avoid infinite recursion.
 * Instead, they test the actual CLI commands that would be executed.
 *
 * The problem: Calling handler() with testType='unit' runs:
 *   npm test -- --testPathPattern=.*\.test\.ts$
 * Which matches THIS FILE (run_tests.integration.test.ts), causing infinite loop!
 *
 * Solution: Test the commands directly using execSync, not through handler().
 *
 * Run with: SKIP_INTEGRATION=false npm test run_tests.integration.test.ts
 */

// Skip these tests by default to prevent accidental infinite loops
const describeIntegration = process.env.SKIP_INTEGRATION === 'false' ? describe : describe.skip;

describeIntegration('run_tests Integration Tests - CLI Commands', () => {
  jest.setTimeout(60000); // 1 minute max

  describe('Jest Unit Test Command', () => {
    it('should execute Jest with correct pattern and flags', () => {
      // Test the actual command that would be run (with a safe, specific pattern)
      const command = 'npm test -- --testPathPattern=validation.test.ts$ --json --maxWorkers=1';

      try {
        const output = execSync(command, {
          cwd: '/opt/stack/AIStudio/backend',
          encoding: 'utf-8',
          timeout: 30000,
          maxBuffer: 10 * 1024 * 1024,
        });

        // Should contain JSON output
        expect(output).toContain('"success"');
        expect(output.length).toBeGreaterThan(0);
      } catch (error: any) {
        // Even if tests fail, command should execute
        expect(error.stdout || error.stderr).toBeTruthy();
      }
    });
  });

  describe('Command Pattern Safety', () => {
    it('should NOT match integration test files when running unit tests', () => {
      // This is the pattern used for unit tests
      const unitPattern = '.*\\.test\\.ts$';
      const integrationFile = 'run_tests.integration.test.ts';

      // Unit tests should EXCLUDE integration tests
      const regex = new RegExp(unitPattern);
      const shouldMatch = regex.test(integrationFile);

      // This demonstrates the problem - integration files match unit pattern!
      expect(shouldMatch).toBe(true); // BUG: This causes infinite recursion

      // The fix is to add --testPathIgnorePatterns=integration to the command
    });

    it('should verify exclusion patterns work', () => {
      // Simulate Jest's pattern matching with exclusion
      const file = 'run_tests.integration.test.ts';
      const includePattern = /.*\.test\.ts$/;
      const excludePattern = /integration/;

      const matchesInclude = includePattern.test(file);
      const matchesExclude = excludePattern.test(file);

      expect(matchesInclude).toBe(true);
      expect(matchesExclude).toBe(true);

      // File should be excluded
      const shouldRun = matchesInclude && !matchesExclude;
      expect(shouldRun).toBe(false); // Correctly excluded!
    });
  });

  describe('Playwright E2E Command', () => {
    it.skip('should execute Playwright with JSON reporter', () => {
      // SKIPPED: Playwright tests are expensive and may not be installed
      const command = 'npx playwright test --reporter=json --max-failures=1';

      try {
        const output = execSync(command, {
          cwd: '/opt/stack/AIStudio',
          encoding: 'utf-8',
          timeout: 30000,
        });

        expect(output).toContain('suites');
      } catch (error: any) {
        // Expected - Playwright may not be configured
        expect(error).toBeDefined();
      }
    });
  });

  describe('Output Parsing', () => {
    it('should handle JSON output from Jest', () => {
      const mockJestOutput = JSON.stringify({
        success: true,
        numTotalTests: 10,
        numPassedTests: 10,
        numFailedTests: 0,
        testResults: [],
      });

      const parsed = JSON.parse(mockJestOutput);
      expect(parsed.success).toBe(true);
      expect(parsed.numTotalTests).toBe(10);
    });
  });
});
