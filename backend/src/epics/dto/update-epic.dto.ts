import { PartialType } from '@nestjs/swagger';
import { CreateEpicDto } from './create-epic.dto';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { EpicStatus } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';

export class UpdateEpicDto extends PartialType(CreateEpicDto) {
  @ApiPropertyOptional({ enum: EpicStatus, description: 'Epic status' })
  @IsEnum(EpicStatus)
  @IsOptional()
  status?: EpicStatus;
}
