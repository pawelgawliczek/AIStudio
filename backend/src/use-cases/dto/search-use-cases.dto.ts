import { IsString, IsOptional, IsUUID, IsEnum, IsInt, Min, Max } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export enum SearchMode {
  SEMANTIC = 'semantic',
  TEXT = 'text',
  COMPONENT = 'component',
}

export class SearchUseCasesDto {
  @ApiPropertyOptional({
    description: 'Project ID to search within',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID()
  @IsOptional()
  projectId?: string;

  @ApiPropertyOptional({
    description: 'Search query (text or semantic)',
    example: 'password reset flow',
  })
  @IsString()
  @IsOptional()
  query?: string;

  @ApiPropertyOptional({
    description: 'Search mode',
    enum: SearchMode,
    example: SearchMode.SEMANTIC,
  })
  @IsEnum(SearchMode)
  @IsOptional()
  mode?: SearchMode;

  @ApiPropertyOptional({
    description: 'Filter by feature area',
    example: 'Authentication',
  })
  @IsString()
  @IsOptional()
  area?: string;

  @ApiPropertyOptional({
    description: 'Filter by components (comma-separated)',
    example: 'Authentication,Email Service',
  })
  @IsString()
  @IsOptional()
  components?: string;

  @ApiPropertyOptional({
    description: 'Number of results to return',
    example: 20,
    default: 20,
  })
  @IsInt()
  @IsOptional()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  limit?: number = 20;

  @ApiPropertyOptional({
    description: 'Minimum similarity threshold for semantic search (0-1)',
    example: 0.7,
    default: 0.7,
  })
  @IsOptional()
  @Type(() => Number)
  minSimilarity?: number = 0.7;
}
