# Test Database Safety Guidelines

## Overview

This guide documents the safety guardrails implemented to prevent catastrophic data loss from accidentally running tests against production databases.

## Background

**CRITICAL SECURITY ISSUE** discovered during ST-86 audit:
- Tests were defaulting to production database (port 5433)
- No runtime validation to prevent production database access
- Risk of data corruption or complete data loss

## Safety Guardrails

### 1. Jest Configuration Default

The `jest.config.js` now defaults to the **test database**:

```javascript
process.env.DATABASE_URL = process.env.DATABASE_URL ||
  'postgresql://postgres:...@127.0.0.1:5434/vibestudio_test?schema=public';
```

**Key changes:**
- Port: `5434` (test) instead of `5433` (production)
- Database: `vibestudio_test` instead of `vibestudio`

### 2. Pre-Test Validation

Before ANY tests run, `jest.config.js` validates the `DATABASE_URL`:

**Validation checks:**
- Port must NOT be 5432 or 5433 (production ports)
- Database name must NOT be `vibestudio` (production database)
- DATABASE_URL must be set

**Fail-fast behavior:**
- Tests abort IMMEDIATELY if validation fails
- Clear error messages indicate the problem
- No database queries execute on validation failure

### 3. Safe Prisma Client Utility

All integration tests must use `createTestPrismaClient()` instead of `new PrismaClient()`:

```typescript
import { createTestPrismaClient } from '@/test-utils/safe-prisma-client';

let prisma: PrismaClient;

beforeAll(() => {
  prisma = createTestPrismaClient(); // ✅ Safe - validates automatically
});
```

**What it does:**
- Validates DATABASE_URL before creating client
- Throws error if URL points to production
- Provides clear error messages

## Database Ports and Names

### Production Databases
- **Port 5432**: Production PostgreSQL (main)
- **Port 5433**: Production PostgreSQL (backup/replica)
- **Database name**: `vibestudio`

⚠️ **NEVER run tests against these!**

### Test Databases
- **Port 5434**: Test PostgreSQL
- **Database name**: `vibestudio_test`

✅ **Always use these for testing**

## Running Tests Safely

### Correct Configuration

Set the test DATABASE_URL in your environment:

```bash
export DATABASE_URL="postgresql://postgres:test@127.0.0.1:5434/vibestudio_test?schema=public"
npm test
```

Or rely on the safe default in `jest.config.js` (recommended).

### What You'll See

When tests start with correct configuration:

```
✅ Test database safety validation passed
   Database: vibestudio_test on port 5434
```

### Error Messages

If misconfigured, you'll see one of these errors:

**Wrong port:**
```
❌ SAFETY GUARD: Tests cannot run against production database!
   Port 5433 is a PRODUCTION port.
   Use port 5434 for test database.
   Current DATABASE_URL: postgresql://...@127.0.0.1:5433/...

   Fix: Set DATABASE_URL to use port 5434
```

**Wrong database name:**
```
❌ SAFETY GUARD: Tests cannot run against production database!
   Database "vibestudio" is PRODUCTION.
   Use "vibestudio_test" for tests.
   Current DATABASE_URL: postgresql://...@127.0.0.1:5434/vibestudio...

   Fix: Set DATABASE_URL to use database name "vibestudio_test"
```

## Writing New Tests

### ✅ Correct Pattern

```typescript
import { PrismaClient } from '@prisma/client';
import { createTestPrismaClient } from '@/test-utils/safe-prisma-client';

describe('My Integration Test', () => {
  let prisma: PrismaClient;

  beforeAll(async () => {
    prisma = createTestPrismaClient(); // ✅ Safe
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('should do something', async () => {
    // Your test code
  });
});
```

### ❌ Unsafe Pattern (DON'T DO THIS)

```typescript
import { PrismaClient } from '@prisma/client';

describe('My Integration Test', () => {
  let prisma: PrismaClient;

  beforeAll(async () => {
    prisma = new PrismaClient(); // ❌ UNSAFE - no validation!
  });

  // ...
});
```

## CI/CD Configuration

Ensure your CI/CD pipelines explicitly set the test database:

```yaml
# .github/workflows/test.yml
env:
  DATABASE_URL: postgresql://postgres:test@127.0.0.1:5434/vibestudio_test?schema=public
```

## Troubleshooting

### Problem: Tests fail with "SAFETY GUARD" error

**Solution:** Check your DATABASE_URL environment variable:

```bash
echo $DATABASE_URL
```

Make sure it uses:
- Port `5434` (not 5432 or 5433)
- Database name `vibestudio_test` (not `vibestudio`)

### Problem: Tests can't connect to database

**Solution:** Ensure the test database is running:

```bash
docker compose up -d test-postgres
```

The test database should be available on port 5434.

### Problem: Import error for createTestPrismaClient

**Solution:** Check the import path:

```typescript
import { createTestPrismaClient } from '@/test-utils/safe-prisma-client';
```

The `@/` alias resolves to `src/` in the backend.

## Architecture

### Validation Flow

```
┌─────────────────────────────────────────────────────────────┐
│ Test Suite Starts                                           │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ jest.config.js: Set default DATABASE_URL (port 5434)       │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ jest.config.js: Validate DATABASE_URL                      │
│ - Check port (must NOT be 5432/5433)                       │
│ - Check database name (must NOT be "vibestudio")           │
└─────────────────────────────────────────────────────────────┘
                          ↓
                  ┌───────┴────────┐
                  │                │
           Validation              │
              FAILS                │
                  │                │
                  ↓                ↓
     ┌────────────────┐    Validation PASSES
     │ Throw Error    │            │
     │ Tests ABORT    │            ↓
     └────────────────┘   ┌─────────────────┐
                          │ Tests Run       │
                          └─────────────────┘
                                  ↓
                          ┌─────────────────┐
                          │ Integration Test│
                          │ calls createTest│
                          │ PrismaClient()  │
                          └─────────────────┘
                                  ↓
                          ┌─────────────────┐
                          │ Validate again  │
                          │ (double-check)  │
                          └─────────────────┘
                                  ↓
                          ┌─────────────────┐
                          │ Create Prisma   │
                          │ Client          │
                          └─────────────────┘
```

### Defense in Depth

The system uses **multiple layers** of protection:

1. **jest.config.js default**: Safe default (port 5434, database `vibestudio_test`)
2. **jest.config.js validation**: Pre-test validation (runs before any tests)
3. **createTestPrismaClient()**: Per-test validation (runs for each test suite)

This ensures that even if one layer fails, the others provide backup protection.

## Related Stories

- **ST-83**: Test Database Safety: Guardrails to Prevent Production DB Access
- **ST-86**: Test Coverage for Core Execution Services (audit that discovered the issue)

## Success Metrics

- ✅ Zero production database connections from test suite
- ✅ 100% of integration tests use safe database utilities
- ✅ Clear error messages when misconfigured (fail-fast)
- ✅ No regressions in test suite
