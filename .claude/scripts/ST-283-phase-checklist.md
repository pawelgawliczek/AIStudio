# TypeScript Strict Mode Migration - Phase Checklist

Use this checklist to track progress through each phase of the migration.

---

## Pre-Migration Setup

- [x] Baseline metrics documented (ST-283-baseline.md)
- [x] Verification script created (verify-strict-mode.sh)
- [x] Test plan documented (ST-283-test-plan.md)
- [ ] Test infrastructure issues identified and documented
- [ ] Team notified of migration schedule

**Starting Metrics**:
- TypeScript Errors: 215 (189 backend, 26 frontend)
- 'any' Usage: 2,677 (2,248 backend, 429 frontend)
- ESLint: 0 errors, 588 warnings
- Tests: Failing (infrastructure issues)
- Build: Failing (type errors)

---

## Phase 1: Foundation Fixes (Week 3, Days 1-2)

**Goal**: Fix existing TypeScript errors without enabling new strict flags

### Tasks

- [ ] Regenerate Prisma Client
  ```bash
  cd backend && npx prisma generate
  ```
  - Expected: Fixes 121 TS2305/TS2694 errors

- [ ] Verify Prisma types imported correctly
  ```bash
  npm run typecheck 2>&1 | grep "error TS2305"
  ```
  - Expected: 0 results

- [ ] Fix Component Type Definitions
  - [ ] Export missing DTOs from types module (`CreateComponentDto`, `UpdateComponentDto`)
  - [ ] Add missing properties to Component type:
    - [ ] `onFailure`
    - [ ] `version`
    - [ ] `tags`
  - [ ] Align Component vs WorkflowComponent distinction

- [ ] Fix remaining TS2339 errors
  - [ ] Review each error individually
  - [ ] Add proper type definitions
  - [ ] Update type imports

- [ ] Fix miscellaneous errors
  - [ ] Remove unused `@ts-expect-error` directives
  - [ ] Fix untyped function calls

### Verification

- [ ] Run verification script
  ```bash
  ./.claude/scripts/verify-strict-mode.sh
  ```

- [ ] Check metrics:
  - [ ] TypeScript Errors: 215 → 0 ✅
  - [ ] ESLint: Still 0 errors ✅
  - [ ] 'any' Usage: ~2,677 (unchanged, expected)

- [ ] Commit changes
  ```bash
  git add .
  git commit -m "fix(ST-283): Phase 1 - Fix existing TypeScript errors"
  ```

### Exit Criteria

- ✅ Zero TypeScript compilation errors
- ✅ All Prisma types properly imported
- ✅ Component type definitions complete
- ✅ ESLint still passing
- ✅ No new 'any' usage added

---

## Phase 2: Enable noImplicitAny (Week 3, Days 3-4)

**Goal**: Enable `noImplicitAny` and add explicit type annotations

### Tasks

- [ ] Update root tsconfig.json
  ```json
  {
    "noImplicitAny": true
  }
  ```

- [ ] Run typecheck to identify implicit any types
  ```bash
  npm run typecheck 2>&1 | tee /tmp/implicit-any-errors.log
  ```

- [ ] Document error count
  - Implicit any errors found: _____

- [ ] Fix implicit any types by module:
  - [ ] Backend services
  - [ ] Backend controllers
  - [ ] Backend DTOs
  - [ ] Backend utilities
  - [ ] Frontend components
  - [ ] Frontend services
  - [ ] Frontend types
  - [ ] Frontend utilities

- [ ] Add JSDoc for complex types where helpful

- [ ] Review and minimize explicit 'any' usage
  - [ ] Replace with proper types where possible
  - [ ] Add `// eslint-disable-next-line` with justification where necessary

### Verification

- [ ] Run verification script
  ```bash
  ./.claude/scripts/verify-strict-mode.sh
  ```

- [ ] Check metrics:
  - [ ] TypeScript Errors: 0 ✅
  - [ ] ESLint: 0 errors ✅
  - [ ] 'any' Usage: Reduced from 2,677 to _____

