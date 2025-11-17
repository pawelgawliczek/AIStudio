import { ApiProperty } from '@nestjs/swagger';
import { RunStatus } from '@prisma/client';
import { IsString, IsOptional, IsDateString, IsInt, IsNumber, IsEnum, IsArray, IsObject } from 'class-validator';

// Re-export RunStatus for convenience
export { RunStatus };

export class CreateWorkflowRunDto {
  @ApiProperty({ description: 'Workflow ID' })
  @IsString()
  workflowId: string;

  @ApiProperty({ description: 'Story ID (optional)', required: false })
  @IsString()
  @IsOptional()
  storyId?: string;

  @ApiProperty({ description: 'Epic ID (optional)', required: false })
  @IsString()
  @IsOptional()
  epicId?: string;

  @ApiProperty({ description: 'Started timestamp' })
  @IsDateString()
  startedAt: string;

  @ApiProperty({ description: 'Finished timestamp (optional)', required: false })
  @IsDateString()
  @IsOptional()
  finishedAt?: string;

  @ApiProperty({ description: 'Duration in seconds (optional)', required: false })
  @IsInt()
  @IsOptional()
  durationSeconds?: number;

  @ApiProperty({ description: 'Total user prompts (optional)', required: false })
  @IsInt()
  @IsOptional()
  totalUserPrompts?: number;

  @ApiProperty({ description: 'Total iterations (optional)', required: false })
  @IsInt()
  @IsOptional()
  totalIterations?: number;

  @ApiProperty({ description: 'Total human interventions (optional)', required: false })
  @IsInt()
  @IsOptional()
  totalInterventions?: number;

  @ApiProperty({ description: 'Average prompts per component (optional)', required: false })
  @IsNumber()
  @IsOptional()
  avgPromptsPerComponent?: number;

  @ApiProperty({ description: 'Total input tokens (optional)', required: false })
  @IsInt()
  @IsOptional()
  totalTokensInput?: number;

  @ApiProperty({ description: 'Total output tokens (optional)', required: false })
  @IsInt()
  @IsOptional()
  totalTokensOutput?: number;

  @ApiProperty({ description: 'Total tokens (optional)', required: false })
  @IsInt()
  @IsOptional()
  totalTokens?: number;

  @ApiProperty({ description: 'Total LOC generated (optional)', required: false })
  @IsInt()
  @IsOptional()
  totalLocGenerated?: number;

  @ApiProperty({ description: 'Estimated cost in USD (optional)', required: false })
  @IsNumber()
  @IsOptional()
  estimatedCost?: number;

  @ApiProperty({ description: 'Run status', enum: RunStatus, default: RunStatus.pending })
  @IsEnum(RunStatus)
  @IsOptional()
  status?: RunStatus;

  @ApiProperty({ description: 'Error message (optional)', required: false })
  @IsString()
  @IsOptional()
  errorMessage?: string;

  @ApiProperty({ description: 'Coordinator decisions log (optional)', required: false })
  @IsObject()
  @IsOptional()
  coordinatorDecisions?: any;
}
