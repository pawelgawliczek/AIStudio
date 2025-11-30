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
  // Limit parallel workers to prevent resource contention
  maxWorkers: 4,
  testMatch: ['**/__tests__/**/*.test.ts'],
  testPathIgnorePatterns: ['/node_modules/', '/dist/'],
  // Don't auto-mock Prisma Client
  unmockedModulePathPatterns: ['@prisma/client'],
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
