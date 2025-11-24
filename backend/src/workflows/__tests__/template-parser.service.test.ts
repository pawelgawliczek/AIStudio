import { TemplateParserService } from '../template-parser.service';
import type { ComponentAssignment } from '../template-parser.service';

describe('TemplateParserService', () => {
  let service: TemplateParserService;

  beforeEach(() => {
    service = new TemplateParserService();
  });

  describe('extractReferences', () => {
    it('should extract single template reference', () => {
      const instructions = 'Use {{Component A}} to implement feature';
      const references = service.extractReferences(instructions);

      expect(references).toHaveLength(1);
      expect(references[0]).toEqual({
        name: 'Component A',
        startIndex: 4,
        endIndex: 19, // Length of "Use {{Component A}}" up to closing braces
      });
    });

    it('should extract multiple template references', () => {
      const instructions = 'Use {{Component A}} and {{Component B}} together';
      const references = service.extractReferences(instructions);

      expect(references).toHaveLength(2);
      expect(references[0].name).toBe('Component A');
      expect(references[1].name).toBe('Component B');
    });

    it('should handle empty instructions', () => {
      const references = service.extractReferences('');
      expect(references).toHaveLength(0);
    });

    it('should handle instructions with no templates', () => {
      const instructions = 'This has no templates';
      const references = service.extractReferences(instructions);
      expect(references).toHaveLength(0);
    });

    it('should trim whitespace inside template braces', () => {
      const instructions = 'Use {{ Component A }} with extra spaces';
      const references = service.extractReferences(instructions);

      expect(references).toHaveLength(1);
      expect(references[0].name).toBe('Component A');
    });

    it('should handle multiline instructions', () => {
      const instructions = `
        Step 1: {{Component A}} analyzes
        Step 2: {{Component B}} implements
        Step 3: {{Component C}} validates
      `;
      const references = service.extractReferences(instructions);

      expect(references).toHaveLength(3);
      expect(references[0].name).toBe('Component A');
      expect(references[1].name).toBe('Component B');
      expect(references[2].name).toBe('Component C');
    });

    it('should handle duplicate references', () => {
      const instructions = '{{Component A}} then {{Component A}} again';
      const references = service.extractReferences(instructions);

      expect(references).toHaveLength(2);
      expect(references[0].name).toBe('Component A');
      expect(references[1].name).toBe('Component A');
    });

    it('should ignore single braces', () => {
      const instructions = 'Use {Component A} with single braces';
      const references = service.extractReferences(instructions);
      expect(references).toHaveLength(0);
    });

    it('should handle nested braces correctly', () => {
      const instructions = 'Use {{Component {A}}} incorrectly';
      const references = service.extractReferences(instructions);
      // Should extract "Component {A" as the reference name
      expect(references).toHaveLength(1);
    });
  });

  describe('validateReferences', () => {
    const mockAssignments: ComponentAssignment[] = [
      {
        componentName: 'Developer',
        componentId: 'comp-1',
        versionId: 'ver-1',
        version: 'v1.0',
        versionMajor: 1,
        versionMinor: 0,
      },
      {
        componentName: 'QA Engineer',
        componentId: 'comp-2',
        versionId: 'ver-2',
        version: 'v2.0',
        versionMajor: 2,
        versionMinor: 0,
      },
    ];

    it('should validate all references exist', () => {
      const instructions = 'Use {{Developer}} and {{QA Engineer}}';
      const result = service.validateReferences(instructions, mockAssignments);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.missingComponents).toHaveLength(0);
    });

    it('should detect missing component reference', () => {
      const instructions = 'Use {{Unknown Component}}';
      const result = service.validateReferences(instructions, mockAssignments);

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].reference).toBe('Unknown Component');
      expect(result.missingComponents).toContain('Unknown Component');
    });

    it('should suggest corrections for typos', () => {
      const instructions = 'Use {{Develper}}'; // Missing 'o'
      const result = service.validateReferences(instructions, mockAssignments);

      expect(result.valid).toBe(false);
      expect(result.errors[0].message).toContain('Did you mean');
      expect(result.errors[0].message).toContain('Developer');
    });

    it('should suggest case-insensitive match', () => {
      const instructions = 'Use {{developer}}'; // Wrong case
      const result = service.validateReferences(instructions, mockAssignments);

      expect(result.valid).toBe(false);
      expect(result.errors[0].message).toContain('Developer');
    });

    it('should validate partial name match', () => {
      const instructions = 'Use {{Dev}}'; // Partial match
      const result = service.validateReferences(instructions, mockAssignments);

      expect(result.valid).toBe(false);
      expect(result.errors[0].message).toContain('Developer');
    });

    it('should handle multiple missing components', () => {
      const instructions = 'Use {{Unknown1}} and {{Unknown2}}';
      const result = service.validateReferences(instructions, mockAssignments);

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(2);
      expect(result.missingComponents).toHaveLength(2);
    });

    it('should validate with empty component assignments', () => {
      const instructions = 'Use {{Developer}}';
      const result = service.validateReferences(instructions, []);

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
    });

    it('should handle instructions with no references', () => {
      const instructions = 'No templates here';
      const result = service.validateReferences(instructions, mockAssignments);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.references).toHaveLength(0);
    });
  });

  describe('getReferencedComponents', () => {
    it('should return unique component names', () => {
      const instructions = '{{Developer}} then {{Developer}} again and {{QA Engineer}}';
      const referenced = service.getReferencedComponents(instructions);

      expect(referenced).toHaveLength(2);
      expect(referenced).toContain('Developer');
      expect(referenced).toContain('QA Engineer');
    });

    it('should return empty array for no references', () => {
      const instructions = 'No templates here';
      const referenced = service.getReferencedComponents(instructions);

      expect(referenced).toHaveLength(0);
    });
  });

  describe('resolveReferences', () => {
    const mockAssignments: ComponentAssignment[] = [
      {
        componentName: 'Developer',
        componentId: 'comp-1',
        versionId: 'ver-1',
        version: 'v1.0',
        versionMajor: 1,
        versionMinor: 0,
      },
      {
        componentName: 'QA Engineer',
        componentId: 'comp-2',
        versionId: 'ver-2',
        version: 'v2.0',
        versionMajor: 2,
        versionMinor: 0,
      },
    ];

    it('should resolve template references with version info', () => {
      const instructions = 'Use {{Developer}} and {{QA Engineer}}';
      const resolved = service.resolveReferences(instructions, mockAssignments);

      expect(resolved).toBe('Use {{Developer (v1.0)}} and {{QA Engineer (v2.0)}}');
    });

    it('should leave unresolved references unchanged', () => {
      const instructions = 'Use {{Unknown Component}}';
      const resolved = service.resolveReferences(instructions, mockAssignments);

      expect(resolved).toBe('Use {{Unknown Component}}');
    });

    it('should handle mixed resolved and unresolved', () => {
      const instructions = 'Use {{Developer}} and {{Unknown}}';
      const resolved = service.resolveReferences(instructions, mockAssignments);

      expect(resolved).toContain('{{Developer (v1.0)}}');
      expect(resolved).toContain('{{Unknown}}');
    });

    it('should handle empty instructions', () => {
      const resolved = service.resolveReferences('', mockAssignments);
      expect(resolved).toBe('');
    });

    it('should handle instructions with no templates', () => {
      const instructions = 'No templates here';
      const resolved = service.resolveReferences(instructions, mockAssignments);
      expect(resolved).toBe('No templates here');
    });
  });

  describe('Levenshtein distance', () => {
    it('should detect close typos within distance of 2', () => {
      // Private method test via validation
      const instructions = 'Use {{Develope}}'; // Missing 'r', distance = 1
      const mockAssignments: ComponentAssignment[] = [
        {
          componentName: 'Developer',
          componentId: 'comp-1',
          versionId: 'ver-1',
          version: 'v1.0',
          versionMajor: 1,
          versionMinor: 0,
        },
      ];

      const result = service.validateReferences(instructions, mockAssignments);

      expect(result.valid).toBe(false);
      expect(result.errors[0].message).toContain('Developer');
    });

    it('should not suggest if distance is too large', () => {
      const instructions = 'Use {{XYZ}}'; // Very different, distance > 2
      const mockAssignments: ComponentAssignment[] = [
        {
          componentName: 'Developer',
          componentId: 'comp-1',
          versionId: 'ver-1',
          version: 'v1.0',
          versionMajor: 1,
          versionMinor: 0,
        },
      ];

      const result = service.validateReferences(instructions, mockAssignments);

      expect(result.valid).toBe(false);
      expect(result.errors[0].message).not.toContain('Did you mean');
    });
  });

  describe('Edge cases', () => {
    it('should handle very long instructions', () => {
      const longInstructions = 'Step 1: {{Developer}} '.repeat(100);
      const mockAssignments: ComponentAssignment[] = [
        {
          componentName: 'Developer',
          componentId: 'comp-1',
          versionId: 'ver-1',
          version: 'v1.0',
          versionMajor: 1,
          versionMinor: 0,
        },
      ];

      const result = service.validateReferences(longInstructions, mockAssignments);
      expect(result.valid).toBe(true);
      expect(result.references).toHaveLength(100);
    });

    it('should handle Unicode characters in component names', () => {
      const instructions = 'Use {{开发者}} for implementation'; // Chinese characters
      const mockAssignments: ComponentAssignment[] = [
        {
          componentName: '开发者',
          componentId: 'comp-1',
          versionId: 'ver-1',
          version: 'v1.0',
          versionMajor: 1,
          versionMinor: 0,
        },
      ];

      const result = service.validateReferences(instructions, mockAssignments);
      expect(result.valid).toBe(true);
    });

    it('should handle special characters in component names', () => {
      const instructions = 'Use {{Full-Stack Developer}} for implementation';
      const mockAssignments: ComponentAssignment[] = [
        {
          componentName: 'Full-Stack Developer',
          componentId: 'comp-1',
          versionId: 'ver-1',
          version: 'v1.0',
          versionMajor: 1,
          versionMinor: 0,
        },
      ];

      const result = service.validateReferences(instructions, mockAssignments);
      expect(result.valid).toBe(true);
    });

    it('should limit suggestions to 3 maximum', () => {
      const instructions = 'Use {{Dev}}';
      const mockAssignments: ComponentAssignment[] = [
        { componentName: 'Developer', componentId: '1', versionId: '1', version: 'v1.0', versionMajor: 1, versionMinor: 0 },
        { componentName: 'DevOps', componentId: '2', versionId: '2', version: 'v1.0', versionMajor: 1, versionMinor: 0 },
        { componentName: 'Device Manager', componentId: '3', versionId: '3', version: 'v1.0', versionMajor: 1, versionMinor: 0 },
        { componentName: 'Debugger', componentId: '4', versionId: '4', version: 'v1.0', versionMajor: 1, versionMinor: 0 },
      ];

      const result = service.validateReferences(instructions, mockAssignments);
      // Should suggest max 3 even though 4 match
      expect(result.errors[0].message.split(',').length).toBeLessThanOrEqual(3);
    });
  });
});
