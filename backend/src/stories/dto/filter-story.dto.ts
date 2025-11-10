import { ApiPropertyOptional } from '@nestjs/swagger';
import { StoryStatus, StoryType } from '@prisma/client';
import { IsEnum, IsOptional, IsString, IsUUID, IsInt, Min } from 'class-validator';
import { Transform } from 'class-transformer';

export class FilterStoryDto {
  @ApiPropertyOptional({ description: 'Filter by project ID' })
  @IsUUID()
  @IsOptional()
  projectId?: string;

  @ApiPropertyOptional({ description: 'Filter by epic ID' })
  @IsUUID()
  @IsOptional()
  epicId?: string;

  @ApiPropertyOptional({ enum: StoryStatus, description: 'Filter by status' })
  @IsEnum(StoryStatus)
  @IsOptional()
  status?: StoryStatus;

  @ApiPropertyOptional({ enum: StoryType, description: 'Filter by type' })
  @IsEnum(StoryType)
  @IsOptional()
  type?: StoryType;

  @ApiPropertyOptional({ description: 'Filter by assigned framework ID' })
  @IsUUID()
  @IsOptional()
  assignedFrameworkId?: string;

  @ApiPropertyOptional({ description: 'Search by title or description' })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({ description: 'Filter by minimum technical complexity' })
  @IsInt()
  @Min(1)
  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  minTechnicalComplexity?: number;

  @ApiPropertyOptional({ description: 'Filter by maximum technical complexity' })
  @IsInt()
  @Min(1)
  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  maxTechnicalComplexity?: number;

  @ApiPropertyOptional({ description: 'Sort by field', enum: ['createdAt', 'technicalComplexity', 'businessImpact'] })
  @IsString()
  @IsOptional()
  sortBy?: string;

  @ApiPropertyOptional({ description: 'Sort order', enum: ['asc', 'desc'] })
  @IsString()
  @IsOptional()
  sortOrder?: 'asc' | 'desc';

  @ApiPropertyOptional({ description: 'Page number', default: 1 })
  @IsInt()
  @Min(1)
  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  page?: number;

  @ApiPropertyOptional({ description: 'Items per page', default: 20 })
  @IsInt()
  @Min(1)
  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  limit?: number;
}
