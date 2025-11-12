import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CoordinatorResponseDto {
  @ApiProperty({ description: 'Coordinator ID' })
  id: string;

  @ApiProperty({ description: 'Project ID' })
  projectId: string;

  @ApiProperty({ description: 'Coordinator name' })
  name: string;

  @ApiProperty({ description: 'Coordinator description' })
  description: string;

  @ApiProperty({ description: 'Domain of responsibility' })
  domain: string;

  @ApiProperty({ description: 'Instructions for coordinator decision-making' })
  coordinatorInstructions: string;

  @ApiProperty({ description: 'Execution configuration' })
  config: any;

  @ApiProperty({ description: 'MCP tools', type: [String] })
  tools: string[];

  @ApiProperty({ description: 'Decision strategy' })
  decisionStrategy: string;

  @ApiProperty({ description: 'Component IDs', type: [String] })
  componentIds: string[];

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
    avgComponentsUsed: number;
  };
}
