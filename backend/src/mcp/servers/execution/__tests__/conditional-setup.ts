/**
 * Conditional Test Setup
 *
 * Loads the Prisma mock ONLY for unit tests.
 * Integration tests set SKIP_PRISMA_MOCK=true to use real database.
 */

// Check if test wants to skip Prisma mock (for integration tests)
const skipPrismaMock = process.env.SKIP_PRISMA_MOCK === 'true';

if (!skipPrismaMock) {
  // Load the standard test setup with Prisma mock for unit tests
  require('./test-setup');
}

// Note: DATABASE_URL is already set in jest.config.js globally
