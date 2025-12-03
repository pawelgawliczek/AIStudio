import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class WorkflowResponseDto {
  @ApiProperty({ description: 'Workflow ID' })
  id: string;

  @ApiProperty({ description: 'Project ID' })
  projectId: string;

  @ApiProperty({ description: 'Workflow name' })
  name: string;

  @ApiPropertyOptional({ description: 'Workflow description' })
  description?: string;

  @ApiProperty({ description: 'Version' })
  version: string;

  @ApiProperty({ description: 'Version major number' })
  versionMajor: number;

  @ApiProperty({ description: 'Version minor number' })
  versionMinor: number;

  @ApiProperty({ description: 'Trigger configuration' })
  triggerConfig: any;

  @ApiPropertyOptional({
    description: 'Component assignments with versions (ST-90)',
    type: 'array',
    items: {
      type: 'object',
      properties: {
        componentName: { type: 'string' },
        componentId: { type: 'string' },
        versionId: { type: 'string' },
        version: { type: 'string' },
        versionMajor: { type: 'number' },
        versionMinor: { type: 'number' },
      },
    },
  })
  componentAssignments?: Array<{
    componentName: string;
    componentId: string;
    versionId: string;
    version: string;
    versionMajor: number;
    versionMinor: number;
  }>;

  @ApiProperty({ description: 'Active status' })
  active: boolean;

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
