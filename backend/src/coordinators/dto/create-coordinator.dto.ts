import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsString, IsArray, IsObject, IsBoolean, IsOptional, ValidateNested } from 'class-validator';

class CoordinatorConfigDto {
  @ApiProperty({ description: 'Model ID (e.g., claude-sonnet-4)' })
  @IsString()
  modelId: string;

  @ApiProperty({ description: 'Temperature (0-1)', example: 0.3 })
  temperature: number;

  @ApiProperty({ description: 'Maximum input tokens', example: 50000 })
  maxInputTokens: number;

  @ApiProperty({ description: 'Maximum output tokens', example: 10000 })
  maxOutputTokens: number;

  @ApiProperty({ description: 'Timeout in seconds', example: 300 })
  timeout: number;

  @ApiProperty({ description: 'Maximum retry attempts', example: 2 })
  maxRetries: number;

  @ApiProperty({ description: 'Cost limit in USD', example: 5.0 })
  costLimit: number;

  [key: string]: any;
}

export class CreateCoordinatorDto {
  @ApiProperty({ description: 'Coordinator name', example: 'Story Implementation Coordinator' })
  @IsString()
  name: string;

  @ApiProperty({ description: 'Coordinator description' })
  @IsString()
  description: string;

  @ApiProperty({ description: 'Domain of responsibility', example: 'story-implementation' })
  @IsString()
  domain: string;

  @ApiProperty({ description: 'Instructions for coordinator decision-making' })
  @IsString()
  coordinatorInstructions: string;

  @ApiProperty({ description: 'Execution configuration', type: CoordinatorConfigDto })
  @IsObject()
  @ValidateNested()
  @Type(() => CoordinatorConfigDto)
  config: CoordinatorConfigDto;

  @ApiProperty({ description: 'MCP tools this coordinator can use', type: [String], example: ['get_story', 'update_story'] })
  @IsArray()
  @IsString({ each: true })
  tools: string[];

  @ApiProperty({ description: 'Decision strategy', enum: ['sequential', 'parallel', 'conditional', 'adaptive'], example: 'conditional' })
  @IsString()
  decisionStrategy: string;

  @ApiProperty({ description: 'Component IDs this coordinator can use', type: [String], example: ['uuid1', 'uuid2'] })
  @IsArray()
  @IsString({ each: true })
  componentIds: string[];

  @ApiPropertyOptional({ description: 'Active status', example: true })
  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @ApiPropertyOptional({ description: 'Version', example: 'v1.0' })
  @IsOptional()
  @IsString()
  version?: string;
}
