import { ApiProperty } from '@nestjs/swagger';
import { LayerType } from '@prisma/client';

export class CodeHealthScoreDto {
  @ApiProperty({ description: 'Overall health score (0-100)', example: 78 })
  overallScore: number;

  @ApiProperty({ description: 'Test coverage percentage', example: 87 })
  coverage: number;

  @ApiProperty({ description: 'Average cyclomatic complexity', example: 6.5 })
  complexity: number;

  @ApiProperty({ description: 'Technical debt ratio (%)', example: 8.2 })
  techDebtRatio: number;

  @ApiProperty({
    description: 'Trend indicator',
    example: 'improving',
    enum: ['improving', 'stable', 'declining'],
  })
  trend: 'improving' | 'stable' | 'declining';

  @ApiProperty({ description: 'Change since last week', example: 3 })
  weeklyChange: number;
}

export class ProjectMetricsDto {
  @ApiProperty({ type: CodeHealthScoreDto })
  healthScore: CodeHealthScoreDto;

  @ApiProperty({ description: 'Total lines of code', example: 42350 })
  totalLoc: number;

  @ApiProperty({
    description: 'LOC by language',
    example: { typescript: 28450, python: 10200, sql: 3700 },
  })
  locByLanguage: Record<string, number>;

  @ApiProperty({ description: 'Total security issues count', example: 42 })
  securityIssues: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };

  @ApiProperty({ description: 'Last metrics update timestamp' })
  lastUpdate: Date;
}

export class LayerMetricsDto {
  @ApiProperty({ enum: LayerType })
  layer: LayerType;

  @ApiProperty({ description: 'Lines of code', example: 18200 })
  loc: number;

  @ApiProperty({ description: 'Percentage of total LOC', example: 43 })
  locPercentage: number;

  @ApiProperty({ description: 'Health score (0-100)', example: 82 })
  healthScore: number;

  @ApiProperty({ description: 'Average complexity', example: 5.8 })
  avgComplexity: number;

  @ApiProperty({ description: 'Code churn level', enum: ['low', 'medium', 'high'] })
  churnLevel: 'low' | 'medium' | 'high';

  @ApiProperty({ description: 'Test coverage percentage', example: 85 })
  coverage: number;

  @ApiProperty({ description: 'Number of defects', example: 8 })
  defectCount: number;
}

export class ComponentMetricsDto {
  @ApiProperty({ description: 'Component name', example: 'Authentication' })
  name: string;

  @ApiProperty({ enum: LayerType })
  layer: LayerType;

  @ApiProperty({ description: 'Number of files', example: 12 })
  fileCount: number;

  @ApiProperty({ description: 'Health score (0-100)', example: 72 })
  healthScore: number;

  @ApiProperty({ description: 'Average complexity', example: 8.5 })
  avgComplexity: number;

  @ApiProperty({ description: 'Code churn level', enum: ['low', 'medium', 'high'] })
  churnLevel: 'low' | 'medium' | 'high';

  @ApiProperty({ description: 'Test coverage percentage', example: 78 })
  coverage: number;

  @ApiProperty({ description: 'Number of hotspots', example: 3 })
  hotspotCount: number;

  @ApiProperty({ description: 'Files in this component' })
  files: string[];
}

export class FileHotspotDto {
  @ApiProperty({ description: 'File path', example: 'src/auth/password-reset.ts' })
  filePath: string;

  @ApiProperty({ description: 'Component name', example: 'Authentication' })
  component: string;

  @ApiProperty({ description: 'Layer', enum: LayerType })
  layer: LayerType;

  @ApiProperty({ description: 'Risk score (0-100)', example: 89 })
  riskScore: number;

  @ApiProperty({ description: 'Cyclomatic complexity', example: 24 })
  complexity: number;

  @ApiProperty({ description: 'Number of changes in last 30 days', example: 8 })
  churnCount: number;

  @ApiProperty({ description: 'Test coverage percentage', example: 65 })
  coverage: number;

  @ApiProperty({ description: 'Lines of code', example: 342 })
  loc: number;

  @ApiProperty({ description: 'Last modified date' })
  lastModified: Date;

  @ApiProperty({ description: 'Story that last modified this file', example: 'ST-38' })
  lastStoryKey?: string;

  @ApiProperty({ description: 'Critical issues count', example: 2 })
  criticalIssues: number;
}

export class CodeIssueDto {
  @ApiProperty({
    description: 'Issue severity',
    enum: ['critical', 'high', 'medium', 'low'],
  })
  severity: 'critical' | 'high' | 'medium' | 'low';

  @ApiProperty({ description: 'Issue type', example: 'Security Vulnerabilities' })
  type: string;

  @ApiProperty({ description: 'Number of occurrences', example: 2 })
  count: number;

  @ApiProperty({ description: 'Files affected', example: 2 })
  filesAffected: number;

  @ApiProperty({ description: 'Sample file paths' })
  sampleFiles: string[];
}

export class FileDetailDto {
  @ApiProperty({ description: 'File path' })
  filePath: string;

  @ApiProperty({ description: 'Component name' })
  component: string;

  @ApiProperty({ enum: LayerType })
  layer: LayerType;

  @ApiProperty({ description: 'Programming language' })
  language: string;

  @ApiProperty({ description: 'Risk score (0-100)' })
  riskScore: number;

  @ApiProperty({ description: 'Lines of code' })
  loc: number;

  @ApiProperty({ description: 'Cyclomatic complexity' })
  complexity: number;

  @ApiProperty({ description: 'Cognitive complexity' })
  cognitiveComplexity: number;

  @ApiProperty({ description: 'Maintainability index (0-100)' })
  maintainabilityIndex: number;

  @ApiProperty({ description: 'Test coverage percentage' })
  coverage: number;

  @ApiProperty({ description: 'Number of modifications in last 30 days' })
  churnCount: number;

  @ApiProperty({ description: 'Total lines changed in last 30 days' })
  linesChanged: number;

  @ApiProperty({ description: 'Churn rate (% of file modified)' })
  churnRate: number;

  @ApiProperty({ description: 'Last modified date' })
  lastModified: Date;

  @ApiProperty({ description: 'Recent changes (last 5)' })
  recentChanges: Array<{
    storyKey: string;
    date: Date;
    linesChanged: number;
  }>;

  @ApiProperty({ description: 'Code quality issues' })
  issues: Array<{
    severity: 'critical' | 'high' | 'medium' | 'low';
    type: string;
    line?: number;
    message: string;
  }>;

  @ApiProperty({ description: 'Files that import this file' })
  importedBy: string[];

  @ApiProperty({ description: 'Files that this file imports' })
  imports: string[];

  @ApiProperty({ description: 'Coupling score' })
  couplingScore: 'low' | 'medium' | 'high';
}

export class TrendDataPointDto {
  @ApiProperty({ description: 'Date of measurement' })
  date: Date;

  @ApiProperty({ description: 'Health score at that date' })
  healthScore: number;

  @ApiProperty({ description: 'Coverage at that date' })
  coverage: number;

  @ApiProperty({ description: 'Average complexity at that date' })
  complexity: number;

  @ApiProperty({ description: 'Tech debt ratio at that date' })
  techDebt: number;
}
