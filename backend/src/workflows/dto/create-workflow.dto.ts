import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsString, IsOptional, IsObject, IsBoolean, ValidateNested } from 'class-validator';

class TriggerConfigDto {
  @ApiProperty({ description: 'Trigger type', enum: ['manual', 'story_status_change', 'scheduled', 'webhook'], example: 'story_status_change' })
  @IsString()
  type: string;

  @ApiPropertyOptional({ description: 'Conditions for triggering' })
  @IsOptional()
  @IsObject()
  conditions?: any;

  @ApiPropertyOptional({ description: 'Schedule configuration (for scheduled triggers)' })
  @IsOptional()
  @IsObject()
  schedule?: {
    cron?: string;
    timezone?: string;
  };

  [key: string]: any;
}

export class CreateWorkflowDto {
  @ApiProperty({ description: 'Workflow name', example: 'Story Implementation Workflow' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ description: 'Workflow description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: 'Coordinator ID to use for this workflow' })
  @IsString()
  coordinatorId: string;

  @ApiProperty({ description: 'Trigger configuration', type: TriggerConfigDto })
  @IsObject()
  @ValidateNested()
  @Type(() => TriggerConfigDto)
  triggerConfig: TriggerConfigDto;

  @ApiPropertyOptional({ description: 'Active status', example: true })
  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @ApiPropertyOptional({ description: 'Version', example: 'v1.0' })
  @IsOptional()
  @IsString()
  version?: string;
}
