import { PartialType , ApiPropertyOptional } from '@nestjs/swagger';
import { EpicStatus } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';
import { CreateEpicDto } from './create-epic.dto';

export class UpdateEpicDto extends PartialType(CreateEpicDto) {
  @ApiPropertyOptional({ enum: EpicStatus, description: 'Epic status' })
  @IsEnum(EpicStatus)
  @IsOptional()
  status?: EpicStatus;
}
