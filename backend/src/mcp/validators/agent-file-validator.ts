import * as fs from 'fs/promises';
import * as path from 'path';
import { getErrorMessage } from '../../common';

export interface ValidationError {
  file: string;
  error: string;
  severity: 'error' | 'warning';
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

export class AgentFileValidator {
  /**
   * Validate an agent file's structure and content
   * @param filePath - Path to the agent file
   * @returns Validation result with errors if any
   */
  static async validateFile(filePath: string): Promise<ValidationResult> {
    const errors: ValidationError[] = [];

    try {
      // Check if file exists
      const exists = await this.fileExists(filePath);
      if (!exists) {
        errors.push({
          file: filePath,
          error: 'File does not exist',
          severity: 'error',
        });
        return { valid: false, errors };
      }

      // Read file content
      const content = await fs.readFile(filePath, 'utf-8');

      // Validate frontmatter
      const frontmatterErrors = this.validateFrontmatter(filePath, content);
      errors.push(...frontmatterErrors);

      // Validate markdown structure
      const markdownErrors = this.validateMarkdownStructure(filePath, content);
      errors.push(...markdownErrors);

      // Validate content sections
      const contentErrors = this.validateContentSections(filePath, content);
      errors.push(...contentErrors);
    } catch (error) {
      errors.push({
        file: filePath,
        error: `Failed to validate file: ${getErrorMessage(error)}`,
        severity: 'error',
      });
    }

    return {
      valid: errors.filter((e) => e.severity === 'error').length === 0,
      errors,
    };
  }

  /**
   * Validate multiple agent files
   */
  static async validateFiles(filePaths: string[]): Promise<ValidationResult> {
    const allErrors: ValidationError[] = [];

    for (const filePath of filePaths) {
      const result = await this.validateFile(filePath);
      allErrors.push(...result.errors);
    }

    return {
      valid: allErrors.filter((e) => e.severity === 'error').length === 0,
      errors: allErrors,
    };
  }

  private static async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  private static validateFrontmatter(
    filePath: string,
    content: string,
  ): ValidationError[] {
    const errors: ValidationError[] = [];

    // Check if frontmatter exists
    const frontmatterRegex = /^---\n([\s\S]*?)\n---/;
    const match = content.match(frontmatterRegex);

    if (!match) {
      errors.push({
        file: filePath,
        error: 'Missing YAML frontmatter (should start with ---)',
        severity: 'error',
      });
      return errors;
    }

    const frontmatterContent = match[1];

    // Validate required fields based on file type
    if (filePath.includes('coordinator-')) {
      this.validateCoordinatorFrontmatter(filePath, frontmatterContent, errors);
    } else if (filePath.includes('component-')) {
      this.validateComponentFrontmatter(filePath, frontmatterContent, errors);
    } else if (filePath.includes('workflow-')) {
      this.validateWorkflowFrontmatter(filePath, frontmatterContent, errors);
    }

    return errors;
  }

  private static validateCoordinatorFrontmatter(
    filePath: string,
    frontmatter: string,
    errors: ValidationError[],
  ): void {
    const requiredFields = ['name', 'description', 'domain', 'tools'];

    for (const field of requiredFields) {
      const fieldRegex = new RegExp(`^${field}:`, 'm');
      if (!fieldRegex.test(frontmatter)) {
        errors.push({
          file: filePath,
          error: `Missing required frontmatter field: ${field}`,
          severity: 'error',
        });
      }
    }
  }

  private static validateComponentFrontmatter(
    filePath: string,
    frontmatter: string,
    errors: ValidationError[],
  ): void {
    const requiredFields = ['name', 'description', 'tags', 'tools'];

    for (const field of requiredFields) {
      const fieldRegex = new RegExp(`^${field}:`, 'm');
      if (!fieldRegex.test(frontmatter)) {
        errors.push({
          file: filePath,
          error: `Missing required frontmatter field: ${field}`,
          severity: 'error',
        });
      }
    }
  }

  private static validateWorkflowFrontmatter(
    filePath: string,
    frontmatter: string,
    errors: ValidationError[],
  ): void {
    const requiredFields = ['name', 'description', 'version'];

    for (const field of requiredFields) {
      const fieldRegex = new RegExp(`^${field}:`, 'm');
      if (!fieldRegex.test(frontmatter)) {
        errors.push({
          file: filePath,
          error: `Missing required frontmatter field: ${field}`,
          severity: 'error',
        });
      }
    }

    // Validate version format
    const versionMatch = frontmatter.match(/version:\s*(.+)/);
    if (versionMatch) {
      const version = versionMatch[1].trim();
      if (!/^v\d+\.\d+$/.test(version)) {
        errors.push({
          file: filePath,
          error: `Invalid version format: ${version} (should be v1.0, v2.1, etc.)`,
          severity: 'warning',
        });
      }
    }
  }

  private static validateMarkdownStructure(
    filePath: string,
    content: string,
  ): ValidationError[] {
    const errors: ValidationError[] = [];

    // Remove frontmatter for markdown validation
    const contentWithoutFrontmatter = content.replace(/^---\n[\s\S]*?\n---\n/, '');

    // Check for h1 heading
    if (!/^# /.test(contentWithoutFrontmatter)) {
      errors.push({
        file: filePath,
        error: 'Missing main heading (# Header)',
        severity: 'warning',
      });
    }

    // Check for balanced code blocks
    const codeBlockMatches = contentWithoutFrontmatter.match(/```/g);
    if (codeBlockMatches && codeBlockMatches.length % 2 !== 0) {
      errors.push({
        file: filePath,
        error: 'Unbalanced code blocks (missing closing ```)',
        severity: 'error',
      });
    }

    return errors;
  }

  private static validateContentSections(
    filePath: string,
    content: string,
  ): ValidationError[] {
    const errors: ValidationError[] = [];

    // Validate based on file type
    if (filePath.includes('component-')) {
      this.validateComponentSections(filePath, content, errors);
    } else if (filePath.includes('coordinator-')) {
      this.validateCoordinatorSections(filePath, content, errors);
    } else if (filePath.includes('workflow-')) {
      this.validateWorkflowSections(filePath, content, errors);
    }

    return errors;
  }

  private static validateComponentSections(
    filePath: string,
    content: string,
    errors: ValidationError[],
  ): void {
    const requiredSections = [
      'Input Instructions',
      'Operation Instructions',
      'Output Instructions',
    ];

    for (const section of requiredSections) {
      const sectionRegex = new RegExp(`##\\s+${section}`, 'i');
      if (!sectionRegex.test(content)) {
        errors.push({
          file: filePath,
          error: `Missing required section: ${section}`,
          severity: 'warning',
        });
      }
    }
  }

  private static validateCoordinatorSections(
    filePath: string,
    content: string,
    errors: ValidationError[],
  ): void {
    const requiredSections = ['Overview', 'Coordinator Instructions'];

    for (const section of requiredSections) {
      const sectionRegex = new RegExp(`##\\s+${section}`, 'i');
      if (!sectionRegex.test(content)) {
        errors.push({
          file: filePath,
          error: `Missing required section: ${section}`,
          severity: 'warning',
        });
      }
    }
  }

  private static validateWorkflowSections(
    filePath: string,
    content: string,
    errors: ValidationError[],
  ): void {
    const requiredSections = ['Description', 'Coordinator', 'Usage'];

    for (const section of requiredSections) {
      const sectionRegex = new RegExp(`##\\s+${section}`, 'i');
      if (!sectionRegex.test(content)) {
        errors.push({
          file: filePath,
          error: `Missing required section: ${section}`,
          severity: 'warning',
        });
      }
    }
  }
}
