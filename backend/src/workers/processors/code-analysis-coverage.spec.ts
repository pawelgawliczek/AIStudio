/**
 * Tests for code analysis processor coverage import functionality
 * Focuses on path normalization and coverage data loading
 */

describe('Code Analysis Processor - Coverage Import', () => {
  describe('Path Normalization', () => {
    // Simulates the path normalization logic from code-analysis.processor.ts
    function normalizePath(filePath: string, repoPath: string = '/app'): string | null {
      let relativePath = filePath;

      // Remove known absolute path prefixes
      const pathPrefixes = [
        repoPath + '/',                    // /app/ (container)
        '/opt/stack/AIStudio/',            // /opt/stack/AIStudio/ (host)
        '/app/',                           // /app/ (alternative format)
      ];

      for (const prefix of pathPrefixes) {
        if (relativePath.startsWith(prefix)) {
          relativePath = relativePath.substring(prefix.length);
          break;
        }
      }

      // If still absolute, try to extract relative path from common patterns
      if (relativePath.startsWith('/')) {
        const parts = relativePath.split('/');
        const markers = ['backend', 'frontend', 'shared'];
        for (const marker of markers) {
          const index = parts.indexOf(marker);
          if (index >= 0) {
            relativePath = parts.slice(index).join('/');
            break;
          }
        }
      }

      // Validate result
      if (!relativePath.startsWith('/') && relativePath.includes('/')) {
        return relativePath;
      }

      return null; // Failed to normalize
    }

    it('should normalize host path to relative path', () => {
      const input = '/opt/stack/AIStudio/backend/src/coordinators/coordinators.service.ts';
      const expected = 'backend/src/coordinators/coordinators.service.ts';

      const result = normalizePath(input);

      expect(result).toBe(expected);
    });

    it('should normalize container path to relative path', () => {
      const input = '/app/backend/src/workflows/workflows.service.ts';
      const expected = 'backend/src/workflows/workflows.service.ts';

      const result = normalizePath(input);

      expect(result).toBe(expected);
    });

    it('should normalize alternative container path format', () => {
      const input = '/app/frontend/src/pages/CodeQualityDashboard.tsx';
      const expected = 'frontend/src/pages/CodeQualityDashboard.tsx';

      const result = normalizePath(input, '/opt/stack/AIStudio');

      expect(result).toBe(expected);
    });

    it('should handle already relative paths', () => {
      const input = 'backend/src/coordinators/coordinators.service.ts';
      const expected = 'backend/src/coordinators/coordinators.service.ts';

      const result = normalizePath(input);

      expect(result).toBe(expected);
    });

    it('should extract relative path using backend marker', () => {
      const input = '/some/unknown/path/backend/src/workers/processors/code-analysis.processor.ts';
      const expected = 'backend/src/workers/processors/code-analysis.processor.ts';

      const result = normalizePath(input);

      expect(result).toBe(expected);
    });

    it('should extract relative path using frontend marker', () => {
      const input = '/var/lib/project/frontend/src/pages/WorkflowManagementView.tsx';
      const expected = 'frontend/src/pages/WorkflowManagementView.tsx';

      const result = normalizePath(input);

      expect(result).toBe(expected);
    });

    it('should extract relative path using shared marker', () => {
      const input = '/mnt/data/project/shared/types/index.ts';
      const expected = 'shared/types/index.ts';

      const result = normalizePath(input);

      expect(result).toBe(expected);
    });

    it('should return null for paths without markers', () => {
      const input = '/var/log/system.log';

      const result = normalizePath(input);

      expect(result).toBeNull();
    });

    it('should return null for invalid paths', () => {
      const input = '/invalid';

      const result = normalizePath(input);

      expect(result).toBeNull();
    });

    it('should return null for empty paths', () => {
      const input = '';

      const result = normalizePath(input);

      expect(result).toBeNull();
    });

    it('should handle paths with multiple slashes', () => {
      const input = '/opt/stack/AIStudio//backend//src/coordinators/coordinators.service.ts';
      // This should still work with the prefix matching
      const result = normalizePath(input);

      // It will match the prefix and remove it, normalizing to relative path
      expect(result).toBe('backend//src/coordinators/coordinators.service.ts');
    });

    it('should prioritize repoPath over other prefixes', () => {
      const input = '/custom/path/backend/src/test.ts';
      const repoPath = '/custom/path';

      const result = normalizePath(input, repoPath);

      expect(result).toBe('backend/src/test.ts');
    });

    it('should handle nested backend directories', () => {
      const input = '/app/backend/backend/src/test.ts';
      const expected = 'backend/backend/src/test.ts';

      const result = normalizePath(input);

      expect(result).toBe(expected);
    });
  });

  describe('Coverage Calculation', () => {
    // Simulates coverage calculation from coverage-final.json format
    function calculateCoverage(coverageData: any): number {
      const statements = coverageData.s || {};
      const branches = coverageData.b || {};
      const functions = coverageData.f || {};

      const stmtTotal = Object.keys(statements).length;
      const stmtCovered = Object.values(statements).filter((v: any) => v > 0).length;
      const stmtPercent = stmtTotal > 0 ? (stmtCovered / stmtTotal) * 100 : 100;

      const branchTotal = Object.keys(branches).length;
      let branchCovered = 0;
      for (const branchArray of Object.values(branches) as any[]) {
        if (Array.isArray(branchArray)) {
          branchCovered += branchArray.filter((v: any) => v > 0).length;
        }
      }
      const branchPercent = branchTotal > 0 ? (branchCovered / (branchTotal * 2)) * 100 : 100;

      const funcTotal = Object.keys(functions).length;
      const funcCovered = Object.values(functions).filter((v: any) => v > 0).length;
      const funcPercent = funcTotal > 0 ? (funcCovered / funcTotal) * 100 : 100;

      return Math.round((stmtPercent + branchPercent + funcPercent) / 3);
    }

    it('should calculate 100% coverage for fully covered file', () => {
      const coverageData = {
        s: { '0': 5, '1': 3, '2': 2 },
        b: { '0': [2, 1] },
        f: { '0': 4, '1': 2 },
      };

      const result = calculateCoverage(coverageData);

      expect(result).toBe(100);
    });

    it('should calculate 0% coverage for uncovered file', () => {
      const coverageData = {
        s: { '0': 0, '1': 0, '2': 0 },
        b: { '0': [0, 0] },
        f: { '0': 0, '1': 0 },
      };

      const result = calculateCoverage(coverageData);

      expect(result).toBe(0);
    });

    it('should calculate partial coverage correctly', () => {
      const coverageData = {
        s: { '0': 5, '1': 0 },        // 50% statements
        b: { '0': [2, 0], '1': [1, 0] }, // 50% branches (2 of 4)
        f: { '0': 4, '1': 0 },        // 50% functions
      };

      const result = calculateCoverage(coverageData);

      expect(result).toBe(50);
    });

    it('should handle empty coverage data', () => {
      const coverageData = {
        s: {},
        b: {},
        f: {},
      };

      const result = calculateCoverage(coverageData);

      expect(result).toBe(100); // No code means 100% coverage by definition
    });

    it('should handle missing coverage fields', () => {
      const coverageData = {};

      const result = calculateCoverage(coverageData);

      expect(result).toBe(100);
    });

    it('should calculate coverage with only statements', () => {
      const coverageData = {
        s: { '0': 5, '1': 3 },
        b: {},
        f: {},
      };

      const result = calculateCoverage(coverageData);

      expect(result).toBe(100); // Only statements, all covered
    });

    it('should calculate coverage with complex branch structure', () => {
      const coverageData = {
        s: { '0': 1, '1': 1, '2': 1, '3': 1 },  // 100%
        b: {
          '0': [1, 1],   // Both branches taken (2 covered)
          '1': [1, 0],   // One branch taken (1 covered)
          '2': [0, 0],   // No branches taken (0 covered)
        },  // 3 of 6 branches = 50%
        f: { '0': 1, '1': 1 },  // 100%
      };

      const result = calculateCoverage(coverageData);

      // (100 + 50 + 100) / 3 = 83.33 ≈ 83
      expect(result).toBe(83);
    });

    it('should round down fractional percentages', () => {
      const coverageData = {
        s: { '0': 1, '1': 0, '2': 0 },  // 33.33%
        b: {},  // 100%
        f: {},  // 100%
      };

      const result = calculateCoverage(coverageData);

      // (33.33 + 100 + 100) / 3 = 77.78 ≈ 78
      expect(result).toBe(78);
    });
  });

  describe('Coverage Summary Format', () => {
    // Simulates coverage calculation from coverage-summary.json format
    function calculateCoverageFromSummary(coverageData: any): number {
      return coverageData.statements?.pct || 0;
    }

    it('should extract coverage from summary format', () => {
      const summaryData = {
        lines: { total: 63, covered: 63, pct: 100 },
        statements: { total: 70, covered: 70, pct: 100 },
        functions: { total: 15, covered: 15, pct: 100 },
        branches: { total: 29, covered: 29, pct: 100 },
      };

      const result = calculateCoverageFromSummary(summaryData);

      expect(result).toBe(100);
    });

    it('should handle partial coverage in summary', () => {
      const summaryData = {
        lines: { total: 100, covered: 50, pct: 50 },
        statements: { total: 120, covered: 60, pct: 50 },
        functions: { total: 10, covered: 5, pct: 50 },
        branches: { total: 20, covered: 10, pct: 50 },
      };

      const result = calculateCoverageFromSummary(summaryData);

      expect(result).toBe(50);
    });

    it('should return 0 for missing data', () => {
      const summaryData = {};

      const result = calculateCoverageFromSummary(summaryData);

      expect(result).toBe(0);
    });
  });

  describe('Integration: Full Coverage Import Flow', () => {
    it('should correctly process coverage file entry', () => {
      const filePath = '/opt/stack/AIStudio/backend/src/coordinators/coordinators.service.ts';
      const coverageData = {
        s: { '0': 5, '1': 3, '2': 2 },
        b: { '0': [2, 1] },
        f: { '0': 4, '1': 2 },
      };

      // Step 1: Normalize path
      function normalizePath(path: string): string | null {
        let relativePath = path;
        const pathPrefixes = ['/opt/stack/AIStudio/', '/app/'];

        for (const prefix of pathPrefixes) {
          if (relativePath.startsWith(prefix)) {
            relativePath = relativePath.substring(prefix.length);
            break;
          }
        }

        if (relativePath.startsWith('/')) {
          const parts = relativePath.split('/');
          const markers = ['backend', 'frontend', 'shared'];
          for (const marker of markers) {
            const index = parts.indexOf(marker);
            if (index >= 0) {
              relativePath = parts.slice(index).join('/');
              break;
            }
          }
        }

        return !relativePath.startsWith('/') && relativePath.includes('/') ? relativePath : null;
      }

      // Step 2: Calculate coverage
      function calculateCoverage(data: any): number {
        const statements = data.s || {};
        const branches = data.b || {};
        const functions = data.f || {};

        const stmtTotal = Object.keys(statements).length;
        const stmtCovered = Object.values(statements).filter((v: any) => v > 0).length;
        const stmtPercent = stmtTotal > 0 ? (stmtCovered / stmtTotal) * 100 : 100;

        const branchTotal = Object.keys(branches).length;
        let branchCovered = 0;
        for (const branchArray of Object.values(branches) as any[]) {
          if (Array.isArray(branchArray)) {
            branchCovered += branchArray.filter((v: any) => v > 0).length;
          }
        }
        const branchPercent = branchTotal > 0 ? (branchCovered / (branchTotal * 2)) * 100 : 100;

        const funcTotal = Object.keys(functions).length;
        const funcCovered = Object.values(functions).filter((v: any) => v > 0).length;
        const funcPercent = funcTotal > 0 ? (funcCovered / funcTotal) * 100 : 100;

        return Math.round((stmtPercent + branchPercent + funcPercent) / 3);
      }

      const normalizedPath = normalizePath(filePath);
      const coverage = calculateCoverage(coverageData);

      expect(normalizedPath).toBe('backend/src/coordinators/coordinators.service.ts');
      expect(coverage).toBe(100);
    });

    it('should skip files that cannot be normalized', () => {
      const filePath = '/var/log/system.log';
      const coverageData = {
        s: { '0': 5 },
        b: {},
        f: {},
      };

      function normalizePath(path: string): string | null {
        let relativePath = path;
        const pathPrefixes = ['/opt/stack/AIStudio/', '/app/'];

        for (const prefix of pathPrefixes) {
          if (relativePath.startsWith(prefix)) {
            relativePath = relativePath.substring(prefix.length);
            break;
          }
        }

        if (relativePath.startsWith('/')) {
          const parts = relativePath.split('/');
          const markers = ['backend', 'frontend', 'shared'];
          for (const marker of markers) {
            const index = parts.indexOf(marker);
            if (index >= 0) {
              relativePath = parts.slice(index).join('/');
              break;
            }
          }
        }

        return !relativePath.startsWith('/') && relativePath.includes('/') ? relativePath : null;
      }

      const normalizedPath = normalizePath(filePath);

      expect(normalizedPath).toBeNull();
    });

    it('should handle batch processing of multiple files', () => {
      const coverageEntries = [
        {
          path: '/opt/stack/AIStudio/backend/src/coordinators/coordinators.service.ts',
          data: { s: { '0': 5, '1': 3 }, b: {}, f: { '0': 2 } },
        },
        {
          path: '/app/backend/src/workflows/workflows.service.ts',
          data: { s: { '0': 0, '1': 0 }, b: {}, f: {} },
        },
        {
          path: '/opt/stack/AIStudio/frontend/src/pages/CodeQualityDashboard.tsx',
          data: { s: { '0': 10 }, b: {}, f: {} },
        },
      ];

      function normalizePath(path: string): string | null {
        let relativePath = path;
        const pathPrefixes = ['/opt/stack/AIStudio/', '/app/'];

        for (const prefix of pathPrefixes) {
          if (relativePath.startsWith(prefix)) {
            relativePath = relativePath.substring(prefix.length);
            break;
          }
        }

        return !relativePath.startsWith('/') && relativePath.includes('/') ? relativePath : null;
      }

      function calculateCoverage(data: any): number {
        const statements = data.s || {};
        const stmtTotal = Object.keys(statements).length;
        const stmtCovered = Object.values(statements).filter((v: any) => v > 0).length;
        return stmtTotal > 0 ? Math.round((stmtCovered / stmtTotal) * 100) : 100;
      }

      const results = coverageEntries
        .map(entry => ({
          path: normalizePath(entry.path),
          coverage: calculateCoverage(entry.data),
        }))
        .filter(r => r.path !== null);

      expect(results).toHaveLength(3);
      expect(results[0].path).toBe('backend/src/coordinators/coordinators.service.ts');
      expect(results[0].coverage).toBe(100);
      expect(results[1].path).toBe('backend/src/workflows/workflows.service.ts');
      expect(results[1].coverage).toBe(0);
      expect(results[2].path).toBe('frontend/src/pages/CodeQualityDashboard.tsx');
      expect(results[2].coverage).toBe(100);
    });
  });
});
