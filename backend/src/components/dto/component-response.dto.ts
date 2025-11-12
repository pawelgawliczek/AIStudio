import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ComponentResponseDto {
  @ApiProperty({ description: 'Component ID' })
  id: string;

  @ApiProperty({ description: 'Project ID' })
  projectId: string;

  @ApiProperty({ description: 'Component name' })
  name: string;

  @ApiPropertyOptional({ description: 'Component description' })
  description?: string;

  @ApiProperty({ description: 'Input instructions' })
  inputInstructions: string;

  @ApiProperty({ description: 'Operation instructions' })
  operationInstructions: string;

  @ApiProperty({ description: 'Output instructions' })
  outputInstructions: string;

  @ApiProperty({ description: 'Execution configuration' })
  config: any;

  @ApiProperty({ description: 'MCP tools', type: [String] })
  tools: string[];

  @ApiPropertyOptional({ description: 'Subtask configuration' })
  subtaskConfig?: any;

  @ApiProperty({ description: 'Failure handling strategy' })
  onFailure: string;

  @ApiProperty({ description: 'Tags', type: [String] })
  tags: string[];

  @ApiProperty({ description: 'Active status' })
  active: boolean;

  @ApiProperty({ description: 'Version' })
  version: string;

  @ApiProperty({ description: 'Created at' })
  createdAt: Date;

  @ApiProperty({ description: 'Updated at' })
  updatedAt: Date;

  @ApiPropertyOptional({ description: 'Usage statistics' })
  usageStats?: {
    totalRuns: number;
    avgRuntime: number;
    avgCost: number;
    successRate: number;
  };
}
