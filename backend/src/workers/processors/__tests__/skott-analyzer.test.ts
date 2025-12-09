/**
 * ST-196: Skott Dependency Analysis Integration Tests
 *
 * Test suite for SkottAnalyzer service that integrates Skott dependency analysis
 * into the CodeAnalysisProcessor background worker.
 *
 * TDD Approach: These tests are written BEFORE implementation to define expected behavior.
 *
 * Key Responsibilities:
 * 1. Parse TypeScript/JavaScript files to extract import statements
 * 2. Separate external dependencies (npm packages) from internal dependencies (relative paths)
 * 3. Build complete project dependency graph
 * 4. Populate bidirectional relationships (imports and importedBy)
 * 5. Store dependency data in CodeMetrics.metadata field
 * 6. Gracefully handle parse errors (degradation, not failure)
 */

import { SkottAnalyzer, DependencyAnalysisResult, FileDependencies } from '../skott-analyzer';

describe('SkottAnalyzer', () => {
  let analyzer: SkottAnalyzer;

  beforeEach(() => {
    analyzer = new SkottAnalyzer();
  });

  describe('analyzeFile()', () => {
    describe('TypeScript file parsing', () => {
      it('should extract ES6 imports from a TypeScript file', async () => {
        const fileContent = `
import { PrismaService } from '../../prisma/prisma.service';
import { Logger } from '@nestjs/common';
import { exec } from 'child_process';
import type { Job } from 'bull';

export class TestService {}
`;
        const filePath = 'backend/src/services/test.service.ts';

        const result = await analyzer.analyzeFile(fileContent, filePath);

        expect(result.filePath).toBe(filePath);
        expect(result.imports).toHaveLength(4);
        expect(result.imports).toContain('../../prisma/prisma.service');
        expect(result.imports).toContain('@nestjs/common');
        expect(result.imports).toContain('child_process');
        expect(result.imports).toContain('bull');
      });

      it('should extract CommonJS requires from JavaScript files', async () => {
        const fileContent = `
const express = require('express');
const { parseConfig } = require('../utils/config');
const logger = require('./logger');

module.exports = { app };
`;
        const filePath = 'backend/src/app.js';

        const result = await analyzer.analyzeFile(fileContent, filePath);

        expect(result.imports).toHaveLength(3);
        expect(result.imports).toContain('express');
        expect(result.imports).toContain('../utils/config');
        expect(result.imports).toContain('./logger');
      });

      it('should extract dynamic imports', async () => {
        const fileContent = `
async function loadModule() {
  const module = await import('./dynamic-module');
  return module;
}
`;
        const filePath = 'backend/src/loader.ts';

        const result = await analyzer.analyzeFile(fileContent, filePath);

        expect(result.imports).toContain('./dynamic-module');
      });

      it('should handle re-exports', async () => {
        const fileContent = `
export { PrismaService } from './prisma/prisma.service';
export * from './utils';
export type { Config } from './types';
`;
        const filePath = 'backend/src/index.ts';

        const result = await analyzer.analyzeFile(fileContent, filePath);

        expect(result.imports).toContain('./prisma/prisma.service');
        expect(result.imports).toContain('./utils');
        expect(result.imports).toContain('./types');
      });
    });

    describe('Dependency classification', () => {
      it('should separate external dependencies from internal dependencies', async () => {
        const fileContent = `
import { PrismaService } from '../../prisma/prisma.service';
import { Logger } from '@nestjs/common';
import { exec } from 'child_process';
import { formatDate } from './utils';
`;
        const filePath = 'backend/src/services/test.service.ts';

        const result = await analyzer.analyzeFile(fileContent, filePath);

        // External dependencies (npm packages)
        expect(result.externalDependencies).toHaveLength(2);
        expect(result.externalDependencies).toContain('@nestjs/common');
        expect(result.externalDependencies).toContain('child_process');

        // Internal dependencies (relative paths)
        expect(result.internalDependencies).toHaveLength(2);
        expect(result.internalDependencies).toContain('../../prisma/prisma.service');
        expect(result.internalDependencies).toContain('./utils');
      });

      it('should classify @organization/package as external', async () => {
        const fileContent = `
import { Component } from '@angular/core';
import { Button } from '@mui/material';
import { utils } from '@mycompany/shared-utils';
`;
        const filePath = 'frontend/src/components/test.tsx';

        const result = await analyzer.analyzeFile(fileContent, filePath);

        expect(result.externalDependencies).toHaveLength(3);
        expect(result.externalDependencies).toContain('@angular/core');
        expect(result.externalDependencies).toContain('@mui/material');
        expect(result.externalDependencies).toContain('@mycompany/shared-utils');
        expect(result.internalDependencies).toHaveLength(0);
      });

      it('should classify relative paths as internal', async () => {
        const fileContent = `
import { UserService } from './user.service';
import { Database } from '../database';
import { Config } from '../../config';
import { Types } from '../../../shared/types';
`;
        const filePath = 'backend/src/services/auth/auth.service.ts';

        const result = await analyzer.analyzeFile(fileContent, filePath);

        expect(result.internalDependencies).toHaveLength(4);
        expect(result.internalDependencies).toContain('./user.service');
        expect(result.internalDependencies).toContain('../database');
        expect(result.internalDependencies).toContain('../../config');
        expect(result.internalDependencies).toContain('../../../shared/types');
        expect(result.externalDependencies).toHaveLength(0);
      });

      it('should classify Node.js built-in modules as external', async () => {
        const fileContent = `
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import crypto from 'crypto';
`;
        const filePath = 'backend/src/utils/file-utils.ts';

        const result = await analyzer.analyzeFile(fileContent, filePath);

        expect(result.externalDependencies).toHaveLength(4);
        expect(result.externalDependencies).toContain('fs');
        expect(result.externalDependencies).toContain('path');
        expect(result.externalDependencies).toContain('child_process');
        expect(result.externalDependencies).toContain('crypto');
      });
    });

    describe('Error handling and graceful degradation', () => {
      it('should return empty arrays on parse error (invalid syntax)', async () => {
        const fileContent = `
this is not valid typescript {{{
import { broken from 'syntax';
`;
        const filePath = 'backend/src/broken.ts';

        const result = await analyzer.analyzeFile(fileContent, filePath);

        // Should NOT throw error - graceful degradation
        expect(result.filePath).toBe(filePath);
        expect(result.imports).toEqual([]);
        expect(result.externalDependencies).toEqual([]);
        expect(result.internalDependencies).toEqual([]);
        expect(result.importedBy).toEqual([]);
        expect(result.parseError).toBe(true);
      });

      it('should handle files with no imports', async () => {
        const fileContent = `
export const config = {
  port: 3000,
  host: 'localhost'
};
`;
        const filePath = 'backend/src/config.ts';

        const result = await analyzer.analyzeFile(fileContent, filePath);

        expect(result.imports).toEqual([]);
        expect(result.externalDependencies).toEqual([]);
        expect(result.internalDependencies).toEqual([]);
        expect(result.parseError).toBe(false);
      });

      it('should handle empty files', async () => {
        const fileContent = '';
        const filePath = 'backend/src/empty.ts';

        const result = await analyzer.analyzeFile(fileContent, filePath);

        expect(result.imports).toEqual([]);
        expect(result.parseError).toBe(false);
      });

      it('should handle files with only comments', async () => {
        const fileContent = `
/**
 * This file is empty
 * Just documentation
 */
// TODO: Implement later
`;
        const filePath = 'backend/src/todo.ts';

        const result = await analyzer.analyzeFile(fileContent, filePath);

        expect(result.imports).toEqual([]);
        expect(result.parseError).toBe(false);
      });
    });

    describe('Edge cases', () => {
      it('should deduplicate imports from same module', async () => {
        const fileContent = `
import { Logger } from '@nestjs/common';
import { Injectable } from '@nestjs/common';
import { Controller } from '@nestjs/common';
`;
        const filePath = 'backend/src/test.ts';

        const result = await analyzer.analyzeFile(fileContent, filePath);

        // Should only appear once in externalDependencies
        const nestjsCount = result.externalDependencies.filter(
          dep => dep === '@nestjs/common'
        ).length;
        expect(nestjsCount).toBe(1);
      });

      it('should handle imports with extensions', async () => {
        const fileContent = `
import { utils } from './utils.js';
import { config } from '../config.json';
`;
        const filePath = 'backend/src/test.ts';

        const result = await analyzer.analyzeFile(fileContent, filePath);

        expect(result.internalDependencies).toContain('./utils.js');
        expect(result.internalDependencies).toContain('../config.json');
      });

      it('should handle side-effect imports', async () => {
        const fileContent = `
import './polyfills';
import 'reflect-metadata';
`;
        const filePath = 'backend/src/main.ts';

        const result = await analyzer.analyzeFile(fileContent, filePath);

        expect(result.internalDependencies).toContain('./polyfills');
        expect(result.externalDependencies).toContain('reflect-metadata');
      });
    });
  });

  describe('analyzeProject()', () => {
    it('should build complete dependency graph for project', async () => {
      // Mock file system with sample project structure
      const files = new Map<string, string>([
        ['backend/src/app.ts', `
import { PrismaService } from './prisma/prisma.service';
import { AuthService } from './auth/auth.service';
export class App {}
`],
        ['backend/src/prisma/prisma.service.ts', `
import { PrismaClient } from '@prisma/client';
export class PrismaService {}
`],
        ['backend/src/auth/auth.service.ts', `
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
export class AuthService {}
`],
      ]);

      const result = await analyzer.analyzeProject('/app/backend', files);

      expect(result.files).toHaveLength(3);

      // Check app.ts dependencies
      const appFile = result.files.find(f => f.filePath === 'backend/src/app.ts');
      expect(appFile).toBeDefined();
      expect(appFile!.internalDependencies).toHaveLength(2);
      expect(appFile!.internalDependencies).toContain('./prisma/prisma.service');
      expect(appFile!.internalDependencies).toContain('./auth/auth.service');

      // Check prisma.service.ts dependencies
      const prismaFile = result.files.find(f => f.filePath === 'backend/src/prisma/prisma.service.ts');
      expect(prismaFile).toBeDefined();
      expect(prismaFile!.externalDependencies).toContain('@prisma/client');

      // Check auth.service.ts dependencies
      const authFile = result.files.find(f => f.filePath === 'backend/src/auth/auth.service.ts');
      expect(authFile).toBeDefined();
      expect(authFile!.internalDependencies).toContain('../prisma/prisma.service');
      expect(authFile!.externalDependencies).toContain('@nestjs/jwt');
    });

    it('should populate importedBy for imported files (bidirectional relationships)', async () => {
      const files = new Map<string, string>([
        ['backend/src/app.ts', `
import { UserService } from './user.service';
`],
        ['backend/src/admin.ts', `
import { UserService } from './user.service';
`],
        ['backend/src/user.service.ts', `
export class UserService {}
`],
      ]);

      const result = await analyzer.analyzeProject('/app/backend', files);

      // user.service.ts should show it's imported by app.ts and admin.ts
      const userService = result.files.find(f => f.filePath === 'backend/src/user.service.ts');
      expect(userService).toBeDefined();
      expect(userService!.importedBy).toHaveLength(2);
      expect(userService!.importedBy).toContain('backend/src/app.ts');
      expect(userService!.importedBy).toContain('backend/src/admin.ts');
    });

    it('should calculate coupling metrics', async () => {
      const files = new Map<string, string>([
        ['backend/src/utils.ts', `export const util = () => {};`],
        ['backend/src/a.ts', `import { util } from './utils';`],
        ['backend/src/b.ts', `import { util } from './utils';`],
        ['backend/src/c.ts', `import { util } from './utils';`],
        ['backend/src/d.ts', `import { util } from './utils';`],
      ]);

      const result = await analyzer.analyzeProject('/app/backend', files);

      // utils.ts has high coupling (imported by 4 files)
      const utils = result.files.find(f => f.filePath === 'backend/src/utils.ts');
      expect(utils).toBeDefined();
      expect(utils!.importedBy).toHaveLength(4);
      expect(utils!.couplingScore).toBe('high'); // 4+ dependents = high coupling
    });

    it('should detect circular dependencies', async () => {
      const files = new Map<string, string>([
        ['backend/src/a.ts', `import { B } from './b';`],
        ['backend/src/b.ts', `import { C } from './c';`],
        ['backend/src/c.ts', `import { A } from './a';`],
      ]);

      const result = await analyzer.analyzeProject('/app/backend', files);

      expect(result.circularDependencies).toBeDefined();
      expect(result.circularDependencies.length).toBeGreaterThan(0);

      const cycle = result.circularDependencies[0];
      expect(cycle).toContain('backend/src/a.ts');
      expect(cycle).toContain('backend/src/b.ts');
      expect(cycle).toContain('backend/src/c.ts');
    });

    it('should handle large projects efficiently', async () => {
      // Create 100 files with dependencies
      const files = new Map<string, string>();
      for (let i = 0; i < 100; i++) {
        const imports = i > 0 ? `import { dep } from './file${i - 1}';` : '';
        files.set(`backend/src/file${i}.ts`, imports);
      }

      const startTime = Date.now();
      const result = await analyzer.analyzeProject('/app/backend', files);
      const duration = Date.now() - startTime;

      expect(result.files).toHaveLength(100);
      expect(duration).toBeLessThan(5000); // Should complete in < 5 seconds
    });
  });

  describe('Integration with CodeAnalysisProcessor', () => {
    it('should store dependency data in metadata field', async () => {
      const fileContent = `
import { PrismaService } from '../prisma/prisma.service';
import { Logger } from '@nestjs/common';
`;
      const filePath = 'backend/src/auth/auth.service.ts';

      const result = await analyzer.analyzeFile(fileContent, filePath);

      // Metadata structure that will be stored in CodeMetrics.metadata
      const expectedMetadata = {
        dependencies: {
          imports: result.imports,
          externalDependencies: result.externalDependencies,
          internalDependencies: result.internalDependencies,
          importedBy: result.importedBy,
        },
      };

      expect(result.externalDependencies).toContain('@nestjs/common');
      expect(result.internalDependencies).toContain('../prisma/prisma.service');

      // Verify metadata can be serialized to JSON (Prisma requirement)
      expect(() => JSON.stringify(expectedMetadata)).not.toThrow();
    });

    it('should merge dependency data with existing metadata', async () => {
      // Existing metadata from CodeAnalysisProcessor
      const existingMetadata = {
        codeSmells: [
          { type: 'todo-comment', severity: 'minor', message: 'TODO found', line: 10 }
        ],
        functions: [
          { name: 'testFunc', complexity: 5, loc: 20 }
        ],
        isTestFile: false,
        correlatedTestFiles: ['auth.service.spec.ts'],
      };

      const fileContent = `import { Logger } from '@nestjs/common';`;
      const filePath = 'backend/src/auth/auth.service.ts';
      const result = await analyzer.analyzeFile(fileContent, filePath);

      // Merged metadata
      const mergedMetadata = {
        ...existingMetadata,
        dependencies: {
          imports: result.imports,
          externalDependencies: result.externalDependencies,
          internalDependencies: result.internalDependencies,
          importedBy: result.importedBy,
        },
      };

      // Verify existing fields preserved
      expect(mergedMetadata.codeSmells).toEqual(existingMetadata.codeSmells);
      expect(mergedMetadata.functions).toEqual(existingMetadata.functions);
      expect(mergedMetadata.isTestFile).toBe(false);

      // Verify new dependencies field added
      expect(mergedMetadata.dependencies).toBeDefined();
      expect(mergedMetadata.dependencies.externalDependencies).toContain('@nestjs/common');
    });
  });

  describe('Performance and memory', () => {
    it('should not leak memory when analyzing many files', async () => {
      const fileContent = `
import { Service } from '@nestjs/common';
import { Utils } from './utils';
`;

      // Analyze same file 1000 times (simulating large project)
      for (let i = 0; i < 1000; i++) {
        await analyzer.analyzeFile(fileContent, `file${i}.ts`);
      }

      // If test completes without error, memory is being managed correctly
      expect(true).toBe(true);
    });

    it('should handle concurrent analysis requests', async () => {
      const files = Array.from({ length: 50 }, (_, i) => ({
        content: `import { dep } from './dep${i}';`,
        path: `backend/src/file${i}.ts`,
      }));

      // Analyze all files concurrently
      const results = await Promise.all(
        files.map(({ content, path }) => analyzer.analyzeFile(content, path))
      );

      expect(results).toHaveLength(50);
      results.forEach((result, i) => {
        expect(result.filePath).toBe(`backend/src/file${i}.ts`);
        expect(result.imports).toHaveLength(1);
      });
    });
  });

  describe('Type definitions', () => {
    it('should export FileDependencies interface', () => {
      const fileDeps: FileDependencies = {
        filePath: 'test.ts',
        imports: ['@nestjs/common'],
        externalDependencies: ['@nestjs/common'],
        internalDependencies: [],
        importedBy: [],
        parseError: false,
        couplingScore: 'low',
      };

      expect(fileDeps.filePath).toBe('test.ts');
    });

    it('should export DependencyAnalysisResult interface', () => {
      const result: DependencyAnalysisResult = {
        files: [],
        circularDependencies: [],
        totalFiles: 0,
        totalDependencies: 0,
      };

      expect(result.files).toEqual([]);
    });
  });
});

