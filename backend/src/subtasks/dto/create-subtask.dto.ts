import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { LayerType, AssigneeType } from '@prisma/client';
import { IsString, IsOptional, IsUUID, IsEnum, IsNotEmpty } from 'class-validator';

export class CreateSubtaskDto {
  @ApiProperty({ description: 'Story ID' })
  @IsUUID()
  @IsNotEmpty()
  storyId: string;

  @ApiProperty({ description: 'Subtask title' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiPropertyOptional({ description: 'Subtask description' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ enum: LayerType, description: 'Layer (frontend, backend, etc.)' })
  @IsEnum(LayerType)
  @IsOptional()
  layer?: LayerType;

  @ApiPropertyOptional({ description: 'Component name' })
  @IsString()
  @IsOptional()
  component?: string;

  @ApiPropertyOptional({
    enum: AssigneeType,
    description: 'Assignee type (agent or human)',
    default: AssigneeType.agent,
  })
  @IsEnum(AssigneeType)
  @IsOptional()
  assigneeType?: AssigneeType;

  @ApiPropertyOptional({ description: 'Assignee ID (agent or user)' })
  @IsUUID()
  @IsOptional()
  assigneeId?: string;
}
