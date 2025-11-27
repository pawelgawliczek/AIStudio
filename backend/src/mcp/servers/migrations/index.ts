/**
 * MCP Migrations Server
 *
 * **ST-70: Database Schema Migration Strategy & Safeguards**
 *
 * Provides safe database migration tools that replace unsafe Prisma commands.
 *
 * **TOOLS:**
 * - run_safe_migration - Execute migrations with comprehensive safeguards
 * - preview_migration - Preview pending migrations (read-only)
 * - create_migration - Create new migration files (no deployment)
 *
 * **BLOCKS UNSAFE COMMANDS:**
 * - ❌ npx prisma db push --accept-data-loss
 * - ❌ npx prisma db push
 * - ❌ npx prisma migrate deploy
 * - ❌ npx prisma migrate resolve
 *
 * **ENFORCES SAFE WORKFLOW:**
 * 1. create_migration - Generate migration files
 * 2. preview_migration - Review pending changes
 * 3. run_safe_migration - Apply with full safeguards
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import {
  createMigrationTool,
  handleCreateMigration,
  CreateMigrationParams,
  CreateMigrationResponse,
} from './create_migration.js';
import {
  previewMigrationTool,
  handlePreviewMigration,
  PreviewMigrationParams,
  PreviewMigrationResponse,
} from './preview_migration.js';
import {
  runSafeMigrationTool,
  handleRunSafeMigration,
  RunSafeMigrationParams,
  RunSafeMigrationResponse,
} from './run_safe_migration.js';

// ============================================================================
// Tool Exports
// ============================================================================

export const migrationTools: Tool[] = [
  runSafeMigrationTool,
  previewMigrationTool,
  createMigrationTool,
];

// ============================================================================
// Handler Exports
// ============================================================================

export {
  handleRunSafeMigration,
  handlePreviewMigration,
  handleCreateMigration,
};

// ============================================================================
// Type Exports
// ============================================================================

export type {
  RunSafeMigrationParams,
  RunSafeMigrationResponse,
  PreviewMigrationParams,
  PreviewMigrationResponse,
  CreateMigrationParams,
  CreateMigrationResponse,
};
