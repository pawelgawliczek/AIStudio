import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsUUID, IsOptional, IsArray, IsEnum } from 'class-validator';
import { ComponentStatus } from '@prisma/client';

export class CreateComponentDto {
  @ApiProperty({ description: 'Project ID' })
  @IsUUID()
  projectId: string;

  @ApiProperty({ description: 'Component name (e.g., Authentication, Billing)' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ description: 'Component description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Owner user ID' })
  @IsOptional()
  @IsUUID()
  ownerId?: string;

  @ApiPropertyOptional({ description: 'Component status', enum: ComponentStatus })
  @IsOptional()
  @IsEnum(ComponentStatus)
  status?: ComponentStatus;

  @ApiPropertyOptional({ description: 'Color hex code' })
  @IsOptional()
  @IsString()
  color?: string;

  @ApiPropertyOptional({ description: 'Icon (emoji or name)' })
  @IsOptional()
  @IsString()
  icon?: string;

  @ApiPropertyOptional({ description: 'File path patterns for auto-detection', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  filePatterns?: string[];

  @ApiPropertyOptional({ description: 'Layer IDs this component spans', type: [String] })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  layerIds?: string[];
}
