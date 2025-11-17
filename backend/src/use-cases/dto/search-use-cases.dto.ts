import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type, Transform } from 'class-transformer';
import { IsString, IsOptional, IsUUID, IsArray, IsInt, Min, Max } from 'class-validator';

export class SearchUseCasesDto {
  @ApiPropertyOptional({
    description: 'Project ID to search within (required)',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID()
  @IsOptional()
  projectId?: string;

  @ApiPropertyOptional({
    description: 'Text search query (searches key, title, area, content)',
    example: 'password reset',
  })
  @IsString()
  @IsOptional()
  query?: string;

  @ApiPropertyOptional({
    description: 'Filter by feature area/component (exact match)',
    example: 'Authentication',
  })
  @IsString()
  @IsOptional()
  area?: string;

  @ApiPropertyOptional({
    description: 'Filter by multiple areas (OR logic, comma-separated)',
    example: ['Authentication', 'Email Service'],
    type: [String],
  })
  @IsArray()
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.split(',').map(s => s.trim()) : value))
  areas?: string[];

  @ApiPropertyOptional({
    description: 'Filter by story ID (find use cases linked to this story)',
    example: '123e4567-e89b-12d3-a456-426614174001',
  })
  @IsUUID()
  @IsOptional()
  storyId?: string;

  @ApiPropertyOptional({
    description: 'Filter by epic ID (find use cases linked to stories in this epic)',
    example: '123e4567-e89b-12d3-a456-426614174002',
  })
  @IsUUID()
  @IsOptional()
  epicId?: string;

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
    description: 'Offset for pagination',
    example: 0,
    default: 0,
  })
  @IsInt()
  @IsOptional()
  @Min(0)
  @Type(() => Number)
  offset?: number = 0;
}
