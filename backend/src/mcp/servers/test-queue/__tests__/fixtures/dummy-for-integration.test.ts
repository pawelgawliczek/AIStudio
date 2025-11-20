/**
 * Dummy test file for integration testing
 *
 * This file is ONLY used by run_tests.integration.test.ts to verify
 * that the test runner can execute real Jest commands.
 *
 * It's intentionally simple and fast to avoid slowing down integration tests.
 */

describe('Dummy Test for Integration Testing', () => {
  it('should pass (dummy test 1)', () => {
    expect(1 + 1).toBe(2);
  });

  it('should pass (dummy test 2)', () => {
    expect('hello').toBe('hello');
  });

  it('should pass (dummy test 3)', () => {
    expect(true).toBe(true);
  });
});
