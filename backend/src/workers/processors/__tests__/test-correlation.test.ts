/**
 * Unit Tests for buildTestSourceCorrelation (ST-16 Backend Issue #2)
 *
 * Purpose: Verify that test files are properly correlated with source files
 * to calculate accurate test coverage percentages.
 *
 * Related Requirements:
 * - BR-2 (Test Coverage Correlation): Must properly match test files to source files
 * - AC-7: Test files are properly correlated with source files
 * - AC-8: CodeQualityDashboard.tsx shows >0% coverage (has integration test)
 * - AC-9: All files with __tests__/*.test.tsx files show accurate coverage
 *
 * Test Patterns to Support:
 * 1. foo.test.ts → foo.ts
 * 2. foo.spec.ts → foo.ts
 * 3. __tests__/foo.test.ts → foo.ts (same parent dir)
 * 4. foo.integration.test.tsx → foo.tsx (compound extension)
 * 5. foo.unit.test.ts → foo.ts
 * 6. __tests__/Foo.integration.test.tsx → Foo.tsx (nested __tests__)
 */

import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../../prisma/prisma.service';
import { CodeAnalysisProcessor } from '../code-analysis.processor';

describe('CodeAnalysisProcessor - Test Correlation (ST-16 Unit Tests)', () => {
  let processor: CodeAnalysisProcessor;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CodeAnalysisProcessor,
        {
          provide: PrismaService,
          useValue: {
            project: { findUnique: jest.fn() },
            codeMetric: { findMany: jest.fn(), create: jest.fn(), update: jest.fn() },
            $transaction: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: { get: jest.fn() },
        },
      ],
    }).compile();

    processor = module.get<CodeAnalysisProcessor>(CodeAnalysisProcessor);
  });

  describe('TC-ST16-U5: Basic test correlation patterns', () => {
    it('should correlate .test.ts files with .ts source files', async () => {
      const allFiles = [
        'src/services/auth.service.ts',
        'src/services/auth.service.test.ts',
      ];

      const correlation = await (processor as any).buildTestSourceCorrelation(
        allFiles,
        '/mock/repo'
      );

      expect(correlation.has('src/services/auth.service.ts')).toBe(true);
      expect(correlation.get('src/services/auth.service.ts')).toContain(
        'src/services/auth.service.test.ts'
      );
    });

    it('should correlate .spec.ts files with .ts source files', async () => {
      const allFiles = [
        'src/utils/parser.ts',
        'src/utils/parser.spec.ts',
      ];

      const correlation = await (processor as any).buildTestSourceCorrelation(
        allFiles,
        '/mock/repo'
      );

      expect(correlation.has('src/utils/parser.ts')).toBe(true);
      expect(correlation.get('src/utils/parser.ts')).toContain(
        'src/utils/parser.spec.ts'
      );
    });

    it('should correlate .test.tsx files with .tsx source files', async () => {
      const allFiles = [
        'frontend/src/components/Button.tsx',
        'frontend/src/components/Button.test.tsx',
      ];

      const correlation = await (processor as any).buildTestSourceCorrelation(
        allFiles,
        '/mock/repo'
      );

      expect(correlation.has('frontend/src/components/Button.tsx')).toBe(true);
      expect(correlation.get('frontend/src/components/Button.tsx')).toContain(
        'frontend/src/components/Button.test.tsx'
      );
    });
  });

  describe('TC-ST16-U6: Compound extension test patterns', () => {
    it('should correlate .integration.test.tsx → .tsx', async () => {
      const allFiles = [
        'frontend/src/pages/CodeQualityDashboard.tsx',
        'frontend/src/pages/CodeQualityDashboard.integration.test.tsx',
      ];

      const correlation = await (processor as any).buildTestSourceCorrelation(
        allFiles,
        '/mock/repo'
      );

      expect(correlation.has('frontend/src/pages/CodeQualityDashboard.tsx')).toBe(true);
      expect(correlation.get('frontend/src/pages/CodeQualityDashboard.tsx')).toContain(
        'frontend/src/pages/CodeQualityDashboard.integration.test.tsx'
      );
    });

    it('should correlate .unit.test.ts → .ts', async () => {
      const allFiles = [
        'backend/src/services/metrics.service.ts',
        'backend/src/services/metrics.service.unit.test.ts',
      ];

      const correlation = await (processor as any).buildTestSourceCorrelation(
        allFiles,
        '/mock/repo'
      );

      expect(correlation.has('backend/src/services/metrics.service.ts')).toBe(true);
      expect(correlation.get('backend/src/services/metrics.service.ts')).toContain(
        'backend/src/services/metrics.service.unit.test.ts'
      );
    });

    it('should correlate .e2e.test.ts → .ts', async () => {
      const allFiles = [
        'backend/src/api/workflow.controller.ts',
        'backend/src/api/workflow.controller.e2e.test.ts',
      ];

      const correlation = await (processor as any).buildTestSourceCorrelation(
        allFiles,
        '/mock/repo'
      );

      expect(correlation.has('backend/src/api/workflow.controller.ts')).toBe(true);
      expect(correlation.get('backend/src/api/workflow.controller.ts')).toContain(
        'backend/src/api/workflow.controller.e2e.test.ts'
      );
    });
  });

  describe('TC-ST16-U7: __tests__ directory patterns', () => {
    it('should correlate __tests__/Foo.test.tsx → Foo.tsx in same parent dir', async () => {
      const allFiles = [
        'frontend/src/components/Modal.tsx',
        'frontend/src/components/__tests__/Modal.test.tsx',
      ];

      const correlation = await (processor as any).buildTestSourceCorrelation(
        allFiles,
        '/mock/repo'
      );

      expect(correlation.has('frontend/src/components/Modal.tsx')).toBe(true);
      expect(correlation.get('frontend/src/components/Modal.tsx')).toContain(
        'frontend/src/components/__tests__/Modal.test.tsx'
      );
    });

    it('should correlate __tests__/Foo.integration.test.tsx → Foo.tsx', async () => {
      const allFiles = [
        'frontend/src/pages/CodeQualityDashboard.tsx',
        'frontend/src/pages/__tests__/CodeQualityDashboard.integration.test.tsx',
      ];

      const correlation = await (processor as any).buildTestSourceCorrelation(
        allFiles,
        '/mock/repo'
      );

      expect(correlation.has('frontend/src/pages/CodeQualityDashboard.tsx')).toBe(true);
      expect(correlation.get('frontend/src/pages/CodeQualityDashboard.tsx')).toContain(
        'frontend/src/pages/__tests__/CodeQualityDashboard.integration.test.tsx'
      );
    });

    it('should NOT correlate test files from different parent directories', async () => {
      const allFiles = [
        'frontend/src/components/Button.tsx',
        'frontend/src/pages/__tests__/Button.test.tsx', // Different parent dir
      ];

      const correlation = await (processor as any).buildTestSourceCorrelation(
        allFiles,
        '/mock/repo'
      );

      // Should not correlate because parent directories don't match
      const tests = correlation.get('frontend/src/components/Button.tsx') || [];
      expect(tests).not.toContain('frontend/src/pages/__tests__/Button.test.tsx');
    });
  });

  describe('TC-ST16-U8: Multiple tests for one source file', () => {
    it('should correlate multiple test files to single source file', async () => {
      const allFiles = [
        'src/services/payment.service.ts',
        'src/services/payment.service.test.ts',
        'src/services/payment.service.integration.test.ts',
        'src/services/payment.service.e2e.test.ts',
      ];

      const correlation = await (processor as any).buildTestSourceCorrelation(
        allFiles,
        '/mock/repo'
      );

      expect(correlation.has('src/services/payment.service.ts')).toBe(true);
      const tests = correlation.get('src/services/payment.service.ts') || [];
      expect(tests).toHaveLength(3);
      expect(tests).toContain('src/services/payment.service.test.ts');
      expect(tests).toContain('src/services/payment.service.integration.test.ts');
      expect(tests).toContain('src/services/payment.service.e2e.test.ts');
    });

    it('should handle both inline and __tests__ patterns for same file', async () => {
      const allFiles = [
        'src/utils/validator.ts',
        'src/utils/validator.test.ts', // Inline test
        'src/utils/__tests__/validator.integration.test.ts', // __tests__ dir
      ];

      const correlation = await (processor as any).buildTestSourceCorrelation(
        allFiles,
        '/mock/repo'
      );

      expect(correlation.has('src/utils/validator.ts')).toBe(true);
      const tests = correlation.get('src/utils/validator.ts') || [];
      expect(tests).toHaveLength(2);
      expect(tests).toContain('src/utils/validator.test.ts');
      expect(tests).toContain('src/utils/__tests__/validator.integration.test.ts');
    });
  });

  describe('TC-ST16-U9: Edge cases and no-correlation scenarios', () => {
    it('should return empty map when no test files exist', async () => {
      const allFiles = [
        'src/services/auth.service.ts',
        'src/utils/parser.ts',
      ];

      const correlation = await (processor as any).buildTestSourceCorrelation(
        allFiles,
        '/mock/repo'
      );

      expect(correlation.size).toBe(0);
    });

    it('should return empty map when no source files exist', async () => {
      const allFiles = [
        'src/services/auth.service.test.ts',
        'src/utils/parser.spec.ts',
      ];

      const correlation = await (processor as any).buildTestSourceCorrelation(
        allFiles,
        '/mock/repo'
      );

      expect(correlation.size).toBe(0);
    });

    it('should handle orphaned test files without matching source', async () => {
      const allFiles = [
        'src/services/auth.service.ts',
        'src/services/missing.service.test.ts', // No matching source file
      ];

      const correlation = await (processor as any).buildTestSourceCorrelation(
        allFiles,
        '/mock/repo'
      );

      expect(correlation.has('src/services/missing.service.ts')).toBe(false);
      expect(correlation.size).toBe(0);
    });

    it('should not add duplicate test files to correlation array', async () => {
      const allFiles = [
        'src/utils/helper.ts',
        'src/utils/helper.test.ts',
      ];

      const correlation = await (processor as any).buildTestSourceCorrelation(
        allFiles,
        '/mock/repo'
      );

      // Run correlation twice to test deduplication
      const correlation2 = await (processor as any).buildTestSourceCorrelation(
        allFiles,
        '/mock/repo'
      );

      const tests = correlation.get('src/utils/helper.ts') || [];
      expect(tests.filter((t: string) => t === 'src/utils/helper.test.ts')).toHaveLength(1);
    });
  });

  describe('TC-ST16-U10: Real-world ST-16 scenario', () => {
    it('should properly correlate CodeQualityDashboard with its integration test', async () => {
      // This is the exact scenario from ST-16 bug report
      const allFiles = [
        'frontend/src/pages/CodeQualityDashboard.tsx',
        'frontend/src/pages/__tests__/CodeQualityDashboard.integration.test.tsx',
        'frontend/src/components/CodeQuality/FileTreeView.tsx',
        'frontend/src/components/CodeQuality/__tests__/FileTreeView.test.tsx',
      ];

      const correlation = await (processor as any).buildTestSourceCorrelation(
        allFiles,
        '/mock/repo'
      );

      // CodeQualityDashboard should have its test
      expect(correlation.has('frontend/src/pages/CodeQualityDashboard.tsx')).toBe(true);
      expect(correlation.get('frontend/src/pages/CodeQualityDashboard.tsx')).toContain(
        'frontend/src/pages/__tests__/CodeQualityDashboard.integration.test.tsx'
      );

      // FileTreeView should have its test
      expect(correlation.has('frontend/src/components/CodeQuality/FileTreeView.tsx')).toBe(true);
      expect(correlation.get('frontend/src/components/CodeQuality/FileTreeView.tsx')).toContain(
        'frontend/src/components/CodeQuality/__tests__/FileTreeView.test.tsx'
      );
    });
  });
});
