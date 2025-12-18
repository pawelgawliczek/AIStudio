# TypeScript Strict Mode Migration - Test Plan (ST-283)

## Current Baseline (2025-12-18)

### 1. 'any' Usage Metrics
- **Backend**: 2,248 occurrences of `: any` or `as any`
- **Frontend**: 429 occurrences of `: any` or `as any`
- **Total**: 2,677 occurrences

### 2. TypeScript Compilation Status

#### Backend Errors: 189 total
Error type breakdown:
- **TS2305** (82 occurrences): Module has no exported member
  - Missing Prisma enum exports: `UserRole`, `EpicStatus`, `MappingSource`, `TestCaseStatus`, `TestExecutionStatus`, `UseCaseRelation`, `RunStatus`, etc.
  - Indicates Prisma client regeneration needed
- **TS2339** (66 occurrences): Property does not exist on type
  - Missing properties on unknown/any types
  - Coordinator and Component type issues
- **TS2694** (39 occurrences): Namespace has no exported member
  - Prisma namespace issues: `UseCaseWhereInput`, `TestQueueGetPayload`
- **TS2578** (1 occurrence): Unused '@ts-expect-error' directive
- **TS2347** (1 occurrence): Untyped function calls may not accept type arguments

#### Frontend Errors: 26 total
Error type breakdown:
- **TS2339** (22 occurrences): Property does not exist on type
  - Component type missing properties (onFailure, version, tags)
  - Type definition mismatches
- **TS2305** (3 occurrences): Module has no exported member
  - Missing DTO exports: `CreateComponentDto`, `UpdateComponentDto`
- **TS2740** (1 occurrence): Type is missing properties
  - Component vs WorkflowComponent type mismatch

### 3. ESLint Status
- **Total**: 0 errors, 588 warnings
- All warnings are from `@typescript-eslint/no-explicit-any` (as expected)
- ESLint passes (no errors)

### 4. Test Suite Status
- **Backend**: 240 test files (.spec.ts)
- **Frontend**: 83 test files (.test.ts, .test.tsx)
- **Current status**: Tests are failing due to NestJS dependency injection issues
  - Main issue: Missing Reflector provider in test modules
  - This is a test infrastructure issue, not related to TypeScript strict mode

### 5. Current TypeScript Configuration

#### Root tsconfig.json
```json
{
  "strict": false,
  "strictNullChecks": false,
  "strictPropertyInitialization": false,
  "noImplicitAny": false,
  "noUnusedLocals": false,
  "noUnusedParameters": false,
  "noImplicitReturns": false,
  "noFallthroughCasesInSwitch": false
}
```

#### Backend tsconfig.json (extends root)
```json
{
  "strictPropertyInitialization": false
}
```

#### Frontend tsconfig.json (standalone)
```json
{
  "strict": false,
  "noUnusedLocals": false,
  "noUnusedParameters": false
}
```

## Testing Strategy

For this TypeScript strict mode migration, traditional "tests" are replaced by TypeScript's type system and linting tools. The verification process consists of:

### 1. Type Safety Verification (Primary Test)
**Tool**: TypeScript Compiler (`npm run typecheck`)
- Validates all type definitions
- Ensures no implicit 'any' types
- Catches type mismatches and missing properties
- **Success Criteria**: Zero TypeScript compilation errors

### 2. Code Quality Verification
**Tool**: ESLint (`npm run lint`)
- Enforces coding standards
- Warns about explicit 'any' usage
- Catches unused variables and imports
- **Success Criteria**: Zero errors (warnings are acceptable)

### 3. Regression Prevention
**Tool**: Jest/Vitest (`npm run test`)
- Ensures existing functionality still works
- Validates that type changes don't break business logic
- Catches runtime errors that types might miss
- **Success Criteria**: All existing tests pass

### 4. Build Verification
**Tool**: Build process (`npm run build`)
- Ensures code can be bundled/transpiled
- Validates production readiness
- **Success Criteria**: Build completes successfully

## Phase-by-Phase Testing Approach

### Phase 1: Fix Prisma Type Issues (Week 3)
**Pre-conditions**:
- Regenerate Prisma client: `npx prisma generate`
- Verify all enums are properly exported

**Verification**:
1. Run typecheck - expect reduction in TS2305 errors
2. Run verification script
3. Document remaining error count

**Success Metrics**:
- TS2305 errors: 82 → 0 (target)
- Total backend errors: 189 → ~107
- All Prisma types properly imported

### Phase 2: Component Type Definitions (Week 3)
**Pre-conditions**:
- Phase 1 complete
- DTOs properly exported from types

**Verification**:
1. Run typecheck - expect reduction in TS2339 and TS2740 errors
2. Check Component-related files compile
3. Run verification script