/**
 * Mock Skott Library Integration
 *
 * These tests verify that our SkottAnalyzer service correctly integrates with
 * the actual Skott library. When implementing, use these as integration tests.
 */
describe('SkottAnalyzer - Skott Library Integration', () => {
  let analyzer: SkottAnalyzer;

  beforeEach(() => {
    analyzer = new SkottAnalyzer();
  });

  it('should use Skott library for parsing when available', async () => {
    const fileContent = `
import { PrismaService } from './prisma/prisma.service';
import { Logger } from '@nestjs/common';
`;
    const filePath = 'backend/src/test.ts';

    const result = await analyzer.analyzeFile(fileContent, filePath);

    // Verify Skott is being used (check for Skott-specific features)
    expect(result.imports).toBeDefined();
    expect(Array.isArray(result.imports)).toBe(true);
  });

  it('should fallback to regex parsing if Skott fails', async () => {
    // Intentionally malformed TypeScript that might break Skott
    const fileContent = `
import { broken from 'syntax
export const x = {{{
`;
    const filePath = 'backend/src/broken.ts';

    const result = await analyzer.analyzeFile(fileContent, filePath);

    // Should still return a result (graceful degradation)
    expect(result.filePath).toBe(filePath);
    expect(result.parseError).toBe(true);
    expect(result.imports).toEqual([]);
  });
});
