/**
 * Unit tests for Component Summary Helper Functions
 * ST-284: Architecture & Complexity Cleanup - Phase 1
 *
 * TDD Test Suite - Tests written BEFORE implementation
 *
 * These tests cover helper functions that will be extracted from generateStructuredSummary
 * to reduce cyclomatic complexity and improve maintainability.
 */

import {
  detectStatusFromOutput,
  extractKeyOutputs,
  extractErrors,
  extractArtifacts,
  cleanupEmptyArrays,
} from '../component-summary.helpers';
import {
  ComponentSummaryStructured,
} from '../component-summary.types';

// Helper functions to be implemented in component-summary.helpers.ts
// These are currently NOT implemented - tests will fail

describe('Component Summary Helper Functions', () => {
  describe('detectStatusFromOutput', () => {
    it('should detect success status from string output', () => {
      const output = { status: 'done', result: 'success' };

      const result = detectStatusFromOutput(output, 'success');

      expect(result).toBe('success');
    });

    it('should detect partial status from output.status field', () => {
      const output = { status: 'partial' };

      const result = detectStatusFromOutput(output, 'success');

      expect(result).toBe('partial');
    });

    it('should detect partial status from string containing "partial"', () => {
      const output = { status: 'work partially complete' };

      const result = detectStatusFromOutput(output, 'success');

      expect(result).toBe('partial');
    });

    it('should detect blocked status from output.status field', () => {
      const output = { status: 'blocked' };

      const result = detectStatusFromOutput(output, 'success');

      expect(result).toBe('blocked');
    });

    it('should detect blocked status from string containing "blocked"', () => {
      const output = { status: 'execution blocked by dependency' };

      const result = detectStatusFromOutput(output, 'success');

      expect(result).toBe('blocked');
    });

    it('should detect failed status from errors array', () => {
      const output = { errors: ['Error 1', 'Error 2'] };

      const result = detectStatusFromOutput(output, 'success');

      expect(result).toBe('failed');
    });

    it('should detect failed status from error field', () => {
      const output = { error: 'Something went wrong' };

      const result = detectStatusFromOutput(output, 'success');

      expect(result).toBe('failed');
    });

    it('should detect failed status from success=false', () => {
      const output = { success: false };

      const result = detectStatusFromOutput(output, 'success');

      expect(result).toBe('failed');
    });

    it('should detect failed status from failed=true', () => {
      const output = { failed: true };

      const result = detectStatusFromOutput(output, 'success');

      expect(result).toBe('failed');
    });

    it('should use explicit status parameter when provided', () => {
      const output = { status: 'partial' };

      const result = detectStatusFromOutput(output, 'failed');

      // Explicit status should take precedence
      expect(result).toBe('failed');
    });

    it('should return default status for empty output', () => {
      const output = {};

      const result = detectStatusFromOutput(output, 'success');

      expect(result).toBe('success');
    });

    it('should handle undefined output', () => {
      const result = detectStatusFromOutput(undefined, 'success');

      expect(result).toBe('success');
    });

    it('should handle null output', () => {
      const result = detectStatusFromOutput(null, 'success');

      expect(result).toBe('success');
    });

    it('should prioritize explicit status over inferred status', () => {
      const output = { status: 'partial', errors: ['Error 1'] };

      const result = detectStatusFromOutput(output, 'failed');

      // Explicit status parameter should win
      expect(result).toBe('failed');
    });

    it('should detect failed from multiple failure indicators', () => {
      const output = {
        success: false,
        failed: true,
        error: 'Critical error',
        errors: ['Error 1', 'Error 2'],
      };

      const result = detectStatusFromOutput(output, 'success');

      expect(result).toBe('failed');
    });
  });

  describe('extractKeyOutputs', () => {
    it('should extract file modifications from files array', () => {
      const output = { files: ['src/api.ts', 'src/service.ts', 'tests/api.test.ts'] };

      const result = extractKeyOutputs(output);

      expect(result).toContain('Modified 3 file(s)');
    });

    it('should extract file modifications from filesModified array', () => {
      const output = { filesModified: ['src/api.ts', 'src/service.ts'] };

      const result = extractKeyOutputs(output);

      expect(result).toContain('Modified 2 file(s)');
    });

    it('should prefer filesModified over files when both exist', () => {
      const output = {
        files: ['file1.ts', 'file2.ts'],
        filesModified: ['modified1.ts', 'modified2.ts', 'modified3.ts'],
      };

      const result = extractKeyOutputs(output);

      // Should use filesModified count (3), not files (2)
      expect(result.find(s => s.includes('Modified 3 file(s)'))).toBeTruthy();
    });

    it('should extract and truncate summary field', () => {
      const output = { summary: 'Implemented user authentication with OAuth2 support' };

      const result = extractKeyOutputs(output);

      expect(result.length).toBeGreaterThan(0);
      expect(result.some(s => s.includes('Implemented user authentication'))).toBe(true);
    });

    it('should extract and truncate changes field', () => {
      const output = { changes: 'Updated API endpoints and added validation' };

      const result = extractKeyOutputs(output);

      expect(result.length).toBeGreaterThan(0);
      expect(result.some(s => s.includes('Updated API endpoints'))).toBe(true);
    });

    it('should extract and truncate description field', () => {
      const output = { description: 'Refactored database queries for better performance' };

      const result = extractKeyOutputs(output);

      expect(result.length).toBeGreaterThan(0);
      expect(result.some(s => s.includes('Refactored database queries'))).toBe(true);
    });

    it('should truncate long summaries to 100 characters', () => {
      const longSummary = 'x'.repeat(200);
      const output = { summary: longSummary };

      const result = extractKeyOutputs(output);

      const summaryItem = result.find(s => s.includes('x'));
      expect(summaryItem).toBeDefined();
      expect(summaryItem!.length).toBeLessThanOrEqual(103); // 100 chars + "..."
    });

    it('should extract error count from errorCount field', () => {
      const output = { errorCount: 5 };

      const result = extractKeyOutputs(output);

      expect(result).toContain('Found 5 error(s)');
    });

    it('should not include error count when it is zero', () => {
      const output = { errorCount: 0 };

      const result = extractKeyOutputs(output);

      expect(result.find(s => s.includes('error'))).toBeUndefined();
    });

    it('should limit output to max 5 items', () => {
      const output = {
        files: ['file1.ts', 'file2.ts'],
        summary: 'Summary text',
        changes: 'Changes text',
        description: 'Description text',
        errorCount: 3,
        additionalInfo: 'Extra info', // This would be 6th item
      };

      const result = extractKeyOutputs(output);

      expect(result.length).toBeLessThanOrEqual(5);
    });

    it('should handle empty output gracefully', () => {
      const output = {};

      const result = extractKeyOutputs(output);

      expect(result).toEqual([]);
    });

    it('should handle undefined output gracefully', () => {
      const result = extractKeyOutputs(undefined);

      expect(result).toEqual([]);
    });

    it('should handle null output gracefully', () => {
      const result = extractKeyOutputs(null);

      expect(result).toEqual([]);
    });

    it('should combine multiple output types', () => {
      const output = {
        files: ['file1.ts', 'file2.ts', 'file3.ts'],
        summary: 'Added new features',
        errorCount: 2,
      };

      const result = extractKeyOutputs(output);

      expect(result.length).toBeGreaterThan(0);
      expect(result.length).toBeLessThanOrEqual(5);
      expect(result.some(s => s.includes('Modified 3 file(s)'))).toBe(true);
      expect(result.some(s => s.includes('Added new features'))).toBe(true);
      expect(result.some(s => s.includes('Found 2 error(s)'))).toBe(true);
    });

    it('should preserve order: files, summary/changes/description, errorCount', () => {
      const output = {
        errorCount: 1,
        summary: 'Summary',
        files: ['file1.ts'],
      };

      const result = extractKeyOutputs(output);

      // Files should come first, then summary, then error count
      expect(result[0]).toContain('Modified');
      expect(result[1]).toContain('Summary');
      expect(result[2]).toContain('error');
    });
  });

  describe('extractErrors', () => {
    it('should extract errors from errors array', () => {
      const output = { errors: ['Error 1', 'Error 2', 'Error 3'] };

      const result = extractErrors(output);

      expect(result).toEqual(['Error 1', 'Error 2', 'Error 3']);
    });

    it('should extract error from error string field', () => {
      const output = { error: 'Critical failure occurred' };

      const result = extractErrors(output);

      expect(result).toEqual(['Critical failure occurred']);
    });

    it('should combine errors array and error string', () => {
      const output = {
        errors: ['Error 1', 'Error 2'],
        error: 'Fatal error',
      };

      const result = extractErrors(output);

      expect(result).toContain('Error 1');
      expect(result).toContain('Error 2');
      expect(result).toContain('Fatal error');
    });

    it('should limit errors to max 3 items', () => {
      const output = {
        errors: ['Error 1', 'Error 2', 'Error 3', 'Error 4', 'Error 5'],
      };

      const result = extractErrors(output);

      expect(result.length).toBe(3);
    });

    it('should convert non-string error values to strings', () => {
      const output = {
        errors: [{ message: 'Error object' }, 123, true],
      };

      const result = extractErrors(output);

      expect(result.length).toBeGreaterThan(0);
      result.forEach(error => {
        expect(typeof error).toBe('string');
      });
    });

    it('should handle empty errors array', () => {
      const output = { errors: [] };

      const result = extractErrors(output);

      expect(result).toEqual([]);
    });

    it('should handle missing errors field', () => {
      const output = {};

      const result = extractErrors(output);

      expect(result).toEqual([]);
    });

    it('should handle undefined output', () => {
      const result = extractErrors(undefined);

      expect(result).toEqual([]);
    });

    it('should handle null output', () => {
      const result = extractErrors(null);

      expect(result).toEqual([]);
    });

    it('should add default error when success=false but no errors', () => {
      const output = { success: false };

      const result = extractErrors(output);

      expect(result).toContain('Execution had issues.');
    });

    it('should add default error when failed=true but no errors', () => {
      const output = { failed: true };

      const result = extractErrors(output);

      expect(result).toContain('Execution had issues.');
    });

    it('should not add default error when errors already exist', () => {
      const output = {
        success: false,
        errors: ['Existing error'],
      };

      const result = extractErrors(output);

      expect(result).not.toContain('Execution had issues.');
      expect(result).toEqual(['Existing error']);
    });

    it('should handle non-array errors field gracefully', () => {
      const output = { errors: 'Single error string' };

      const result = extractErrors(output);

      // Should handle gracefully, might return empty or convert to array
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('extractArtifacts', () => {
    it('should extract artifacts from artifactsCreated array', () => {
      const output = {
        artifactsCreated: ['ARCH_DOC', 'API_SPEC', 'DESIGN_DOC'],
      };

      const result = extractArtifacts(output);

      expect(result).toEqual(['ARCH_DOC', 'API_SPEC', 'DESIGN_DOC']);
    });

    it('should extract artifacts from artifactsProduced array', () => {
      const output = {
        artifactsProduced: ['THE_PLAN', 'TECH_SPEC'],
      };

      const result = extractArtifacts(output);

      expect(result).toEqual(['THE_PLAN', 'TECH_SPEC']);
    });

    it('should extract artifacts from artifacts array', () => {
      const output = {
        artifacts: ['DOC_1', 'DOC_2'],
      };

      const result = extractArtifacts(output);

      expect(result).toEqual(['DOC_1', 'DOC_2']);
    });

    it('should prefer artifactsCreated over artifactsProduced', () => {
      const output = {
        artifactsCreated: ['CREATED_1', 'CREATED_2'],
        artifactsProduced: ['PRODUCED_1'],
      };

      const result = extractArtifacts(output);

      expect(result).toEqual(['CREATED_1', 'CREATED_2']);
    });

    it('should prefer artifactsProduced over artifacts', () => {
      const output = {
        artifactsProduced: ['PRODUCED_1', 'PRODUCED_2'],
        artifacts: ['GENERIC_1'],
      };

      const result = extractArtifacts(output);

      expect(result).toEqual(['PRODUCED_1', 'PRODUCED_2']);
    });

    it('should convert non-string artifact values to strings', () => {
      const output = {
        artifactsCreated: [{ key: 'DOC_1' }, 123, true],
      };

      const result = extractArtifacts(output);

      expect(result.length).toBeGreaterThan(0);
      result.forEach(artifact => {
        expect(typeof artifact).toBe('string');
      });
    });

    it('should handle empty artifacts array', () => {
      const output = { artifactsCreated: [] };

      const result = extractArtifacts(output);

      expect(result).toEqual([]);
    });

    it('should handle missing artifacts field', () => {
      const output = {};

      const result = extractArtifacts(output);

      expect(result).toEqual([]);
    });

    it('should handle undefined output', () => {
      const result = extractArtifacts(undefined);

      expect(result).toEqual([]);
    });

    it('should handle null output', () => {
      const result = extractArtifacts(null);

      expect(result).toEqual([]);
    });

    it('should handle non-array artifacts field gracefully', () => {
      const output = { artifactsCreated: 'SINGLE_ARTIFACT' };

      const result = extractArtifacts(output);

      // Should handle gracefully
      expect(Array.isArray(result)).toBe(true);
    });

    it('should preserve artifact key format (uppercase with underscores)', () => {
      const output = {
        artifactsCreated: ['ARCH_DOC', 'API_SPEC', 'THE_PLAN'],
      };

      const result = extractArtifacts(output);

      result.forEach(artifact => {
        expect(artifact).toMatch(/^[A-Z_0-9]+$/);
      });
    });
  });

  describe('cleanupEmptyArrays', () => {
    it('should remove empty keyOutputs array', () => {
      const summary: ComponentSummaryStructured = {
        version: '1.0',
        status: 'success',
        summary: 'Test summary',
        keyOutputs: [],
      };

      cleanupEmptyArrays(summary);

      expect(summary.keyOutputs).toBeUndefined();
    });

    it('should remove empty nextAgentHints array', () => {
      const summary: ComponentSummaryStructured = {
        version: '1.0',
        status: 'success',
        summary: 'Test summary',
        nextAgentHints: [],
      };

      cleanupEmptyArrays(summary);

      expect(summary.nextAgentHints).toBeUndefined();
    });

    it('should remove empty artifactsProduced array', () => {
      const summary: ComponentSummaryStructured = {
        version: '1.0',
        status: 'success',
        summary: 'Test summary',
        artifactsProduced: [],
      };

      cleanupEmptyArrays(summary);

      expect(summary.artifactsProduced).toBeUndefined();
    });

    it('should remove empty errors array', () => {
      const summary: ComponentSummaryStructured = {
        version: '1.0',
        status: 'success',
        summary: 'Test summary',
        errors: [],
      };

      cleanupEmptyArrays(summary);

      expect(summary.errors).toBeUndefined();
    });

    it('should remove all empty arrays in one call', () => {
      const summary: ComponentSummaryStructured = {
        version: '1.0',
        status: 'success',
        summary: 'Test summary',
        keyOutputs: [],
        nextAgentHints: [],
        artifactsProduced: [],
        errors: [],
      };

      cleanupEmptyArrays(summary);

      expect(summary.keyOutputs).toBeUndefined();
      expect(summary.nextAgentHints).toBeUndefined();
      expect(summary.artifactsProduced).toBeUndefined();
      expect(summary.errors).toBeUndefined();
    });

    it('should preserve non-empty arrays', () => {
      const summary: ComponentSummaryStructured = {
        version: '1.0',
        status: 'success',
        summary: 'Test summary',
        keyOutputs: ['Output 1'],
        nextAgentHints: ['Hint 1'],
        artifactsProduced: ['ARCH_DOC'],
        errors: ['Error 1'],
      };

      cleanupEmptyArrays(summary);

      expect(summary.keyOutputs).toEqual(['Output 1']);
      expect(summary.nextAgentHints).toEqual(['Hint 1']);
      expect(summary.artifactsProduced).toEqual(['ARCH_DOC']);
      expect(summary.errors).toEqual(['Error 1']);
    });

    it('should mutate the original object (not create a copy)', () => {
      const summary: ComponentSummaryStructured = {
        version: '1.0',
        status: 'success',
        summary: 'Test summary',
        keyOutputs: [],
      };

      const originalRef = summary;
      cleanupEmptyArrays(summary);

      expect(summary === originalRef).toBe(true);
      expect(summary.keyOutputs).toBeUndefined();
    });

    it('should handle object with no optional arrays', () => {
      const summary: ComponentSummaryStructured = {
        version: '1.0',
        status: 'success',
        summary: 'Test summary',
      };

      cleanupEmptyArrays(summary);

      // Should not throw, object should remain unchanged
      expect(summary.keyOutputs).toBeUndefined();
      expect(summary.nextAgentHints).toBeUndefined();
      expect(summary.artifactsProduced).toBeUndefined();
      expect(summary.errors).toBeUndefined();
    });

    it('should handle mix of empty and non-empty arrays', () => {
      const summary: ComponentSummaryStructured = {
        version: '1.0',
        status: 'success',
        summary: 'Test summary',
        keyOutputs: ['Output 1'], // Non-empty
        nextAgentHints: [], // Empty
        artifactsProduced: ['ARCH_DOC'], // Non-empty
        errors: [], // Empty
      };

      cleanupEmptyArrays(summary);

      expect(summary.keyOutputs).toEqual(['Output 1']);
      expect(summary.nextAgentHints).toBeUndefined();
      expect(summary.artifactsProduced).toEqual(['ARCH_DOC']);
      expect(summary.errors).toBeUndefined();
    });
  });

  describe('Integration: Using helpers together', () => {
    it('should work together to build a complete summary', () => {
      const output = {
        status: 'partial',
        files: ['file1.ts', 'file2.ts'],
        summary: 'Implemented feature X',
        errors: ['Minor linting error'],
        artifactsCreated: ['ARCH_DOC'],
      };

      const status = detectStatusFromOutput(output, 'success');
      const keyOutputs = extractKeyOutputs(output);
      const errors = extractErrors(output);
      const artifacts = extractArtifacts(output);

      const summary: ComponentSummaryStructured = {
        version: '1.0',
        status,
        summary: 'Implementer partial.',
        keyOutputs: keyOutputs.length > 0 ? keyOutputs : undefined,
        errors: errors.length > 0 ? errors : undefined,
        artifactsProduced: artifacts.length > 0 ? artifacts : undefined,
      };

      cleanupEmptyArrays(summary);

      expect(summary.status).toBe('partial');
      expect(summary.keyOutputs).toBeDefined();
      expect(summary.errors).toBeDefined();
      expect(summary.artifactsProduced).toBeDefined();
    });
  });
});
