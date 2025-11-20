import { PartialType , ApiPropertyOptional } from '@nestjs/swagger';
import { SubtaskStatus } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';
import { CreateSubtaskDto } from './create-subtask.dto';

export class UpdateSubtaskDto extends PartialType(CreateSubtaskDto) {
  @ApiPropertyOptional({ enum: SubtaskStatus, description: 'Subtask status' })
  @IsEnum(SubtaskStatus)
  @IsOptional()
  status?: SubtaskStatus;
}
