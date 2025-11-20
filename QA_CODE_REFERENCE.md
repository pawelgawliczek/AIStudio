# ST-42 QA Validation - Code Reference Guide

## Implementation Files

### Primary Implementation
**File:** `/opt/stack/AIStudio/backend/src/mcp/servers/git/detect_schema_changes.ts`
**Size:** 498 lines
**Language:** TypeScript

### Key Code Sections

#### 1. Tool Definition
```typescript
export const tool: Tool = {
  name: 'detect_schema_changes',
  description: 'Detect and analyze database schema changes by comparing Prisma migration files in worktree vs main branch',
  inputSchema: {
    type: 'object',
    properties: {
      storyId: {
        type: 'string',
        description: 'Story UUID (required)',
      },
    },
    required: ['storyId'],
  },
};

export const metadata = {
  category: 'git',
  domain: 'development',
  tags: ['git', 'prisma', 'migrations', 'schema', 'detection'],
  version: '1.0.0',
  since: 'sprint-6',
};
```

#### 2. Breaking Pattern Detection (8 patterns)
```typescript
const BREAKING_PATTERNS = {
  DROP_TABLE: {
    regex: /DROP\s+TABLE\s+(?:IF\s+EXISTS\s+)?["']?(\w+)["']?/gi,
    description: 'Table deletion - data loss risk',
  },
  RENAME_TABLE: {
    regex: /(?:RENAME\s+TABLE|ALTER\s+TABLE\s+["']?(\w+)["']?\s+RENAME\s+TO)\s+["']?(\w+)["']?/gi,
    description: 'Table rename - breaks existing queries',
  },
  DROP_COLUMN: {
    regex: /ALTER\s+TABLE\s+["']?(\w+)["']?\s+DROP\s+COLUMN\s+["']?(\w+)["']?/gi,
    description: 'Column deletion - data loss and query breakage',
  },
  RENAME_COLUMN: {
    regex: /ALTER\s+TABLE\s+["']?(\w+)["']?\s+RENAME\s+COLUMN\s+["']?(\w+)["']?\s+TO\s+["']?(\w+)["']?/gi,
    description: 'Column rename - breaks existing queries',
  },
  ALTER_COLUMN_TYPE: {
    regex: /ALTER\s+TABLE\s+["']?(\w+)["']?\s+ALTER\s+COLUMN\s+["']?(\w+)["']?\s+(?:SET\s+DATA\s+)?TYPE\s+(\w+)/gi,
    description: 'Column type change - potential data loss/incompatibility',
  },
  DROP_INDEX: {
    regex: /DROP\s+INDEX\s+(?:IF\s+EXISTS\s+)?["']?(\w+)["']?/gi,
    description: 'Index deletion - performance degradation',
  },
  DROP_CONSTRAINT: {
    regex: /ALTER\s+TABLE\s+["']?(\w+)["']?\s+DROP\s+CONSTRAINT\s+["']?(\w+)["']?/gi,
    description: 'Constraint deletion - data integrity risk',
  },
  DROP_ENUM: {
    regex: /DROP\s+TYPE\s+(?:IF\s+EXISTS\s+)?["']?(\w+)["']?/gi,
    description: 'Enum type deletion - breaks dependent columns',
  },
};
```

