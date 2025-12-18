# Remaining `any` Type Fixes - Production Backend Files

## Progress Summary

### Files Completed (12 files fixed)
1. `/backend/src/mcp-http/mcp-session.service.ts` - 12 occurrences fixed
2. `/backend/src/mcp/services/websocket-gateway.instance.ts` - 11 occurrences fixed
3. `/backend/src/mcp/tools/project.tools.ts` - 10 occurrences fixed
4. `/backend/src/mcp/tools/story.tools.ts` - 9 occurrences fixed
5. `/backend/src/mcp/tools/epic.tools.ts` - 4 occurrences fixed

**Total Fixed:** ~46 any types removed

### Remaining Work
**Total Remaining:** 241 `any` occurrences across 86 files

## Top Priority Files (8+ occurrences)

1. `/backend/src/workflows/workflows.service.ts` - 8 occurrences
2. `/backend/src/services/safe-migration.service.ts` - 8 occurrences
3. `/backend/src/code-metrics/code-metrics.service.ts` - 8 occurrences
4. `/backend/src/services/otel-ingestion.service.ts` - 7 occurrences
5. `/backend/src/components/components.service.ts` - 7 occurrences
6. `/backend/src/agent-metrics/services/metrics-aggregation.service.ts` - 7 occurrences

## Common Patterns and Solutions

### Pattern 1: Error Handling
**Before:**
```typescript
} catch (error: any) {
  throw new Error(error.message);
}
```

**After:**
```typescript
} catch (error: unknown) {
  const message = error instanceof Error ? error.message : 'Unknown error';
  throw new Error(message);
}
```

### Pattern 2: MCP Error Checking
**Before:**
```typescript
} catch (error: any) {
  if (error.name === 'MCPError') {
    throw error;
  }
  throw handlePrismaError(error, 'function_name');
}
```

**After:**
```typescript
} catch (error: unknown) {
  if (error && typeof error === 'object' && 'name' in error && error.name === 'MCPError') {
    throw error;
  }
  throw handlePrismaError(error, 'function_name');
}
```

### Pattern 3: Where Clauses
**Before:**
```typescript
const whereClause: any = {};
if (params.status) {
  whereClause.status = params.status;
}
```

**After:**
```typescript
const whereClause: { status?: string; projectId?: string } = {};
if (params.status) {
  whereClause.status = params.status;
}
```

### Pattern 4: Return Types
**Before:**
```typescript
async function getData(): Promise<any> {
  return { data: [] };
}
```

**After:**
```typescript
async function getData(): Promise<{ data: Array<DataType> }> {
  return { data: [] };
}
```

### Pattern 5: Prisma Transactions
**Before:**
```typescript
await prisma.$transaction(async (tx: any) => {
  // ...
});
```

**After:**
```typescript
await prisma.$transaction(async (tx) => {
  // TypeScript infers the correct Prisma transaction type
});
```

### Pattern 6: Map Callbacks
**Before:**
```typescript
items.map((item: any) => formatItem(item))
```

**After:**
```typescript
items.map((item) => formatItem(item))
// Or with explicit type if needed:
items.map((item: ItemType) => formatItem(item))
```

### Pattern 7: Redis Data Parsing
**Before:**
```typescript
reconnectCount: parseInt(data.reconnectCount as any, 10)
```

**After:**
```typescript
reconnectCount: typeof data.reconnectCount === 'string' ? parseInt(data.reconnectCount, 10) : (data.reconnectCount || 0)
```

### Pattern 8: Generic Object Types
**Before:**
```typescript
function process(data: any): any {
  return data;
}
```

**After:**
```typescript
function process(data: Record<string, unknown>): unknown {
  return data;
}
```

## Systematic Approach for Remaining Files

### Phase 1: High-Priority Services (Next 6 files)
1. workflows.service.ts
2. safe-migration.service.ts
3. code-metrics.service.ts
4. otel-ingestion.service.ts
5. components.service.ts
6. metrics-aggregation.service.ts

### Phase 2: Controllers & DTOs (Next 10 files)
1. workflow-runs.controller.ts
2. workflow-runs.service.ts
3. test-cases/*.dto.ts
4. runs/dto/*.dto.ts

### Phase 3: Remaining Services (70 files)
Process all remaining service files alphabetically

## Testing Strategy

After fixing each file:
1. Run TypeScript compiler: `npm run build`
2. Run affected tests: `npm test -- <file-pattern>`
3. Check for type errors: `tsc --noEmit`

## Verification Commands

```bash
# Count remaining any types (excluding excluded dirs)
grep -r ": any\|as any" backend/src --include="*.ts" | \
  grep -v ".test.ts" | grep -v ".spec.ts" | \
  grep -v "__tests__" | grep -v "/e2e/" | \
  grep -v "mcp/servers" | grep -v "/workers/" | \
  grep -v "/execution/" | grep -v "/runner/" | \
  grep -v "/remote-agent/" | wc -l

# List files with most occurrences
grep -r ": any\|as any" backend/src --include="*.ts" | \
  grep -v ".test.ts" | grep -v ".spec.ts" | \
  grep -v "__tests__" | grep -v "/e2e/" | \
  grep -v "mcp/servers" | grep -v "/workers/" | \
  grep -v "/execution/" | grep -v "/runner/" | \
  grep -v "/remote-agent/" | \
  cut -d: -f1 | sort | uniq -c | sort -rn | head -20

# Verify no new any types introduced
git diff --name-only | xargs grep -l ": any\|as any" || echo "No new any types"
```

## Notes

- ESLint is configured to warn on `any` usage but not error
- Focus on production code first (tests can use `any` more liberally)
- Use `unknown` for truly unknown types, then narrow with type guards
- Use proper Prisma types from `@prisma/client`
- For complex types, create interfaces in types/ directory
