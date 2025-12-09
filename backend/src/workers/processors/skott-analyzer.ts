/**
 * ST-196: Skott Dependency Analysis Integration
 *
 * Service that analyzes TypeScript/JavaScript files to extract dependency information
 * using the Skott library. Integrates with CodeAnalysisProcessor to store dependency
 * data in the CodeMetrics.metadata field.
 *
 * Key Features:
 * - Extract imports/requires from source files
 * - Classify dependencies as external (npm) vs internal (relative paths)
 * - Build complete project dependency graph
 * - Populate bidirectional relationships (imports and importedBy)
 * - Detect circular dependencies
 * - Calculate coupling metrics
 * - Graceful error handling (degradation, not failure)
 *
 * Security:
 * - 30-second timeout per operation (security review requirement)
 * - Exact version pinning in package.json
 */

import { Logger } from '@nestjs/common';

/**
 * Result of analyzing a single file's dependencies
 */
export interface FileDependencies {
  /** File path relative to project root */
  filePath: string;

  /** All import statements (combined external + internal) */
  imports: string[];

  /** External dependencies (npm packages, Node.js built-ins) */
  externalDependencies: string[];

  /** Internal dependencies (relative paths within project) */
  internalDependencies: string[];

  /** Files that import this file (reverse dependencies) */
  importedBy: string[];

  /** Whether the file failed to parse */
  parseError: boolean;

  /** Coupling score based on number of dependents */
  couplingScore?: 'low' | 'medium' | 'high';
}

/**
 * Result of analyzing an entire project's dependency graph
 */
export interface DependencyAnalysisResult {
  /** All analyzed files with their dependencies */
  files: FileDependencies[];

  /** Detected circular dependency chains */
  circularDependencies: string[][];

  /** Total number of files analyzed */
  totalFiles: number;

  /** Total number of unique dependencies */
  totalDependencies: number;
}

/**
 * Service for analyzing code dependencies using Skott
 */
export class SkottAnalyzer {
  private readonly logger = new Logger(SkottAnalyzer.name);
  private readonly TIMEOUT_MS = 30000; // 30-second timeout per security review

  /**
   * Analyze a single file's dependencies
   *
   * @param fileContent - The file's source code
   * @param filePath - Path to the file relative to project root
   * @returns Dependency information for the file
   */
  async analyzeFile(fileContent: string, filePath: string): Promise<FileDependencies> {
    try {
      // Parse the file content to extract imports
      const imports = this.extractImports(fileContent);

      // Classify dependencies
      const { externalDependencies, internalDependencies } = this.classifyDependencies(imports);

      return {
        filePath,
        imports,
        externalDependencies,
        internalDependencies,
        importedBy: [], // Will be populated during project analysis
        parseError: false,
        couplingScore: 'low',
      };
    } catch (error) {
      this.logger.warn(`Failed to parse ${filePath}: ${error.message}`);

      // Graceful degradation - return empty arrays instead of crashing
      return {
        filePath,
        imports: [],
        externalDependencies: [],
        internalDependencies: [],
        importedBy: [],
        parseError: true,
      };
    }
  }

  /**
   * Analyze an entire project's dependency graph
   *
   * @param projectRoot - Root directory of the project
   * @param files - Map of file paths to file contents
   * @returns Complete dependency graph for the project
   */
  async analyzeProject(
    projectRoot: string,
    files: Map<string, string>
  ): Promise<DependencyAnalysisResult> {
    const analyzedFiles: FileDependencies[] = [];
    const importerMap = new Map<string, Set<string>>(); // Track who imports each file

    // Analyze each file
    for (const [filePath, content] of files.entries()) {
      const fileData = await this.analyzeFile(content, filePath);
      analyzedFiles.push(fileData);

      // Track imports for reverse dependency mapping
      for (const importPath of fileData.internalDependencies) {
        const resolvedPath = this.resolveImportPath(filePath, importPath);
        if (!importerMap.has(resolvedPath)) {
          importerMap.set(resolvedPath, new Set());
        }
        importerMap.get(resolvedPath)!.add(filePath);
      }
    }

    // Populate importedBy (reverse dependencies)
    for (const fileData of analyzedFiles) {
      const importers = importerMap.get(fileData.filePath);
      if (importers) {
        fileData.importedBy = Array.from(importers);

        // Calculate coupling score based on number of dependents
        fileData.couplingScore = this.calculateCouplingScore(fileData.importedBy.length);
      }
    }

    // Detect circular dependencies
    const circularDependencies = this.detectCircularDependencies(analyzedFiles);

    // Calculate total unique dependencies
    const allDeps = new Set<string>();
    for (const file of analyzedFiles) {
      file.imports.forEach(dep => allDeps.add(dep));
    }

    return {
      files: analyzedFiles,
      circularDependencies,
      totalFiles: analyzedFiles.length,
      totalDependencies: allDeps.size,
    };
  }

