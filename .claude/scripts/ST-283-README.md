# TypeScript Strict Mode Migration - Testing Guide

Quick reference for testing and verification during ST-283 implementation.

## Quick Commands

### Run Full Verification
```bash
./.claude/scripts/verify-strict-mode.sh
```
This runs all checks and provides a comprehensive report.

### Individual Checks

```bash
# 1. Count 'any' usage
grep -r ": any\|as any" backend/src --include="*.ts" | wc -l
grep -r ": any\|as any" frontend/src --include="*.ts" --include="*.tsx" | wc -l

# 2. Type check only
npm run typecheck

# 3. Lint only
npm run lint

# 4. Tests only
npm run test -- --passWithNoTests

# 5. Build only
npm run build
```

## Files Created

| File | Purpose |
|------|---------|
| `verify-strict-mode.sh` | Automated verification script |
| `ST-283-baseline.md` | Initial state documentation |
| `ST-283-test-plan.md` | Complete testing strategy |
| `ST-283-README.md` | This quick reference |

## Workflow

### Before Starting a Phase
1. Review current baseline metrics
2. Run verification script to establish starting point
3. Document current error count

### During Implementation
1. Make small, incremental changes
2. Run `npm run typecheck` frequently (fast feedback)
3. Fix errors as they appear
4. Commit working code frequently

### After Completing a Phase
1. Run full verification script
2. Compare metrics to baseline
3. Document improvements
4. Ensure all phase criteria met

### Before Creating PR
1. Run complete verification suite
2. All checks must pass (except tests if infrastructure issue exists)
3. Update documentation with final metrics
4. Include before/after comparison

## Expected Results by Phase

### Phase 1: Foundation Fixes
- TypeScript errors: 215 → 0
- Prisma types: All imported correctly
- Component types: All properties defined
- Status: ✅ TypeCheck passes

### Phase 2: noImplicitAny
- Config: `noImplicitAny: true`
- 'any' usage: Explicit types added for all implicit any
- Status: ✅ TypeCheck passes

### Phase 3: strictNullChecks
- Config: `strictNullChecks: true`
- Null handling: All null/undefined cases handled
- Status: ✅ TypeCheck passes

### Phase 4: Full Strict Mode
- Config: `strict: true`
- All checks: ✅ Pass
- 'any' usage: < 100 total
- Production: Ready for deployment

## Interpreting Verification Output

### Success (Exit Code 0)
```
==========================================
SUMMARY
==========================================
Any usage: Backend=50, Frontend=25
✓ All verification checks passed!
```

### Failure (Exit Code 1)
```
==========================================
SUMMARY
==========================================
Any usage: Backend=2248, Frontend=429
✗ Some verification checks failed

Logs saved to:
  - /tmp/typecheck.log
  - /tmp/lint.log
  - /tmp/test.log
  - /tmp/build.log
```

Check the specific log files for detailed error messages.

## Common Error Types

### TS2305: Module has no exported member
**Cause**: Missing Prisma enum exports
**Fix**: Run `npx prisma generate` to regenerate Prisma client

### TS2339: Property does not exist on type
**Cause**: Type definition missing properties
**Fix**: Update type definitions or add proper types

### TS2694: Namespace has no exported member
**Cause**: Prisma types not generated
**Fix**: Run `npx prisma generate`

### ESLint Warnings (no-explicit-any)
**Cause**: Explicit `any` usage
**Fix**: Replace with proper types (this is the goal of the migration)

## Tips

1. **Incremental Progress**: Don't try to fix everything at once
2. **Fast Feedback**: Use `npm run typecheck` during development
3. **Commit Often**: Small commits make debugging easier
4. **Document Blockers**: If you can't fix something, document why
5. **Ask for Help**: Complex type issues may need discussion

## Rollback Plan

If a phase fails verification:
1. Review specific errors in log files
2. Determine if fixable or needs different approach
3. If unfixable, revert config change:
   ```bash
   git checkout tsconfig.json
   git checkout backend/tsconfig.json
   git checkout frontend/tsconfig.json
   ```
4. Document the blocker
5. Create follow-up story if needed

## Metrics to Track

Track these metrics after each phase:

| Metric | Command | Goal |
|--------|---------|------|
| 'any' count | `grep -r ": any\|as any" {backend,frontend}/src --include="*.ts" --include="*.tsx" \| wc -l` | < 100 |
| TS errors | `npm run typecheck 2>&1 \| grep -c "error TS"` | 0 |
| ESLint errors | `npm run lint 2>&1 \| grep -c "error"` | 0 |
| Tests passing | `npm run test -- --passWithNoTests` | ✅ |
| Build status | `npm run build` | ✅ |

## Support

- **Documentation**: See `ST-283-test-plan.md` for detailed strategy
- **Baseline**: See `ST-283-baseline.md` for initial metrics
- **Issues**: Check `/tmp/*.log` files for detailed errors
- **Questions**: Refer to TypeScript strict mode documentation

---

Last updated: 2025-12-18
Story: ST-283 - Week 3-4: TypeScript Strict Mode
