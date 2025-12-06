import { ApiProperty } from '@nestjs/swagger';
import { RunStatus } from '@prisma/client';

// ST-57: Define CoordinatorMetricsDto FIRST to avoid circular dependency
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

  // Workflow states (from related workflow, for workflow-viz components)
  @ApiProperty({ required: false })
  states?: WorkflowStateSummaryDto[];

  // ST-182: Master transcript paths for live streaming
  @ApiProperty({ required: false, type: [String], description: 'Paths to master session transcripts (for live streaming)' })
  masterTranscriptPaths?: string[];
}

export class WorkflowStateSummaryDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  order: number;

  @ApiProperty({ required: false })
  componentId?: string;

  @ApiProperty({ required: false })
  preExecutionInstructions?: string;

  @ApiProperty({ required: false })
  postExecutionInstructions?: string;

  @ApiProperty()
  mandatory: boolean;

  @ApiProperty()
  requiresApproval: boolean;

  @ApiProperty({ required: false })
  runLocation?: string;

  @ApiProperty({ required: false })
  offlineFallback?: string;
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
