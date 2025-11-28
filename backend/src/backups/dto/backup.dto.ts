import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsString, IsBoolean, IsOptional } from 'class-validator';

export class BackupStatusDto {
  @ApiProperty()
  production: {
    healthy: boolean;
    lastBackupTime: string | null;
    lastBackupFile: string | null;
    hoursSinceLastBackup: number | null;
    backupCount: number;
    totalSizeMB: number;
    alerts: string[];
  };

  @ApiProperty()
  overallHealth: boolean;

  @ApiProperty()
  lastCheckTime: string;
}

export class BackupInfoDto {
  @ApiProperty()
  filename: string;

  @ApiProperty()
  environment: string;

  @ApiProperty()
  timestamp: string;

  @ApiProperty()
  size: number;

  @ApiProperty()
  sizeMB: number;

  @ApiProperty()
  age: string;

  @ApiProperty()
  ageHours: number;

  @ApiProperty({ nullable: true })
  checksum: string | null;

  @ApiProperty()
  fullPath: string;

  @ApiProperty({ nullable: true })
  createdAt: string | null;
}

export class ListBackupsDto {
  @ApiProperty({ type: [BackupInfoDto] })
  backups: BackupInfoDto[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  byEnvironment: {
    production: number;
    development: number;
    legacy: number;
  };
}

export class RunBackupDto {
  @ApiProperty()
  success: boolean;

  @ApiProperty()
  backupFile: string;

  @ApiProperty()
  backupPath: string;

  @ApiProperty()
  sizeMB: number;

  @ApiProperty()
  duration: number;

  @ApiProperty()
  checksum: string;

  @ApiProperty()
  environment: string;

  @ApiProperty()
  timestamp: string;

  @ApiProperty({ nullable: true })
  error?: string;
}

export class RestoreBackupDto {
  @ApiProperty()
  success: boolean;

  @ApiProperty()
  restoredFrom: string;

  @ApiProperty()
  tablesRestored: number;

  @ApiProperty()
  duration: number;

  @ApiProperty()
  checksumVerified: boolean;

  @ApiProperty({ nullable: true })
  warning?: string;

  @ApiProperty({ nullable: true })
  error?: string;
}

export class CreateBackupRequestDto {
  @ApiProperty({ default: 'production', enum: ['production', 'development'] })
  @IsOptional()
  @IsEnum(['production', 'development'])
  environment?: 'production' | 'development';
}

export class RestoreBackupRequestDto {
  @ApiProperty()
  @IsString()
  backupFile: string;

  @ApiProperty()
  @IsBoolean()
  confirm: boolean;
}
