import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class WorkflowResponseDto {
  @ApiProperty({ description: 'Workflow ID' })
  id: string;

  @ApiProperty({ description: 'Project ID' })
  projectId: string;

  @ApiProperty({ description: 'Coordinator ID' })
  coordinatorId: string;

  @ApiProperty({ description: 'Workflow name' })
  name: string;

  @ApiPropertyOptional({ description: 'Workflow description' })
  description?: string;

  @ApiProperty({ description: 'Version' })
  version: string;

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

  @ApiPropertyOptional({ description: 'Coordinator details' })
  coordinator?: {
    id: string;
    name: string;
    domain: string;
    version?: string;
    versionMajor?: number;
    versionMinor?: number;
    flowDiagram?: string;
    componentIds?: string[];
    components?: Array<{
      id: string;
      name: string;
    }>;
  };

  @ApiPropertyOptional({ description: 'Usage statistics' })
  usageStats?: {
    totalRuns: number;
    avgRuntime: number;
    avgCost: number;
    successRate: number;
  };

  @ApiPropertyOptional({ description: 'Activation status' })
  activationStatus?: {
    isActivated: boolean;
    activatedAt?: Date;
    activatedBy?: string;
    filesGenerated?: string[];
  };
}
