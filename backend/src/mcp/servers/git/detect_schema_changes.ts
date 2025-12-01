/**
 * Detect Schema Changes Tool
 * Detects and analyzes database schema changes in worktrees
 */

import * as fs from 'fs';
import * as path from 'path';
import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { PrismaClient } from '@prisma/client';
import {
  NotFoundError,
  ValidationError,
} from '../../types';
import {
  validateRequired,
  handlePrismaError,
} from '../../utils';
import { execGit, validateWorktreePath, checkFilesystemExists } from './git_utils';

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

// Constants
const REPO_PATH = '/opt/stack/AIStudio';
const MIGRATIONS_SUBPATH = 'backend/prisma/migrations';
const MIGRATION_SQL_FILENAME = 'migration.sql';
const MAX_MIGRATION_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const PATTERN_DETECTION_LIMIT = 1 * 1024 * 1024; // 1MB for pattern detection

// Breaking SQL patterns
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

// Non-breaking SQL patterns
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

// Interfaces
interface DetectSchemaChangesParams {
  storyId: string;
}

interface MigrationDetail {
  name: string;
  timestamp: string | null;
  filePath: string;
  isBreaking: boolean;
  breakingPatterns: string[];
  nonBreakingPatterns: string[];
  sqlContent?: string;
  warnings?: string[];
}

interface DetectionMetadata {
  worktreeId: string;
  worktreePath: string;
  branchName: string;
  comparedAgainst: string;
  detectedAt: string;
  migrationCount: number;
  breakingMigrationCount: number;
}

interface DetectSchemaChangesResponse {
  hasChanges: boolean;
  isBreaking: boolean;
  migrationFiles: MigrationDetail[];
  schemaVersion: string | null;
  summary: string;
  metadata: DetectionMetadata;
}

/**
 * List migration directories in a path
 */
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

/**
 * List migrations in main branch using git
 */
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

/**
 * Find new migrations in worktree that don't exist in main
 */
function findNewMigrations(
  worktreeMigrations: string[],
  mainMigrations: string[]
): string[] {
  const mainSet = new Set(mainMigrations);
  return worktreeMigrations.filter(migration => !mainSet.has(migration));
}

/**
 * Read SQL content from migration.sql file
 */
function readMigrationSQL(migrationPath: string): string {
  const filePath = path.join(migrationPath, MIGRATION_SQL_FILENAME);

  if (!fs.existsSync(filePath)) {
    throw new Error(`Migration SQL file not found: ${filePath}`);
  }

  const stats = fs.statSync(filePath);

  if (stats.size > MAX_MIGRATION_FILE_SIZE) {
    throw new Error(`Migration file too large: ${stats.size} bytes (max 10MB)`);
  }

  let content = fs.readFileSync(filePath, 'utf-8');

  // Truncate for pattern detection if very large
  if (content.length > PATTERN_DETECTION_LIMIT) {
    content = content.substring(0, PATTERN_DETECTION_LIMIT);
  }

  return content;
}

/**
 * Analyze SQL content for breaking and non-breaking patterns
 */
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

/**
 * Extract timestamp from migration directory name
 * Format: YYYYMMDDHHMM_description or YYYYMMDD_description
 */
function extractTimestamp(migrationName: string): string | null {
  try {
    // Try to extract timestamp from directory name
    const timestampMatch = migrationName.match(/^(\d{8,12})/);
    if (!timestampMatch) {
      return null;
    }

    const timestamp = timestampMatch[1];

    // Parse based on length
    if (timestamp.length === 12) {
      // YYYYMMDDHHMM
      const year = timestamp.substring(0, 4);
      const month = timestamp.substring(4, 6);
      const day = timestamp.substring(6, 8);
      const hour = timestamp.substring(8, 10);
      const minute = timestamp.substring(10, 12);

      return new Date(`${year}-${month}-${day}T${hour}:${minute}:00Z`).toISOString();
    } else if (timestamp.length === 8) {
      // YYYYMMDD
      const year = timestamp.substring(0, 4);
      const month = timestamp.substring(4, 6);
      const day = timestamp.substring(6, 8);

      return new Date(`${year}-${month}-${day}T00:00:00Z`).toISOString();
    }

    return null;
  } catch (error) {
    return null;
  }
}

/**
 * Generate schema version from migration name
 */
