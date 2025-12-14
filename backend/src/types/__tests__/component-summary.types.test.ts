/**
 * Unit tests for Component Summary Type Utilities
 * ST-203: Add componentSummary field for structured agent handoffs
 *
 * TDD Test Suite - Tests written BEFORE implementation
 */

import {
  ComponentSummaryStructured,
  ComponentSummaryStatus,
  serializeComponentSummary,
  parseComponentSummary,
  generateStructuredSummary,
} from '../component-summary.types';

describe('Component Summary Type Utilities', () => {
  describe('Type Definitions', () => {
    it('should define valid ComponentSummaryStatus values', () => {
      const validStatuses: ComponentSummaryStatus[] = ['success', 'partial', 'blocked', 'failed'];
      expect(validStatuses).toHaveLength(4);
    });

    it('should define ComponentSummaryStructured interface with required fields', () => {
      const validSummary: ComponentSummaryStructured = {
        version: '1.0',
        status: 'success',
        summary: 'Work completed successfully',
      };

      expect(validSummary.version).toBe('1.0');
      expect(validSummary.status).toBe('success');
      expect(validSummary.summary).toBe('Work completed successfully');
    });

    it('should allow optional fields in ComponentSummaryStructured', () => {
      const fullSummary: ComponentSummaryStructured = {
        version: '1.0',
        status: 'success',
        summary: 'Implemented feature',
        keyOutputs: ['Created API endpoint', 'Added tests'],
        nextAgentHints: ['Review error handling', 'Add integration tests'],
        artifactsProduced: ['ARCH_DOC', 'API_SPEC'],
        errors: ['Minor linting issue'],
      };

      expect(fullSummary.keyOutputs).toHaveLength(2);
      expect(fullSummary.nextAgentHints).toHaveLength(2);
      expect(fullSummary.artifactsProduced).toHaveLength(2);
      expect(fullSummary.errors).toHaveLength(1);
    });
  });

  describe('serializeComponentSummary', () => {
    it('should convert structured object to JSON string', () => {
      const summary: ComponentSummaryStructured = {
        version: '1.0',
        status: 'success',
        summary: 'Test summary',
      };

      const result = serializeComponentSummary(summary);

      expect(typeof result).toBe('string');
      expect(JSON.parse(result)).toEqual(summary);
    });

    it('should serialize with all optional fields', () => {
      const summary: ComponentSummaryStructured = {
        version: '1.0',
        status: 'partial',
        summary: 'Partial completion',
        keyOutputs: ['Output 1', 'Output 2'],
        nextAgentHints: ['Hint 1'],
        artifactsProduced: ['ARCH_DOC'],
        errors: ['Error 1'],
      };

      const result = serializeComponentSummary(summary);
      const parsed = JSON.parse(result);

      expect(parsed.keyOutputs).toEqual(['Output 1', 'Output 2']);
      expect(parsed.nextAgentHints).toEqual(['Hint 1']);
      expect(parsed.artifactsProduced).toEqual(['ARCH_DOC']);
      expect(parsed.errors).toEqual(['Error 1']);
    });

    it('should produce compact JSON string (no extra whitespace)', () => {
      const summary: ComponentSummaryStructured = {
        version: '1.0',
        status: 'success',
        summary: 'Test',
      };

      const result = serializeComponentSummary(summary);

      expect(result).not.toContain('\n');
      expect(result).not.toContain('  ');
    });

    it('should handle special characters in strings', () => {
      const summary: ComponentSummaryStructured = {
        version: '1.0',
        status: 'success',
        summary: 'Summary with "quotes" and \n newlines',
      };

      const result = serializeComponentSummary(summary);
      const parsed = JSON.parse(result);

      expect(parsed.summary).toBe('Summary with "quotes" and \n newlines');
    });
  });

  describe('parseComponentSummary', () => {
    it('should parse valid JSON string to structured object', () => {
      const jsonString = '{"version":"1.0","status":"success","summary":"Test"}';

      const result = parseComponentSummary(jsonString);

      expect(result).not.toBeNull();
      expect(result?.version).toBe('1.0');
      expect(result?.status).toBe('success');
      expect(result?.summary).toBe('Test');
    });

    it('should return null for invalid JSON', () => {
      const invalidJson = '{invalid json}';

      const result = parseComponentSummary(invalidJson);

      expect(result).toBeNull();
    });

    it('should return null for non-JSON string (legacy text)', () => {
      const legacyText = 'Implementer completed. Modified 3 files.';

      const result = parseComponentSummary(legacyText);

      expect(result).toBeNull();
    });

    it('should return null for empty string', () => {
      const result = parseComponentSummary('');

      expect(result).toBeNull();
    });

    it('should return null for null input', () => {
      const result = parseComponentSummary(null);

      expect(result).toBeNull();
    });

    it('should return null for undefined input', () => {
      const result = parseComponentSummary(undefined);

      expect(result).toBeNull();
    });

    it('should return null for JSON missing required fields', () => {
      const invalidStructure = '{"version":"1.0","status":"success"}'; // Missing summary

      const result = parseComponentSummary(invalidStructure);

      expect(result).toBeNull();
    });

    it('should return null for JSON with invalid status value', () => {
      const invalidStatus = '{"version":"1.0","status":"invalid","summary":"Test"}';

      const result = parseComponentSummary(invalidStatus);

      expect(result).toBeNull();
    });

    it('should parse JSON with optional fields', () => {
      const jsonWithOptionals = JSON.stringify({
        version: '1.0',
        status: 'partial',
        summary: 'Partial work',
        keyOutputs: ['Output 1'],
        nextAgentHints: ['Hint 1'],
        artifactsProduced: ['ARCH_DOC'],
        errors: ['Error 1'],
      });

      const result = parseComponentSummary(jsonWithOptionals);

      expect(result).not.toBeNull();
      expect(result?.keyOutputs).toEqual(['Output 1']);
      expect(result?.errors).toEqual(['Error 1']);
    });
  });

  describe('generateStructuredSummary', () => {
    it('should generate basic summary from minimal output', () => {
      const output = { status: 'done' };
      const componentName = 'Implementer';

      const result = generateStructuredSummary(output, componentName);

      expect(result.version).toBe('1.0');
      expect(result.status).toBe('success');
      expect(result.summary).toContain(componentName);
      expect(result.summary.length).toBeLessThanOrEqual(200);
    });

    it('should detect success status from output', () => {
      const output = { status: 'done', result: 'completed' };
      const componentName = 'Architect';

      const result = generateStructuredSummary(output, componentName);

      expect(result.status).toBe('success');
    });

    it('should detect partial status from output', () => {
      const output = { status: 'partial', result: 'some work done' };
      const componentName = 'Designer';

      const result = generateStructuredSummary(output, componentName);

      expect(result.status).toBe('partial');
    });

    it('should detect blocked status from output', () => {
      const output = { status: 'blocked', blocker: 'Waiting for approval' };
      const componentName = 'Implementer';

      const result = generateStructuredSummary(output, componentName);

      expect(result.status).toBe('blocked');
    });

    it('should detect failed status from errors', () => {
      const output = { error: 'Tests failed', errors: ['Test 1 failed', 'Test 2 failed'] };
      const componentName = 'QA';

      const result = generateStructuredSummary(output, componentName);

      expect(result.status).toBe('failed');
      expect(result.errors).toBeDefined();
      expect(result.errors!.length).toBeGreaterThan(0);
    });

    it('should extract keyOutputs from file modifications', () => {
      const output = { files: ['src/api.ts', 'src/service.ts', 'tests/api.test.ts'] };
      const componentName = 'Implementer';

      const result = generateStructuredSummary(output, componentName);

      expect(result.keyOutputs).toBeDefined();
      expect(result.keyOutputs!.length).toBeGreaterThan(0);
      expect(result.keyOutputs!.length).toBeLessThanOrEqual(5);
    });

    it('should limit keyOutputs to max 5 items', () => {
      const output = {
        files: ['file1.ts', 'file2.ts', 'file3.ts', 'file4.ts', 'file5.ts', 'file6.ts', 'file7.ts'],
      };
      const componentName = 'Implementer';

      const result = generateStructuredSummary(output, componentName);

      expect(result.keyOutputs).toBeDefined();
      expect(result.keyOutputs!.length).toBeLessThanOrEqual(5);
    });

    it('should extract artifactsProduced from output', () => {
      const output = {
        artifactsCreated: ['ARCH_DOC', 'API_SPEC', 'DESIGN_DOC'],
      };
      const componentName = 'Architect';

      const result = generateStructuredSummary(output, componentName);

      expect(result.artifactsProduced).toBeDefined();
      expect(result.artifactsProduced).toEqual(['ARCH_DOC', 'API_SPEC', 'DESIGN_DOC']);
    });

    it('should generate nextAgentHints when recommendations exist', () => {
      const output = {
        recommendations: ['Add error handling', 'Implement retry logic', 'Add monitoring'],
      };
      const componentName = 'Architect';

      const result = generateStructuredSummary(output, componentName);

      expect(result.nextAgentHints).toBeDefined();
      expect(result.nextAgentHints!.length).toBeGreaterThan(0);
      expect(result.nextAgentHints!.length).toBeLessThanOrEqual(3);
    });

    it('should limit nextAgentHints to max 3 items', () => {
      const output = {
        recommendations: ['Hint 1', 'Hint 2', 'Hint 3', 'Hint 4', 'Hint 5'],
      };
      const componentName = 'Designer';

      const result = generateStructuredSummary(output, componentName);

      expect(result.nextAgentHints).toBeDefined();
      expect(result.nextAgentHints!.length).toBeLessThanOrEqual(3);
    });

    it('should limit errors to max 3 items', () => {
      const output = {
        errors: ['Error 1', 'Error 2', 'Error 3', 'Error 4', 'Error 5'],
      };
      const componentName = 'QA';

      const result = generateStructuredSummary(output, componentName);

      expect(result.errors).toBeDefined();
      expect(result.errors!.length).toBeLessThanOrEqual(3);
    });

    it('should truncate summary to max 200 characters', () => {
      const output = {
        description:
          'This is a very long description that exceeds 200 characters. It contains lots of details about the work that was done, including multiple aspects and considerations. This text should be truncated to fit within the 200 character limit for the summary field.',
      };
      const componentName = 'Implementer';

      const result = generateStructuredSummary(output, componentName);

      expect(result.summary.length).toBeLessThanOrEqual(200);
    });

    it('should handle empty output object', () => {
      const output = {};
      const componentName = 'Explorer';

      const result = generateStructuredSummary(output, componentName);

      expect(result.version).toBe('1.0');
      expect(result.status).toBe('success');
      expect(result.summary).toBeTruthy();
    });

    it('should handle null output', () => {
      const componentName = 'Implementer';

      const result = generateStructuredSummary(null, componentName);

      expect(result.version).toBe('1.0');
      expect(result.status).toBe('success');
      expect(result.summary).toContain(componentName);
    });

    it('should handle undefined output', () => {
      const componentName = 'Designer';

      const result = generateStructuredSummary(undefined, componentName);

      expect(result.version).toBe('1.0');
      expect(result.status).toBe('success');
      expect(result.summary).toContain(componentName);
    });

    it('should include component name in summary', () => {
      const output = { result: 'done' };
      const componentName = 'CustomAgent';

      const result = generateStructuredSummary(output, componentName);

      expect(result.summary.toLowerCase()).toContain('customagent'.toLowerCase());
    });
  });

  describe('Validation Edge Cases', () => {
    it('should handle arrays exceeding max lengths', () => {
      const summary: ComponentSummaryStructured = {
        version: '1.0',
        status: 'success',
        summary: 'Test',
        keyOutputs: ['1', '2', '3', '4', '5', '6'], // Max 5
        nextAgentHints: ['a', 'b', 'c', 'd'], // Max 3
        errors: ['e1', 'e2', 'e3', 'e4'], // Max 3
      };

      const serialized = serializeComponentSummary(summary);
      const parsed = parseComponentSummary(serialized);

      // Parser should accept the data even if it exceeds max
      // (validation is done at generation time)
      expect(parsed).not.toBeNull();
    });

    it('should handle summary exceeding max length', () => {
      const longSummary = 'x'.repeat(300); // Max 200
      const summary: ComponentSummaryStructured = {
        version: '1.0',
        status: 'success',
        summary: longSummary,
      };

      const serialized = serializeComponentSummary(summary);
      const parsed = parseComponentSummary(serialized);

      // Parser accepts it (truncation happens at generation)
      expect(parsed).not.toBeNull();
      expect(parsed?.summary).toBe(longSummary);
    });
  });

  describe('Backward Compatibility', () => {
    it('should gracefully handle legacy text summaries in parse', () => {
      const legacyText = 'Implementer completed. Modified 3 file(s).';

      const result = parseComponentSummary(legacyText);

      // Should return null for non-JSON legacy format
      expect(result).toBeNull();
    });

    it('should allow consuming code to detect legacy vs structured', () => {
      const structuredJson = '{"version":"1.0","status":"success","summary":"Test"}';
      const legacyText = 'Old format summary';

      const structured = parseComponentSummary(structuredJson);
      const legacy = parseComponentSummary(legacyText);

      expect(structured).not.toBeNull();
      expect(legacy).toBeNull();
    });
  });
});
