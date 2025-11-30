// Jest config for E2E tests - uses REAL Prisma client (no mocking)
// E2E tests need actual database access to test full integration

// Force override DATABASE_URL for tests - use DEV database from host machine
process.env.DATABASE_URL =
  'postgresql://postgres:CHANGE_ME_POSTGRES_PASSWORD@127.0.0.1:5433/vibestudio?schema=public';

module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  // E2E tests can be long-running
  testTimeout: 300000,
  // Force exit after tests complete (prevent hanging from unclosed handles)
  forceExit: true,
  // Detect open handles for debugging
  detectOpenHandles: false,
  // Run tests serially for E2E
  maxWorkers: 1,
  // E2E test match pattern
  testMatch: ['**/e2e/**/*.e2e.test.ts'],
  // CRITICAL: Ignore __mocks__ directory to use real Prisma client
  // The __mocks__ is used for unit tests, E2E tests need real DB access
  modulePathIgnorePatterns: ['<rootDir>/src/__mocks__'],
  // NO moduleNameMapper for @prisma/client - use real Prisma client
  moduleNameMapper: {
    // Only map path aliases, NOT Prisma
    '^@/(.*)$': '<rootDir>/src/$1',
    '^(\\.{1,2}/.*)\\.js$': '$1',
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
