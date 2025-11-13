import { IsBoolean, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ActivateWorkflowDto {
  @ApiProperty({
    description: 'Force overwrite existing files without confirmation',
    required: false,
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  forceOverwrite?: boolean;

  @ApiProperty({
    description: 'Skip backing up existing files',
    required: false,
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  skipBackup?: boolean;

  @ApiProperty({
    description: 'Project root path (defaults to current directory)',
    required: false,
  })
  @IsString()
  @IsOptional()
  projectRoot?: string;
}

export class DeactivateWorkflowDto {
  @ApiProperty({
    description: 'Keep generated files on disk',
    required: false,
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  keepFiles?: boolean;
}

export class ActivationResponseDto {
  @ApiProperty({ description: 'Whether activation was successful' })
  success: boolean;

  @ApiProperty({ description: 'List of files generated', type: [String] })
  filesGenerated: string[];

  @ApiProperty({ description: 'Files that had conflicts', type: [String], required: false })
  conflicts?: string[];

  @ApiProperty({ description: 'Location of backup files', required: false })
  backupLocation?: string;

  @ApiProperty({ description: 'Activation record ID' })
  activationId: string;

  @ApiProperty({ description: 'Workflow version activated' })
  version: string;
}

export class DeactivationResponseDto {
  @ApiProperty({ description: 'Whether deactivation was successful' })
  success: boolean;

  @ApiProperty({ description: 'List of files removed', type: [String] })
  filesRemoved: string[];

  @ApiProperty({ description: 'Workflow ID that was deactivated' })
  workflowId: string;

  @ApiProperty({ description: 'Timestamp when deactivated' })
  deactivatedAt: string;
}

export class SyncResponseDto {
  @ApiProperty({ description: 'Whether sync was successful' })
  success: boolean;

  @ApiProperty({ description: 'Whether files were actually updated' })
  updated: boolean;

  @ApiProperty({ description: 'Previous version' })
  previousVersion: string;

  @ApiProperty({ description: 'New version after sync' })
  newVersion: string;

  @ApiProperty({ description: 'Files that were updated', type: [String] })
  filesUpdated: string[];

  @ApiProperty({ description: 'Summary of changes', type: [String] })
  changes: string[];
}

export class ActiveWorkflowResponseDto {
  @ApiProperty({ description: 'Workflow ID', required: false })
  workflowId?: string;

  @ApiProperty({ description: 'Workflow name', required: false })
  workflowName?: string;

  @ApiProperty({ description: 'Current version', required: false })
  version?: string;

  @ApiProperty({ description: 'When it was activated', required: false })
  activatedAt?: string;

  @ApiProperty({ description: 'Generated files', type: [String], required: false })
  filesGenerated?: string[];

  @ApiProperty({ description: 'Auto-sync enabled', required: false })
  autoSync?: boolean;

  @ApiProperty({ description: 'Current status', required: false })
  status?: string;
}
