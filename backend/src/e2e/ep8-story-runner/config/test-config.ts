/**
 * EP-8 Story Runner E2E Test Configuration
 * Constants and configuration for E2E tests
 */

export const TEST_CONFIG = {
  // Test data naming prefix for isolation
  PREFIX: '_TEST_EP8_',

  // Timestamp for unique naming
  TIMESTAMP: Date.now(),

  // Test project name
  PROJECT_NAME: `_TEST_EP8_Project_${Date.now()}`,

  // Timeouts
  TIMEOUT: {
    DEFAULT: 30000,      // 30 seconds
    BACKUP: 120000,      // 2 minutes
    AGENT_SPAWN: 300000, // 5 minutes
  },

  // Model configuration for test components
  MODEL_CONFIG: {
    modelId: 'claude-sonnet-4-20250514',
    temperature: 0.7,
    maxInputTokens: 50000,
    maxOutputTokens: 8000,
    timeout: 300000,
    maxRetries: 3,
  },

  // Default tools for test agents
  DEFAULT_TOOLS: ['Read', 'Grep', 'Glob'] as string[],
};

/**
 * Generate a unique test name with prefix
 */
export function testName(suffix: string): string {
  return `${TEST_CONFIG.PREFIX}${suffix}_${TEST_CONFIG.TIMESTAMP}`;
}