#### 3. Non-Breaking Pattern Detection (6 patterns)
```typescript
const NON_BREAKING_PATTERNS = {
  CREATE_TABLE: {
    regex: /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?["']?(\w+)["']?/gi,
    description: 'New table creation - safe',
  },
  ADD_COLUMN: {
    regex: /ALTER\s+TABLE\s+["']?(\w+)["']?\s+ADD\s+(?:COLUMN\s+)?["']?(\w+)["']?/gi,
    description: 'New column addition - safe if nullable or has default',
  },
  CREATE_INDEX: {
    regex: /CREATE\s+(?:UNIQUE\s+)?INDEX\s+(?:IF\s+NOT\s+EXISTS\s+)?["']?(\w+)["']?/gi,
    description: 'New index creation - safe',
  },
  ADD_CONSTRAINT: {
    regex: /ALTER\s+TABLE\s+["']?(\w+)["']?\s+ADD\s+CONSTRAINT\s+["']?(\w+)["']?/gi,
    description: 'New constraint - safe if data already valid',
  },
  CREATE_TYPE: {
    regex: /CREATE\s+TYPE\s+["']?(\w+)["']?/gi,
    description: 'New enum/type creation - safe',
  },
  UPDATE_DATA: {
    regex: /UPDATE\s+["']?(\w+)["']?\s+SET/gi,
    description: 'Data migration - generally safe (backfill)',
  },
};
```

#### 4. Handler Function Entry Point
```typescript
export async function handler(
  prisma: PrismaClient,
  params: DetectSchemaChangesParams,
): Promise<DetectSchemaChangesResponse> {
  try {
    validateRequired(params, ['storyId']);

    // 1. Fetch story and validate it exists
    const story = await prisma.story.findUnique({
      where: { id: params.storyId },
    });

    if (!story) {
      throw new NotFoundError('Story', params.storyId);
    }

    // 2. Fetch active/idle worktree for story
    const worktree = await prisma.worktree.findFirst({
      where: {
        storyId: params.storyId,
        status: { in: ['active', 'idle'] },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (!worktree) {
      throw new NotFoundError(
        'Worktree',
        params.storyId,
        {
          resourceType: 'Worktree',
          resourceId: params.storyId,
          createTool: 'git_create_worktree',
        }
      );
    }

    // 3. Validate worktree filesystem exists
    validateWorktreePath(worktree.worktreePath);
    if (!checkFilesystemExists(worktree.worktreePath)) {
      throw new ValidationError(
        `Worktree filesystem does not exist at ${worktree.worktreePath}. Use git_delete_worktree to clean up database record.`
      );
    }

    // ... continued in implementation file
  } catch (error: any) {
    if (error.name === 'MCPError') {
      throw error;
    }
    throw handlePrismaError(error, 'detect_schema_changes');
  }
}
```

#### 5. Migration Discovery
```typescript
function listMigrations(migrationsPath: string): string[] {
  try {
    if (!fs.existsSync(migrationsPath)) {
      return [];
    }

    return fs.readdirSync(migrationsPath, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name)
      .sort();
  } catch (error: any) {
    console.warn(`Failed to list migrations in ${migrationsPath}:`, error.message);
    return [];
  }
}

function listMainBranchMigrations(repoPath: string): string[] {
  try {
    const output = execGit(
      `git ls-tree --name-only main:${MIGRATIONS_SUBPATH}/`,
      repoPath
    );

    return output
      .split('\n')
      .filter(line => line.trim().length > 0)
      .map(line => line.trim())
      .sort();
  } catch (error: any) {
    // Main branch might not have migrations directory yet
    if (error.message.includes('not a tree object')) {
      return [];
    }
    throw error;
  }
}

function findNewMigrations(
  worktreeMigrations: string[],
  mainMigrations: string[]
): string[] {
  const mainSet = new Set(mainMigrations);
  return worktreeMigrations.filter(migration => !mainSet.has(migration));
}
```