**Success Metrics**:
- TS2339 errors in frontend: 22 → 0 (target)
- TS2305 errors in frontend: 3 → 0 (target)
- Frontend typecheck passes

### Phase 3: Enable noImplicitAny (Week 3)
**Pre-conditions**:
- Phases 1-2 complete
- All Prisma and Component type issues resolved

**Configuration Change**:
```json
{
  "noImplicitAny": true
}
```

**Verification**:
1. Run typecheck - expect new errors for implicit any
2. Systematically add type annotations
3. Run verification script after each module

**Success Metrics**:
- All implicit any types explicitly typed
- Typecheck passes
- ESLint warnings for explicit any documented

### Phase 4: Enable strictNullChecks (Week 4)
**Pre-conditions**:
- Phase 3 complete
- noImplicitAny enabled and passing

**Configuration Change**:
```json
{
  "strictNullChecks": true
}
```

**Verification**:
1. Run typecheck - expect null/undefined errors
2. Add null checks and optional chaining
3. Update function signatures with proper null handling
4. Run verification script

**Success Metrics**:
- All null/undefined cases properly handled
- Typecheck passes
- No runtime null reference errors

### Phase 5: Enable Full Strict Mode (Week 4)
**Pre-conditions**:
- Phases 1-4 complete
- All individual strict flags passing

**Configuration Change**:
```json
{
  "strict": true
}
```

This enables:
- `strictNullChecks`
- `strictFunctionTypes`
- `strictBindCallApply`
- `strictPropertyInitialization`
- `noImplicitThis`
- `alwaysStrict`

**Verification**:
1. Run complete verification suite
2. Run all tests
3. Perform build
4. Deploy to test environment

**Success Metrics**:
- Zero TypeScript errors
- All tests pass
- Build succeeds
- ESLint passes (warnings OK)
- 'any' usage minimized (< 100 total)

## Verification Script

The script `.claude/scripts/verify-strict-mode.sh` automates all verification checks:

```bash
# Run full verification
./.claude/scripts/verify-strict-mode.sh

# Checks performed:
# 1. Count 'any' usage (backend + frontend)
# 2. TypeScript compilation (npm run typecheck)
# 3. ESLint (npm run lint)
# 4. Unit tests (npm run test)
# 5. Build verification (npm run build)
```

**Exit Codes**:
- `0`: All checks passed
- `1`: One or more checks failed

**Logs**:
- `/tmp/typecheck.log`: TypeScript errors
- `/tmp/lint.log`: ESLint output
- `/tmp/test.log`: Test results
- `/tmp/build.log`: Build output

## Testing at Each Phase

### Before Starting Work
1. Document current baseline (already done above)
2. Run verification script to establish starting point
3. Commit results for comparison

### During Implementation
1. Make incremental changes
2. Run `npm run typecheck` frequently (quick feedback)
3. Fix errors as they appear (don't accumulate)
4. Run verification script before committing

### After Completing Phase
1. Run full verification script
2. Document new metrics
3. Compare to baseline
4. Ensure all criteria met before advancing

### Before Merging
1. Run complete test suite
2. Run build verification
3. Deploy to test environment
4. Perform smoke tests on key features

## Known Issues to Address

### Test Infrastructure (Pre-existing)
- NestJS test modules missing Reflector provider
- Should be fixed before or during this migration
- Not a blocker for type migration, but should be resolved

### Prisma Client
- Must regenerate after schema changes
- Ensure consistent version across environments

### Type Definition Gaps
- Component vs WorkflowComponent distinction
- DTO exports from types module
- Coordinator type properties

## Success Criteria Summary

### Phase Completion Criteria
- ✓ Zero TypeScript compilation errors
- ✓ ESLint passes (0 errors)
- ✓ All existing tests pass
- ✓ Build completes successfully
- ✓ 'any' usage reduced from baseline

### Final Success Criteria (End of Week 4)
- ✓ `strict: true` enabled in all tsconfigs
- ✓ Zero TypeScript errors
- ✓ All tests passing
- ✓ 'any' usage < 100 total (from 2,677)
- ✓ No regression in functionality
- ✓ Production build successful
- ✓ Documentation updated

## Rollback Plan

If verification fails at any phase:
1. Review specific error types
2. Determine if issue is:
   - Type definition problem (fixable)
   - Configuration issue (revert config)
   - Breaking change (needs refactor)
3. Fix issues incrementally
4. Re-run verification
5. If unfixable, revert config change and document blocker

## Notes

- This is a type safety improvement, not a feature
- No runtime behavior changes expected
- Focus on correctness over speed
- Document any 'any' usage that can't be removed
- Create follow-up stories for complex type issues
