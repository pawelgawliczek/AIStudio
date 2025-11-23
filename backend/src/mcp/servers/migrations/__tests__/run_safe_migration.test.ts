/**
 * Tests for run_safe_migration tool
 * ST-85: Safe Migration MCP Tools & Permission Enforcement
 */

import { PrismaClient } from '@prisma/client';
import { handler, tool } from '../run_safe_migration';
import { SafeMigrationService } from '../../../../services/safe-migration.service';

// Mock SafeMigrationService
jest.mock('../../../../services/safe-migration.service');

describe('run_safe_migration', () => {
  let prisma: PrismaClient;
  let mockSafeMigrationService: jest.Mocked<SafeMigrationService>;

  beforeEach(() => {
    prisma = new PrismaClient();
    jest.clearAllMocks();

    // Create mock instance
    mockSafeMigrationService = new SafeMigrationService() as jest.Mocked<SafeMigrationService>;
  });

  afterEach(async () => {
    await prisma.$disconnect();
  });

  describe('Tool Definition', () => {
    it('should have correct tool name', () => {
      expect(tool.name).toBe('run_safe_migration');
    });

    it('should have optional storyId parameter', () => {
      expect(tool.inputSchema.properties).toHaveProperty('storyId');
    });

    it('should have confirmMigration parameter', () => {
      expect(tool.inputSchema.properties).toHaveProperty('confirmMigration');
    });

    it('should have dryRun parameter', () => {
      expect(tool.inputSchema.properties).toHaveProperty('dryRun');
    });

    it('should have emergency flags', () => {
      expect(tool.inputSchema.properties).toHaveProperty('skipBackup');
      expect(tool.inputSchema.properties).toHaveProperty('skipValidation');
    });
  });

  describe('Handler Function - Validation', () => {
    it('should require confirmMigration for non-dry-run', async () => {
      const result = await handler({
        dryRun: false,
        confirmMigration: false,
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('confirmMigration must be true');
    });

    it('should allow dry-run without confirmation', async () => {
      // Mock pending migrations check
      mockSafeMigrationService.checkPendingMigrations = jest.fn().mockResolvedValue([]);

      const result = await handler({
        dryRun: true,
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('DRY-RUN');
    });
  });

  describe('Handler Function - Dry-Run Mode', () => {
    it('should return pending migrations without applying', async () => {
      mockSafeMigrationService.checkPendingMigrations = jest.fn().mockResolvedValue([
        '20251123_add_user_roles',
      ]);

      const result = await handler({
        dryRun: true,
      });

      expect(result.success).toBe(true);
      expect(result.pendingMigrations).toEqual(['20251123_add_user_roles']);
      expect(result.message).toContain('DRY-RUN');
      expect(mockSafeMigrationService.executeMigration).not.toHaveBeenCalled();
    });

    it('should handle no pending migrations', async () => {
      mockSafeMigrationService.checkPendingMigrations = jest.fn().mockResolvedValue([]);

      const result = await handler({
        dryRun: true,
      });

      expect(result.success).toBe(true);
      expect(result.pendingMigrations).toEqual([]);
      expect(result.message).toContain('No migrations needed');
    });
  });

  describe('Handler Function - Full Migration Flow', () => {
    beforeEach(() => {
      // Mock successful migration flow
      mockSafeMigrationService.checkPendingMigrations = jest.fn().mockResolvedValue([
        '20251123_add_user_roles',
      ]);
      mockSafeMigrationService.createPreMigrationBackup = jest.fn().mockResolvedValue({
        backupFile: '/backups/vibestudio_premig_20251123_120000.dump',
      });
      mockSafeMigrationService.verifyBackup = jest.fn().mockResolvedValue(true);
      mockSafeMigrationService.acquireQueueLock = jest.fn().mockResolvedValue({
        id: 'lock-123',
      });
      mockSafeMigrationService.executeMigration = jest.fn().mockResolvedValue({
        appliedMigrations: ['20251123_add_user_roles'],
      });
      mockSafeMigrationService.validatePostMigration = jest.fn().mockResolvedValue({
        schemaValidation: true,
        dataIntegrity: true,
        healthChecks: true,
        smokeTests: true,
      });
      mockSafeMigrationService.releaseQueueLock = jest.fn().mockResolvedValue(undefined);
    });

    it('should execute full migration with all safeguards', async () => {
      const result = await handler({
        storyId: 'test-story-id',
        confirmMigration: true,
        environment: 'production',
      });

      expect(result.success).toBe(true);
      expect(result.appliedMigrations).toEqual(['20251123_add_user_roles']);
      expect(result.backupFile).toBeDefined();
      expect(result.lockId).toBe('lock-123');
      expect(result.validationResults).toEqual({
        schemaValidation: true,
        dataIntegrity: true,
        healthChecks: true,
        smokeTests: true,
      });
    });

    it('should create pre-migration backup', async () => {
      await handler({
        confirmMigration: true,
      });

      expect(mockSafeMigrationService.createPreMigrationBackup).toHaveBeenCalledWith(
        undefined // no storyId
      );
    });

    it('should verify backup integrity', async () => {
      await handler({
        confirmMigration: true,
      });

      expect(mockSafeMigrationService.verifyBackup).toHaveBeenCalledWith(
        '/backups/vibestudio_premig_20251123_120000.dump'
      );
    });

    it('should acquire queue lock', async () => {
      await handler({
        confirmMigration: true,
        storyId: 'test-story-id',
      });

      expect(mockSafeMigrationService.acquireQueueLock).toHaveBeenCalledWith('test-story-id');
    });

    it('should release queue lock after migration', async () => {
      await handler({
        confirmMigration: true,
      });

      expect(mockSafeMigrationService.releaseQueueLock).toHaveBeenCalledWith('lock-123');
    });
  });

  describe('Handler Function - Error Handling', () => {
    it('should rollback on migration failure', async () => {
      mockSafeMigrationService.checkPendingMigrations = jest.fn().mockResolvedValue([
        '20251123_add_user_roles',
      ]);
      mockSafeMigrationService.createPreMigrationBackup = jest.fn().mockResolvedValue({
        backupFile: '/backups/vibestudio_premig_20251123_120000.dump',
      });
      mockSafeMigrationService.verifyBackup = jest.fn().mockResolvedValue(true);
      mockSafeMigrationService.acquireQueueLock = jest.fn().mockResolvedValue({
        id: 'lock-123',
      });
      mockSafeMigrationService.executeMigration = jest.fn().mockRejectedValue(
        new Error('Migration failed')
      );
      mockSafeMigrationService.rollback = jest.fn().mockResolvedValue(undefined);
      mockSafeMigrationService.releaseQueueLock = jest.fn().mockResolvedValue(undefined);

      const result = await handler({
        confirmMigration: true,
      });

      expect(result.success).toBe(false);
      expect(result.phases.rollback).toBeDefined();
      expect(mockSafeMigrationService.rollback).toHaveBeenCalledWith(
        '/backups/vibestudio_premig_20251123_120000.dump'
      );
    });

    it('should rollback on validation failure', async () => {
      mockSafeMigrationService.checkPendingMigrations = jest.fn().mockResolvedValue([
        '20251123_add_user_roles',
      ]);
      mockSafeMigrationService.createPreMigrationBackup = jest.fn().mockResolvedValue({
        backupFile: '/backups/vibestudio_premig_20251123_120000.dump',
      });
      mockSafeMigrationService.verifyBackup = jest.fn().mockResolvedValue(true);
      mockSafeMigrationService.acquireQueueLock = jest.fn().mockResolvedValue({
        id: 'lock-123',
      });
      mockSafeMigrationService.executeMigration = jest.fn().mockResolvedValue({
        appliedMigrations: ['20251123_add_user_roles'],
      });
      mockSafeMigrationService.validatePostMigration = jest.fn().mockResolvedValue({
        schemaValidation: false, // Validation fails
        dataIntegrity: true,
        healthChecks: true,
        smokeTests: true,
      });
      mockSafeMigrationService.rollback = jest.fn().mockResolvedValue(undefined);

      const result = await handler({
        confirmMigration: true,
      });

      expect(result.success).toBe(false);
      expect(mockSafeMigrationService.rollback).toHaveBeenCalled();
    });

    it('should release lock on error', async () => {
      mockSafeMigrationService.checkPendingMigrations = jest.fn().mockResolvedValue([
        '20251123_add_user_roles',
      ]);
      mockSafeMigrationService.createPreMigrationBackup = jest.fn().mockResolvedValue({
        backupFile: '/backups/vibestudio_premig_20251123_120000.dump',
      });
      mockSafeMigrationService.verifyBackup = jest.fn().mockResolvedValue(true);
      mockSafeMigrationService.acquireQueueLock = jest.fn().mockResolvedValue({
        id: 'lock-123',
      });
      mockSafeMigrationService.executeMigration = jest.fn().mockRejectedValue(
        new Error('Migration failed')
      );
      mockSafeMigrationService.rollback = jest.fn().mockResolvedValue(undefined);
      mockSafeMigrationService.releaseQueueLock = jest.fn().mockResolvedValue(undefined);

      await handler({
        confirmMigration: true,
      });

      expect(mockSafeMigrationService.releaseQueueLock).toHaveBeenCalledWith('lock-123');
    });
  });

  describe('Handler Function - Emergency Flags', () => {
    it('should skip backup when skipBackup is true', async () => {
      mockSafeMigrationService.checkPendingMigrations = jest.fn().mockResolvedValue([
        '20251123_add_user_roles',
      ]);
      mockSafeMigrationService.acquireQueueLock = jest.fn().mockResolvedValue({
        id: 'lock-123',
      });
      mockSafeMigrationService.executeMigration = jest.fn().mockResolvedValue({
        appliedMigrations: ['20251123_add_user_roles'],
      });
      mockSafeMigrationService.releaseQueueLock = jest.fn().mockResolvedValue(undefined);

      const result = await handler({
        confirmMigration: true,
        skipBackup: true,
      });

      expect(result.warnings).toContain(
        '⚠️ WARNING: Skipping pre-migration backup (EMERGENCY MODE)'
      );
      expect(mockSafeMigrationService.createPreMigrationBackup).not.toHaveBeenCalled();
    });

    it('should skip validation when skipValidation is true', async () => {
      mockSafeMigrationService.checkPendingMigrations = jest.fn().mockResolvedValue([
        '20251123_add_user_roles',
      ]);
      mockSafeMigrationService.createPreMigrationBackup = jest.fn().mockResolvedValue({
        backupFile: '/backups/vibestudio_premig_20251123_120000.dump',
      });
      mockSafeMigrationService.verifyBackup = jest.fn().mockResolvedValue(true);
      mockSafeMigrationService.acquireQueueLock = jest.fn().mockResolvedValue({
        id: 'lock-123',
      });
      mockSafeMigrationService.executeMigration = jest.fn().mockResolvedValue({
        appliedMigrations: ['20251123_add_user_roles'],
      });
      mockSafeMigrationService.releaseQueueLock = jest.fn().mockResolvedValue(undefined);

      const result = await handler({
        confirmMigration: true,
        skipValidation: true,
      });

      expect(result.warnings).toContain(
        '⚠️ WARNING: Skipping post-migration validation (EMERGENCY MODE)'
      );
      expect(mockSafeMigrationService.validatePostMigration).not.toHaveBeenCalled();
    });
  });

  describe('Handler Function - Story Tracking', () => {
    it('should include story key in response when storyId provided', async () => {
      mockSafeMigrationService.checkPendingMigrations = jest.fn().mockResolvedValue([]);

      // Mock story lookup
      const mockStoryFindUnique = prisma.story.findUnique as jest.MockedFunction<
        typeof prisma.story.findUnique
      >;
      mockStoryFindUnique.mockResolvedValue({
        id: 'test-story-id',
        key: 'ST-85',
        title: 'Test Story',
      } as any);

      const result = await handler({
        storyId: 'test-story-id',
        dryRun: true,
      });

      expect(result.storyKey).toBe('ST-85');
    });
  });
});
