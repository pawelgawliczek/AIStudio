import { IsString, IsOptional, IsInt, IsBoolean, IsEnum, IsDateString, Min, IsObject } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum RunOrigin {
  mcp = 'mcp',
  cli = 'cli',
  api = 'api',
  webhook = 'webhook',
}

export class CreateRunDto {
  @ApiProperty({ description: 'Project ID' })
  @IsString()
  projectId: string;

  @ApiPropertyOptional({ description: 'Story ID (optional)' })
  @IsOptional()
  @IsString()
  storyId?: string;

  @ApiPropertyOptional({ description: 'Subtask ID (optional)' })
  @IsOptional()
  @IsString()
  subtaskId?: string;

  @ApiPropertyOptional({ description: 'Agent ID (optional)' })
  @IsOptional()
  @IsString()
  agentId?: string;

  @ApiPropertyOptional({ description: 'Framework ID (optional)' })
  @IsOptional()
  @IsString()
  frameworkId?: string;

  @ApiProperty({ description: 'Origin of the run', enum: RunOrigin })
  @IsEnum(RunOrigin)
  origin: RunOrigin;

  @ApiProperty({ description: 'Input tokens used' })
  @IsInt()
  @Min(0)
  tokensInput: number;

  @ApiProperty({ description: 'Output tokens used' })
  @IsInt()
  @Min(0)
  tokensOutput: number;

  @ApiProperty({ description: 'Start time of the run' })
  @IsDateString()
  startedAt: string;

  @ApiPropertyOptional({ description: 'Finish time of the run' })
  @IsOptional()
  @IsDateString()
  finishedAt?: string;

  @ApiPropertyOptional({ description: 'Whether the run was successful', default: true })
  @IsOptional()
  @IsBoolean()
  success?: boolean;

  @ApiPropertyOptional({ description: 'Error type if run failed' })
  @IsOptional()
  @IsString()
  errorType?: string;

  @ApiPropertyOptional({ description: 'Number of iterations', default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  iterations?: number;

  @ApiPropertyOptional({ description: 'Additional metadata as JSON' })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}
