import { PrismaClient } from '@prisma/client';

const PRODUCTION_PORTS = ['5432', '5433'];
const PRODUCTION_DBS = ['vibestudio'];
const TEST_PORT = '5434';
const TEST_DB = 'vibestudio_test';

/**
 * Validates that a database URL is safe for testing
 * @throws Error if URL points to production database
 */
export function validateTestDatabaseUrl(url: string): void {
  // Check port
  const portMatch = url.match(/:(\d+)\//);
  const port = portMatch ? portMatch[1] : null;

  if (port && PRODUCTION_PORTS.includes(port)) {
    throw new Error(
      `❌ SAFETY GUARD: Cannot connect to production database in tests!\n` +
        `   Port ${port} is PRODUCTION. Use port ${TEST_PORT} for tests.\n` +
        `   Current URL: ${url}`
    );
  }

  // Check database name (everything after last / and before ?)
  const dbMatch = url.match(/\/([^/?]+)(?:\?|$)/);
  const dbName = dbMatch ? dbMatch[1] : null;

  if (dbName && PRODUCTION_DBS.includes(dbName)) {
    throw new Error(
      `❌ SAFETY GUARD: Cannot connect to production database in tests!\n` +
        `   Database "${dbName}" is PRODUCTION. Use "${TEST_DB}" for tests.\n` +
        `   Current URL: ${url}`
    );
  }
}

/**
 * Creates a Prisma client for integration tests with safety validation
 * @returns PrismaClient instance connected to test database
 * @throws Error if DATABASE_URL points to production
 *
 * @example
 * ```typescript
 * import { createTestPrismaClient } from '@/test-utils/safe-prisma-client';
 *
 * let prisma: PrismaClient;
 *
 * beforeAll(() => {
 *   prisma = createTestPrismaClient(); // Validates safety automatically
 * });
 *
 * afterAll(async () => {
 *   await prisma.$disconnect();
 * });
 * ```
 */
export function createTestPrismaClient(): PrismaClient {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error('DATABASE_URL not set for integration tests');
  }

  // Validate before creating client
  validateTestDatabaseUrl(databaseUrl);

  return new PrismaClient({
    datasources: {
      db: { url: databaseUrl },
    },
  });
}
