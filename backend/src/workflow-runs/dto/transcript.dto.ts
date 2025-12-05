/**
 * ST-173: Transcript DTOs
 *
 * Data Transfer Objects for transcript API endpoints.
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Summary of a master transcript (orchestrator session)
 */
export class MasterTranscriptSummaryDto {
  @ApiProperty({ description: 'Artifact UUID' })
  artifactId: string;

  @ApiProperty({ description: 'First 500 characters of content' })
  contentPreview: string;

  @ApiProperty({ description: 'File size in bytes' })
  size: number;

  @ApiProperty({ description: 'When transcript was uploaded' })
  createdAt: Date;

  @ApiProperty({ description: 'Index in master transcript array (0=initial, 1=after first compact)' })
  index: number;
}

/**
 * Summary of an agent transcript (spawned component)
 */
export class AgentTranscriptSummaryDto {
  @ApiProperty({ description: 'Artifact UUID' })
  artifactId: string;

  @ApiProperty({ description: 'Component UUID that created this transcript' })
  componentId: string;

  @ApiProperty({ description: 'Component name (e.g., Developer, Architect)' })
  componentName: string;

  @ApiProperty({ description: 'First 500 characters of content' })
  contentPreview: string;

  @ApiProperty({ description: 'File size in bytes' })
  size: number;

  @ApiProperty({ description: 'When transcript was uploaded' })
  createdAt: Date;
}

/**
 * List of all transcripts for a workflow run
 */
export class TranscriptListResponseDto {
  @ApiProperty({ type: [MasterTranscriptSummaryDto], description: 'Master/orchestrator transcripts' })
  master: MasterTranscriptSummaryDto[];

  @ApiProperty({ type: [AgentTranscriptSummaryDto], description: 'Agent/component transcripts' })
  agents: AgentTranscriptSummaryDto[];
}

/**
 * Full transcript detail including content
 */
export class TranscriptDetailResponseDto {
  @ApiProperty({ description: 'Artifact UUID' })
  id: string;

  @ApiPropertyOptional({ description: 'Full JSONL content (when includeContent=true)' })
  content?: string;

  @ApiPropertyOptional({ description: 'Content preview (when includeContent=false)' })
  contentPreview?: string;

  @ApiProperty({ description: 'MIME type (application/x-jsonlines)' })
  contentType: string;

  @ApiProperty({ description: 'File size in bytes' })
  size: number;

  @ApiProperty({ enum: ['master', 'agent'], description: 'Transcript type' })
  transcriptType: 'master' | 'agent';

  @ApiPropertyOptional({ description: 'Component ID (for agent transcripts only)' })
  componentId?: string;

  @ApiPropertyOptional({ description: 'Component name (for agent transcripts only)' })
  componentName?: string;

  @ApiProperty({ description: 'When transcript was uploaded' })
  createdAt: Date;

  @ApiPropertyOptional({ description: 'Index in master transcript array (for master transcripts)' })
  index?: number;

  @ApiPropertyOptional({ description: 'Token metrics extracted from transcript' })
  metrics?: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
}