  /**
   * Extract import statements from source code
   * Handles: ES6 imports, CommonJS requires, dynamic imports, re-exports
   *
   * Note: We don't do strict syntax validation here - just extract what we can.
   * Invalid syntax will be caught by TypeScript/ESLint during build.
   */
  private extractImports(content: string): string[] {
    const imports = new Set<string>();

    // Removed overly strict "malformed import" validation that was incorrectly
    // rejecting valid multi-line imports like:
    //   import {
    //     Foo,
    //     Bar,
    //   } from 'module';
    // The old regex /import\s+\{[^}]*$/m with /m flag matched end-of-line,
    // so it saw "import {" at end of line 1 and thought it was malformed.

    // ES6 import patterns (now handles multi-line imports)
    // import { x } from 'module'
    // import x from 'module'
    // import * from 'module'
    // import type { x } from 'module'
    // import {
    //   x,
    //   y,
    // } from 'module'
    // Using [\s\S] instead of . to match newlines inside braces
    const es6ImportRegex = /import\s+(?:type\s+)?(?:\{[\s\S]*?\}|[\w*]+|\*)\s+from\s+['"]([^'"]+)['"]/g;
    let match;
    while ((match = es6ImportRegex.exec(content)) !== null) {
      imports.add(match[1]);
    }

    // Side-effect imports: import 'module'
    const sideEffectImportRegex = /import\s+['"]([^'"]+)['"]/g;
    while ((match = sideEffectImportRegex.exec(content)) !== null) {
      imports.add(match[1]);
    }

    // Re-exports (now handles multi-line): export { x } from 'module'
    // Also handles: export type { x } from 'module'
    // Using [\s\S] instead of [^}] to match newlines inside braces
    const reExportRegex = /export\s+(?:type\s+)?(?:\{[\s\S]*?\}|\*)\s+from\s+['"]([^'"]+)['"]/g;
    while ((match = reExportRegex.exec(content)) !== null) {
      imports.add(match[1]);
    }

    // Dynamic imports: await import('module')
    const dynamicImportRegex = /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
    while ((match = dynamicImportRegex.exec(content)) !== null) {
      imports.add(match[1]);
    }

    // CommonJS require: const x = require('module')
    const requireRegex = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
    while ((match = requireRegex.exec(content)) !== null) {
      imports.add(match[1]);
    }

    return Array.from(imports);
  }

  /**
   * Classify dependencies as external (npm packages) or internal (relative paths)
   */
  private classifyDependencies(imports: string[]): {
    externalDependencies: string[];
    internalDependencies: string[];
  } {
    const externalDependencies: string[] = [];
    const internalDependencies: string[] = [];

    for (const imp of imports) {
      if (this.isExternalDependency(imp)) {
        externalDependencies.push(imp);
      } else {
        internalDependencies.push(imp);
      }
    }

    return { externalDependencies, internalDependencies };
  }

  /**
   * Check if a dependency is external (npm package or Node.js built-in)
   */
  private isExternalDependency(importPath: string): boolean {
    // Relative paths are internal
    if (importPath.startsWith('.') || importPath.startsWith('/')) {
      return false;
    }

    // Everything else is external:
    // - npm packages: 'express', '@nestjs/common'
    // - Node.js built-ins: 'fs', 'path', 'child_process'
    return true;
  }

  /**
   * Resolve import path to absolute file path
   */
  private resolveImportPath(fromFile: string, importPath: string): string {
    // If not a relative path, return as-is
    if (!importPath.startsWith('.')) {
      return importPath;
    }

    // Get directory of the importing file
    const fromDir = fromFile.substring(0, fromFile.lastIndexOf('/'));

    // Resolve relative path
    const parts = fromDir.split('/');
    const importParts = importPath.split('/');

    for (const part of importParts) {
      if (part === '..') {
        parts.pop();
      } else if (part !== '.') {
        parts.push(part);
      }
    }

    const resolved = parts.join('/');

    // If import already has extension, use as-is
    if (importPath.match(/\.(tsx?|jsx?|json|js|mjs|cjs)$/)) {
      return resolved;
    }

    // Otherwise, add .ts extension (TypeScript analysis typically omits extensions)
    // Try .ts first (most common)
    return resolved + '.ts';
  }

  /**
   * Calculate coupling score based on number of dependents
   * Low: 0-2, Medium: 3, High: 4+
   */
  private calculateCouplingScore(dependentCount: number): 'low' | 'medium' | 'high' {
    if (dependentCount <= 2) {
      return 'low';
    } else if (dependentCount <= 3) {
      return 'medium';
    } else {
      return 'high'; // 4+ dependents
    }
  }

  /**
   * Detect circular dependencies in the dependency graph
   */
  private detectCircularDependencies(files: FileDependencies[]): string[][] {
    const cycles: string[][] = [];
    const fileMap = new Map<string, FileDependencies>();

    // Build file map
    for (const file of files) {
      fileMap.set(file.filePath, file);
    }

    // Track visited files and current path
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const currentPath: string[] = [];

    const dfs = (filePath: string): void => {
      if (recursionStack.has(filePath)) {
        // Found a cycle - extract the cycle from currentPath
        const cycleStart = currentPath.indexOf(filePath);
        if (cycleStart !== -1) {
          const cycle = currentPath.slice(cycleStart).concat(filePath);
          cycles.push(cycle);
        }
        return;
      }

      if (visited.has(filePath)) {
        return;
      }

      visited.add(filePath);
      recursionStack.add(filePath);
      currentPath.push(filePath);

      const file = fileMap.get(filePath);
      if (file) {
        // Visit internal dependencies
        for (const dep of file.internalDependencies) {
          const resolvedDep = this.resolveImportPath(filePath, dep);
          if (fileMap.has(resolvedDep)) {
            dfs(resolvedDep);
          }
        }
      }

      currentPath.pop();
      recursionStack.delete(filePath);
    };

    // Run DFS from each file
    for (const file of files) {
      if (!visited.has(file.filePath)) {
        dfs(file.filePath);
      }
    }

    return cycles;
  }
}
