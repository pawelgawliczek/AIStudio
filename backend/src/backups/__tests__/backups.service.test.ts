import { Test, TestingModule } from '@nestjs/testing';
// Mock the MCP handlers
jest.mock('../../mcp/servers/operations/get_backup_status', () => ({
  handler: jest.fn(),
}));
jest.mock('../../mcp/servers/operations/list_backups', () => ({
  handler: jest.fn(),
}));
jest.mock('../../mcp/servers/operations/run_backup', () => ({
  handler: jest.fn(),
}));
jest.mock('../../mcp/servers/operations/restore_backup', () => ({
  handler: jest.fn(),
}));
import { handler as getBackupStatusHandler } from '../../mcp/servers/operations/get_backup_status';
import { handler as listBackupsHandler } from '../../mcp/servers/operations/list_backups';
import { handler as restoreBackupHandler } from '../../mcp/servers/operations/restore_backup';
import { handler as runBackupHandler } from '../../mcp/servers/operations/run_backup';
import { PrismaService } from '../../prisma/prisma.service';
import { BackupsService } from '../backups.service';

describe('BackupsService', () => {
  let service: BackupsService;
  let prismaService: PrismaService;

  const mockPrismaService = {
    // Mock any necessary prisma methods if needed
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BackupsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<BackupsService>(BackupsService);
    prismaService = module.get<PrismaService>(PrismaService);

    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getStatus', () => {
    it('should call getBackupStatusHandler and return result', async () => {
      const mockStatus = {
        production: {
          healthy: true,
          lastBackupTime: '2024-01-01T10:00:00Z',
          lastBackupFile: 'vibestudio_production_20240101_100000.sql.gz',
          hoursSinceLastBackup: 2.5,
          backupCount: 10,
          totalSizeMB: 150,
          alerts: [],
        },
        development: {
          healthy: true,
          lastBackupTime: '2024-01-01T12:00:00Z',
          lastBackupFile: 'vibestudio_development_20240101_120000.sql.gz',
          hoursSinceLastBackup: 0.5,
          backupCount: 5,
          totalSizeMB: 50,
          alerts: [],
        },
        overallHealth: true,
        lastCheckTime: '2024-01-01T12:30:00Z',
      };

      (getBackupStatusHandler as jest.Mock).mockResolvedValue(mockStatus);

      const result = await service.getStatus();

      expect(result).toEqual(mockStatus);
      expect(getBackupStatusHandler).toHaveBeenCalledWith(prismaService, {});
      expect(getBackupStatusHandler).toHaveBeenCalledTimes(1);
    });

    it('should handle errors and rethrow', async () => {
      const mockError = new Error('Failed to get backup status');
      (getBackupStatusHandler as jest.Mock).mockRejectedValue(mockError);

      await expect(service.getStatus()).rejects.toThrow(mockError);
      expect(getBackupStatusHandler).toHaveBeenCalledWith(prismaService, {});
    });

    it('should return unhealthy status when backups are stale', async () => {
      const mockStatus = {
        production: {
          healthy: false,
          lastBackupTime: '2024-01-01T10:00:00Z',
          lastBackupFile: 'vibestudio_production_20240101_100000.sql.gz',
          hoursSinceLastBackup: 30,
          backupCount: 10,
          totalSizeMB: 150,
          alerts: ['Production backup is stale (30 hours old)'],
        },
        development: {
          healthy: true,
          lastBackupTime: '2024-01-01T12:00:00Z',
          lastBackupFile: 'vibestudio_development_20240101_120000.sql.gz',
          hoursSinceLastBackup: 0.5,
          backupCount: 5,
          totalSizeMB: 50,
          alerts: [],
        },
        overallHealth: false,
        lastCheckTime: '2024-01-01T12:30:00Z',
      };

      (getBackupStatusHandler as jest.Mock).mockResolvedValue(mockStatus);

      const result = await service.getStatus();

      expect(result.overallHealth).toBe(false);
      expect(result.production.healthy).toBe(false);
      expect(result.production.alerts).toContain('Production backup is stale (30 hours old)');
    });
  });

  describe('listBackups', () => {
    it('should call listBackupsHandler with default params', async () => {
      const mockBackups = {
        backups: [
          {
            filename: 'vibestudio_production_20240101_100000.sql.gz',
            environment: 'production',
            timestamp: '2024-01-01T10:00:00Z',
            size: 157286400,
            sizeMB: 150,
            age: '2 hours ago',
            ageHours: 2,
            checksum: 'abc123',
            fullPath: '/opt/stack/backups/production/vibestudio_production_20240101_100000.sql.gz',
            createdAt: '2024-01-01T10:00:00Z',
          },
        ],
        total: 1,
        byEnvironment: {
          production: 1,
          development: 0,
          legacy: 0,
        },
      };

      (listBackupsHandler as jest.Mock).mockResolvedValue(mockBackups);

      const result = await service.listBackups();

      expect(result).toEqual(mockBackups);
      expect(listBackupsHandler).toHaveBeenCalledWith(prismaService, {
        environment: 'all',
        limit: 50,
      });
      expect(listBackupsHandler).toHaveBeenCalledTimes(1);
    });

    it('should call listBackupsHandler with custom environment filter', async () => {
      const mockBackups = {
        backups: [],
        total: 0,
        byEnvironment: {
          production: 5,
          development: 0,
          legacy: 0,
        },
      };

      (listBackupsHandler as jest.Mock).mockResolvedValue(mockBackups);

      const result = await service.listBackups('production', undefined);

      expect(result).toEqual(mockBackups);
      expect(listBackupsHandler).toHaveBeenCalledWith(prismaService, {
        environment: 'production',
        limit: 50,
      });
    });

    it('should call listBackupsHandler with custom limit', async () => {
      const mockBackups = {
        backups: [],
        total: 0,
        byEnvironment: {
          production: 10,
          development: 10,
          legacy: 0,
        },
      };

      (listBackupsHandler as jest.Mock).mockResolvedValue(mockBackups);

      const result = await service.listBackups('all', 100);

      expect(result).toEqual(mockBackups);
      expect(listBackupsHandler).toHaveBeenCalledWith(prismaService, {
        environment: 'all',
        limit: 100,
      });
    });

    it('should handle development environment filter', async () => {
      const mockBackups = {
        backups: [
          {
            filename: 'vibestudio_development_20240101_100000.sql.gz',
            environment: 'development',
            timestamp: '2024-01-01T10:00:00Z',
            size: 52428800,
            sizeMB: 50,
            age: '1 hour ago',
            ageHours: 1,
            checksum: 'def456',
            fullPath: '/opt/stack/backups/development/vibestudio_development_20240101_100000.sql.gz',
            createdAt: '2024-01-01T10:00:00Z',
          },
        ],
        total: 1,
        byEnvironment: {
          production: 0,
          development: 1,
          legacy: 0,
        },
      };

      (listBackupsHandler as jest.Mock).mockResolvedValue(mockBackups);

      const result = await service.listBackups('development', 20);

      expect(result).toEqual(mockBackups);
      expect(listBackupsHandler).toHaveBeenCalledWith(prismaService, {
        environment: 'development',
        limit: 20,
      });
    });

    it('should handle errors and rethrow', async () => {
      const mockError = new Error('Failed to list backups');
      (listBackupsHandler as jest.Mock).mockRejectedValue(mockError);

      await expect(service.listBackups()).rejects.toThrow(mockError);
      expect(listBackupsHandler).toHaveBeenCalledWith(prismaService, {
        environment: 'all',
        limit: 50,
      });
    });
  });

  describe('runBackup', () => {
    it('should call runBackupHandler for production environment', async () => {
      const mockResult = {
        success: true,
        backupFile: 'vibestudio_production_20240101_120000.sql.gz',
        backupPath: '/opt/stack/backups/production/vibestudio_production_20240101_120000.sql.gz',
        sizeMB: 155.5,
        duration: 12.5,
        checksum: 'abc123def456',
        environment: 'production',
        timestamp: '2024-01-01T12:00:00Z',
      };

      (runBackupHandler as jest.Mock).mockResolvedValue(mockResult);

      const result = await service.runBackup('production');

      expect(result).toEqual(mockResult);
      expect(runBackupHandler).toHaveBeenCalledWith(prismaService, {
        environment: 'production',
      });
      expect(runBackupHandler).toHaveBeenCalledTimes(1);
    });

    it('should call runBackupHandler for development environment', async () => {
      const mockResult = {
        success: true,
        backupFile: 'vibestudio_development_20240101_120000.sql.gz',
        backupPath: '/opt/stack/backups/development/vibestudio_development_20240101_120000.sql.gz',
        sizeMB: 52.3,
        duration: 5.2,
        checksum: 'xyz789abc123',
        environment: 'development',
        timestamp: '2024-01-01T12:00:00Z',
      };

      (runBackupHandler as jest.Mock).mockResolvedValue(mockResult);

      const result = await service.runBackup('development');

      expect(result).toEqual(mockResult);
      expect(runBackupHandler).toHaveBeenCalledWith(prismaService, {
        environment: 'development',
      });
    });

    it('should handle backup failure', async () => {
      const mockResult = {
        success: false,
        backupFile: '',
        backupPath: '',
        sizeMB: 0,
        duration: 0,
        checksum: '',
        environment: 'production',
        timestamp: '2024-01-01T12:00:00Z',
        error: 'Failed to create backup: disk full',
      };

      (runBackupHandler as jest.Mock).mockResolvedValue(mockResult);

      const result = await service.runBackup('production');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to create backup: disk full');
    });

    it('should handle errors and rethrow', async () => {
      const mockError = new Error('Backup process crashed');
      (runBackupHandler as jest.Mock).mockRejectedValue(mockError);

      await expect(service.runBackup('production')).rejects.toThrow(mockError);
      expect(runBackupHandler).toHaveBeenCalledWith(prismaService, {
        environment: 'production',
      });
    });
  });

  describe('restoreBackup', () => {
    it('should call restoreBackupHandler with confirm=true', async () => {
      const mockResult = {
        success: true,
        restoredFrom: 'vibestudio_production_20240101_100000.sql.gz',
        tablesRestored: 25,
        duration: 30.5,
        checksumVerified: true,
      };

      (restoreBackupHandler as jest.Mock).mockResolvedValue(mockResult);

      const result = await service.restoreBackup(
        'vibestudio_production_20240101_100000.sql.gz',
        true
      );

      expect(result).toEqual(mockResult);
      expect(restoreBackupHandler).toHaveBeenCalledWith(prismaService, {
        backupFile: 'vibestudio_production_20240101_100000.sql.gz',
        confirm: true,
      });
      expect(restoreBackupHandler).toHaveBeenCalledTimes(1);
    });

    it('should fail when confirm=false', async () => {
      const mockResult = {
        success: false,
        restoredFrom: '',
        tablesRestored: 0,
        duration: 0,
        checksumVerified: false,
        error: 'Restore confirmation required',
      };

      (restoreBackupHandler as jest.Mock).mockResolvedValue(mockResult);

      const result = await service.restoreBackup(
        'vibestudio_production_20240101_100000.sql.gz',
        false
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Restore confirmation required');
    });

    it('should handle restore with checksum warning', async () => {
      const mockResult = {
        success: true,
        restoredFrom: 'vibestudio_production_20240101_100000.sql.gz',
        tablesRestored: 25,
        duration: 30.5,
        checksumVerified: false,
        warning: 'Checksum verification failed - backup may be corrupted',
      };

      (restoreBackupHandler as jest.Mock).mockResolvedValue(mockResult);

      const result = await service.restoreBackup(
        'vibestudio_production_20240101_100000.sql.gz',
        true
      );

      expect(result.checksumVerified).toBe(false);
      expect(result.warning).toContain('Checksum verification failed');
    });

    it('should handle restore failure', async () => {
      const mockResult = {
        success: false,
        restoredFrom: 'vibestudio_production_20240101_100000.sql.gz',
        tablesRestored: 0,
        duration: 5.2,
        checksumVerified: false,
        error: 'Database connection failed during restore',
      };

      (restoreBackupHandler as jest.Mock).mockResolvedValue(mockResult);

      const result = await service.restoreBackup(
        'vibestudio_production_20240101_100000.sql.gz',
        true
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Database connection failed during restore');
    });

    it('should handle errors and rethrow', async () => {
      const mockError = new Error('Restore process crashed');
      (restoreBackupHandler as jest.Mock).mockRejectedValue(mockError);

      await expect(
        service.restoreBackup('vibestudio_production_20240101_100000.sql.gz', true)
      ).rejects.toThrow(mockError);
      expect(restoreBackupHandler).toHaveBeenCalledWith(prismaService, {
        backupFile: 'vibestudio_production_20240101_100000.sql.gz',
        confirm: true,
      });
    });

    it('should handle backup file not found', async () => {
      const mockResult = {
        success: false,
        restoredFrom: 'nonexistent_backup.sql.gz',
        tablesRestored: 0,
        duration: 0,
        checksumVerified: false,
        error: 'Backup file not found',
      };

      (restoreBackupHandler as jest.Mock).mockResolvedValue(mockResult);

      const result = await service.restoreBackup('nonexistent_backup.sql.gz', true);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Backup file not found');
    });
  });
});
