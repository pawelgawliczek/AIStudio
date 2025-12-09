# SkottAnalyzer Test Suite Documentation

## Overview

Test suite for **ST-196: Integrate Skott Dependency Analysis into CodeAnalysisProcessor**

This test suite follows **Test-Driven Development (TDD)** principles - tests are written BEFORE implementation to define expected behavior.

## Test File Location

```
backend/src/workers/processors/__tests__/skott-analyzer.test.ts
```

## Test Structure

### 1. `analyzeFile()` Tests

**Purpose:** Verify single file dependency extraction

**Test Categories:**
- **TypeScript file parsing**
  - ES6 imports (`import { X } from 'Y'`)
  - CommonJS requires (`const X = require('Y')`)
  - Dynamic imports (`await import('X')`)
  - Re-exports (`export { X } from 'Y'`)

- **Dependency classification**
  - External dependencies (npm packages: `@nestjs/common`, `lodash`)
  - Internal dependencies (relative paths: `./utils`, `../services`)
  - Node.js built-ins (`fs`, `path`, `child_process`)
  - Scoped packages (`@organization/package`)

- **Error handling and graceful degradation**
  - Invalid syntax → return empty arrays (no crash)
  - Files with no imports → empty arrays
  - Empty files → empty arrays
  - Comment-only files → empty arrays

- **Edge cases**
  - Duplicate imports from same module → deduplicated
  - Imports with file extensions (`.js`, `.json`)
  - Side-effect imports (`import './polyfills'`)

### 2. `analyzeProject()` Tests

**Purpose:** Verify complete project dependency graph construction

**Test Categories:**
- **Dependency graph building**
  - Extract dependencies from all files
  - Build complete project-wide dependency map

- **Bidirectional relationships**
  - Populate `importedBy` arrays (reverse dependencies)
  - File A imports File B → File B's `importedBy` includes File A

- **Coupling metrics**
  - Calculate coupling score based on number of dependents
  - Low: 0-2 dependents
  - Medium: 3-5 dependents
  - High: 6+ dependents

- **Circular dependency detection**
  - Detect cycles (A → B → C → A)
  - Return all circular dependency chains

- **Performance**
  - Handle large projects (100+ files) efficiently
  - Complete analysis in < 5 seconds

### 3. Integration with CodeAnalysisProcessor

**Purpose:** Verify dependency data storage in database

**Test Categories:**
- **Metadata structure**
  - Store dependencies in `CodeMetrics.metadata.dependencies` field
  - Ensure JSON serialization works (Prisma requirement)

- **Metadata merging**
  - Preserve existing metadata fields (`codeSmells`, `functions`, `isTestFile`)
  - Add new `dependencies` field without overwriting existing data

### 4. Performance and Memory Tests

**Purpose:** Ensure efficiency for production use

**Test Categories:**
- **Memory management**
  - No memory leaks when analyzing 1000+ files
  - Proper cleanup of temporary objects

- **Concurrent analysis**
  - Handle 50+ concurrent file analysis requests
  - No race conditions or data corruption

### 5. Type Definition Tests

**Purpose:** Verify exported TypeScript interfaces

**Test Categories:**
- `FileDependencies` interface
- `DependencyAnalysisResult` interface

## Running the Tests

### Run all SkottAnalyzer tests:
```bash
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

## Expected Test Behavior (TDD Phase)

**Current State:** ❌ All tests FAIL (expected)

The `SkottAnalyzer` class currently throws "Not implemented yet - ST-196" for all methods.

**After ST-196 Implementation:** ✅ All tests PASS

Once Skott integration is implemented, all 30+ test cases should pass.

## Implementation Checklist

When implementing `SkottAnalyzer` in ST-196, ensure:

- [ ] Install Skott library: `npm install skott`
- [ ] Implement `analyzeFile()` method
  - [ ] Parse TypeScript/JavaScript using Skott
  - [ ] Extract all import statements
  - [ ] Classify dependencies (external vs internal)
  - [ ] Handle parse errors gracefully
- [ ] Implement `analyzeProject()` method
  - [ ] Build complete dependency graph
  - [ ] Populate `importedBy` arrays
  - [ ] Calculate coupling scores
  - [ ] Detect circular dependencies
- [ ] Integrate with `CodeAnalysisProcessor`
  - [ ] Call `SkottAnalyzer.analyzeFile()` in `saveFileMetrics()`
  - [ ] Store results in `CodeMetrics.metadata.dependencies`
  - [ ] Merge with existing metadata

## Metadata Schema

The dependency data will be stored in `CodeMetrics.metadata` as:

```typescript
{
  // Existing fields (preserved)
  codeSmells: [...],
  functions: [...],
  isTestFile: boolean,
  correlatedTestFiles: [...],

  // New field (added by ST-196)
  dependencies: {
    imports: string[],              // All imports
    externalDependencies: string[], // npm packages
    internalDependencies: string[], // relative paths
    importedBy: string[]           // reverse dependencies
  }
}
```

## Test Coverage Goals

- **Line Coverage:** > 90%
- **Branch Coverage:** > 85%
- **Function Coverage:** 100%

## Related Files

- **Implementation:** `backend/src/workers/processors/skott-analyzer.ts`
- **Integration:** `backend/src/workers/processors/code-analysis.processor.ts`
- **Database Schema:** `backend/prisma/schema.prisma` (CodeMetrics.metadata field)

## Notes

1. **Graceful Degradation:** Parser errors should NOT crash the worker. Return empty arrays and set `parseError: true`.

2. **Performance:** Large projects (1000+ files) should complete in reasonable time (< 30 seconds).

3. **Memory:** Avoid loading entire codebase into memory. Process files in batches if needed.

4. **Skott Library:** Use Skott's built-in features for dependency extraction. Fallback to regex parsing only if Skott fails.

5. **Database Impact:** Metadata field is JSONB in Postgres. Ensure all data is JSON-serializable.

## Questions for Implementation

1. Should we store import locations (line numbers)?
2. Should we track export information (not just imports)?
3. Should we detect unused dependencies?
4. Should we calculate dependency depth (transitive dependencies)?

These can be added in future stories if needed.
