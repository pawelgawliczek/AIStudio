import { ApiPropertyOptional } from '@nestjs/swagger';
import { SubtaskStatus, LayerType, AssigneeType } from '@prisma/client';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';

export class FilterSubtaskDto {
  @ApiPropertyOptional({ description: 'Filter by story ID' })
  @IsUUID()
  @IsOptional()
  storyId?: string;

  @ApiPropertyOptional({ enum: SubtaskStatus, description: 'Filter by status' })
  @IsEnum(SubtaskStatus)
  @IsOptional()
  status?: SubtaskStatus;

  @ApiPropertyOptional({ enum: LayerType, description: 'Filter by layer' })
  @IsEnum(LayerType)
  @IsOptional()
  layer?: LayerType;

  @ApiPropertyOptional({ enum: AssigneeType, description: 'Filter by assignee type' })
  @IsEnum(AssigneeType)
  @IsOptional()
  assigneeType?: AssigneeType;
}
