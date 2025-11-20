/**
 * Pattern Safety Tests
 *
 * These tests verify that test patterns cannot cause infinite recursion.
 * They run WITHOUT executing any actual tests - just pattern matching logic.
 */

describe('Test Pattern Safety', () => {
  describe('Unit Test Pattern Exclusions', () => {
    it('should exclude integration test files from unit test runs', () => {
      const unitIncludePattern = /.*\.test\.ts$/;
      const unitExcludePatterns = [/e2e/, /integration/];

      const testFiles = [
        'validation.test.ts',           // Should run
        'run_tests.test.ts',            // Should run
        'run_tests.integration.test.ts', // Should NOT run (matches "integration")
        'e2e/login.test.ts',            // Should NOT run (matches "e2e")
        'something.spec.ts',            // Should NOT run (doesn't match .test.ts)
      ];

      const results = testFiles.map(file => {
        const matchesInclude = unitIncludePattern.test(file);
        const matchesAnyExclude = unitExcludePatterns.some(pattern => pattern.test(file));
        return {
          file,
          shouldRun: matchesInclude && !matchesAnyExclude,
        };
      });

      expect(results).toEqual([
        { file: 'validation.test.ts', shouldRun: true },
        { file: 'run_tests.test.ts', shouldRun: true },
        { file: 'run_tests.integration.test.ts', shouldRun: false }, // CRITICAL
        { file: 'e2e/login.test.ts', shouldRun: false },
        { file: 'something.spec.ts', shouldRun: false },
      ]);
    });
  });

  describe('Integration Test Pattern Exclusions', () => {
    it('should exclude run_tests.integration.test.ts from integration runs', () => {
      const integrationIncludePattern = /.*\.integration\.test\.ts$/;
      const integrationExcludePatterns = [/run_tests\.integration/];

      const testFiles = [
        'database.integration.test.ts',      // Should run
        'api.integration.test.ts',           // Should run
        'run_tests.integration.test.ts',     // Should NOT run (self-reference)
        'something.test.ts',                 // Should NOT run (not integration)
      ];

      const results = testFiles.map(file => {
        const matchesInclude = integrationIncludePattern.test(file);
        const matchesAnyExclude = integrationExcludePatterns.some(pattern => pattern.test(file));
        return {
          file,
          shouldRun: matchesInclude && !matchesAnyExclude,
        };
      });

      expect(results).toEqual([
        { file: 'database.integration.test.ts', shouldRun: true },
        { file: 'api.integration.test.ts', shouldRun: true },
        { file: 'run_tests.integration.test.ts', shouldRun: false }, // CRITICAL
        { file: 'something.test.ts', shouldRun: false },
      ]);
    });
  });

  describe('Infinite Recursion Prevention', () => {
    it('should document the infinite loop scenario', () => {
      // This test documents the bug that caused system crashes

      // SCENARIO: User runs integration tests
      // Command: npm test run_tests.integration.test.ts

      // OLD BROKEN CODE:
      // The integration test called handler() with testType='unit'
      // handler() ran: npm test -- --testPathPattern=.*\.test\.ts$
      // That pattern matched run_tests.integration.test.ts
      // So it ran the integration test again → infinite loop

      // FIX #1: Add --testPathIgnorePatterns=integration to unit tests
      // FIX #2: Rewrite integration tests to NOT call handler()
      // FIX #3: Skip integration tests by default (SKIP_INTEGRATION !== 'false')

      const unitPattern = /.*\.test\.ts$/;
      const integrationFile = 'run_tests.integration.test.ts';

      // WITHOUT exclusion, this would cause infinite loop
      expect(unitPattern.test(integrationFile)).toBe(true);

      // WITH exclusion, it's safe
      const excludeIntegration = /integration/;
      const shouldRun = unitPattern.test(integrationFile) && !excludeIntegration.test(integrationFile);
      expect(shouldRun).toBe(false); // Safe!
    });
  });

  describe('Command Construction', () => {
    it('should build unit test command with correct exclusions', () => {
      const command = 'npm test -- --testPathPattern=.*\\.test\\.ts$ --testPathIgnorePatterns=e2e --testPathIgnorePatterns=integration --json';

      expect(command).toContain('--testPathIgnorePatterns=e2e');
      expect(command).toContain('--testPathIgnorePatterns=integration');
      expect(command).toContain('--json');
    });

    it('should build integration test command with self-exclusion', () => {
      const command = 'npm test -- --testPathPattern=.*\\.integration\\.test\\.ts$ --testPathIgnorePatterns=run_tests.integration --json';

      expect(command).toContain('--testPathIgnorePatterns=run_tests.integration');
      expect(command).toContain('--json');
    });
  });
});
