import { ApiPropertyOptional } from '@nestjs/swagger';
import { EpicStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';

export class FilterEpicDto {
  @ApiPropertyOptional({ description: 'Filter by project ID' })
  @IsUUID()
  @IsOptional()
  projectId?: string;

  @ApiPropertyOptional({ enum: EpicStatus, description: 'Filter by status' })
  @IsEnum(EpicStatus)
  @IsOptional()
  status?: EpicStatus;
}
