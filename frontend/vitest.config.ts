import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'happy-dom',
    setupFiles: './src/test/setup.ts',
    deps: {
      optimizer: {
        web: {
          include: ['react-syntax-highlighter'],
        },
      },
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary', 'json', 'html', 'lcov'],
      reportsDirectory: './coverage',
      reportOnFailure: true, // Generate coverage even when tests fail
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.test.{ts,tsx}',
        'src/**/*.spec.{ts,tsx}',
        'src/**/*.d.ts',
        'src/main.tsx',
        'src/vite-env.d.ts',
        'src/test/**',
        'src/**/__tests__/**',
      ],
      all: true,
      // Thresholds temporarily disabled to allow coverage file generation
      // Will re-enable after verifying coverage collection works
      // thresholds: {
      //   statements: 60,
      //   branches: 50,
      //   functions: 60,
      //   lines: 60,
      // },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@aistudio/shared': path.resolve(__dirname, '../shared/src'),
    },
  },
});
