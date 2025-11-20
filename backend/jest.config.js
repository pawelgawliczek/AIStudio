// Set DATABASE_URL before any tests run
process.env.DATABASE_URL =
  process.env.DATABASE_URL ||
  'postgresql://postgres:361a30c6d68396be29c7eddc3f9ff1b1cfe07675c707232a370bda33f7c8b518@127.0.0.1:5433/vibestudio?schema=public';

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
