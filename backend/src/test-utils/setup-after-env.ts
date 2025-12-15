/**
 * Jest Setup After Environment
 * Runs before each test file, after test framework is initialized
 *
 * This file provides centralized test cleanup to prevent tests from hanging
 * when run in groups due to leaked timers, uncleaned mocks, or shared state.
 */

// Track if we've already set up the unhandled rejection handler
let handlerInstalled = false;

// Before each test - ensure clean state
beforeEach(() => {
  jest.clearAllMocks();
});

// After each test - cleanup
afterEach(() => {
  // Restore real timers if fake timers were used
  // Check if setTimeout is mocked (indicates fake timers are active)
  try {
    if (jest.isMockFunction(global.setTimeout)) {
      jest.useRealTimers();
    }
  } catch {
    // Ignore errors - timers might not be mockable in all contexts
  }

  // Clear all mocks
  jest.clearAllMocks();
});

// After all tests in a file - final cleanup
afterAll(() => {
  // Ensure real timers are restored
  try {
    if (jest.isMockFunction(global.setTimeout)) {
      jest.useRealTimers();
    }
  } catch {
    // Ignore
  }
});

// Global error handler for unhandled rejections in tests
// Only install once to avoid duplicate handlers
if (!handlerInstalled) {
  process.on('unhandledRejection', (reason, promise) => {
    console.error('[Test] Unhandled Rejection at:', promise, 'reason:', reason);
  });
  handlerInstalled = true;
}
