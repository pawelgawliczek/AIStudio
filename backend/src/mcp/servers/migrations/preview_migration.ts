/**
 * MCP Tool: Preview Pending Database Migrations
 *
 * **ST-70: Database Schema Migration Strategy & Safeguards**
 *
 * Preview pending migrations without applying them.
 * Safe read-only operation that shows what would be applied.
 *
 * **REPLACES UNSAFE COMMANDS:**
 * - ❌ `npx prisma migrate status`
 * - ✅ Use this tool for safe migration preview
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { SafeMigrationService } from '../../../services/safe-migration.service.js';

// ============================================================================
// Input/Output Types
// ============================================================================

export interface PreviewMigrationParams {
  // No parameters needed - just lists pending migrations
}

export interface PreviewMigrationResponse {
  success: boolean;
  pendingMigrations: string[];
  migrationCount: number;
  message: string;
}

// ============================================================================
// Tool Definition
// ============================================================================

export const previewMigrationTool: Tool = {
  name: 'preview_migration',
  description: 'Preview pending migrations without applying. Read-only; use run_safe_migration to apply.',
  inputSchema: {
    type: 'object',
    properties: {},
    required: [],
  },
};

// ============================================================================
// Tool Handler
// ============================================================================

export async function handlePreviewMigration(
  params: PreviewMigrationParams,
): Promise<PreviewMigrationResponse> {
  try {
    const safeMigrationService = new SafeMigrationService();
    const pendingMigrations = await safeMigrationService.checkPendingMigrations();

    if (pendingMigrations.length === 0) {
      return {
        success: true,
        pendingMigrations: [],
        migrationCount: 0,
        message: '✅ Database schema is up to date. No pending migrations.',
      };
    }

    return {
      success: true,
      pendingMigrations,
      migrationCount: pendingMigrations.length,
      message: `📋 Found ${pendingMigrations.length} pending migration(s): ${pendingMigrations.join(', ')}`,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      pendingMigrations: [],
      migrationCount: 0,
      message: `❌ Failed to check pending migrations: ${errorMessage}`,
    };
  }
}
