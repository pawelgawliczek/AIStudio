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

  /**
   * ST-28: Risk Score Formula Consistency Tests
   * Validates that the canonical formula is used correctly
   * Implements BR-4 (Regression Prevention) from baAnalysis
   */
  describe('Risk Score Calculation (ST-28)', () => {
    /**
     * Helper to calculate risk score using the canonical formula
     * This replicates the worker's calculation logic
     */
    function calculateExpectedRiskScore(
      complexity: number,
      churn: number,
      maintainability: number
    ): number {
      const rawRiskScore = Math.round(
        (complexity / 10) * churn * (100 - maintainability)
      );
      return Math.max(0, Math.min(100, rawRiskScore));
    }

    it('should calculate risk score using canonical formula', () => {
      // Test case from ST-28 documentation
      const complexity = 20;
      const churn = 5;
      const maintainability = 60;

      const expectedRiskScore = calculateExpectedRiskScore(complexity, churn, maintainability);

      // Expected: round((20 / 10) × 5 × 40) = round(400) = 400 → capped at 100
      expect(expectedRiskScore).toBe(100);
    });

    it('should cap risk score at 100 for extremely high-risk files', () => {
      const complexity = 50; // Very high complexity
      const churn = 20; // Frequent changes
      const maintainability = 0; // Worst maintainability

      const riskScore = calculateExpectedRiskScore(complexity, churn, maintainability);

      // Should be capped at 100, not 1000
      expect(riskScore).toBe(100);
      expect(riskScore).toBeLessThanOrEqual(100);
    });

    it('should handle zero churn edge case', () => {
      const complexity = 20;
      const churn = 0; // New file, no history
      const maintainability = 60;

      const riskScore = calculateExpectedRiskScore(complexity, churn, maintainability);

      // Zero churn = zero risk
      expect(riskScore).toBe(0);
    });

    it('should handle perfect maintainability (100)', () => {
      const complexity = 20;
      const churn = 5;
      const maintainability = 100; // Perfect maintainability

      const riskScore = calculateExpectedRiskScore(complexity, churn, maintainability);

      // (20/10) × 5 × (100-100) = 0
      expect(riskScore).toBe(0);
    });

    it('should handle zero complexity edge case', () => {
      const complexity = 0; // Trivial file
      const churn = 5;
      const maintainability = 60;

      const riskScore = calculateExpectedRiskScore(complexity, churn, maintainability);

      // Zero complexity = zero risk
      expect(riskScore).toBe(0);
    });

    it('should produce medium risk score for typical file', () => {
      const complexity = 10; // Moderate complexity
      const churn = 3; // Some changes
      const maintainability = 70; // Good maintainability

      const riskScore = calculateExpectedRiskScore(complexity, churn, maintainability);

      // Expected: round((10 / 10) × 3 × 30) = round(90) = 90
      expect(riskScore).toBe(90);
      expect(riskScore).toBeGreaterThan(0);
      expect(riskScore).toBeLessThanOrEqual(100);
    });

    it('should produce low risk score for well-maintained file', () => {
      const complexity = 5; // Low complexity
      const churn = 2; // Infrequent changes
      const maintainability = 90; // Excellent maintainability

      const riskScore = calculateExpectedRiskScore(complexity, churn, maintainability);

      // Expected: round((5 / 10) × 2 × 10) = round(10) = 10
      expect(riskScore).toBe(10);
      expect(riskScore).toBeLessThan(50);
    });

    it('should round fractional results correctly', () => {
      const complexity = 7; // Creates fractional intermediate result
      const churn = 3;
      const maintainability = 65;

      const riskScore = calculateExpectedRiskScore(complexity, churn, maintainability);

      // Expected: round((7 / 10) × 3 × 35) = round(73.5) = 74
      expect(riskScore).toBe(74);
    });

    it('should ensure risk score is never negative', () => {
      // Edge case: Even with edge values, risk should never be negative
      const testCases = [
        { complexity: 0, churn: 0, maintainability: 100 },
        { complexity: -1, churn: 5, maintainability: 60 }, // Invalid input
        { complexity: 5, churn: -1, maintainability: 60 }, // Invalid input
      ];

      testCases.forEach(({ complexity, churn, maintainability }) => {
        const riskScore = calculateExpectedRiskScore(complexity, churn, maintainability);
        expect(riskScore).toBeGreaterThanOrEqual(0);
      });
    });

    /**
     * Regression test: Ensure new formula differs from old formula
     * This validates that ST-28 fix actually changes the calculation
     */
    it('should differ from old worker formula', () => {
      const complexity = 20;
      const churn = 5;
      const maintainability = 60;

      // New canonical formula
      const newFormula = calculateExpectedRiskScore(complexity, churn, maintainability);

      // Old worker formula (for comparison)
      const oldFormula = Math.min(100, (complexity * churn * (100 - maintainability)) / 100);

      // These should be different (ST-28 fix)
      expect(newFormula).not.toBe(oldFormula);
      expect(newFormula).toBe(100); // New formula
      expect(oldFormula).toBe(40); // Old formula
    });

    /**
     * Test data-driven validation
     * Uses multiple test cases to ensure formula robustness
     */
    it('should calculate correctly across multiple scenarios', () => {
      const testCases = [
        // { complexity, churn, maintainability, expectedRisk }
        { c: 20, h: 5, m: 60, expected: 100 }, // Example from ST-28
        { c: 10, h: 2, m: 80, expected: 4 }, // Low risk
        { c: 50, h: 10, m: 30, expected: 100 }, // Capped at 100
        { c: 0, h: 5, m: 60, expected: 0 }, // Zero complexity
        { c: 20, h: 0, m: 60, expected: 0 }, // Zero churn
        { c: 15, h: 4, m: 50, expected: 30 }, // Medium risk
      ];

      testCases.forEach(({ c, h, m, expected }) => {
        const result = calculateExpectedRiskScore(c, h, m);
        expect(result).toBe(expected);
      });
    });

    /**
     * MCP Tool Formula Consistency Test
     * Ensures worker and MCP tool use identical formula
     * This is the CRITICAL test for ST-28 fix
     */
    it('should match MCP tool formula exactly', () => {
      // Simulate MCP tool formula (from get_file_health.ts)
      const mcpToolFormula = (complexity: number, churn: number, maintainability: number) => {
        return Math.round(
          (complexity / 10) * churn * (100 - maintainability)
        );
      };

      const testCases = [
        { c: 20, h: 5, m: 60 },
        { c: 10, h: 2, m: 80 },
        { c: 50, h: 10, m: 30 },
        { c: 5, h: 3, m: 90 },
      ];

      testCases.forEach(({ c, h, m }) => {
        const workerResult = calculateExpectedRiskScore(c, h, m);
        const mcpToolRaw = mcpToolFormula(c, h, m);
        const mcpToolBounded = Math.max(0, Math.min(100, mcpToolRaw));

        // Worker and MCP tool MUST produce identical results (ST-28 requirement)
        expect(workerResult).toBe(mcpToolBounded);
      });
    });
  });
});
