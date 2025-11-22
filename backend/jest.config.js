// Set DATABASE_URL before any tests run
process.env.DATABASE_URL =
  process.env.DATABASE_URL ||
  'postgresql://postgres:CHANGE_ME_POSTGRES_PASSWORD@127.0.0.1:5434/vibestudio_test?schema=public';

// CRITICAL SAFETY GUARD: Validate DATABASE_URL before running ANY tests
// This prevents catastrophic data loss from accidentally running tests against production
const databaseUrl = process.env.DATABASE_URL;
const PRODUCTION_PORTS = ['5432', '5433'];
const PRODUCTION_DBS = ['vibestudio'];
const TEST_PORT = '5434';
const TEST_DB = 'vibestudio_test';

if (!databaseUrl) {
  throw new Error('❌ DATABASE_URL not set for tests');
}

// Extract port from URL
const portMatch = databaseUrl.match(/:(\d+)\//);
const port = portMatch ? portMatch[1] : null;

if (port && PRODUCTION_PORTS.includes(port)) {
  throw new Error(
    `❌ SAFETY GUARD: Tests cannot run against production database!\n` +
    `   Port ${port} is a PRODUCTION port.\n` +
    `   Use port ${TEST_PORT} for test database.\n` +
    `   Current DATABASE_URL: ${databaseUrl}\n` +
    `\n` +
    `   Fix: Set DATABASE_URL to use port ${TEST_PORT}`
  );
}

// Extract database name from URL (everything after last / and before ?)
const dbMatch = databaseUrl.match(/\/([^/?]+)(?:\?|$)/);
const dbName = dbMatch ? dbMatch[1] : null;

if (dbName && PRODUCTION_DBS.includes(dbName)) {
  throw new Error(
    `❌ SAFETY GUARD: Tests cannot run against production database!\n` +
    `   Database "${dbName}" is PRODUCTION.\n` +
    `   Use "${TEST_DB}" for tests.\n` +
    `   Current DATABASE_URL: ${databaseUrl}\n` +
    `\n` +
    `   Fix: Set DATABASE_URL to use database name "${TEST_DB}"`
  );
}

console.log('✅ Test database safety validation passed');
console.log(`   Database: ${dbName} on port ${port}`);

module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  testPathIgnorePatterns: ['/node_modules/', '/dist/'],
  // Don't auto-mock Prisma Client
  unmockedModulePathPatterns: ['@prisma/client'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/__tests__/**',
    '!src/**/index.ts',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  // Conditionally load setup file - skip for integration tests that need real DB
  setupFilesAfterEnv: [
    '<rootDir>/src/mcp/servers/execution/__tests__/conditional-setup.ts'
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^(\.{1,2}/.*)\\.js$': '$1',
  },
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      tsconfig: {
        target: 'ES2020',
        module: 'commonjs',
        lib: ['ES2020'],
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
        emitDecoratorMetadata: true,
        experimentalDecorators: true,
        moduleResolution: 'node',
      },
    }],
  },
};
