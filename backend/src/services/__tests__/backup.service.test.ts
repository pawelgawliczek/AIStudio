/**
 * Unit tests for BackupService
 */

import { BackupService } from '../backup.service';
import { execDockerCommand } from '../../utils/docker-exec.util';
import { fileExists, getFileSize, readJsonFile } from '../../utils/file-system.util';

// Mock dependencies
jest.mock('../../utils/docker-exec.util');
jest.mock('../../utils/file-system.util');

const mockExecDockerCommand = execDockerCommand as jest.MockedFunction<typeof execDockerCommand>;
const mockFileExists = fileExists as jest.MockedFunction<typeof fileExists>;
const mockGetFileSize = getFileSize as jest.MockedFunction<typeof getFileSize>;
const mockReadJsonFile = readJsonFile as jest.MockedFunction<typeof readJsonFile>;

describe('BackupService', () => {
  let backupService: BackupService;

  beforeEach(() => {
    backupService = new BackupService();
    jest.clearAllMocks();
  });

  describe('createBackup', () => {
    it('should create backup successfully', async () => {
      // Mock successful backup creation
      mockExecDockerCommand.mockResolvedValue('pg_dump completed');
      mockFileExists.mockResolvedValue(true);
      mockGetFileSize.mockResolvedValue(1024 * 1024); // 1MB

      const result = await backupService.createBackup('manual', 'ST-70');

      expect(result.success).toBe(true);
      expect(result.backupPath).toContain('vibestudio_');
      expect(result.backupPath).toContain('.dump');
      expect(result.metadata.type).toBe('manual');
      expect(result.metadata.context).toBe('ST-70');
    });

    it('should fail if backup file not created', async () => {
      mockExecDockerCommand.mockResolvedValue('pg_dump completed');
      mockFileExists.mockResolvedValue(false);

      await expect(backupService.createBackup('manual', 'ST-70')).rejects.toThrow(
        'Backup file was not created'
      );
    });

    it('should fail if backup file too small', async () => {
      mockExecDockerCommand.mockResolvedValue('pg_dump completed');
      mockFileExists.mockResolvedValue(true);
      mockGetFileSize.mockResolvedValue(100); // Only 100 bytes

      await expect(backupService.createBackup('manual', 'ST-70')).rejects.toThrow(
        'Backup file is suspiciously small'
      );
    });

    it('should include proper timestamp in filename', async () => {
      mockExecDockerCommand.mockResolvedValue('pg_dump completed');
      mockFileExists.mockResolvedValue(true);
      mockGetFileSize.mockResolvedValue(1024 * 1024);

      const result = await backupService.createBackup('pre-migration', 'ST-70');

      expect(result.backupPath).toMatch(/vibestudio_premig_\d{8}_\d{6}_ST-70\.dump/);
    });
  });

  describe('verifyBackup', () => {
    it('should verify backup successfully', async () => {
      mockFileExists.mockResolvedValue(true);
      mockGetFileSize.mockResolvedValue(2 * 1024 * 1024); // 2MB
      mockExecDockerCommand.mockResolvedValue('pg_restore succeeded');

      const result = await backupService.verifyBackup('/backups/test.dump');

      expect(result.valid).toBe(true);
      expect(result.fileExists).toBe(true);
      expect(result.fileSize).toBe(2097152);
    });

    it('should fail if file does not exist', async () => {
      mockFileExists.mockResolvedValue(false);

      const result = await backupService.verifyBackup('/backups/missing.dump');

      expect(result.valid).toBe(false);
      expect(result.fileExists).toBe(false);
    });

    it('should fail if restore test fails', async () => {
      mockFileExists.mockResolvedValue(true);
      mockGetFileSize.mockResolvedValue(1024 * 1024);
      mockExecDockerCommand.mockRejectedValue(new Error('pg_restore failed'));

      const result = await backupService.verifyBackup('/backups/test.dump');

      expect(result.valid).toBe(false);
      expect(result.restoreTest).toBe(false);
      expect(result.error).toContain('pg_restore failed');
    });
  });

  describe('listBackups', () => {
    it('should list backups with metadata', async () => {
      // Mock file system calls
      const mockBackups = [
        'vibestudio_premig_20251119_100000_ST-70.dump',
        'vibestudio_manual_20251118_143000_ST-69.dump',
      ];

      // Mock glob results
      jest.spyOn(require('glob'), 'sync').mockReturnValue(
        mockBackups.map((f) => `/backups/${f}`)
      );

      mockGetFileSize.mockResolvedValue(5 * 1024 * 1024); // 5MB
      mockReadJsonFile.mockResolvedValue({
        type: 'pre-migration',
        context: 'ST-70',
        timestamp: '2025-11-19T10:00:00.000Z',
      });

      const result = await backupService.listBackups();

      expect(result.length).toBe(2);
      expect(result[0].filename).toContain('premig');
    });
  });

  describe('cleanupOldBackups', () => {
    it('should remove backups older than retention period', async () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 100); // 100 days ago

      const mockBackups = [
        {
          filename: 'vibestudio_premig_20240815_100000_ST-1.dump',
          path: '/backups/vibestudio_premig_20240815_100000_ST-1.dump',
          created: oldDate,
          type: 'pre-migration' as const,
          size: 1024 * 1024,
        },
      ];

      jest.spyOn(backupService, 'listBackups').mockResolvedValue(mockBackups);
      jest.spyOn(require('fs').promises, 'unlink').mockResolvedValue(undefined);

      const result = await backupService.cleanupOldBackups();

      expect(result.removed).toBeGreaterThan(0);
      expect(result.backupsRemoved[0]).toContain('ST-1');
    });
  });
});