- [ ] Run tests (if infrastructure fixed)
  ```bash
  npm run test
  ```

- [ ] Commit changes
  ```bash
  git add .
  git commit -m "feat(ST-283): Phase 2 - Enable noImplicitAny"
  ```

### Exit Criteria

- ✅ `noImplicitAny: true` enabled
- ✅ Zero TypeScript compilation errors
- ✅ All implicit any types resolved
- ✅ 'any' usage reduced (target: < 1,000)
- ✅ Tests passing (if infrastructure fixed)

---

## Phase 3: Enable strictNullChecks (Week 4, Days 1-2)

**Goal**: Enable `strictNullChecks` and handle all null/undefined cases

### Tasks

- [ ] Update root tsconfig.json
  ```json
  {
    "strictNullChecks": true
  }
  ```

- [ ] Run typecheck to identify null/undefined errors
  ```bash
  npm run typecheck 2>&1 | tee /tmp/strict-null-errors.log
  ```

- [ ] Document error count
  - Null check errors found: _____

- [ ] Fix null/undefined errors:
  - [ ] Add null checks (`if (value !== null)`)
  - [ ] Use optional chaining (`value?.property`)
  - [ ] Use nullish coalescing (`value ?? defaultValue`)
  - [ ] Update function signatures to include `| null | undefined`
  - [ ] Add non-null assertions (`value!`) only where provably safe

- [ ] Review database queries for null handling
  - [ ] Prisma nullable fields
  - [ ] Optional relations

- [ ] Update tests for null cases
  - [ ] Add null/undefined test cases
  - [ ] Verify error handling

### Verification

- [ ] Run verification script
  ```bash
  ./.claude/scripts/verify-strict-mode.sh
  ```

- [ ] Check metrics:
  - [ ] TypeScript Errors: 0 ✅
  - [ ] ESLint: 0 errors ✅
  - [ ] Tests: Passing ✅
  - [ ] 'any' Usage: _____

- [ ] Manual testing:
  - [ ] Test null cases in key features
  - [ ] Verify no null reference errors

- [ ] Commit changes
  ```bash
  git add .
  git commit -m "feat(ST-283): Phase 3 - Enable strictNullChecks"
  ```

### Exit Criteria

- ✅ `strictNullChecks: true` enabled
- ✅ Zero TypeScript compilation errors
- ✅ All null/undefined cases handled
- ✅ No runtime null reference errors
- ✅ Tests passing
- ✅ Manual testing successful

---

## Phase 4: Enable Full Strict Mode (Week 4, Days 3-5)

**Goal**: Enable complete strict mode and prepare for production

### Tasks

- [ ] Update all tsconfig files

  Root `tsconfig.json`:
  ```json
  {
    "strict": true
  }
  ```

  Backend `tsconfig.json`:
  ```json
  {
    "extends": "../tsconfig.json"
  }
  ```

  Frontend `tsconfig.json`:
  ```json
  {
    "strict": true
  }
  ```

- [ ] Run typecheck to identify new strict errors
  ```bash
  npm run typecheck 2>&1 | tee /tmp/strict-mode-errors.log
  ```

- [ ] Fix new strict mode errors:
  - [ ] `strictFunctionTypes` violations
  - [ ] `strictBindCallApply` issues
  - [ ] `strictPropertyInitialization` problems
  - [ ] `noImplicitThis` errors

- [ ] Run complete verification
  ```bash
  ./.claude/scripts/verify-strict-mode.sh
  ```

- [ ] Run full test suite
  ```bash
  npm run test
  ```

- [ ] Build for production
  ```bash
  npm run build
  ```

- [ ] Deploy to test environment
  ```bash
  # Use deployment slash commands
  /deploy-backend
  /deploy-frontend
  ```

- [ ] Smoke test in test environment
  - [ ] User authentication
  - [ ] Story creation/editing
  - [ ] Workflow execution
  - [ ] MCP tool calls
  - [ ] Component library