#### 6. SQL Pattern Analysis
```typescript
function analyzeSQLPatterns(sqlContent: string): {
  breakingPatterns: string[];
  nonBreakingPatterns: string[];
} {
  const breaking: string[] = [];
  const nonBreaking: string[] = [];

  // Check breaking patterns
  for (const [name, config] of Object.entries(BREAKING_PATTERNS)) {
    const matches = sqlContent.matchAll(config.regex);
    for (const match of matches) {
      // Extract context (up to 100 chars)
      const startIdx = Math.max(0, match.index! - 20);
      const endIdx = Math.min(sqlContent.length, match.index! + 80);
      const context = sqlContent.substring(startIdx, endIdx).trim();

      breaking.push(`[${name}] ${context}`);
    }
  }

  // Check non-breaking patterns (only if no breaking patterns found)
  if (breaking.length === 0) {
    for (const [name, config] of Object.entries(NON_BREAKING_PATTERNS)) {
      const matches = sqlContent.matchAll(config.regex);
      for (const match of matches) {
        const context = match[0].substring(0, 100);
        nonBreaking.push(`[${name}] ${context}`);
      }
    }
  }

  return { breakingPatterns: breaking, nonBreakingPatterns: nonBreaking };
}
```

#### 7. Story Metadata Update
```typescript
// Update story metadata with schema change info
const existingMetadata = (story.metadata as any) || {};
await prisma.story.update({
  where: { id: params.storyId },
  data: {
    metadata: {
      ...existingMetadata,
      schemaChanges: {
        hasChanges,
        isBreaking,
        detectedAt: response.metadata.detectedAt,
        schemaVersion,
        migrationCount: migrationFiles.length,
        breakingMigrationCount: breakingCount,
        migrationFiles: migrationFiles.map(m => m.name),
      },
    },
  },
});
```

### Test File
**File:** `/opt/stack/AIStudio/backend/src/mcp/servers/git/__tests__/detect_schema_changes.test.ts`
**Size:** ~450 lines
**Language:** TypeScript (Jest)
**Tests:** 31 total

#### Test Structure Overview
```typescript
describe('detect_schema_changes', () => {
  describe('Tool Definition', () => {
    // 3 tests for tool metadata and schema
  });

  describe('Input Validation', () => {
    // 3 tests for story, worktree, filesystem validation
  });

  describe('Migration Discovery', () => {
    // 3 tests for listing and filtering migrations
  });

  describe('Breaking Pattern Detection', () => {
    // 6 tests for all breaking patterns
  });

  describe('Non-Breaking Pattern Detection', () => {
    // 4 tests for non-breaking patterns
  });

  describe('Schema Version Extraction', () => {
    // 4 tests for timestamp parsing
  });

  describe('Error Handling', () => {
    // 4 tests for error scenarios
  });

  describe('Database Updates', () => {
    // 2 tests for metadata updates
  });

  describe('Response Structure', () => {
    // 2 tests for response format
  });
});
```

### Tool Registration
**File:** `/opt/stack/AIStudio/backend/src/mcp/servers/git/index.ts`
**Line:** 8
```typescript
export * as detectSchemaChanges from './detect_schema_changes.js';
```

## Response Examples

### Example 1: No Changes
```json
{
  "hasChanges": false,
  "isBreaking": false,
  "migrationFiles": [],
  "schemaVersion": null,
  "summary": "No schema changes detected",
  "metadata": {
    "worktreeId": "abc-123",
    "worktreePath": "/opt/stack/worktrees/st-42",
    "branchName": "st-42-schema-detection",
    "comparedAgainst": "main",
    "detectedAt": "2025-11-19T15:30:00.000Z",
    "migrationCount": 0,
    "breakingMigrationCount": 0
  }
}
```

### Example 2: Breaking Changes
```json
{
  "hasChanges": true,
  "isBreaking": true,
  "migrationFiles": [
    {
      "name": "20251119_restructure_users",
      "timestamp": "2025-11-19T14:30:00Z",
      "filePath": "backend/prisma/migrations/20251119_restructure_users",
      "isBreaking": true,
      "breakingPatterns": [
        "[DROP_TABLE] DROP TABLE old_users;",
        "[ALTER_COLUMN_TYPE] ALTER TABLE users ALTER COLUMN id TYPE BIGINT"
      ],
      "nonBreakingPatterns": []
    }
  ],
  "schemaVersion": "20251119",
  "summary": "⚠️ 1 breaking change detected in 1 migration - queue locking required",
  "metadata": {
    "worktreeId": "abc-123",
    "worktreePath": "/opt/stack/worktrees/st-99",
    "branchName": "st-99-metrics-refactor",
    "comparedAgainst": "main",
    "detectedAt": "2025-11-19T16:00:00.000Z",
    "migrationCount": 1,
    "breakingMigrationCount": 1
  }
}
```

