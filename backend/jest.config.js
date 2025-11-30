// Force override DATABASE_URL for tests - ignore root .env which uses Docker hostname (postgres:5432)
// Tests must use localhost:5433 to connect to DEV database from host machine
process.env.DATABASE_URL =
  'postgresql://postgres:CHANGE_ME_POSTGRES_PASSWORD@127.0.0.1:5433/vibestudio?schema=public';

module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  // Global timeout to prevent infinite hangs (10 seconds per test)
  testTimeout: 10000,
  // Force exit after tests complete (prevent hanging from unclosed handles)
  forceExit: true,
  // Detect open handles for debugging
  detectOpenHandles: false,
  // Run tests serially to prevent Prisma engine initialization race conditions
  // Multiple Jest workers competing for Prisma engine causes infinite loops
  maxWorkers: 1,
  testMatch: ['**/__tests__/**/*.test.ts'],
  // Skip integration tests that require TEST database (port 5434) - run with npm run test:integration
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '\\.integration\\.test\\.ts$',  // Skip *.integration.test.ts files
  ],
  // Auto-mock Prisma Client using __mocks__/@prisma/client.ts
  // This prevents Prisma engine initialization which causes 100% CPU loops
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/__tests__/**',
    '!src/**/*.test.ts',
    '!src/**/*.spec.ts',
    '!src/**/index.ts',
    '!src/main.ts',
    '!src/test-utils/**',
    '!src/**/dto/**',
    '!src/**/entities/**',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'text-summary', 'lcov', 'html', 'json'],
  coverageThreshold: {
    global: {
      statements: 70,
      branches: 60,
      functions: 70,
      lines: 70,
    },
  },
  // Conditionally load setup file - skip for integration tests that need real DB
  setupFilesAfterEnv: [
    '<rootDir>/src/mcp/servers/execution/__tests__/conditional-setup.ts'
  ],
  moduleNameMapper: {
    // Auto-mock @prisma/client to prevent engine initialization CPU loops
    '^@prisma/client$': '<rootDir>/src/__mocks__/@prisma/client.ts',
    // Mock runtime library to prevent Prisma engine initialization
    '^@prisma/client/runtime/library$': '<rootDir>/src/__mocks__/@prisma/client/runtime/library.ts',
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
