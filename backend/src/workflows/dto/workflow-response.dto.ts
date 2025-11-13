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
