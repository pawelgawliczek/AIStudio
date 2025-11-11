import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { StoryType } from '@prisma/client';
import {
  IsString,
  IsOptional,
  IsUUID,
  IsEnum,
  IsInt,
  Min,
  Max,
  IsNotEmpty,
  IsArray,
} from 'class-validator';

export class CreateStoryDto {
  @ApiProperty({ description: 'Project ID' })
  @IsUUID()
  @IsNotEmpty()
  projectId: string;

  @ApiPropertyOptional({ description: 'Epic ID' })
  @IsUUID()
  @IsOptional()
  epicId?: string;

  @ApiProperty({ description: 'Story title' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiPropertyOptional({ description: 'Story description' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ enum: StoryType, default: StoryType.feature })
  @IsEnum(StoryType)
  @IsOptional()
  type?: StoryType;

  @ApiPropertyOptional({ description: 'Business impact (1-5)', minimum: 1, maximum: 5 })
  @IsInt()
  @Min(1)
  @Max(5)
  @IsOptional()
  businessImpact?: number;

  @ApiPropertyOptional({
    description: 'Business complexity (1-5)',
    minimum: 1,
    maximum: 5,
  })
  @IsInt()
  @Min(1)
  @Max(5)
  @IsOptional()
  businessComplexity?: number;

  @ApiPropertyOptional({
    description: 'Technical complexity (1-5)',
    minimum: 1,
    maximum: 5,
  })
  @IsInt()
  @Min(1)
  @Max(5)
  @IsOptional()
  technicalComplexity?: number;

  @ApiPropertyOptional({ description: 'Estimated token cost' })
  @IsInt()
  @Min(0)
  @IsOptional()
  estimatedTokenCost?: number;

  @ApiPropertyOptional({ description: 'Assigned framework ID' })
  @IsUUID()
  @IsOptional()
  assignedFrameworkId?: string;

  @ApiPropertyOptional({ description: 'Layer IDs this story spans', type: [String] })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  layerIds?: string[];

  @ApiPropertyOptional({ description: 'Component IDs this story affects', type: [String] })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  componentIds?: string[];

  @ApiPropertyOptional({ description: 'BA agent analysis notes' })
  @IsString()
  @IsOptional()
  baAnalysis?: string;

  @ApiPropertyOptional({ description: 'Architect agent analysis notes' })
  @IsString()
  @IsOptional()
  architectAnalysis?: string;
}
