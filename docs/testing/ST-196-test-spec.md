# ST-196: SkottAnalyzer Test Specifications (TDD)

## Overview

This document describes the comprehensive test suite created for **ST-196: Integrate Skott Dependency Analysis into CodeAnalysisProcessor**.

Following **Test-Driven Development (TDD)** principles, all tests were written BEFORE implementation to define expected behavior.

## Deliverables

### 1. Test File
**Location:** `/Users/pawelgawliczek/projects/AIStudio/backend/src/workers/processors/__tests__/skott-analyzer.test.ts`

**Size:** 20KB

**Test Count:** 30+ test cases across 8 test suites

### 2. Type Definitions
**Location:** `/Users/pawelgawliczek/projects/AIStudio/backend/src/workers/processors/skott-analyzer.ts`

**Exports:**
- `FileDependencies` interface
- `DependencyAnalysisResult` interface
- `SkottAnalyzer` class (placeholder)

### 3. Documentation
**Location:** `/Users/pawelgawliczek/projects/AIStudio/backend/src/workers/processors/__tests__/skott-analyzer.README.md`

**Contents:**
- Test structure explanation
- Running tests guide
- Implementation checklist
- Metadata schema specification

## Test Coverage

### Test Suites (8 total)

#### 1. `analyzeFile()` - TypeScript file parsing (4 tests)
- ✓ Extract ES6 imports from TypeScript files
- ✓ Extract CommonJS requires from JavaScript files
- ✓ Extract dynamic imports
- ✓ Handle re-exports

#### 2. `analyzeFile()` - Dependency classification (4 tests)
- ✓ Separate external from internal dependencies
- ✓ Classify @organization/package as external
- ✓ Classify relative paths as internal
- ✓ Classify Node.js built-ins as external

#### 3. `analyzeFile()` - Error handling and graceful degradation (4 tests)
- ✓ Return empty arrays on parse error (no crash)
- ✓ Handle files with no imports
- ✓ Handle empty files
- ✓ Handle comment-only files

#### 4. `analyzeFile()` - Edge cases (3 tests)
- ✓ Deduplicate imports from same module
- ✓ Handle imports with file extensions
- ✓ Handle side-effect imports

#### 5. `analyzeProject()` - Project-wide analysis (5 tests)
- ✓ Build complete dependency graph for project
- ✓ Populate importedBy for imported files (bidirectional)
- ✓ Calculate coupling metrics (low/medium/high)
- ✓ Detect circular dependencies
- ✓ Handle large projects efficiently (100+ files in < 5s)

#### 6. Integration with CodeAnalysisProcessor (2 tests)
- ✓ Store dependency data in metadata field
- ✓ Merge with existing metadata without overwriting

#### 7. Performance and memory (2 tests)
- ✓ No memory leaks when analyzing 1000+ files
- ✓ Handle concurrent analysis requests (50+ files)

#### 8. Type definitions (2 tests)
- ✓ Export FileDependencies interface
- ✓ Export DependencyAnalysisResult interface

#### 9. Skott Library Integration (2 tests)
- ✓ Use Skott library for parsing when available
- ✓ Fallback to regex parsing if Skott fails

## Key Testing Principles

### 1. Graceful Degradation
**Requirement:** Parser errors must NOT crash the worker

