import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiBody,
} from '@nestjs/swagger';
import { RolesGuard } from '../auth/guards/roles.guard';
import { BackupsService } from './backups.service';
import {
  BackupStatusDto,
  ListBackupsDto,
  RunBackupDto,
  RestoreBackupDto,
  CreateBackupRequestDto,
  RestoreBackupRequestDto,
} from './dto/backup.dto';

@ApiTags('backups')
@Controller('backups')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@ApiBearerAuth()
export class BackupsController {
  constructor(private readonly backupsService: BackupsService) {}

  @Get('status')
  @ApiOperation({ summary: 'Get backup health status' })
  @ApiResponse({ status: 200, description: 'Return backup status', type: BackupStatusDto })
  getStatus(): Promise<BackupStatusDto> {
    return this.backupsService.getStatus();
  }

  @Get()
  @ApiOperation({ summary: 'List all backups with filters' })
  @ApiResponse({ status: 200, description: 'Return list of backups', type: ListBackupsDto })
  @ApiQuery({ name: 'environment', required: false, enum: ['production', 'development', 'legacy', 'all'] })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  listBackups(
    @Query('environment') environment?: string,
    @Query('limit') limit?: string
  ): Promise<ListBackupsDto> {
    return this.backupsService.listBackups(
      environment,
      limit ? parseInt(limit, 10) : undefined
    );
  }

  @Post('run')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new backup' })
  @ApiResponse({ status: 201, description: 'Backup created successfully', type: RunBackupDto })
  @ApiBody({ type: CreateBackupRequestDto })
  runBackup(@Body() body: CreateBackupRequestDto): Promise<RunBackupDto> {
    return this.backupsService.runBackup(body.environment || 'production');
  }

  @Post('restore')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Restore from backup (DESTRUCTIVE)' })
  @ApiResponse({ status: 200, description: 'Backup restored successfully', type: RestoreBackupDto })
  @ApiBody({ type: RestoreBackupRequestDto })
  restoreBackup(@Body() body: RestoreBackupRequestDto): Promise<RestoreBackupDto> {
    return this.backupsService.restoreBackup(body.backupFile, body.confirm);
  }
}
