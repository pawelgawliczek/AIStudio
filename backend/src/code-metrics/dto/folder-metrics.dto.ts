import { ApiProperty } from '@nestjs/swagger';

export class FolderMetricsDto {
  @ApiProperty({ description: 'Number of files in this folder (recursive)' })
  fileCount: number;

  @ApiProperty({ description: 'Total lines of code' })
  totalLoc: number;

  @ApiProperty({ description: 'Average cyclomatic complexity' })
  avgComplexity: number;

  @ApiProperty({ description: 'Average cognitive complexity' })
  avgCognitiveComplexity: number;

  @ApiProperty({ description: 'Average maintainability index (0-100)' })
  avgMaintainability: number;

  @ApiProperty({ description: 'Average test coverage (0-100)' })
  avgCoverage: number;

  @ApiProperty({ description: 'Average risk score (0-100)' })
  avgRiskScore: number;

  @ApiProperty({ description: 'Number of files with 0% coverage' })
  uncoveredFiles: number;

  @ApiProperty({ description: 'Number of critical issues' })
  criticalIssues: number;

  @ApiProperty({ description: 'Health score (0-100)' })
  healthScore: number;
}

export class FolderNodeDto {
  @ApiProperty({ description: 'Folder or file path' })
  path: string;

  @ApiProperty({ description: 'Display name (folder/file name)' })
  name: string;

  @ApiProperty({ description: 'Node type: folder or file', enum: ['folder', 'file'] })
  type: 'folder' | 'file';

  @ApiProperty({ description: 'Aggregated metrics for this node', type: () => FolderMetricsDto })
  metrics: FolderMetricsDto;

  @ApiProperty({ description: 'Child nodes', type: () => [FolderNodeDto], required: false })
  children?: FolderNodeDto[];
}

export class CoverageGapDto {
  @ApiProperty({ description: 'File path' })
  filePath: string;

  @ApiProperty({ description: 'Lines of code' })
  loc: number;

  @ApiProperty({ description: 'Cyclomatic complexity' })
  complexity: number;

  @ApiProperty({ description: 'Risk score' })
  riskScore: number;

  @ApiProperty({ description: 'Current test coverage (0-100)' })
  coverage: number;

  @ApiProperty({ description: 'Priority score (higher = more urgent)' })
  priority: number;

  @ApiProperty({ description: 'Reason for priority' })
  reason: string;
}
