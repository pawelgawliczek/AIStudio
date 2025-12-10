module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/__tests__/**',
    '!src/**/index.ts',
    '!src/**/*.d.ts',
  ],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  // Timeout for async operations
  testTimeout: 10000,
  // Clear mocks between tests
  clearMocks: true,
  // Coverage thresholds (will fail initially - that's TDD)
  coverageThreshold: {
    global: {
      statements: 0, // Will increase as implementation progresses
      branches: 0,
      functions: 0,
      lines: 0,
    },
  },
};
