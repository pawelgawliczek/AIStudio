import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID, IsEnum } from 'class-validator';
import { LayerStatus } from '@prisma/client';

export class FilterLayerDto {
  @ApiPropertyOptional({ description: 'Filter by project ID' })
  @IsOptional()
  @IsUUID()
  projectId?: string;

  @ApiPropertyOptional({ description: 'Filter by status', enum: LayerStatus })
  @IsOptional()
  @IsEnum(LayerStatus)
  status?: LayerStatus;
}
