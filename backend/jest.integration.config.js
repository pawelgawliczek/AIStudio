// Jest config for integration/e2e tests in src/__tests__
// Uses REAL Prisma client (no mocking) for database integration tests

// Force override DATABASE_URL for tests - use DEV database from host machine
process.env.DATABASE_URL =
  'postgresql://postgres:CHANGE_ME_POSTGRES_PASSWORD@127.0.0.1:5433/vibestudio?schema=public';

module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  // Integration tests can be long-running
  testTimeout: 30000,
  // Force exit after tests complete
  forceExit: true,
  detectOpenHandles: false,
  // Run tests serially
  maxWorkers: 1,
  // Match integration and e2e test files in __tests__ directories
  testMatch: [
    '**/__tests__/**/*.integration.test.ts',
    '**/__tests__/**/*.e2e.test.ts',
  ],
  // CRITICAL: Ignore __mocks__ directory to use real Prisma client
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
