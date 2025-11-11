import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID, IsEnum } from 'class-validator';
import { ComponentStatus } from '@prisma/client';

export class FilterComponentDto {
  @ApiPropertyOptional({ description: 'Filter by project ID' })
  @IsOptional()
  @IsUUID()
  projectId?: string;

  @ApiPropertyOptional({ description: 'Filter by status', enum: ComponentStatus })
  @IsOptional()
  @IsEnum(ComponentStatus)
  status?: ComponentStatus;

  @ApiPropertyOptional({ description: 'Filter by layer ID' })
  @IsOptional()
  @IsUUID()
  layerId?: string;
}
