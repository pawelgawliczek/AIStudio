import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsString, IsOptional, IsObject, IsBoolean, ValidateNested, IsArray, IsNumber } from 'class-validator';

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

class ComponentAssignmentDto {
  @ApiProperty({ description: 'Component name (must be unique within workflow)', example: 'Fullstack Developer' })
  @IsString()
  componentName: string;

  @ApiProperty({ description: 'Component UUID' })
  @IsString()
  componentId: string;

  @ApiProperty({ description: 'Version UUID' })
  @IsString()
  versionId: string;

  @ApiProperty({ description: 'Version string', example: 'v0.2' })
  @IsString()
  version: string;

  @ApiProperty({ description: 'Major version number', example: 0 })
  @IsNumber()
  versionMajor: number;

  @ApiProperty({ description: 'Minor version number', example: 2 })
  @IsNumber()
  versionMinor: number;
}

export class CreateWorkflowDto {
  @ApiProperty({ description: 'Workflow name', example: 'Story Implementation Workflow' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ description: 'Workflow description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: 'Trigger configuration', type: TriggerConfigDto })
  @IsObject()
  @ValidateNested()
  @Type(() => TriggerConfigDto)
  triggerConfig: TriggerConfigDto;

  @ApiPropertyOptional({
    description: 'Component assignments for this workflow',
    type: [ComponentAssignmentDto],
    example: [
      {
        componentName: 'Fullstack Developer',
        componentId: 'uuid-here',
        versionId: 'version-uuid',
        version: 'v0.2',
        versionMajor: 0,
        versionMinor: 2
      }
    ]
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ComponentAssignmentDto)
  componentAssignments?: ComponentAssignmentDto[];

  @ApiPropertyOptional({ description: 'Active status', example: true })
  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @ApiPropertyOptional({ description: 'Version', example: 'v1.0' })
  @IsOptional()
  @IsString()
  version?: string;
}
