import { Test, TestingModule } from '@nestjs/testing';
import { CodeAnalysisProcessor } from '../code-analysis.processor';
import { PrismaService } from '../../../prisma/prisma.service';

describe('CodeAnalysisProcessor', () => {
  let processor: CodeAnalysisProcessor;
  let prismaService: jest.Mocked<PrismaService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CodeAnalysisProcessor,
        {
          provide: PrismaService,
          useValue: {
            project: {
              findUnique: jest.fn(),
            },
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
    prismaService = module.get(PrismaService);
  });

  describe('isSourceFile', () => {
    it('should include TypeScript files', () => {
      const isSourceFile = (processor as any).isSourceFile.bind(processor);
      expect(isSourceFile('backend/src/app.ts')).toBe(true);
      expect(isSourceFile('backend/src/component.tsx')).toBe(true);
    });

    it('should include JavaScript files', () => {
      const isSourceFile = (processor as any).isSourceFile.bind(processor);
      expect(isSourceFile('frontend/src/utils.js')).toBe(true);
      expect(isSourceFile('frontend/src/App.jsx')).toBe(true);
    });

    it('should now include test files (bug fix)', () => {
      const isSourceFile = (processor as any).isSourceFile.bind(processor);
      expect(isSourceFile('backend/src/auth/auth.service.spec.ts')).toBe(true);
      expect(isSourceFile('backend/src/auth/auth.service.test.ts')).toBe(true);
      expect(isSourceFile('backend/src/__tests__/app.test.ts')).toBe(true);
    });

    it('should exclude node_modules', () => {
      const isSourceFile = (processor as any).isSourceFile.bind(processor);
      expect(isSourceFile('node_modules/lodash/index.js')).toBe(false);
    });

    it('should exclude dist folder', () => {
      const isSourceFile = (processor as any).isSourceFile.bind(processor);
      expect(isSourceFile('dist/app.js')).toBe(false);
    });

    it('should exclude build folder', () => {
      const isSourceFile = (processor as any).isSourceFile.bind(processor);
      expect(isSourceFile('build/main.js')).toBe(false);
    });

    it('should exclude coverage folder', () => {
      const isSourceFile = (processor as any).isSourceFile.bind(processor);
      expect(isSourceFile('coverage/lcov-report/index.html')).toBe(false);
    });

    it('should include Python files', () => {
      const isSourceFile = (processor as any).isSourceFile.bind(processor);
      expect(isSourceFile('scripts/analyze.py')).toBe(true);
    });

    it('should include Go files', () => {
      const isSourceFile = (processor as any).isSourceFile.bind(processor);
      expect(isSourceFile('services/main.go')).toBe(true);
    });

    it('should include Rust files', () => {
      const isSourceFile = (processor as any).isSourceFile.bind(processor);
      expect(isSourceFile('src/lib.rs')).toBe(true);
    });

    it('should include Java files', () => {
      const isSourceFile = (processor as any).isSourceFile.bind(processor);
      expect(isSourceFile('src/main/App.java')).toBe(true);
    });
  });

  describe('isTestFile', () => {
    it('should identify .test. files', () => {
      const isTestFile = (processor as any).isTestFile.bind(processor);
      expect(isTestFile('backend/src/auth/auth.service.test.ts')).toBe(true);
      expect(isTestFile('frontend/src/App.test.tsx')).toBe(true);
    });

    it('should identify .spec. files', () => {
      const isTestFile = (processor as any).isTestFile.bind(processor);
      expect(isTestFile('backend/src/auth/auth.service.spec.ts')).toBe(true);
      expect(isTestFile('backend/src/users/users.controller.spec.ts')).toBe(true);
    });

    it('should identify __tests__ folder files', () => {
      const isTestFile = (processor as any).isTestFile.bind(processor);
      expect(isTestFile('backend/src/__tests__/app.test.ts')).toBe(true);
      expect(isTestFile('frontend/src/__tests__/utils.test.tsx')).toBe(true);
    });

    it('should not identify regular source files as tests', () => {
      const isTestFile = (processor as any).isTestFile.bind(processor);
      expect(isTestFile('backend/src/auth/auth.service.ts')).toBe(false);
      expect(isTestFile('frontend/src/App.tsx')).toBe(false);
    });
  });

  describe('calculateLOC', () => {
    it('should count non-empty, non-comment lines', () => {
      const calculateLOC = (processor as any).calculateLOC.bind(processor);
      const content = `
import { Test } from '@nestjs/testing';

// This is a comment
const x = 1;
const y = 2;

/* Multi-line
   comment */
const z = x + y;
`;
      const loc = calculateLOC(content);
      expect(loc).toBe(4); // import, const x, const y, const z
    });

    it('should skip blank lines', () => {
      const calculateLOC = (processor as any).calculateLOC.bind(processor);
      const content = `
const a = 1;

const b = 2;

`;
      const loc = calculateLOC(content);
      expect(loc).toBe(2);
    });

    it('should skip single-line comments', () => {
      const calculateLOC = (processor as any).calculateLOC.bind(processor);
      const content = `
// comment 1
const a = 1;
// comment 2
// comment 3
const b = 2;
`;
      const loc = calculateLOC(content);
      expect(loc).toBe(2);
    });

    it('should skip multi-line comments', () => {
      const calculateLOC = (processor as any).calculateLOC.bind(processor);
      const content = `
const a = 1;
/* This is
   a multi-line
   comment */
const b = 2;
`;
      const loc = calculateLOC(content);
      expect(loc).toBe(2);
    });

    it('should skip Python comments (#)', () => {
      const calculateLOC = (processor as any).calculateLOC.bind(processor);
      const content = `
# Python comment
def main():
    # another comment
    pass
`;
      const loc = calculateLOC(content);
      expect(loc).toBe(2);
    });
  });

  describe('calculateComplexity', () => {
    it('should count decision points (if statements)', async () => {
      const calculateComplexity = (processor as any).calculateComplexity.bind(processor);
      const content = `
function test() {
  if (a) {
    return 1;
  } else {
    return 2;
  }
}
`;
      const complexity = await calculateComplexity(content, 'test.ts');
      expect(complexity.cyclomatic).toBeGreaterThan(1);
    });

    it('should count loops', async () => {
      const calculateComplexity = (processor as any).calculateComplexity.bind(processor);
      const content = `
function test() {
  for (let i = 0; i < 10; i++) {
    while (condition) {
      // do something
    }
  }
}
`;
      const complexity = await calculateComplexity(content, 'test.ts');
      expect(complexity.cyclomatic).toBeGreaterThanOrEqual(3); // base + for + while
    });

    it('should count logical operators', async () => {
      const calculateComplexity = (processor as any).calculateComplexity.bind(processor);
      const content = `
function test() {
  if (a && b || c) {
    return true;
  }
}
`;
      const complexity = await calculateComplexity(content, 'test.ts');
      expect(complexity.cyclomatic).toBeGreaterThanOrEqual(4); // base + if + && + ||
    });

    it('should count ternary operators', async () => {
      const calculateComplexity = (processor as any).calculateComplexity.bind(processor);
      const content = `
function test() {
  const result = a ? 1 : 2;
}
`;
      const complexity = await calculateComplexity(content, 'test.ts');
      expect(complexity.cyclomatic).toBeGreaterThanOrEqual(2);
    });
  });

  describe('calculateMaintainability', () => {
    it('should return 100 for zero LOC', () => {
      const calculateMaintainability = (processor as any).calculateMaintainability.bind(processor);
      const complexity = { cyclomatic: 1, cognitive: 1, maxComplexity: 1 };
      const result = calculateMaintainability(complexity, 0, 0);
      expect(result).toBe(100);
    });

    it('should decrease with higher complexity', () => {
      const calculateMaintainability = (processor as any).calculateMaintainability.bind(processor);
      const lowComplexity = { cyclomatic: 1, cognitive: 1, maxComplexity: 1 };
      const highComplexity = { cyclomatic: 50, cognitive: 100, maxComplexity: 50 };

      const lowResult = calculateMaintainability(lowComplexity, 100, 0);
      const highResult = calculateMaintainability(highComplexity, 100, 0);

      expect(lowResult).toBeGreaterThan(highResult);
    });

    it('should decrease with higher LOC', () => {
      const calculateMaintainability = (processor as any).calculateMaintainability.bind(processor);
      const complexity = { cyclomatic: 10, cognitive: 15, maxComplexity: 10 };

      const smallFile = calculateMaintainability(complexity, 50, 0);
      const largeFile = calculateMaintainability(complexity, 500, 0);

      expect(smallFile).toBeGreaterThan(largeFile);
    });

    it('should penalize for code smells', () => {
      const calculateMaintainability = (processor as any).calculateMaintainability.bind(processor);
      const complexity = { cyclomatic: 10, cognitive: 15, maxComplexity: 10 };

      const noSmells = calculateMaintainability(complexity, 100, 0);
      const manySmells = calculateMaintainability(complexity, 100, 10);

      expect(noSmells).toBeGreaterThan(manySmells);
      expect(noSmells - manySmells).toBe(20); // 10 smells * 2 penalty each
    });
  });

  describe('detectCodeSmells', () => {
    it('should detect TODO comments', async () => {
      const detectCodeSmells = (processor as any).detectCodeSmells.bind(processor);
      const content = `
// TODO: Fix this later
function test() {
  // TODO: And this
}
`;
      const smells = await detectCodeSmells(content, 'test.ts');
      const todoSmell = smells.find((s: any) => s.type === 'todo-comment');
      expect(todoSmell).toBeDefined();
      expect(todoSmell.severity).toBe('minor');
    });

    it('should detect console.log statements', async () => {
      const detectCodeSmells = (processor as any).detectCodeSmells.bind(processor);
      const content = `
function test() {
  console.log('debug');
  console.error('error');
}
`;
      const smells = await detectCodeSmells(content, 'test.ts');
      const consoleSmell = smells.find((s: any) => s.type === 'console-log');
      expect(consoleSmell).toBeDefined();
      expect(consoleSmell.severity).toBe('minor');
    });
  });

  describe('buildTestSourceCorrelation', () => {
    it('should correlate .spec.ts files with source files', async () => {
      const buildCorrelation = (processor as any).buildTestSourceCorrelation.bind(processor);
      const files = [
        'backend/src/auth/auth.service.ts',
        'backend/src/auth/auth.service.spec.ts',
        'backend/src/users/users.service.ts',
      ];

      const correlation = await buildCorrelation(files, '/app');

      expect(correlation.has('backend/src/auth/auth.service.ts')).toBe(true);
      expect(correlation.get('backend/src/auth/auth.service.ts')).toContain(
        'backend/src/auth/auth.service.spec.ts'
      );
    });

    it('should correlate .test.ts files with source files', async () => {
      const buildCorrelation = (processor as any).buildTestSourceCorrelation.bind(processor);
      const files = [
        'backend/src/auth/auth.service.ts',
        'backend/src/auth/auth.service.test.ts',
      ];

      const correlation = await buildCorrelation(files, '/app');

      expect(correlation.has('backend/src/auth/auth.service.ts')).toBe(true);
      expect(correlation.get('backend/src/auth/auth.service.ts')).toContain(
        'backend/src/auth/auth.service.test.ts'
      );
    });

    it('should correlate __tests__ folder files', async () => {
      const buildCorrelation = (processor as any).buildTestSourceCorrelation.bind(processor);
      const files = [
        'backend/src/auth/auth.service.ts',
        'backend/src/auth/__tests__/auth.service.test.ts',
      ];

      const correlation = await buildCorrelation(files, '/app');

      expect(correlation.has('backend/src/auth/auth.service.ts')).toBe(true);
    });

    it('should handle files with no tests', async () => {
      const buildCorrelation = (processor as any).buildTestSourceCorrelation.bind(processor);
      const files = [
        'backend/src/auth/auth.service.ts',
        'backend/src/users/users.service.ts',
      ];

      const correlation = await buildCorrelation(files, '/app');

      expect(correlation.has('backend/src/auth/auth.service.ts')).toBe(false);
    });

    it('should handle multiple test files for one source', async () => {
      const buildCorrelation = (processor as any).buildTestSourceCorrelation.bind(processor);
      const files = [
        'backend/src/auth/auth.service.ts',
        'backend/src/auth/auth.service.spec.ts',
        'backend/src/auth/auth.service.test.ts',
      ];

      const correlation = await buildCorrelation(files, '/app');

      const tests = correlation.get('backend/src/auth/auth.service.ts');
      expect(tests).toHaveLength(2);
    });
  });

  describe('loadCoverageData', () => {
    it('should parse coverage-summary.json format', async () => {
      const loadCoverageData = (processor as any).loadCoverageData.bind(processor);

      // Mock fs
      jest.spyOn(require('fs').promises, 'readFile').mockImplementation(async (path: string) => {
        if (path.includes('coverage-summary.json')) {
          return JSON.stringify({
            total: { statements: { pct: 50 } },
            '/opt/stack/AIStudio/backend/src/auth/auth.service.ts': {
              statements: { pct: 100 },
            },
            '/opt/stack/AIStudio/backend/src/users/users.service.ts': {
              statements: { pct: 75 },
            },
          });
        }
        throw new Error('File not found');
      });

      const coverageMap = await loadCoverageData('/opt/stack/AIStudio');

      expect(coverageMap.get('backend/src/auth/auth.service.ts')).toBe(100);
      expect(coverageMap.get('backend/src/users/users.service.ts')).toBe(75);
    });
  });

  describe('Delta Calculations', () => {
    it('should detect new files', async () => {
      const calculateDeltas = (processor as any).calculateDeltas.bind(processor);

      prismaService.codeMetrics.aggregate = jest.fn().mockResolvedValue({
        _avg: { testCoverage: 15 },
      });

      const baseline = {
        totalFiles: 2,
        totalLOC: 100,
        avgCoverage: 10,
        fileMap: new Map([
          ['file1.ts', { loc: 50, complexity: 5, coverage: 10, lastAnalyzed: new Date() }],
          ['file2.ts', { loc: 50, complexity: 5, coverage: 10, lastAnalyzed: new Date() }],
        ]),
      };

      const currentResults = [
        { filePath: 'file1.ts', loc: 50, complexity: { cyclomatic: 5 } },
        { filePath: 'file2.ts', loc: 50, complexity: { cyclomatic: 5 } },
        { filePath: 'file3.ts', loc: 30, complexity: { cyclomatic: 3 } }, // New file
      ];

      const deltas = await calculateDeltas('project1', baseline, currentResults);

      expect(deltas.filesChanged).toBe(1); // Only new file
      expect(deltas.locDelta).toBe(30);
    });

    it('should detect modified files', async () => {
      const calculateDeltas = (processor as any).calculateDeltas.bind(processor);

      prismaService.codeMetrics.aggregate = jest.fn().mockResolvedValue({
        _avg: { testCoverage: 10 },
      });

      const baseline = {
        totalFiles: 1,
        totalLOC: 50,
        avgCoverage: 10,
        fileMap: new Map([
          ['file1.ts', { loc: 50, complexity: 5, coverage: 10, lastAnalyzed: new Date() }],
        ]),
      };

      const currentResults = [
        { filePath: 'file1.ts', loc: 60, complexity: { cyclomatic: 6 } }, // Modified
      ];

      const deltas = await calculateDeltas('project1', baseline, currentResults);

      expect(deltas.filesChanged).toBe(1);
      expect(deltas.locDelta).toBe(10); // 60 - 50
    });

    it('should detect deleted files', async () => {
      const calculateDeltas = (processor as any).calculateDeltas.bind(processor);

      prismaService.codeMetrics.aggregate = jest.fn().mockResolvedValue({
        _avg: { testCoverage: 10 },
      });

      const baseline = {
        totalFiles: 2,
        totalLOC: 100,
        avgCoverage: 10,
        fileMap: new Map([
          ['file1.ts', { loc: 50, complexity: 5, coverage: 10, lastAnalyzed: new Date() }],
          ['file2.ts', { loc: 50, complexity: 5, coverage: 10, lastAnalyzed: new Date() }],
        ]),
      };

      const currentResults = [
        { filePath: 'file1.ts', loc: 50, complexity: { cyclomatic: 5 } },
        // file2.ts was deleted
      ];

      const deltas = await calculateDeltas('project1', baseline, currentResults);

      expect(deltas.filesChanged).toBe(1); // deleted file
      expect(deltas.locDelta).toBe(-50);
    });

    it('should show 0 changes when nothing changed', async () => {
      const calculateDeltas = (processor as any).calculateDeltas.bind(processor);

      prismaService.codeMetrics.aggregate = jest.fn().mockResolvedValue({
        _avg: { testCoverage: 10 },
      });

      const baseline = {
        totalFiles: 2,
        totalLOC: 100,
        avgCoverage: 10,
        fileMap: new Map([
          ['file1.ts', { loc: 50, complexity: 5, coverage: 10, lastAnalyzed: new Date() }],
          ['file2.ts', { loc: 50, complexity: 5, coverage: 10, lastAnalyzed: new Date() }],
        ]),
      };

      const currentResults = [
        { filePath: 'file1.ts', loc: 50, complexity: { cyclomatic: 5 } },
        { filePath: 'file2.ts', loc: 50, complexity: { cyclomatic: 5 } },
      ];

      const deltas = await calculateDeltas('project1', baseline, currentResults);

      expect(deltas.filesChanged).toBe(0);
      expect(deltas.locDelta).toBe(0);
      expect(deltas.coverageDelta).toBe(0);
    });

    it('should count new test files', async () => {
      const calculateDeltas = (processor as any).calculateDeltas.bind(processor);

      prismaService.codeMetrics.aggregate = jest.fn().mockResolvedValue({
        _avg: { testCoverage: 15 },
      });

      const baseline = {
        totalFiles: 1,
        totalLOC: 50,
        avgCoverage: 10,
        fileMap: new Map([
          ['file1.ts', { loc: 50, complexity: 5, coverage: 10, lastAnalyzed: new Date() }],
        ]),
      };

      const currentResults = [
        { filePath: 'file1.ts', loc: 50, complexity: { cyclomatic: 5 } },
        { filePath: 'file1.spec.ts', loc: 30, complexity: { cyclomatic: 2 } }, // New test
      ];

      const deltas = await calculateDeltas('project1', baseline, currentResults);

      expect(deltas.newTestCount).toBe(1);
    });
  });
});