- [ ] Performance check
  - [ ] Build time: _____
  - [ ] Bundle size: _____
  - [ ] Runtime performance: _____

### Verification

- [ ] Run verification script (final check)
  ```bash
  ./.claude/scripts/verify-strict-mode.sh
  ```

- [ ] Final metrics:
  - [ ] TypeScript Errors: 0 ✅
  - [ ] ESLint: 0 errors ✅
  - [ ] Tests: All passing ✅
  - [ ] Build: Successful ✅
  - [ ] 'any' Usage: < 100 ✅
  - [ ] Production deployment: Successful ✅

- [ ] Documentation updates:
  - [ ] Update CLAUDE.md if needed
  - [ ] Update developer documentation
  - [ ] Add migration notes to docs

- [ ] Create PR
  ```bash
  git add .
  git commit -m "feat(ST-283): Phase 4 - Enable full TypeScript strict mode"
  git push origin ep-12/main
  # Create PR via gh or GitHub UI
  ```

### Exit Criteria

- ✅ `strict: true` enabled in all configs
- ✅ Zero TypeScript compilation errors
- ✅ All tests passing
- ✅ Build successful
- ✅ 'any' usage < 100 total
- ✅ Production deployment successful
- ✅ Smoke tests passing
- ✅ Documentation updated
- ✅ PR created and reviewed

---

## Post-Migration

### Cleanup

- [ ] Remove temporary log files
  ```bash
  rm /tmp/typecheck.log /tmp/lint.log /tmp/test.log /tmp/build.log
  rm /tmp/implicit-any-errors.log /tmp/strict-null-errors.log /tmp/strict-mode-errors.log
  ```

- [ ] Archive baseline and test documentation
  - [ ] Move to docs/migrations/ folder
  - [ ] Update references in main docs

### Documentation

- [ ] Update project README with strict mode info
- [ ] Document any remaining 'any' usage with justifications
- [ ] Create follow-up stories for complex type issues (if any)
- [ ] Share learnings with team

### Monitoring

- [ ] Monitor production for type-related errors (first 48 hours)
- [ ] Check error logs for null references
- [ ] Verify performance metrics
- [ ] Gather team feedback

### Follow-up Stories (if needed)

- [ ] Story for remaining 'any' usage (if > 100)
- [ ] Story for test infrastructure fixes (if still failing)
- [ ] Story for additional type definitions
- [ ] Story for performance optimizations

---

## Rollback Procedure

If critical issues are discovered in production:

1. **Immediate**:
   ```bash
   git revert <commit-hash>
   git push origin main
   /deploy-backend
   /deploy-frontend
   ```

2. **Document**:
   - What broke
   - Why it broke
   - What was missed in testing

3. **Fix**:
   - Create hotfix branch
   - Fix the specific issue
   - Add regression tests
   - Re-deploy with fix

4. **Review**:
   - Update test plan
   - Add missing test cases
   - Improve verification process

---

## Notes

- Each phase should be completed fully before moving to the next
- Run verification script after every major change
- Commit frequently with descriptive messages
- Don't rush - type safety is about correctness, not speed
- Ask for help with complex type issues
- Document any 'any' usage that can't be removed

---

## Progress Tracking

| Phase | Status | Completion Date | Errors Fixed | 'any' Reduced |
|-------|--------|-----------------|--------------|---------------|
| Pre-Migration | ✅ Complete | 2025-12-18 | N/A | N/A |
| Phase 1: Foundation | ⏳ Pending | | | |
| Phase 2: noImplicitAny | ⏳ Pending | | | |
| Phase 3: strictNullChecks | ⏳ Pending | | | |
| Phase 4: Full Strict Mode | ⏳ Pending | | | |
| Post-Migration | ⏳ Pending | | | |

**Legend**:
- ⏳ Pending
- 🔄 In Progress
- ✅ Complete
- ❌ Blocked

---

Last updated: 2025-12-18
Story: ST-283 - Week 3-4: TypeScript Strict Mode
