/**
 * DTO for Recent Analysis data (ST-37 Issue #2)
 * Displays historical code analysis runs with commit links
 */

import { ApiProperty } from '@nestjs/swagger';

export class RecentAnalysisDto {
  @ApiProperty({ description: 'Snapshot ID' })
  id: string;

  @ApiProperty({ description: 'Analysis timestamp' })
  timestamp: Date;

  @ApiProperty({
    description: 'Analysis status',
    enum: ['completed', 'failed', 'partial', 'running', 'unknown'],
  })
  status: 'completed' | 'failed' | 'partial' | 'running' | 'unknown';

  @ApiProperty({
    description: 'Git commit hash (7+ chars)',
    nullable: true,
  })
  commitHash?: string;

  @ApiProperty({ description: 'Overall health score (0-100)' })
  healthScore: number;

  @ApiProperty({
    description: 'Total files analyzed',
    required: false,
  })
  totalFiles?: number;

  @ApiProperty({
    description: 'Error message if failed',
    nullable: true,
  })
  errorMessage?: string;
}

export class RecentAnalysesResponseDto {
  @ApiProperty({ type: [RecentAnalysisDto] })
  analyses: RecentAnalysisDto[];

  @ApiProperty({ description: 'Total count available' })
  total: number;

  @ApiProperty({ description: 'Whether more analyses exist beyond limit' })
  hasMore: boolean;
}
