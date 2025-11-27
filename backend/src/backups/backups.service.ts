import { Injectable, Logger } from '@nestjs/common';

// Import MCP handlers directly
import { handler as getBackupStatusHandler } from '../mcp/servers/operations/get_backup_status';
import { handler as listBackupsHandler } from '../mcp/servers/operations/list_backups';
import { handler as restoreBackupHandler } from '../mcp/servers/operations/restore_backup';
import { handler as runBackupHandler } from '../mcp/servers/operations/run_backup';
import { PrismaService } from '../prisma/prisma.service';
import {
  BackupStatusDto,
  ListBackupsDto,
  RunBackupDto,
  RestoreBackupDto,
} from './dto/backup.dto';

@Injectable()
export class BackupsService {
  private readonly logger = new Logger(BackupsService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Get backup status (uses MCP get_backup_status handler)
   */
  async getStatus(): Promise<BackupStatusDto> {
    try {
      this.logger.log('Fetching backup status');

      const result = await getBackupStatusHandler(this.prisma, {});

      return result as BackupStatusDto;
    } catch (error) {
      this.logger.error('Failed to get backup status', error);
      throw error;
    }
  }

  /**
   * List all backups (uses MCP list_backups handler)
   */
  async listBackups(
    environment?: string,
    limit?: number
  ): Promise<ListBackupsDto> {
    try {
      this.logger.log(`Listing backups (env: ${environment || 'all'}, limit: ${limit || 50})`);

      const result = await listBackupsHandler(this.prisma, {
        environment: (environment as 'production' | 'development' | 'legacy' | 'all') || 'all',
        limit: limit || 50,
      });

      return result as ListBackupsDto;
    } catch (error) {
      this.logger.error('Failed to list backups', error);
      throw error;
    }
  }

  /**
   * Run backup (uses MCP run_backup handler)
   */
  async runBackup(environment: 'production' | 'development'): Promise<RunBackupDto> {
    try {
      this.logger.log(`Creating backup for ${environment}`);

      const result = await runBackupHandler(this.prisma, { environment });

      return result as RunBackupDto;
    } catch (error) {
      this.logger.error(`Failed to create ${environment} backup`, error);
      throw error;
    }
  }

  /**
   * Restore backup (uses MCP restore_backup handler)
   */
  async restoreBackup(
    backupFile: string,
    confirm: boolean
  ): Promise<RestoreBackupDto> {
    try {
      this.logger.warn(`RESTORING BACKUP: ${backupFile} (confirm: ${confirm})`);

      const result = await restoreBackupHandler(this.prisma, {
        backupFile,
        confirm,
      });

      return result as RestoreBackupDto;
    } catch (error) {
      this.logger.error(`Failed to restore backup ${backupFile}`, error);
      throw error;
    }
  }
}
