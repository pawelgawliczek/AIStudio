import { Test, TestingModule } from '@nestjs/testing';
import { BackupsController } from '../backups.controller';
import { BackupsService } from '../backups.service';
import {
  BackupStatusDto,
  ListBackupsDto,
  RunBackupDto,
  RestoreBackupDto,
  CreateBackupRequestDto,
  RestoreBackupRequestDto,
} from '../dto/backup.dto';

describe('BackupsController', () => {
  let controller: BackupsController;
  let backupsService: BackupsService;

  const mockBackupStatus: BackupStatusDto = {
    production: {
      healthy: true,
      lastBackupTime: '2024-01-01T10:00:00Z',
      lastBackupFile: 'vibestudio_production_20240101_100000.sql.gz',
      hoursSinceLastBackup: 2.5,
      backupCount: 10,
      totalSizeMB: 150,
      alerts: [],
    },
    overallHealth: true,
    lastCheckTime: '2024-01-01T12:30:00Z',
  };

  const mockListBackups: ListBackupsDto = {
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
      {
        filename: 'vibestudio_production_20240101_080000.sql.gz',
        environment: 'production',
        timestamp: '2024-01-01T08:00:00Z',
        size: 157286400,
        sizeMB: 150,
        age: '4 hours ago',
        ageHours: 4,
        checksum: 'def456',
        fullPath: '/opt/stack/backups/production/vibestudio_production_20240101_080000.sql.gz',
        createdAt: '2024-01-01T08:00:00Z',
      },
    ],
    total: 2,
    byEnvironment: {
      production: 2,
      development: 0,
      legacy: 0,
    },
  };

  const mockRunBackup: RunBackupDto = {
    success: true,
    backupFile: 'vibestudio_production_20240101_120000.sql.gz',
    backupPath: '/opt/stack/backups/production/vibestudio_production_20240101_120000.sql.gz',
    sizeMB: 155.5,
    duration: 12.5,
    checksum: 'abc123def456',
    environment: 'production',
    timestamp: '2024-01-01T12:00:00Z',
  };

  const mockRestoreBackup: RestoreBackupDto = {
    success: true,
    restoredFrom: 'vibestudio_production_20240101_100000.sql.gz',
    tablesRestored: 25,
    duration: 30.5,
    checksumVerified: true,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BackupsController],
      providers: [
        {
          provide: BackupsService,
          useValue: {
            getStatus: jest.fn(),
            listBackups: jest.fn(),
            runBackup: jest.fn(),
            restoreBackup: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<BackupsController>(BackupsController);
    backupsService = module.get<BackupsService>(BackupsService);

    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('GET /backups/status', () => {
    it('should return backup status', async () => {
      jest.spyOn(backupsService, 'getStatus').mockResolvedValue(mockBackupStatus);

      const result = await controller.getStatus();

      expect(result).toEqual(mockBackupStatus);
      expect(backupsService.getStatus).toHaveBeenCalledTimes(1);
    });

    it('should return unhealthy status when backups are stale', async () => {
      const unhealthyStatus: BackupStatusDto = {
        production: {
          healthy: false,
          lastBackupTime: '2024-01-01T10:00:00Z',
          lastBackupFile: 'vibestudio_production_20240101_100000.sql.gz',
          hoursSinceLastBackup: 30,
          backupCount: 10,
          totalSizeMB: 150,
          alerts: ['Production backup is stale (30 hours old)'],
        },
        overallHealth: false,
        lastCheckTime: '2024-01-01T12:30:00Z',
      };

      jest.spyOn(backupsService, 'getStatus').mockResolvedValue(unhealthyStatus);

      const result = await controller.getStatus();

      expect(result.overallHealth).toBe(false);
      expect(result.production.healthy).toBe(false);
      expect(result.production.alerts).toHaveLength(1);
    });

    it('should propagate errors from service', async () => {
      const error = new Error('Failed to get backup status');
      jest.spyOn(backupsService, 'getStatus').mockRejectedValue(error);

      await expect(controller.getStatus()).rejects.toThrow(error);
    });
  });

  describe('GET /backups', () => {
    it('should list all backups with default params', async () => {
      jest.spyOn(backupsService, 'listBackups').mockResolvedValue(mockListBackups);

      const result = await controller.listBackups();

      expect(result).toEqual(mockListBackups);
      expect(backupsService.listBackups).toHaveBeenCalledWith(undefined, undefined);
      expect(backupsService.listBackups).toHaveBeenCalledTimes(1);
    });

    it('should filter by environment', async () => {
      const productionBackups: ListBackupsDto = {
        ...mockListBackups,
        byEnvironment: { production: 2, development: 0, legacy: 0 },
      };

      jest.spyOn(backupsService, 'listBackups').mockResolvedValue(productionBackups);

      const result = await controller.listBackups('production');

      expect(result).toEqual(productionBackups);
      expect(backupsService.listBackups).toHaveBeenCalledWith('production', undefined);
    });

    it('should filter by development environment', async () => {
      const devBackups: ListBackupsDto = {
        backups: [
          {
            filename: 'vibestudio_development_20240101_100000.sql.gz',
            environment: 'development',
            timestamp: '2024-01-01T10:00:00Z',
            size: 52428800,
            sizeMB: 50,
            age: '1 hour ago',
            ageHours: 1,
            checksum: 'dev123',
            fullPath: '/opt/stack/backups/development/vibestudio_development_20240101_100000.sql.gz',
            createdAt: '2024-01-01T10:00:00Z',
          },
        ],
        total: 1,
        byEnvironment: { production: 0, development: 1, legacy: 0 },
      };

      jest.spyOn(backupsService, 'listBackups').mockResolvedValue(devBackups);

      const result = await controller.listBackups('development');

      expect(result).toEqual(devBackups);
      expect(backupsService.listBackups).toHaveBeenCalledWith('development', undefined);
    });

    it('should apply limit parameter', async () => {
      jest.spyOn(backupsService, 'listBackups').mockResolvedValue(mockListBackups);

      const result = await controller.listBackups(undefined, '10');

      expect(result).toEqual(mockListBackups);
      expect(backupsService.listBackups).toHaveBeenCalledWith(undefined, 10);
    });

    it('should combine environment and limit filters', async () => {
      jest.spyOn(backupsService, 'listBackups').mockResolvedValue(mockListBackups);

      const result = await controller.listBackups('production', '5');

      expect(result).toEqual(mockListBackups);
      expect(backupsService.listBackups).toHaveBeenCalledWith('production', 5);
    });

    it('should handle legacy backups filter', async () => {
      const legacyBackups: ListBackupsDto = {
        backups: [
          {
            filename: 'vibestudio_20231201_100000.sql.gz',
            environment: 'legacy',
            timestamp: '2023-12-01T10:00:00Z',
            size: 104857600,
            sizeMB: 100,
            age: '60 days ago',
            ageHours: 1440,
            checksum: 'legacy123',
            fullPath: '/opt/stack/backups/vibestudio_20231201_100000.sql.gz',
            createdAt: null,
          },
        ],
        total: 1,
        byEnvironment: { production: 0, development: 0, legacy: 1 },
      };

      jest.spyOn(backupsService, 'listBackups').mockResolvedValue(legacyBackups);

      const result = await controller.listBackups('legacy');

      expect(result).toEqual(legacyBackups);
      expect(backupsService.listBackups).toHaveBeenCalledWith('legacy', undefined);
    });

    it('should return empty list when no backups exist', async () => {
      const emptyBackups: ListBackupsDto = {
        backups: [],
        total: 0,
        byEnvironment: { production: 0, development: 0, legacy: 0 },
      };

      jest.spyOn(backupsService, 'listBackups').mockResolvedValue(emptyBackups);

      const result = await controller.listBackups();

      expect(result.backups).toHaveLength(0);
      expect(result.total).toBe(0);
    });

    it('should propagate errors from service', async () => {
      const error = new Error('Failed to list backups');
      jest.spyOn(backupsService, 'listBackups').mockRejectedValue(error);

      await expect(controller.listBackups()).rejects.toThrow(error);
    });
  });

  describe('POST /backups/run', () => {
    it('should create a production backup by default', async () => {
      jest.spyOn(backupsService, 'runBackup').mockResolvedValue(mockRunBackup);

      const body: CreateBackupRequestDto = { environment: 'production' };
      const result = await controller.runBackup(body);

      expect(result).toEqual(mockRunBackup);
      expect(backupsService.runBackup).toHaveBeenCalledWith('production');
      expect(backupsService.runBackup).toHaveBeenCalledTimes(1);
    });

    it('should create a development backup when specified', async () => {
      const devBackup: RunBackupDto = {
        ...mockRunBackup,
        backupFile: 'vibestudio_development_20240101_120000.sql.gz',
        environment: 'development',
        sizeMB: 52.3,
      };

      jest.spyOn(backupsService, 'runBackup').mockResolvedValue(devBackup);

      const body: CreateBackupRequestDto = { environment: 'development' };
      const result = await controller.runBackup(body);

      expect(result).toEqual(devBackup);
      expect(backupsService.runBackup).toHaveBeenCalledWith('development');
    });

    it('should default to production when environment not specified', async () => {
      jest.spyOn(backupsService, 'runBackup').mockResolvedValue(mockRunBackup);

      const body = {} as CreateBackupRequestDto;
      const result = await controller.runBackup(body);

      expect(result).toEqual(mockRunBackup);
      expect(backupsService.runBackup).toHaveBeenCalledWith('production');
    });

    it('should handle backup failure', async () => {
      const failedBackup: RunBackupDto = {
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

      jest.spyOn(backupsService, 'runBackup').mockResolvedValue(failedBackup);

      const body: CreateBackupRequestDto = { environment: 'production' };
      const result = await controller.runBackup(body);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should propagate errors from service', async () => {
      const error = new Error('Backup process crashed');
      jest.spyOn(backupsService, 'runBackup').mockRejectedValue(error);

      const body: CreateBackupRequestDto = { environment: 'production' };
      await expect(controller.runBackup(body)).rejects.toThrow(error);
    });
  });

  describe('POST /backups/restore', () => {
    it('should restore from backup with confirmation', async () => {
      jest.spyOn(backupsService, 'restoreBackup').mockResolvedValue(mockRestoreBackup);

      const body: RestoreBackupRequestDto = {
        backupFile: 'vibestudio_production_20240101_100000.sql.gz',
        confirm: true,
      };
      const result = await controller.restoreBackup(body);

      expect(result).toEqual(mockRestoreBackup);
      expect(backupsService.restoreBackup).toHaveBeenCalledWith(
        'vibestudio_production_20240101_100000.sql.gz',
        true
      );
      expect(backupsService.restoreBackup).toHaveBeenCalledTimes(1);
    });

    it('should fail restore without confirmation', async () => {
      const failedRestore: RestoreBackupDto = {
        success: false,
        restoredFrom: '',
        tablesRestored: 0,
        duration: 0,
        checksumVerified: false,
        error: 'Restore confirmation required',
      };

      jest.spyOn(backupsService, 'restoreBackup').mockResolvedValue(failedRestore);

      const body: RestoreBackupRequestDto = {
        backupFile: 'vibestudio_production_20240101_100000.sql.gz',
        confirm: false,
      };
      const result = await controller.restoreBackup(body);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Restore confirmation required');
    });

    it('should restore development backup', async () => {
      const devRestore: RestoreBackupDto = {
        success: true,
        restoredFrom: 'vibestudio_development_20240101_100000.sql.gz',
        tablesRestored: 25,
        duration: 15.3,
        checksumVerified: true,
      };

      jest.spyOn(backupsService, 'restoreBackup').mockResolvedValue(devRestore);

      const body: RestoreBackupRequestDto = {
        backupFile: 'vibestudio_development_20240101_100000.sql.gz',
        confirm: true,
      };
      const result = await controller.restoreBackup(body);

      expect(result).toEqual(devRestore);
      expect(backupsService.restoreBackup).toHaveBeenCalledWith(
        'vibestudio_development_20240101_100000.sql.gz',
        true
      );
    });

    it('should handle checksum verification warning', async () => {
      const restoreWithWarning: RestoreBackupDto = {
        success: true,
        restoredFrom: 'vibestudio_production_20240101_100000.sql.gz',
        tablesRestored: 25,
        duration: 30.5,
        checksumVerified: false,
        warning: 'Checksum verification failed - backup may be corrupted',
      };

      jest.spyOn(backupsService, 'restoreBackup').mockResolvedValue(restoreWithWarning);

      const body: RestoreBackupRequestDto = {
        backupFile: 'vibestudio_production_20240101_100000.sql.gz',
        confirm: true,
      };
      const result = await controller.restoreBackup(body);

      expect(result.checksumVerified).toBe(false);
      expect(result.warning).toContain('Checksum verification failed');
    });

    it('should handle restore failure', async () => {
      const failedRestore: RestoreBackupDto = {
        success: false,
        restoredFrom: 'vibestudio_production_20240101_100000.sql.gz',
        tablesRestored: 0,
        duration: 5.2,
        checksumVerified: false,
        error: 'Database connection failed during restore',
      };

      jest.spyOn(backupsService, 'restoreBackup').mockResolvedValue(failedRestore);

      const body: RestoreBackupRequestDto = {
        backupFile: 'vibestudio_production_20240101_100000.sql.gz',
        confirm: true,
      };
      const result = await controller.restoreBackup(body);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle backup file not found', async () => {
      const notFoundRestore: RestoreBackupDto = {
        success: false,
        restoredFrom: 'nonexistent_backup.sql.gz',
        tablesRestored: 0,
        duration: 0,
        checksumVerified: false,
        error: 'Backup file not found',
      };

      jest.spyOn(backupsService, 'restoreBackup').mockResolvedValue(notFoundRestore);

      const body: RestoreBackupRequestDto = {
        backupFile: 'nonexistent_backup.sql.gz',
        confirm: true,
      };
      const result = await controller.restoreBackup(body);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Backup file not found');
    });

    it('should propagate errors from service', async () => {
      const error = new Error('Restore process crashed');
      jest.spyOn(backupsService, 'restoreBackup').mockRejectedValue(error);

      const body: RestoreBackupRequestDto = {
        backupFile: 'vibestudio_production_20240101_100000.sql.gz',
        confirm: true,
      };
      await expect(controller.restoreBackup(body)).rejects.toThrow(error);
    });
  });
});
