/**
 * Tests for preview_migration tool
 * ST-85: Safe Migration MCP Tools & Permission Enforcement
 */

import { handler, tool } from '../preview_migration';
import { SafeMigrationService } from '../../../../services/safe-migration.service';

// Mock SafeMigrationService
jest.mock('../../../../services/safe-migration.service');

describe('preview_migration', () => {
  let mockSafeMigrationService: jest.Mocked<SafeMigrationService>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockSafeMigrationService = new SafeMigrationService() as jest.Mocked<SafeMigrationService>;
  });

  describe('Tool Definition', () => {
    it('should have correct tool name', () => {
      expect(tool.name).toBe('preview_migration');
    });

    it('should have no required parameters', () => {
      expect(tool.inputSchema.required).toEqual([]);
    });

    it('should be a read-only operation', () => {
      expect(tool.description).toContain('Preview pending');
      expect(tool.description).toContain('without applying');
    });
  });

  describe('Handler Function', () => {
    it('should return pending migrations', async () => {
      mockSafeMigrationService.checkPendingMigrations = jest.fn().mockResolvedValue([
        '20251123_add_user_roles',
        '20251123_update_story_status',
      ]);

      const result = await handler({});

      expect(result.success).toBe(true);
      expect(result.pendingMigrations).toEqual([
        '20251123_add_user_roles',
        '20251123_update_story_status',
      ]);
      expect(result.migrationCount).toBe(2);
      expect(result.message).toContain('2 pending migration(s)');
    });

    it('should handle no pending migrations', async () => {
      mockSafeMigrationService.checkPendingMigrations = jest.fn().mockResolvedValue([]);

      const result = await handler({});

      expect(result.success).toBe(true);
      expect(result.pendingMigrations).toEqual([]);
      expect(result.migrationCount).toBe(0);
      expect(result.message).toContain('No pending migrations');
    });

    it('should handle errors gracefully', async () => {
      mockSafeMigrationService.checkPendingMigrations = jest.fn().mockRejectedValue(
        new Error('Database connection failed')
      );

      const result = await handler({});

      expect(result.success).toBe(false);
      expect(result.pendingMigrations).toEqual([]);
      expect(result.migrationCount).toBe(0);
      expect(result.message).toContain('Failed to check pending migrations');
    });

    it('should list migration names in message', async () => {
      mockSafeMigrationService.checkPendingMigrations = jest.fn().mockResolvedValue([
        '20251123_add_user_roles',
      ]);

      const result = await handler({});

      expect(result.message).toContain('20251123_add_user_roles');
    });
  });
});
