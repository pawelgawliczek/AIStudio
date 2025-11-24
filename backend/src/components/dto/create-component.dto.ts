import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsString, IsOptional, IsArray, IsObject, IsEnum, IsBoolean, ValidateNested, IsNumber } from 'class-validator';

class ExecutionConfigDto {
  @ApiProperty({ description: 'Model ID (e.g., claude-sonnet-4)' })
  @IsString()
  modelId: string;

  @ApiProperty({ description: 'Temperature (0-1)', example: 0.3 })
  @IsNumber()
  temperature: number;

  @ApiProperty({ description: 'Maximum input tokens', example: 50000 })
  @IsNumber()
  maxInputTokens: number;

  @ApiProperty({ description: 'Maximum output tokens', example: 10000 })
  @IsNumber()
  maxOutputTokens: number;

  @ApiProperty({ description: 'Timeout in seconds', example: 300 })
  @IsNumber()
  timeout: number;

  @ApiProperty({ description: 'Maximum retry attempts', example: 2 })
  @IsNumber()
  maxRetries: number;

  @ApiProperty({ description: 'Cost limit in USD', example: 5.0 })
  @IsNumber()
  costLimit: number;
}

class SubtaskConfigDto {
  @ApiProperty({ description: 'Auto-create subtask', example: true })
  @IsBoolean()
  createSubtask: boolean;

  @ApiProperty({ description: 'Subtask layer', enum: ['frontend', 'backend', 'infra', 'test', 'other'] })
  @IsString()
  layer: string;

  @ApiProperty({ description: 'Assignee type', enum: ['agent', 'human'] })
  @IsString()
  assignee: string;
}

export class CreateComponentDto {
  @ApiProperty({ description: 'Component name', example: 'Requirements Analyzer' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ description: 'Component description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: 'Input instructions - how to receive data' })
  @IsString()
  inputInstructions: string;

  @ApiProperty({ description: 'Operation instructions - what work to do' })
  @IsString()
  operationInstructions: string;

  @ApiProperty({ description: 'Output instructions - how to format results' })
  @IsString()
  outputInstructions: string;

  @ApiProperty({ description: 'Execution configuration', type: ExecutionConfigDto })
  @IsObject()
  @ValidateNested()
  @Type(() => ExecutionConfigDto)
  config: ExecutionConfigDto;

  @ApiProperty({ description: 'MCP tools this component can use', type: [String], example: ['create_story', 'update_story'] })
  @IsArray()
  @IsString({ each: true })
  tools: string[];

  @ApiPropertyOptional({ description: 'Subtask configuration', type: SubtaskConfigDto })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => SubtaskConfigDto)
  subtaskConfig?: SubtaskConfigDto;

  @ApiProperty({ description: 'Failure handling strategy', enum: ['stop', 'skip', 'retry', 'pause'], example: 'stop' })
  @IsEnum(['stop', 'skip', 'retry', 'pause'])
  onFailure: string;

  @ApiPropertyOptional({ description: 'Tags for categorization', type: [String], example: ['requirements', 'analysis'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({ description: 'Active status', example: true })
  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @ApiPropertyOptional({ description: 'Version', example: 'v1.0' })
  @IsOptional()
  @IsString()
  version?: string;
}
