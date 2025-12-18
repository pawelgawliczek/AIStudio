/**
 * MCP Tool: Create New Database Migration
 *
 * **ST-70: Database Schema Migration Strategy & Safeguards**
 *
 * Create a new migration file based on schema changes.
 * This uses `prisma migrate dev --create-only` to generate migration files
 * WITHOUT applying them to the database.
 *
 * **WORKFLOW:**
 * 1. Edit backend/prisma/schema.prisma
 * 2. Use this tool to create migration file
 * 3. Review generated SQL in backend/prisma/migrations/
 * 4. Use preview_migration to see pending migrations
 * 5. Use run_safe_migration to apply with safeguards
 *
 * **REPLACES UNSAFE COMMANDS:**
 * - ❌ `npx prisma migrate dev` (auto-applies to DB)
 * - ✅ Use this tool for safe migration creation only
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { ValidationError } from '../../types/index.js';
import { validateRequired } from '../../utils.js';

const execAsync = promisify(exec);

// ============================================================================
// Input/Output Types
// ============================================================================

export interface CreateMigrationParams {
  name: string; // Migration name (e.g., "add_user_roles")
  storyId?: string; // Optional story ID for naming context
}

export interface CreateMigrationResponse {
  success: boolean;
  migrationName: string;
  migrationPath: string;
  sqlPreview?: string;
  warnings: string[];
  message: string;
}

// ============================================================================
// Tool Definition
// ============================================================================

export const createMigrationTool: Tool = {
  name: 'create_migration',
  description: 'Create migration file from schema changes. Does NOT apply; use run_safe_migration to apply.',
  inputSchema: {
    type: 'object',
    properties: {
      name: {
        type: 'string',
        description: 'Migration name (e.g., "add_user_roles", "update_story_status")',
      },
      storyId: {
        type: 'string',
        description: 'Optional story ID for naming context',
      },
    },
    required: ['name'],
  },
};

// ============================================================================
// Tool Handler
// ============================================================================

export async function handleCreateMigration(
  params: CreateMigrationParams,
): Promise<CreateMigrationResponse> {
  const warnings: string[] = [];

  try {
    // Validate required fields
    validateRequired(params as unknown as Record<string, unknown>, ['name']);

    // Sanitize migration name (alphanumeric and underscores only)
    const sanitizedName = params.name.replace(/[^a-zA-Z0-9_]/g, '_');
    if (sanitizedName !== params.name) {
      warnings.push(`Migration name sanitized: "${params.name}" → "${sanitizedName}"`);
    }

    // Build prisma migrate dev command
    const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:CHANGE_ME_POSTGRES_PASSWORD@127.0.0.1:5432/vibestudio?schema=public';

    const command = `cd /opt/stack/AIStudio/backend && DATABASE_URL='${DATABASE_URL}' npx prisma migrate dev --create-only --name ${sanitizedName}`;

    // Execute command
    const { stdout, stderr } = await execAsync(command, {
      timeout: 60000, // 60 second timeout
    });

    // Parse output to find migration path
    const migrationPathMatch = stdout.match(/migrations\/(\d+_[^/\s]+)/);
    const migrationName = migrationPathMatch ? migrationPathMatch[1] : sanitizedName;
    const migrationPath = `/opt/stack/AIStudio/backend/prisma/migrations/${migrationName}`;

    // Check if migration was created
    if (stdout.includes('No changes detected') || stdout.includes('already in sync')) {
      return {
        success: true,
        migrationName: sanitizedName,
        migrationPath,
        warnings: ['No schema changes detected. Migration not created.'],
        message: '⚠️ No schema changes detected. Your database schema is already in sync with schema.prisma.',
      };
    }

    // Try to read SQL preview
    let sqlPreview: string | undefined;
    try {
      const { stdout: sqlContent } = await execAsync(`cat ${migrationPath}/migration.sql`);
      sqlPreview = sqlContent;
    } catch (error) {
      warnings.push('Could not read generated SQL file');
    }

    return {
      success: true,
      migrationName,
      migrationPath,
      sqlPreview,
      warnings,
      message: `✅ Migration created successfully: ${migrationName}\n\n` +
               `Path: ${migrationPath}\n\n` +
               `Next steps:\n` +
               `1. Review the generated SQL in ${migrationPath}/migration.sql\n` +
               `2. Use preview_migration to see pending migrations\n` +
               `3. Use run_safe_migration to apply with safeguards`,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    return {
      success: false,
      migrationName: params.name,
      migrationPath: '',
      warnings,
      message: `❌ Failed to create migration: ${errorMessage}`,
    };
  }
}