function generateSchemaVersion(migrationName: string): string | null {
  const timestampMatch = migrationName.match(/^(\d{8,12})/);
  return timestampMatch ? timestampMatch[1] : null;
}

/**
 * Analyze a single migration file
 */
function analyzeMigration(
  migrationName: string,
  migrationPath: string,
  migrationsBasePath: string
): MigrationDetail {
  const warnings: string[] = [];

  try {
    const sql = readMigrationSQL(migrationPath);
    const { breakingPatterns, nonBreakingPatterns } = analyzeSQLPatterns(sql);

    return {
      name: migrationName,
      timestamp: extractTimestamp(migrationName),
      filePath: path.relative(REPO_PATH, migrationPath),
      isBreaking: breakingPatterns.length > 0,
      breakingPatterns,
      nonBreakingPatterns,
    };
  } catch (error: any) {
    // Non-fatal error - log and return partial result
    console.warn(`Failed to analyze migration ${migrationName}:`, error.message);
    warnings.push(`Failed to read migration file: ${error.message}`);

    // Conservative: assume breaking if can't read
    return {
      name: migrationName,
      timestamp: extractTimestamp(migrationName),
      filePath: path.relative(REPO_PATH, migrationPath),
      isBreaking: true,
      breakingPatterns: [],
      nonBreakingPatterns: [],
      warnings,
    };
  }
}

/**
 * Generate human-readable summary
 */
function generateSummary(
  hasChanges: boolean,
  isBreaking: boolean,
  migrationCount: number,
  breakingCount: number
): string {
  if (!hasChanges) {
    return 'No schema changes detected';
  }

  if (isBreaking) {
    return `⚠️ ${breakingCount} breaking change${breakingCount > 1 ? 's' : ''} detected in ${migrationCount} migration${migrationCount > 1 ? 's' : ''} - queue locking required`;
  }

  return `${migrationCount} non-breaking change${migrationCount > 1 ? 's' : ''} detected (new tables/columns/indexes)`;
}

/**
 * Main handler function
 */
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

    // 3. Validate worktree filesystem exists (ST-158: pass hostType for laptop worktrees)
    validateWorktreePath(worktree.worktreePath, worktree.hostType || undefined);
    if (!checkFilesystemExists(worktree.worktreePath)) {
      throw new ValidationError(
        `Worktree filesystem does not exist at ${worktree.worktreePath}. Use git_delete_worktree to clean up database record.`
      );
    }

    // 4. List migrations in worktree
    const worktreeMigrationsPath = path.join(
      worktree.worktreePath,
      MIGRATIONS_SUBPATH
    );
    const worktreeMigrations = listMigrations(worktreeMigrationsPath);

    // 5. List migrations in main branch
    const mainMigrations = listMainBranchMigrations(REPO_PATH);

    // 6. Find new migrations
    const newMigrations = findNewMigrations(worktreeMigrations, mainMigrations);

    // 7. Analyze each new migration
    const migrationFiles: MigrationDetail[] = newMigrations.map(migrationName => {
      const migrationPath = path.join(worktreeMigrationsPath, migrationName);
      return analyzeMigration(migrationName, migrationPath, worktreeMigrationsPath);
    });

    // 8. Calculate results
    const hasChanges = migrationFiles.length > 0;
    const isBreaking = migrationFiles.some(m => m.isBreaking);
    const breakingCount = migrationFiles.filter(m => m.isBreaking).length;

    // Get latest schema version
    const schemaVersion = migrationFiles.length > 0
      ? generateSchemaVersion(migrationFiles[migrationFiles.length - 1].name)
      : null;

    // 9. Build response
    const response: DetectSchemaChangesResponse = {
      hasChanges,
      isBreaking,
      migrationFiles,
      schemaVersion,
      summary: generateSummary(hasChanges, isBreaking, migrationFiles.length, breakingCount),
      metadata: {
        worktreeId: worktree.id,
        worktreePath: worktree.worktreePath,
        branchName: worktree.branchName,
        comparedAgainst: 'main',
        detectedAt: new Date().toISOString(),
        migrationCount: migrationFiles.length,
        breakingMigrationCount: breakingCount,
      },
    };

    // 10. Update story metadata
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

    return response;
  } catch (error: any) {
    if (error.name === 'MCPError') {
      throw error;
    }
    throw handlePrismaError(error, 'detect_schema_changes');
  }
}
