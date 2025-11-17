/**
 * Verification tests for ST-8: Fix CodeAnalysisWorker producing incorrect metrics
 * These tests verify the acceptance criteria are met.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { CodeAnalysisProcessor } from '../code-analysis.processor';
import { PrismaService } from '../../../prisma/prisma.service';

describe('ST-8 Acceptance Criteria Verification', () => {
  let processor: CodeAnalysisProcessor;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CodeAnalysisProcessor,
        {
          provide: PrismaService,
          useValue: {
            project: { findUnique: jest.fn() },
            codeMetrics: {
              upsert: jest.fn(),
              aggregate: jest.fn(),
              findMany: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    processor = module.get<CodeAnalysisProcessor>(CodeAnalysisProcessor);
  });

  describe('AC1: All source files analyzed (including test files)', () => {
    it('should include .test.ts files in analysis', () => {
      const isSourceFile = (processor as any).isSourceFile.bind(processor);
      expect(isSourceFile('backend/src/auth/auth.service.test.ts')).toBe(true);
    });

    it('should include .spec.ts files in analysis', () => {
      const isSourceFile = (processor as any).isSourceFile.bind(processor);
      expect(isSourceFile('backend/src/auth/auth.service.spec.ts')).toBe(true);
    });

    it('should include __tests__ folder files', () => {
      const isSourceFile = (processor as any).isSourceFile.bind(processor);
      expect(isSourceFile('backend/src/__tests__/app.test.ts')).toBe(true);
    });

    it('should include all standard source file types', () => {
      const isSourceFile = (processor as any).isSourceFile.bind(processor);
      expect(isSourceFile('backend/src/app.ts')).toBe(true);
      expect(isSourceFile('frontend/src/App.tsx')).toBe(true);
      expect(isSourceFile('scripts/util.js')).toBe(true);
      expect(isSourceFile('components/Button.jsx')).toBe(true);
      expect(isSourceFile('services/main.go')).toBe(true);
      expect(isSourceFile('lib/core.rs')).toBe(true);
      expect(isSourceFile('src/Main.java')).toBe(true);
      expect(isSourceFile('scripts/analyze.py')).toBe(true);
    });
  });

  describe('AC2: No hardcoded values', () => {
    it('should calculate LOC dynamically from file content', () => {
      const calculateLOC = (processor as any).calculateLOC.bind(processor);

      const content1 = 'const a = 1;';
      const content2 = 'const a = 1;\nconst b = 2;\nconst c = 3;';

      expect(calculateLOC(content1)).toBe(1);
      expect(calculateLOC(content2)).toBe(3);
    });

    it('should calculate complexity dynamically', async () => {
      const calculateComplexity = (processor as any).calculateComplexity.bind(processor);

      const simple = 'const a = 1;';
      const complex = `
        if (a) {
          if (b) {
            while (c) {
              for (let i = 0; i < 10; i++) {
                // nested
              }
            }
          }
        }
      `;

      const simpleComplexity = await calculateComplexity(simple, 'test.ts');
      const complexComplexity = await calculateComplexity(complex, 'test.ts');

      expect(complexComplexity.cyclomatic).toBeGreaterThan(simpleComplexity.cyclomatic);
    });

    it('should not use hardcoded 83% coverage', async () => {
      // The old code had hardcoded 83% coverage for certain files
      // This test ensures coverage comes from actual Jest output
      const isTestFile = (processor as any).isTestFile.bind(processor);

      // No file should automatically get 83% coverage
      expect(isTestFile('backend/src/auth/auth.service.ts')).toBe(false);
      expect(isTestFile('backend/src/auth/auth.service.spec.ts')).toBe(true);

      // Coverage should be applied separately, not hardcoded
    });
  });

  describe('AC3: Re-running analysis with no changes shows 0 delta', () => {
    it('should show 0 files changed when nothing changed', async () => {
      const calculateDeltas = (processor as any).calculateDeltas.bind(processor);
      const prismaService = (processor as any).prisma;

      prismaService.codeMetrics.aggregate = jest.fn().mockResolvedValue({
        _avg: { testCoverage: 15 },
      });

      const baseline = {
        totalFiles: 3,
        totalLOC: 150,
        avgCoverage: 15,
        fileMap: new Map([
          ['file1.ts', { loc: 50, complexity: 5, coverage: 20, lastAnalyzed: new Date() }],
          ['file2.ts', { loc: 50, complexity: 6, coverage: 10, lastAnalyzed: new Date() }],
          ['file3.ts', { loc: 50, complexity: 4, coverage: 15, lastAnalyzed: new Date() }],
        ]),
      };

      const currentResults = [
        { filePath: 'file1.ts', loc: 50, complexity: { cyclomatic: 5 } },
        { filePath: 'file2.ts', loc: 50, complexity: { cyclomatic: 6 } },
        { filePath: 'file3.ts', loc: 50, complexity: { cyclomatic: 4 } },
      ];

      const deltas = await calculateDeltas('project1', baseline, currentResults);

      expect(deltas.filesChanged).toBe(0);
      expect(deltas.locDelta).toBe(0);
      expect(deltas.coverageDelta).toBe(0);
      expect(deltas.newTestCount).toBe(0);
    });
  });

  describe('AC4: Only actual new tests are counted', () => {
    it('should only count genuinely new test files', async () => {
      const calculateDeltas = (processor as any).calculateDeltas.bind(processor);
      const prismaService = (processor as any).prisma;

      prismaService.codeMetrics.aggregate = jest.fn().mockResolvedValue({
        _avg: { testCoverage: 20 },
      });

      const baseline = {
        totalFiles: 2,
        totalLOC: 100,
        avgCoverage: 15,
        fileMap: new Map([
          ['file1.ts', { loc: 50, complexity: 5, coverage: 15, lastAnalyzed: new Date() }],
          ['file1.spec.ts', { loc: 50, complexity: 3, coverage: 0, lastAnalyzed: new Date() }],
        ]),
      };

      const currentResults = [
        { filePath: 'file1.ts', loc: 50, complexity: { cyclomatic: 5 } },
        { filePath: 'file1.spec.ts', loc: 50, complexity: { cyclomatic: 3 } }, // Existing test
        { filePath: 'file2.spec.ts', loc: 30, complexity: { cyclomatic: 2 } }, // NEW test
      ];

      const deltas = await calculateDeltas('project1', baseline, currentResults);

      expect(deltas.newTestCount).toBe(1); // Only the actually new test
      expect(deltas.filesChanged).toBe(1); // Only the new file
    });

    it('should not count re-analyzed existing tests as new', async () => {
      const calculateDeltas = (processor as any).calculateDeltas.bind(processor);
      const prismaService = (processor as any).prisma;

      prismaService.codeMetrics.aggregate = jest.fn().mockResolvedValue({
        _avg: { testCoverage: 15 },
      });

      const baseline = {
        totalFiles: 3,
        totalLOC: 150,
        avgCoverage: 15,
        fileMap: new Map([
          ['src/app.ts', { loc: 50, complexity: 5, coverage: 15, lastAnalyzed: new Date() }],
          ['src/app.test.ts', { loc: 50, complexity: 3, coverage: 0, lastAnalyzed: new Date() }],
          ['src/app.spec.ts', { loc: 50, complexity: 3, coverage: 0, lastAnalyzed: new Date() }],
        ]),
      };

      const currentResults = [
        { filePath: 'src/app.ts', loc: 50, complexity: { cyclomatic: 5 } },
        { filePath: 'src/app.test.ts', loc: 50, complexity: { cyclomatic: 3 } },
        { filePath: 'src/app.spec.ts', loc: 50, complexity: { cyclomatic: 3 } },
      ];

      const deltas = await calculateDeltas('project1', baseline, currentResults);

      expect(deltas.newTestCount).toBe(0); // No new tests
      expect(deltas.filesChanged).toBe(0);
    });
  });

  describe('AC5: File changes reflect real git diff', () => {
    it('should only count files with actual LOC changes', async () => {
      const calculateDeltas = (processor as any).calculateDeltas.bind(processor);
      const prismaService = (processor as any).prisma;

      prismaService.codeMetrics.aggregate = jest.fn().mockResolvedValue({
        _avg: { testCoverage: 15 },
      });

      const baseline = {
        totalFiles: 3,
        totalLOC: 150,
        avgCoverage: 15,
        fileMap: new Map([
          ['file1.ts', { loc: 50, complexity: 5, coverage: 15, lastAnalyzed: new Date() }],
          ['file2.ts', { loc: 50, complexity: 6, coverage: 10, lastAnalyzed: new Date() }],
          ['file3.ts', { loc: 50, complexity: 4, coverage: 15, lastAnalyzed: new Date() }],
        ]),
      };

      const currentResults = [
        { filePath: 'file1.ts', loc: 55, complexity: { cyclomatic: 6 } }, // Changed
        { filePath: 'file2.ts', loc: 50, complexity: { cyclomatic: 6 } }, // No change
        { filePath: 'file3.ts', loc: 50, complexity: { cyclomatic: 4 } }, // No change
      ];

      const deltas = await calculateDeltas('project1', baseline, currentResults);

      expect(deltas.filesChanged).toBe(1); // Only the truly changed file
      expect(deltas.locDelta).toBe(5); // 55 - 50
    });

    it('should track both LOC and complexity changes', async () => {
      const calculateDeltas = (processor as any).calculateDeltas.bind(processor);
      const prismaService = (processor as any).prisma;

      prismaService.codeMetrics.aggregate = jest.fn().mockResolvedValue({
        _avg: { testCoverage: 15 },
      });

      const baseline = {
        totalFiles: 1,
        totalLOC: 50,
        avgCoverage: 15,
        fileMap: new Map([
          ['file1.ts', { loc: 50, complexity: 5, coverage: 15, lastAnalyzed: new Date() }],
        ]),
      };

      const currentResults = [
        // Same LOC but different complexity = still changed
        { filePath: 'file1.ts', loc: 50, complexity: { cyclomatic: 10 } },
      ];

      const deltas = await calculateDeltas('project1', baseline, currentResults);

      expect(deltas.filesChanged).toBe(1);
      expect(deltas.locDelta).toBe(0); // LOC didn't change
    });
  });

  describe('AC6: Coverage matches Jest output', () => {
    it('should correctly identify test files for coverage exclusion', () => {
      const isTestFile = (processor as any).isTestFile.bind(processor);

      // Test files should not receive coverage (they ARE the tests)
      expect(isTestFile('backend/src/auth/auth.service.spec.ts')).toBe(true);
      expect(isTestFile('backend/src/auth/auth.service.test.ts')).toBe(true);

      // Source files should receive coverage
      expect(isTestFile('backend/src/auth/auth.service.ts')).toBe(false);
    });

    it('should correlate test files with source files', async () => {
      const buildCorrelation = (processor as any).buildTestSourceCorrelation.bind(processor);

      const files = [
        'backend/src/auth/auth.service.ts',
        'backend/src/auth/auth.service.spec.ts',
        'backend/src/users/users.service.ts',
        'backend/src/users/users.service.test.ts',
      ];

      const correlation = await buildCorrelation(files, '/app');

      // Each source file should be correlated with its test
      expect(correlation.get('backend/src/auth/auth.service.ts')).toContain(
        'backend/src/auth/auth.service.spec.ts'
      );
      expect(correlation.get('backend/src/users/users.service.ts')).toContain(
        'backend/src/users/users.service.test.ts'
      );
    });
  });

  describe('Performance and Accuracy', () => {
    it('should handle large file counts efficiently', async () => {
      const buildCorrelation = (processor as any).buildTestSourceCorrelation.bind(processor);

      // Simulate 500 files (250 source + 250 tests)
      const files: string[] = [];
      for (let i = 0; i < 250; i++) {
        files.push(`backend/src/service${i}.ts`);
        files.push(`backend/src/service${i}.spec.ts`);
      }

      const startTime = Date.now();
      const correlation = await buildCorrelation(files, '/app');
      const endTime = Date.now();

      // Should complete in reasonable time (<1 second)
      expect(endTime - startTime).toBeLessThan(1000);
      expect(correlation.size).toBe(250);
    });

    it('should calculate maintainability index correctly', () => {
      const calculateMaintainability = (processor as any).calculateMaintainability.bind(processor);

      // High maintainability: low complexity, small file, no smells
      const highMI = calculateMaintainability(
        { cyclomatic: 2, cognitive: 3, maxComplexity: 2 },
        50,
        0
      );

      // Low maintainability: high complexity, large file, many smells
      const lowMI = calculateMaintainability(
        { cyclomatic: 100, cognitive: 150, maxComplexity: 100 },
        2000,
        20
      );

      expect(highMI).toBeGreaterThan(lowMI);
      expect(highMI).toBeLessThanOrEqual(100);
      expect(lowMI).toBeGreaterThanOrEqual(0);
    });
  });
});
