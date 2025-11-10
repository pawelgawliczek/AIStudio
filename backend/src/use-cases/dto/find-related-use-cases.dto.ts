import { IsUUID, IsOptional, IsInt, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class FindRelatedUseCasesDto {
  @ApiProperty({
    description: 'Story ID to find related use cases for',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID()
  storyId: string;

  @ApiPropertyOptional({
    description: 'Include use cases from the same epic',
    default: true,
  })
  @IsOptional()
  includeEpicUseCases?: boolean = true;

  @ApiPropertyOptional({
    description: 'Include semantically similar use cases',
    default: true,
  })
  @IsOptional()
  includeSemanticallySimilar?: boolean = true;

  @ApiPropertyOptional({
    description: 'Maximum number of results',
    default: 10,
  })
  @IsInt()
  @IsOptional()
  @Min(1)
  @Max(50)
  @Type(() => Number)
  limit?: number = 10;

  @ApiPropertyOptional({
    description: 'Minimum similarity threshold (0-1)',
    default: 0.6,
  })
  @IsOptional()
  @Type(() => Number)
  minSimilarity?: number = 0.6;
}
