import { IsOptional, IsString, IsBoolean } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class GetStoryExecutionDetailsDto {
  @ApiProperty({ description: 'Story ID' })
  @IsString()
  storyId: string;

  @ApiPropertyOptional({ description: 'Include commit details', default: true })
  @IsBoolean()
  @IsOptional()
  includeCommits?: boolean = true;

  @ApiPropertyOptional({ description: 'Include file changes', default: true })
  @IsBoolean()
  @IsOptional()
  includeFileChanges?: boolean = true;
}

// Response DTOs

export class AgentRunMetricsDto {
  tokensPerLoc?: number;
  locPerPrompt?: number;
  runtimePerLoc?: number; // seconds
  runtimePerToken: number; // seconds
}

export class AgentExecutionDto {
  runId: string;
  agentRole: string; // 'ba', 'architect', 'developer', 'qa'
  agentName: string;
  executionNumber: number; // e.g., 1 for first BA run, 2 for second Architect run
  startedAt: string; // ISO date
  finishedAt: string; // ISO date
  duration: number; // seconds
  tokensInput: number;
  tokensOutput: number;
  tokensTotal: number;
  iterations: number; // number of prompts
  locGenerated?: number; // null for non-code agents
  success: boolean;
  metrics: AgentRunMetricsDto;
  outputs: {
    commits?: string[]; // commit hashes
    filesModified?: string[];
    linkedUseCases?: string[];
    artifacts?: string[];
    description?: string;
  };
}

export class StoryLevelSummaryDto {
  storyId: string;
  storyKey: string;
  storyTitle: string;
  status: string;
  complexity: number;
  epicId: string;
  epicKey: string;
  totalExecutions: number;
  executionsByRole: {
    ba: number;
    architect: number;
    developer: number;
    qa: number;
  };
  totalTime: number; // seconds
  totalTokens: number;
  tokensInput: number;
  tokensOutput: number;
  totalLoc: number;
  totalIterations: number;
  aggregateMetrics: {
    tokensPerLoc: number;
    locPerPrompt: number; // code agents only
    runtimePerLoc: number; // seconds
    runtimePerToken: number; // seconds
  };
  costEstimate: number;
}

export class StoryExecutionDetailsResponseDto {
  story: {
    id: string;
    key: string;
    title: string;
    status: string;
    complexity: number;
    epic: {
      id: string;
      key: string;
      name: string;
    };
  };
  executions: AgentExecutionDto[];
  summary: StoryLevelSummaryDto;
  commits?: {
    hash: string;
    author: string;
    message: string;
    timestamp: string;
    locAdded: number;
    locDeleted: number;
    filesChanged: string[];
  }[];
  generatedAt: string;
}
