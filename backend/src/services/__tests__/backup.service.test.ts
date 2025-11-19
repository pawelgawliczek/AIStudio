/**
 * Unit tests for BackupService
 */

import { BackupService } from '../backup.service';
import { BackupType } from '../../types/migration.types';
import { dockerExec } from '../../utils/docker-exec.util';
import * as fs from 'fs/promises';

// Mock dependencies
jest.mock('../../utils/docker-exec.util');
jest.mock('fs/promises');

const mockDockerExec = dockerExec as jest.MockedFunction<typeof dockerExec>;
const mockFs = fs as jest.Mocked<typeof fs>;

describe('BackupService', () => {
  let backupService: BackupService;

  beforeEach(() => {
    backupService = new BackupService();
    jest.clearAllMocks();
  });

  describe('createBackup', () => {
    it('should create backup successfully', async () => {
      mockDockerExec.mockResolvedValue({
        success: true,
        stdout: 'pg_dump completed',
        stderr: '',
        exitCode: 0,
      });
      mockFs.stat = jest.fn().mockResolvedValue({ size: 1024 * 1024 } as any);
      mockFs.writeFile = jest.fn().mockResolvedValue(undefined);

      const result = await backupService.createBackup(BackupType.MANUAL, 'test-context');

      expect(result.type).toBe(BackupType.MANUAL);
      expect(result.context).toBe('test-context');
      expect(result.size).toBeGreaterThan(0);
      expect(result.verified).toBe(false);
    });

    it('should fail if pg_dump fails', async () => {
      mockDockerExec.mockResolvedValue({
        success: false,
        stdout: '',
        stderr: 'pg_dump failed',
        exitCode: 1,
      });

      await expect(
        backupService.createBackup(BackupType.MANUAL, 'test')
      ).rejects.toThrow();
    });

    it('should fail if file is too small', async () => {
      mockDockerExec.mockResolvedValue({
        success: true,
        stdout: 'completed',
        stderr: '',
        exitCode: 0,
      });
      mockFs.stat = jest.fn().mockResolvedValue({ size: 512 } as any); // < 1KB

      await expect(
        backupService.createBackup(BackupType.MANUAL, 'test')
      ).rejects.toThrow();
    });
  });

  describe('verifyBackup', () => {
    it('should verify backup successfully', async () => {
      const backup = {
        filename: 'test.dump',
        filepath: '/backups/test.dump',
        type: BackupType.MANUAL,
        size: 1024 * 1024,
        created: new Date(),
        verified: false,
      };

      mockFs.access = jest.fn().mockResolvedValue(undefined);
      mockFs.stat = jest.fn().mockResolvedValue({ size: 1024 * 1024 } as any);
      mockDockerExec.mockResolvedValue({
        success: true,
        stdout: 'restore test passed',
        stderr: '',
        exitCode: 0,
      });

      const result = await backupService.verifyBackup(backup);

      expect(result.success).toBe(true);
      expect(result.fileExists).toBe(true);
      expect(result.fileSizeValid).toBe(true);
    });

    it('should fail if file does not exist', async () => {
      const backup = {
        filename: 'missing.dump',
        filepath: '/backups/missing.dump',
        type: BackupType.MANUAL,
        size: 1024,
        created: new Date(),
        verified: false,
      };

      mockFs.access = jest.fn().mockRejectedValue(new Error('File not found'));

      const result = await backupService.verifyBackup(backup);

      expect(result.success).toBe(false);
      expect(result.fileExists).toBe(false);
    });

    it('should fail if restore test fails', async () => {
      const backup = {
        filename: 'test.dump',
        filepath: '/backups/test.dump',
        type: BackupType.MANUAL,
        size: 1024 * 1024,
        created: new Date(),
        verified: false,
      };

      mockFs.access = jest.fn().mockResolvedValue(undefined);
      mockFs.stat = jest.fn().mockResolvedValue({ size: 1024 * 1024 } as any);
      mockDockerExec.mockResolvedValue({
        success: false,
        stdout: '',
        stderr: 'restore failed',
        exitCode: 1,
      });

      const result = await backupService.verifyBackup(backup);

      expect(result.success).toBe(false);
      expect(result.sampleRestoreSuccess).toBe(false);
    });
  });

  describe('listBackups', () => {
    it('should list backups with metadata', async () => {
      mockFs.readdir = jest.fn().mockResolvedValue([
        'vibestudio_manual_20251119_120000_test.dump',
        'vibestudio_daily_20251118_020000_auto.dump',
      ] as any);
      mockFs.stat = jest.fn().mockResolvedValue({
        size: 1024 * 1024,
        mtime: new Date(),
      } as any);
      mockFs.readFile = jest.fn().mockResolvedValue(
        JSON.stringify({
          databaseName: 'vibestudio',
          tableCount: 30,
        })
      );

      const result = await backupService.listBackups();

      expect(result.length).toBe(2);
      expect(result[0].type).toBe(BackupType.MANUAL);
      expect(result[1].type).toBe(BackupType.DAILY);
    });
  });

  describe('cleanupOldBackups', () => {
    it('should remove old backups', async () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 100); // 100 days old

      mockFs.readdir = jest.fn().mockResolvedValue([
        'vibestudio_manual_20240101_120000_old.dump',
      ] as any);
      mockFs.stat = jest.fn().mockResolvedValue({
        size: 1024,
        mtime: oldDate,
      } as any);
      mockFs.readFile = jest.fn().mockResolvedValue('{}');
      mockFs.unlink = jest.fn().mockResolvedValue(undefined);

      const result = await backupService.cleanupOldBackups();

      expect(result.deleted).toBeGreaterThan(0);
    });
  });
});
