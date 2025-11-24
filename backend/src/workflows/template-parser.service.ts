import { Injectable } from '@nestjs/common';

export interface TemplateReference {
  name: string;
  startIndex: number;
  endIndex: number;
}

export interface TemplateValidationError {
  reference: string;
  message: string;
  startIndex: number;
  endIndex: number;
}

export interface TemplateValidationResult {
  valid: boolean;
  references: TemplateReference[];
  errors: TemplateValidationError[];
  missingComponents: string[];
}

export interface ComponentAssignment {
  componentName: string;
  componentId: string;
  versionId: string;
  version: string;
  versionMajor: number;
  versionMinor: number;
}

@Injectable()
export class TemplateParserService {
  /**
   * Extract all {{template}} references from instructions text
   */
  extractReferences(instructions: string): TemplateReference[] {
    const regex = /\{\{([^}]+)\}\}/g;
    const references: TemplateReference[] = [];
    let match: RegExpExecArray | null;

    while ((match = regex.exec(instructions)) !== null) {
      references.push({
        name: match[1].trim(),
        startIndex: match.index,
        endIndex: match.index + match[0].length,
      });
    }

    return references;
  }

  /**
   * Validate that all template references exist in component assignments
   */
  validateReferences(
    instructions: string,
    componentAssignments: ComponentAssignment[],
  ): TemplateValidationResult {
    const references = this.extractReferences(instructions);
    const errors: TemplateValidationError[] = [];
    const missingComponents: string[] = [];

    // Create a set of available component names
    const availableComponents = new Set(
      componentAssignments.map((c) => c.componentName),
    );

    // Check each reference
    for (const ref of references) {
      if (!availableComponents.has(ref.name)) {
        // Check if it's a typo (case-insensitive or close match)
        const suggestions = this.findSuggestions(ref.name, availableComponents);
        const message = suggestions.length > 0
          ? `Component '${ref.name}' not found. Did you mean: ${suggestions.join(', ')}?`
          : `Component '${ref.name}' not found in assigned components`;

        errors.push({
          reference: ref.name,
          message,
          startIndex: ref.startIndex,
          endIndex: ref.endIndex,
        });

        if (!missingComponents.includes(ref.name)) {
          missingComponents.push(ref.name);
        }
      }
    }

    return {
      valid: errors.length === 0,
      references,
      errors,
      missingComponents,
    };
  }

  /**
   * Find potential typo corrections using simple string similarity
   */
  private findSuggestions(input: string, available: Set<string>): string[] {
    const suggestions: string[] = [];
    const lowerInput = input.toLowerCase();

    for (const name of available) {
      const lowerName = name.toLowerCase();

      // Exact case-insensitive match
      if (lowerName === lowerInput) {
        suggestions.push(name);
        continue;
      }

      // Starts with or contains
      if (lowerName.includes(lowerInput) || lowerInput.includes(lowerName)) {
        suggestions.push(name);
        continue;
      }

      // Simple Levenshtein distance check (max 2 edits)
      if (this.levenshteinDistance(lowerInput, lowerName) <= 2) {
        suggestions.push(name);
      }
    }

    return suggestions.slice(0, 3); // Return max 3 suggestions
  }

  /**
   * Calculate Levenshtein distance between two strings
   */
  private levenshteinDistance(a: string, b: string): number {
    const matrix: number[][] = [];

    for (let i = 0; i <= b.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= a.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substitution
            matrix[i][j - 1] + 1, // insertion
            matrix[i - 1][j] + 1, // deletion
          );
        }
      }
    }

    return matrix[b.length][a.length];
  }

  /**
   * Get all unique component names referenced in instructions
   */
  getReferencedComponents(instructions: string): string[] {
    const references = this.extractReferences(instructions);
    return [...new Set(references.map((r) => r.name))];
  }

  /**
   * Replace template references with actual component information
   * Useful for preview/display purposes
   */
  resolveReferences(
    instructions: string,
    componentAssignments: ComponentAssignment[],
  ): string {
    let resolved = instructions;
    const componentMap = new Map(
      componentAssignments.map((c) => [c.componentName, c]),
    );

    const regex = /\{\{([^}]+)\}\}/g;
    resolved = resolved.replace(regex, (match, name) => {
      const trimmedName = name.trim();
      const component = componentMap.get(trimmedName);
      if (component) {
        return `{{${trimmedName} (${component.version})}}`;
      }
      return match; // Leave unresolved if not found
    });

    return resolved;
  }
}
