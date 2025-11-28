/**
 * Type definitions for Code Quality Dashboard
 * Extracted from CodeQualityDashboard.tsx for reusability and maintainability
 */

export interface HealthScore {
  overallScore: number;
  coverage: number;
  complexity: number;
  techDebtRatio: number;
  trend: 'improving' | 'stable' | 'declining';
  weeklyChange: number;
}

export interface ProjectMetrics {
  healthScore: HealthScore;
  totalLoc: number;
  totalFiles?: number;
  locByLanguage: Record<string, number>;
  securityIssues: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  coverage?: {
    overall: number;
    weeklyChange: number;
  };
  lastUpdate: Date;
}

export interface FileHotspot {
  filePath: string;
  riskScore: number;
  complexity: number;
  churnCount: number;
  coverage: number;
  loc: number;
  lastModified: Date;
  lastStoryKey?: string;
  criticalIssues: number;
}

export type IssueSeverity = 'critical' | 'high' | 'medium' | 'low';

export interface CodeIssue {
  severity: IssueSeverity;
  type: string;
  count: number;
  filesAffected: number;
  sampleFiles: string[];
}

export interface FileIssue {
  severity: IssueSeverity;
  type: string;
  line?: number;
  message: string;
}

export interface RecentChange {
  storyKey: string;
  date: Date;
  linesChanged: number;
}

export type CouplingScore = 'low' | 'medium' | 'high';

export interface FileDetail {
  filePath: string;
  language: string;
  riskScore: number;
  loc: number;
  complexity: number;
  cognitiveComplexity: number;
  maintainabilityIndex: number;
  coverage: number;
  churnCount: number;
  linesChanged: number;
  churnRate: number;
  lastModified: Date;
  recentChanges: RecentChange[];
  issues: FileIssue[];
  importedBy: string[];
  imports: string[];
  couplingScore: CouplingScore;
}

export interface FolderMetrics {
  fileCount: number;
  totalLoc: number;
  avgComplexity: number;
  avgCognitiveComplexity: number;
  avgMaintainability: number;
  avgCoverage: number;
  avgRiskScore: number;
  uncoveredFiles: number;
  criticalIssues: number;
  healthScore: number;
}

export interface FolderNode {
  path: string;
  name: string;
  type: 'folder' | 'file';
  metrics: FolderMetrics;
  children?: FolderNode[];
}

export interface CoverageGap {
  filePath: string;
  loc: number;
  complexity: number;
  riskScore: number;
  coverage: number;
  priority: number;
  reason: string;
}

export type AnalysisStatusType = 'queued' | 'running' | 'completed' | 'failed' | 'not_found';

export interface AnalysisStatus {
  status: AnalysisStatusType;
  progress?: number;
  message?: string;
  startedAt?: Date;
  completedAt?: Date;
}

export interface AnalysisComparison {
  healthScoreChange: number;
  newTests: number;
  coverageChange: number;
  complexityChange: number;
  newFiles: number;
  deletedFiles: number;
  qualityImprovement: boolean;
  lastAnalysis?: Date;
}

export interface TestLevelStats {
  total: number;
  passing: number;
  failing: number;
  skipped: number;
  coverage: number;
  avgDuration: number;
}

export interface TestSummaryByLevel {
  unit: TestLevelStats;
  integration: TestLevelStats;
  e2e: TestLevelStats;
}

export interface TestSummary {
  totalTests: number;
  passing: number;
  failing: number;
  skipped: number;
  lastExecution?: Date;
  coveragePercentage?: number;
  testsByLevel?: TestSummaryByLevel; // ST-132: Optional test level breakdown
}

// BR-Analysis-1: Analysis status types (from baAnalysis)
export type AnalysisRunStatus = 'completed' | 'failed' | 'partial' | 'running' | 'unknown';

// Recent analysis interface for displaying analysis history
export interface RecentAnalysis {
  id: string;                    // Snapshot ID or analysis run ID
  timestamp: Date;               // Analysis completion timestamp (snapshotDate)
  status: AnalysisRunStatus;     // Analysis outcome
  commitHash?: string;           // Git commit hash (7+ chars)
  healthScore?: number;          // Overall health score from snapshot
  totalFiles?: number;           // Files analyzed (optional detail)
  errorMessage?: string;         // Error detail if status = 'failed'
}

export interface RecentAnalysesResponse {
  analyses: RecentAnalysis[];
  total: number;                 // Total count (for pagination)
  hasMore: boolean;              // Indicates if more analyses exist
}

export interface FileMetrics {
  linesOfCode: number;
  cyclomaticComplexity: number;
  cognitiveComplexity: number;
  maintainabilityIndex: number;
  testCoverage: number;
  riskScore: number;
}

export type FileStatus = 'added' | 'modified' | 'deleted';

export interface FileChange {
  filePath: string;
  status: FileStatus;
  language: string;
  current: FileMetrics | null;
  previous: FileMetrics | null;
  changes: FileMetrics | null;
}

export interface FileChangesData {
  files: FileChange[];
}

export type DrillDownLevel = 'project' | 'file';

export interface StoryCreationContext {
  type: 'file' | 'issue' | 'folder';
  data: FileHotspot | CodeIssue | FolderNode;
}

export interface CodeQualityFilters {
  severityFilter: IssueSeverity | 'all';
  typeFilter: string | 'all';
  showOnlyHighRisk: boolean;
}

export interface TrendDataPoint {
  date: Date;
  healthScore: number;
  coverage: number;
  complexity: number;
  techDebt: number;
}