### Example 3: Non-Breaking Changes
```json
{
  "hasChanges": true,
  "isBreaking": false,
  "migrationFiles": [
    {
      "name": "20251119_add_tool_calls",
      "timestamp": "2025-11-19T11:42:00Z",
      "filePath": "backend/prisma/migrations/20251119_add_tool_calls",
      "isBreaking": false,
      "breakingPatterns": [],
      "nonBreakingPatterns": [
        "[ADD_COLUMN] ALTER TABLE component_runs ADD COLUMN tool_calls INTEGER",
        "[CREATE_INDEX] CREATE INDEX idx_component_runs_tool_calls"
      ]
    }
  ],
  "schemaVersion": "20251119",
  "summary": "1 non-breaking change detected (new tables/columns/indexes)",
  "metadata": {
    "worktreeId": "abc-123",
    "worktreePath": "/opt/stack/worktrees/st-57",
    "branchName": "st-57-tool-calls",
    "comparedAgainst": "main",
    "detectedAt": "2025-11-19T14:00:00.000Z",
    "migrationCount": 1,
    "breakingMigrationCount": 0
  }
}
```

## Test Execution

To run the tests:
```bash
cd /opt/stack/AIStudio/backend
npm test -- detect_schema_changes.test.ts
```

Expected output:
```
PASS src/mcp/servers/git/__tests__/detect_schema_changes.test.ts
  detect_schema_changes
    Tool Definition
      ✓ should have correct tool name
      ✓ should have required storyId parameter
      ✓ should have git category metadata
    [... 28 more tests ...]

Test Suites: 1 passed, 1 total
Tests:       31 passed, 31 total
Time:        5.494 s
```

## Performance Benchmarks

Based on test execution:
- **Average test time:** ~177ms per test
- **Fastest test:** ~1ms (simple checks)
- **Slowest test:** ~67ms (database operations)
- **Total suite time:** 5.494 seconds

Estimated real-world performance:
- **Typical case (1-3 migrations):** 500-1000ms
- **Complex case (5 migrations):** 1-2 seconds
- **Large case (10+ migrations):** 2-5 seconds

## Integration Points

### For ST-43 (Queue Locking)
```typescript
const result = await detectSchemaChanges({ storyId });
if (result.isBreaking) {
  await lockTestQueue({ 
    reason: `Breaking schema changes in ${storyKey}`,
    schemaVersion: result.schemaVersion 
  });
}
```

### For ST-44 (Deploy to Test Env)
```typescript
const result = await detectSchemaChanges({ storyId });
if (result.hasChanges) {
  // Apply migrations via prisma migrate deploy
}
if (result.isBreaking) {
  // Wait for queue lock
}
```

### For ST-45 (Run Tests)
```typescript
const story = await getStory(storyId);
const migrations = story.metadata?.schemaChanges?.migrationFiles;
if (testsFailed && story.metadata?.schemaChanges?.isBreaking) {
  // Log critical warning about potential rollback
}
```

## Key Design Decisions

1. **Conservative Pattern Detection:** Assumes breaking when in doubt to prevent false negatives (data loss risk)
2. **Non-Fatal Error Handling:** Gracefully degrades for unreadable files while returning partial results
3. **Efficient Git Operations:** Uses `git ls-tree` instead of checkout for main branch comparison
4. **File Size Limits:** Truncates large migrations for pattern detection (breaking patterns typically at top)
5. **Metadata Preservation:** Merges schema changes into existing metadata (doesn't overwrite)