**Test Case:**
```typescript
it('should return empty arrays on parse error (invalid syntax)', async () => {
  const fileContent = `this is not valid typescript {{{`;
  const result = await analyzer.analyzeFile(fileContent, 'broken.ts');

  expect(result.parseError).toBe(true);
  expect(result.imports).toEqual([]);
  // Worker continues processing other files
});
```

### 2. Bidirectional Relationships
**Requirement:** Build reverse dependency graph

**Test Case:**
```typescript
it('should populate importedBy for imported files', async () => {
  // app.ts imports user.service.ts
  // admin.ts imports user.service.ts

  const result = await analyzer.analyzeProject(...);
  const userService = result.files.find(f => f.filePath === 'user.service.ts');

  expect(userService.importedBy).toContain('app.ts');
  expect(userService.importedBy).toContain('admin.ts');
});
```

### 3. Performance Requirements
**Requirement:** Handle large projects efficiently

**Test Case:**
```typescript
it('should handle large projects efficiently', async () => {
  const files = new Map(); // 100 files

  const startTime = Date.now();
  const result = await analyzer.analyzeProject('/app/backend', files);
  const duration = Date.now() - startTime;

  expect(result.files).toHaveLength(100);
  expect(duration).toBeLessThan(5000); // < 5 seconds
});
```

### 4. Metadata Schema
**Requirement:** Store in CodeMetrics.metadata without breaking existing fields

**Schema:**
```typescript
{
  // Existing fields (preserved)
  codeSmells: CodeSmell[],
  functions: FunctionMetric[],
  isTestFile: boolean,
  correlatedTestFiles: string[],

  // New field (ST-196)
  dependencies: {
    imports: string[],              // All imports
    externalDependencies: string[], // npm packages
    internalDependencies: string[], // relative paths
    importedBy: string[]           // reverse dependencies
  }
}
```

## Running the Tests

### Run all SkottAnalyzer tests:
```bash
cd /Users/pawelgawliczek/projects/AIStudio/backend
npm test -- skott-analyzer.test.ts
```

### Run specific test suite:
```bash
npm test -- skott-analyzer.test.ts -t "analyzeFile"
```

### Run with coverage:
```bash
npm test -- --coverage skott-analyzer.test.ts
```

## Current Test Status

**Expected Behavior (TDD Phase):**
- ❌ All tests FAIL (expected)
- SkottAnalyzer methods throw "Not implemented yet - ST-196"

**After ST-196 Implementation:**
- ✅ All tests PASS
- Coverage > 90%

## Implementation Checklist

When implementing SkottAnalyzer in ST-196:

### Phase 1: Install Dependencies
- [ ] Install Skott library: `npm install skott`
- [ ] Install types if needed: `npm install -D @types/skott`

### Phase 2: Implement `analyzeFile()`
- [ ] Parse TypeScript/JavaScript using Skott
- [ ] Extract all import statements
- [ ] Classify dependencies (external vs internal)
- [ ] Handle parse errors gracefully
- [ ] Return `FileDependencies` object

### Phase 3: Implement `analyzeProject()`
- [ ] Build complete dependency graph
- [ ] Populate `importedBy` arrays (bidirectional)
- [ ] Calculate coupling scores (low/medium/high)
- [ ] Detect circular dependencies
- [ ] Return `DependencyAnalysisResult` object

### Phase 4: Integrate with CodeAnalysisProcessor
- [ ] Import SkottAnalyzer in `code-analysis.processor.ts`
- [ ] Call `analyzeFile()` in `saveFileMetrics()`
- [ ] Store results in `CodeMetrics.metadata.dependencies`
- [ ] Merge with existing metadata (preserve existing fields)

### Phase 5: Verify Tests
- [ ] Run test suite: `npm test -- skott-analyzer.test.ts`
- [ ] Verify all 30+ tests pass
- [ ] Check coverage > 90%
- [ ] Fix any failing tests

## Example Usage (After Implementation)

```typescript
// In CodeAnalysisProcessor.saveFileMetrics()
import { SkottAnalyzer } from './skott-analyzer';

const analyzer = new SkottAnalyzer();

// Analyze file dependencies
const fileContent = await this.getFileContent(repoPath, filePath);
const dependencies = await analyzer.analyzeFile(fileContent, filePath);

// Store in metadata
await this.prisma.codeMetrics.upsert({
  where: { projectId_filePath: { projectId, filePath } },
  create: {
    projectId,
    filePath,
    // ... other metrics ...
    metadata: {
      codeSmells: metrics.codeSmells,
      functions: metrics.complexity.functions,
      isTestFile: isTest,
      correlatedTestFiles: correlatedTestFiles || [],
      dependencies: {
        imports: dependencies.imports,
        externalDependencies: dependencies.externalDependencies,
        internalDependencies: dependencies.internalDependencies,
        importedBy: dependencies.importedBy,
      }
    }
  },
  update: {
    // ... same metadata structure ...
  }
});
```

## Test Data Examples

### Example 1: Simple Service File
```typescript
// Input file
const fileContent = `
import { PrismaService } from '../prisma/prisma.service';
import { Logger } from '@nestjs/common';

export class UserService {
  constructor(
    private prisma: PrismaService,
    private logger: Logger
  ) {}
}
`;

// Expected output
{
  filePath: 'backend/src/users/user.service.ts',
  imports: ['../prisma/prisma.service', '@nestjs/common'],
  externalDependencies: ['@nestjs/common'],
  internalDependencies: ['../prisma/prisma.service'],
  importedBy: [],
  parseError: false
}
```

### Example 2: File with Parse Error
```typescript
// Input file (invalid syntax)
const fileContent = `
import { broken from 'syntax
export const x = {{{
`;

// Expected output (graceful degradation)
{
  filePath: 'backend/src/broken.ts',
  imports: [],
  externalDependencies: [],
  internalDependencies: [],
  importedBy: [],
  parseError: true
}
```

### Example 3: Project Dependency Graph
```typescript
// Input files
const files = new Map([
  ['app.ts', 'import { UserService } from "./user.service";'],
  ['admin.ts', 'import { UserService } from "./user.service";'],
  ['user.service.ts', 'export class UserService {}']
]);

// Expected output
{
  files: [
    {
      filePath: 'app.ts',
      imports: ['./user.service'],
      internalDependencies: ['./user.service'],
      importedBy: []
    },
    {
      filePath: 'admin.ts',
      imports: ['./user.service'],
      internalDependencies: ['./user.service'],
      importedBy: []
    },
    {
      filePath: 'user.service.ts',
      imports: [],
      importedBy: ['app.ts', 'admin.ts'], // Bidirectional
      couplingScore: 'low' // 2 dependents
    }
  ],
  circularDependencies: [],
  totalFiles: 3,
  totalDependencies: 2
}
```

## Integration Points

### 1. CodeAnalysisProcessor Integration
**File:** `backend/src/workers/processors/code-analysis.processor.ts`

**Method:** `saveFileMetrics()`

**Changes Required:**
```typescript
// Add import
import { SkottAnalyzer } from './skott-analyzer';

// Add to class
private skottAnalyzer = new SkottAnalyzer();

// In saveFileMetrics()
const fileContent = await this.getFileContent(repoPath, filePath);
const dependencies = await this.skottAnalyzer.analyzeFile(fileContent, filePath);

// Update metadata
metadata: {
  codeSmells: metrics.codeSmells,
  functions: metrics.complexity.functions,
  isTestFile: isTest,
  correlatedTestFiles: correlatedTestFiles || [],
  dependencies: {
    imports: dependencies.imports,
    externalDependencies: dependencies.externalDependencies,
    internalDependencies: dependencies.internalDependencies,
    importedBy: dependencies.importedBy,
  }
}
```

### 2. Database Schema (No Changes Required)
**Table:** `code_metrics`

**Field:** `metadata` (JSONB)

**Current Schema:** Already supports arbitrary JSON structure

**New Data:** Adds `dependencies` field to existing metadata

## Performance Considerations

### Memory Usage
- **Constraint:** Don't load entire codebase into memory
- **Solution:** Process files in batches (10 files at a time)
- **Test:** Memory leak test (1000+ files)

### Processing Speed
- **Requirement:** < 5 seconds for 100 files
- **Requirement:** < 30 seconds for 1000+ files
- **Test:** Performance test with timer

### Concurrency
- **Requirement:** Handle 50+ concurrent analysis requests
- **Solution:** Use Promise.all() for parallel processing
- **Test:** Concurrent analysis test

## Coverage Goals

- **Line Coverage:** > 90%
- **Branch Coverage:** > 85%
- **Function Coverage:** 100%
- **Statement Coverage:** > 90%

## Questions for Implementation Review

1. **Import Location Tracking:** Should we store line numbers for imports?
2. **Export Tracking:** Should we track what each file exports?
3. **Unused Dependencies:** Should we detect unused imports?
4. **Transitive Dependencies:** Should we calculate dependency depth?
5. **Performance:** Should we cache analysis results?

These can be addressed in future stories if needed.

## Related Documentation

- **Story:** ST-196: Integrate Skott Dependency Analysis into CodeAnalysisProcessor
- **Test File:** `backend/src/workers/processors/__tests__/skott-analyzer.test.ts`
- **Implementation:** `backend/src/workers/processors/skott-analyzer.ts`
- **Integration Point:** `backend/src/workers/processors/code-analysis.processor.ts`
- **Database Schema:** `backend/prisma/schema.prisma` (CodeMetrics table)

## Next Steps

1. Review test specifications with team
2. Get approval for metadata schema
3. Install Skott library
4. Implement SkottAnalyzer class
5. Run tests and iterate until all pass
6. Integrate with CodeAnalysisProcessor
7. Test end-to-end in development environment
8. Deploy to production

---

**Document Version:** 1.0
**Created:** 2025-12-09
**Author:** Tester Agent (Claude Code)
**Story:** ST-196
