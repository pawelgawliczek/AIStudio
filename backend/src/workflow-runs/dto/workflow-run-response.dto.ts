import { ApiProperty } from '@nestjs/swagger';
import { RunStatus } from './create-workflow-run.dto';

export class WorkflowRunResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  projectId: string;

  @ApiProperty()
  workflowId: string;

  @ApiProperty({ required: false })
  storyId?: string;

  @ApiProperty({ required: false })
  epicId?: string;

  @ApiProperty()
  startedAt: string;

  @ApiProperty({ required: false })
  finishedAt?: string;

  @ApiProperty({ required: false })
  durationSeconds?: number;

  @ApiProperty({ required: false })
  totalUserPrompts?: number;

  @ApiProperty({ required: false })
  totalIterations?: number;

  @ApiProperty({ required: false })
  totalInterventions?: number;

  @ApiProperty({ required: false })
  avgPromptsPerComponent?: number;

  @ApiProperty({ required: false })
  totalTokensInput?: number;

  @ApiProperty({ required: false })
  totalTokensOutput?: number;

  @ApiProperty({ required: false })
  totalTokens?: number;

  @ApiProperty({ required: false })
  totalLocGenerated?: number;

  @ApiProperty({ required: false })
  estimatedCost?: number;

  @ApiProperty({ enum: RunStatus })
  status: RunStatus;

  @ApiProperty({ required: false })
  errorMessage?: string;

  @ApiProperty({ required: false })
  coordinatorDecisions?: any;

  @ApiProperty({ required: false })
  coordinatorMetrics?: CoordinatorMetricsDto;

  @ApiProperty()
  createdAt: string;

  @ApiProperty()
  updatedAt: string;

  // Related data (when includeRelations=true)
  @ApiProperty({ required: false })
  workflow?: {
    id: string;
    name: string;
    version: string;
  };

  @ApiProperty({ required: false })
  story?: {
    id: string;
    key: string;
    title: string;
  };

  @ApiProperty({ required: false })
  componentRuns?: ComponentRunSummaryDto[];
}

export class ComponentRunSummaryDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  componentId: string;

  @ApiProperty()
  componentName: string;

  @ApiProperty({ required: false })
  executionOrder?: number; // ST-57: 0 for orchestrator, 1+ for components

  @ApiProperty()
  startedAt: string;

  @ApiProperty({ required: false })
  finishedAt?: string;

  @ApiProperty({ required: false })
  durationSeconds?: number;

  @ApiProperty({ required: false })
  tokensInput?: number;

  @ApiProperty({ required: false })
  tokensOutput?: number;

  @ApiProperty({ required: false })
  totalTokens?: number;

  @ApiProperty({ required: false })
  cost?: number; // ST-57: Cost in USD

  @ApiProperty({ required: false })
  toolCalls?: number; // ST-57: Number of tool calls

  @ApiProperty({ required: false })
  locGenerated?: number;

  @ApiProperty({ enum: RunStatus })
  status: RunStatus;

  @ApiProperty()
  success: boolean;
}

export class CoordinatorMetricsDto {
  @ApiProperty({ required: false })
  tokensInput?: number;

  @ApiProperty({ required: false })
  tokensOutput?: number;

  @ApiProperty({ required: false })
  totalTokens?: number;

  @ApiProperty({ required: false })
  costUsd?: number;

  @ApiProperty({ required: false })
  toolCalls?: number;

  @ApiProperty({ required: false })
  userPrompts?: number;

  @ApiProperty({ required: false })
  iterations?: number;

  @ApiProperty({ required: false })
  dataSource?: string;

  @ApiProperty({ required: false })
  transcriptPath?: string;
}
