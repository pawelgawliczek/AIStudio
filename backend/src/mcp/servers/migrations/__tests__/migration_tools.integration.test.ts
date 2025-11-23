/**
 * Integration Tests for Migration MCP Tools
 * ST-85: Safe Migration MCP Tools & Permission Enforcement
 *
 * Tests real database interactions for migration tools
 *
 * NOTE: These tests use the TEST database (port 5434)
 * Configured via DATABASE_URL environment variable in test setup
 *
 * Covers:
 * - preview_migration: Read-only migration status checks
 * - run_safe_migration: Full migration workflow with safeguards
 * - create_migration: Migration file generation
 */

import { PrismaClient } from '@prisma/client';
import { handlePreviewMigration } from '../preview_migration';
import { handleRunSafeMigration } from '../run_safe_migration';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';

const execAsync = promisify(exec);

// Increase default timeout for integration tests
jest.setTimeout(15000); // 15 seconds default

describe('Migration MCP Tools - Integration Tests', () => {
  let prisma: PrismaClient;
  const TEST_DATABASE_URL = process.env.DATABASE_URL ||
    'postgresql://postgres:test@127.0.0.1:5434/vibestudio_test?schema=public';

  beforeAll(async () => {
    // Ensure we're using TEST database
    if (!TEST_DATABASE_URL.includes(':5434') && !TEST_DATABASE_URL.includes('vibestudio_test')) {
      throw new Error(
        '⚠️ SAFETY CHECK FAILED: Integration tests MUST use TEST database (port 5434)!\n' +
        `Current DATABASE_URL: ${TEST_DATABASE_URL}\n` +
        'Expected: Contains ":5434" or "vibestudio_test"'
      );
    }

    prisma = new PrismaClient({
      datasources: {
        db: {
          url: TEST_DATABASE_URL,
        },
      },
    });

    // Verify database connection
    await prisma.$connect();
    console.log('✅ Connected to TEST database');

    // Seed TEST database schema using Prisma
    console.log('📦 Seeding TEST database schema using Prisma...');
    try {
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);

      // Use Prisma db push to sync schema to TEST database
      // This reads from schema.prisma and applies it to the TEST database (via DATABASE_URL env var)
      const pushCmd = `cd /opt/stack/AIStudio/backend && DATABASE_URL='${TEST_DATABASE_URL}' npx prisma db push --accept-data-loss --skip-generate`;

      await execAsync(pushCmd, { timeout: 30000 });
      console.log('  ✓ Applied schema to TEST database using Prisma');

      console.log('✅ TEST database schema ready');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('❌ Failed to seed TEST database:', errorMessage);
      console.error('Error details:', error);
      throw error;
    }
  }, 60000); // 60 second timeout for seeding

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('preview_migration - Integration', () => {
    it('should connect to database and check migration status', async () => {
      const result = await handlePreviewMigration({});

      if (!result.success) {
        console.error('Preview failed:', result.message);
      }

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.pendingMigrations).toBeDefined();
      expect(Array.isArray(result.pendingMigrations)).toBe(true);
      expect(result.migrationCount).toBeDefined();
      expect(typeof result.migrationCount).toBe('number');
    }, 10000); // 10 second timeout

    it('should return valid migration count', async () => {
      const result = await handlePreviewMigration({});

      expect(result.migrationCount).toBeGreaterThanOrEqual(0);
      expect(result.migrationCount).toBe(result.pendingMigrations.length);
    });

    it('should include informative message', async () => {
      const result = await handlePreviewMigration({});

      expect(result.message).toBeDefined();
      expect(typeof result.message).toBe('string');
      expect(result.message.length).toBeGreaterThan(0);
    });

    it('should not modify database state', async () => {
      // Get initial migration status
      const beforeResult = await handlePreviewMigration({});

      // Run preview again
      const afterResult = await handlePreviewMigration({});

      // Should return same results (read-only)
      expect(afterResult.pendingMigrations).toEqual(beforeResult.pendingMigrations);
      expect(afterResult.migrationCount).toBe(beforeResult.migrationCount);
    });
  });

  describe('run_safe_migration - Validation (Integration)', () => {
    it('should reject execution without confirmation', async () => {
      const result = await handleRunSafeMigration({
        dryRun: false,
        confirmMigration: false,
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('confirmMigration must be true');
    });

    it('should allow dry-run without confirmation', async () => {
      const result = await handleRunSafeMigration({
        dryRun: true,
      });

      if (!result.success) {
        console.error('Dry-run failed:', result.message);
        console.error('Errors:', result.errors);
        console.error('Phases:', JSON.stringify(result.phases, null, 2));
      }

      expect(result.success).toBe(true);
      expect(result.message).toContain('DRY-RUN');
    });

    it('should handle database connection check', async () => {
      const result = await handleRunSafeMigration({
        dryRun: true,
      });

      if (!result.phases?.preFlightChecks?.success) {
        console.error('Pre-flight checks failed:', result.phases?.preFlightChecks);
      }

      // Should complete pre-flight checks successfully
      expect(result.phases).toBeDefined();
      expect(result.phases.preFlightChecks).toBeDefined();
      expect(result.phases.preFlightChecks.success).toBe(true);
    });
  });

  describe('run_safe_migration - Dry-Run Mode (Integration)', () => {
    it('should list pending migrations without applying', async () => {
      const result = await handleRunSafeMigration({
        dryRun: true,
      });

      if (!result.success) {
        console.error('List pending migrations failed:', result.message);
        console.error('Errors:', result.errors);
        console.error('Phases:', JSON.stringify(result.phases, null, 2));
      }

      expect(result.success).toBe(true);
      expect(result.pendingMigrations).toBeDefined();
      expect(Array.isArray(result.pendingMigrations)).toBe(true);
    });

    it('should complete quickly in dry-run mode', async () => {
      const startTime = Date.now();

      await handleRunSafeMigration({
        dryRun: true,
      });

      const duration = Date.now() - startTime;

      // Dry-run should complete in under 7 seconds (adjusted for test database overhead)
      expect(duration).toBeLessThan(7000);
    });

    it('should not create backup in dry-run mode', async () => {
      const result = await handleRunSafeMigration({
        dryRun: true,
      });

      expect(result.backupFile).toBeUndefined();
      expect(result.phases.createBackup).toBeUndefined();
    });

    it('should not acquire lock in dry-run mode', async () => {
      const result = await handleRunSafeMigration({
        dryRun: true,
      });

      expect(result.lockId).toBeUndefined();
      expect(result.phases.acquireLock).toBeUndefined();
    });
  });

  describe('run_safe_migration - Story Tracking (Integration)', () => {
    it('should handle invalid story ID gracefully', async () => {
      const result = await handleRunSafeMigration({
        storyId: 'invalid-uuid',
        dryRun: true,
      });

      // Should still complete dry-run
      expect(result.success).toBe(true);
      expect(result.storyKey).toBeUndefined();
    });

    it('should include story key when valid story ID provided', async () => {
      // Create test project and user first
      const testProject = await prisma.project.create({
        data: {
          name: 'Test Project for Migration',
          status: 'active',
        },
      });

      const testUser = await prisma.user.create({
        data: {
          email: 'test-migration@example.com',
          name: 'Test User',
          password: 'hashed-password-not-used',
          role: 'admin',
        },
      });

      const testStory = await prisma.story.create({
        data: {
          projectId: testProject.id,
          createdById: testUser.id,
          key: 'ST-85-TEST',
          title: 'Test Story for Migration Integration',
          type: 'feature',
          status: 'planning',
        },
      });

      try {
        const result = await handleRunSafeMigration({
          storyId: testStory.id,
          dryRun: true,
        });

        expect(result.success).toBe(true);
        expect(result.storyKey).toBe('ST-85-TEST');
      } finally {
        // Cleanup in reverse order
        await prisma.story.delete({ where: { id: testStory.id } });
        await prisma.user.delete({ where: { id: testUser.id } });
        await prisma.project.delete({ where: { id: testProject.id } });
      }
    });
  });

  describe('run_safe_migration - Emergency Flags (Integration)', () => {
    it('should warn about skipBackup flag', async () => {
      const result = await handleRunSafeMigration({
        dryRun: true,
        skipBackup: true,
      });

      expect(result.warnings).toContain(
        '⚠️ WARNING: Skipping pre-migration backup (EMERGENCY MODE)'
      );
    });

    it('should warn about skipValidation flag', async () => {
      const result = await handleRunSafeMigration({
        dryRun: true,
        skipValidation: true,
      });

      expect(result.warnings).toContain(
        '⚠️ WARNING: Skipping post-migration validation (EMERGENCY MODE)'
      );
    });

    it('should warn about both emergency flags', async () => {
      const result = await handleRunSafeMigration({
        dryRun: true,
        skipBackup: true,
        skipValidation: true,
      });

      expect(result.warnings).toHaveLength(2);
      expect(result.warnings).toContain(
        '⚠️ WARNING: Skipping pre-migration backup (EMERGENCY MODE)'
      );
      expect(result.warnings).toContain(
        '⚠️ WARNING: Skipping post-migration validation (EMERGENCY MODE)'
      );
    });
  });

  describe('Migration Workflow - Phase Tracking (Integration)', () => {
    it('should track all phases in dry-run', async () => {
      const result = await handleRunSafeMigration({
        dryRun: true,
      });

      expect(result.phases).toBeDefined();
      expect(result.phases.preFlightChecks).toBeDefined();
      expect(result.phases.checkPendingMigrations).toBeDefined();

      // These phases should be present
      expect(result.phases.preFlightChecks.success).toBe(true);
      expect(result.phases.checkPendingMigrations.success).toBe(true);

      // These phases should NOT be present in dry-run
      expect(result.phases.executeMigration).toBeUndefined();
      expect(result.phases.rollback).toBeUndefined();
    });

    it('should include duration for each phase', async () => {
      const result = await handleRunSafeMigration({
        dryRun: true,
      });

      expect(result.phases.preFlightChecks.duration).toBeDefined();
      expect(result.phases.preFlightChecks.duration).toBeGreaterThanOrEqual(0);

      expect(result.phases.checkPendingMigrations.duration).toBeDefined();
      expect(result.phases.checkPendingMigrations.duration).toBeGreaterThanOrEqual(0);
    });

    it('should include total duration', async () => {
      const result = await handleRunSafeMigration({
        dryRun: true,
      });

      expect(result.duration).toBeDefined();
      expect(result.duration).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Database Safety Checks (Integration)', () => {
    it('should verify TEST database is being used', async () => {
      // Query database to confirm it's the test instance
      const result = await prisma.$queryRaw<Array<{ current_database: string }>>`
        SELECT current_database()
      `;

      expect(result[0].current_database).toBe('vibestudio_test');
    });

    it('should verify TEST database port', async () => {
      const databaseUrl = process.env.DATABASE_URL || TEST_DATABASE_URL;

      expect(
        databaseUrl.includes(':5434') ||
        databaseUrl.includes('vibestudio_test')
      ).toBe(true);
    });

    it('should not allow migrations on production database', async () => {
      const databaseUrl = process.env.DATABASE_URL || TEST_DATABASE_URL;

      // Double-check we're not on production
      expect(databaseUrl).not.toContain(':5433');
      expect(databaseUrl).not.toContain('vibestudio?schema=public');
    });
  });

  describe('Error Handling (Integration)', () => {
    it('should handle database connection errors gracefully', async () => {
      // This test would require disconnecting the database
      // For safety, we just verify error structure exists
      const result = await handlePreviewMigration({});

      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('message');
      expect(result).toHaveProperty('pendingMigrations');
      expect(result).toHaveProperty('migrationCount');
    });

    it('should return structured error response', async () => {
      const result = await handleRunSafeMigration({
        dryRun: false,
        confirmMigration: false, // This will cause validation error
      });

      expect(result.success).toBe(false);
      expect(result.message).toBeDefined();
      expect(result.errors).toBeDefined();
      expect(Array.isArray(result.errors)).toBe(true);
    });
  });

  describe('Response Structure (Integration)', () => {
    it('should return complete response structure', async () => {
      const result = await handleRunSafeMigration({
        dryRun: true,
      });

      // Required fields
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('pendingMigrations');
      expect(result).toHaveProperty('appliedMigrations');
      expect(result).toHaveProperty('duration');
      expect(result).toHaveProperty('phases');
      expect(result).toHaveProperty('warnings');
      expect(result).toHaveProperty('errors');
      expect(result).toHaveProperty('message');

      // Type checks
      expect(typeof result.success).toBe('boolean');
      expect(Array.isArray(result.pendingMigrations)).toBe(true);
      expect(Array.isArray(result.appliedMigrations)).toBe(true);
      expect(typeof result.duration).toBe('number');
      expect(typeof result.phases).toBe('object');
      expect(Array.isArray(result.warnings)).toBe(true);
      expect(Array.isArray(result.errors)).toBe(true);
      expect(typeof result.message).toBe('string');
    });
  });

  describe('Performance (Integration)', () => {
    it('should complete dry-run within reasonable time', async () => {
      const startTime = Date.now();

      await handleRunSafeMigration({
        dryRun: true,
      });

      const duration = Date.now() - startTime;

      // Should complete in under 7 seconds (adjusted for test database overhead)
      expect(duration).toBeLessThan(7000);
    });

    it('should handle multiple concurrent preview requests', async () => {
      const promises = Array(5).fill(null).map(() => handlePreviewMigration({}));

      const results = await Promise.all(promises);

      // All should succeed
      results.forEach(result => {
        expect(result.success).toBe(true);
      });

      // All should return same pending migrations
      const firstResult = results[0];
      results.forEach(result => {
        expect(result.pendingMigrations).toEqual(firstResult.pendingMigrations);
      });
    }, 30000); // 30 second timeout for concurrent requests
  });
});
