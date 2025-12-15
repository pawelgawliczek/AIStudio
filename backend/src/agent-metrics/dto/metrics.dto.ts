import { ComplexityBand, DateRange, AggregationLevel } from './enums';

// Token Metrics
export interface TokenMetricsDto {
  inputTokens: number;
  outputTokens: number;
  cacheRead: number;
  cacheWrite: number;
  totalTokens: number;
  cacheHitRate: number;
}

// Efficiency Metrics
export interface EfficiencyMetricsDto {
  avgTokensPerStory: number;
  avgTokenPerLoc: number;
  storyCycleTimeHours: number;
  promptIterationsPerStory: number;
  parallelizationEfficiencyPercent: number;
  tokenEfficiencyRatio: number;
  tokensPerLOC?: number;
  promptsPerStory?: number;
  interactionsPerStory?: number;
  defectsPerStory?: number;
  defectLeakagePercent?: number;
  codeChurnPercent?: number;
  testCoveragePercent?: number;
  turnsPerStory?: number;
  manualPromptsPerStory?: number;
  automationRate?: number;
}

// Quality Metrics
export interface QualityMetricsDto {
  defectsPerStory: number;
  defectLeakagePercent: number;
  codeChurnPercent: number;
  testCoveragePercent: number;
  codeComplexityDeltaPercent: number;
  criticalDefects: number;
}

// Cost Metrics
export interface CostMetricsDto {
  costPerStory: number;
  costPerAcceptedLoc: number;
  storiesCompleted: number;
  acceptedLoc: number;
  reworkCost: number;
  netCost: number;
}

// Code Impact Metrics
export interface CodeImpactMetricsDto {
  linesAdded: number;
  linesModified: number;
  linesDeleted: number;
  testsAdded: number;
  filesModified: number;
}

// Execution Metrics
export interface ExecutionMetricsDto {
  totalRuns: number;
  totalDurationSeconds: number;
  avgDurationPerRun: number;
  totalPrompts: number;
  totalInteractions: number;
  totalIterations: number;
  totalTurns?: number;
  totalManualPrompts?: number;
  totalAutoContinues?: number;
}

// Comprehensive Metrics (combining all)
export interface ComprehensiveMetricsDto {
  tokens: TokenMetricsDto;
  efficiency: EfficiencyMetricsDto;
  costValue: CostMetricsDto;
  codeImpact: CodeImpactMetricsDto;
  execution: ExecutionMetricsDto;
}

// Framework Comparison
export interface FrameworkInfoDto {
  id: string;
  name: string;
}

export interface FrameworkComparisonResultDto {
  framework: FrameworkInfoDto;
  efficiencyMetrics: EfficiencyMetricsDto;
  qualityMetrics: QualityMetricsDto;
  costMetrics: CostMetricsDto;
  sampleSize: number;
  confidenceLevel: string;
}

export interface FrameworkComparisonResponseDto {
  projectId: string;
  projectName: string;
  complexityBand: ComplexityBand;
  dateRange: DateRange;
  startDate: string;
  endDate: string;
  comparisons: FrameworkComparisonResultDto[];
  overheadAnalysis?: any;
  trends: any;
  aiInsights: string[];
  generatedAt: string;
}

export interface GetFrameworkMetricsDto {
  projectId: string;
  frameworkIds: string[];
  complexityBand: ComplexityBand;
  dateRange: DateRange;
  startDate?: string;
  endDate?: string;
}

// Workflow Metrics
export interface WorkflowMetricsSummaryDto {
  workflowId: string;
  workflowName: string;
  totalRuns: number;
  metrics: ComprehensiveMetricsDto;
}

export interface StoryMetricsSummaryDto {
  storyId: string;
  storyKey: string;
  storyTitle: string;
  businessComplexity: number;
  technicalComplexity: number;
  metrics: ComprehensiveMetricsDto;
}

export interface EpicMetricsSummaryDto {
  epicId: string;
  epicKey: string;
  epicTitle: string;
  totalStories: number;
  metrics: ComprehensiveMetricsDto;
}

export interface AgentMetricsSummaryDto {
  agentName: string;
  componentId: string;
  totalExecutions: number;
  metrics: ComprehensiveMetricsDto;
}

export interface TrendDataPointDto {
  date: string;
  value: number;
}

export interface TrendAnalysisDto {
  metricName: string;
  data: TrendDataPointDto[];
  trend: 'improving' | 'stable' | 'declining';
  changePercent: number;
}

export interface GetWorkflowMetricsDto {
  projectId: string;
  workflowId?: string;
  dateRange?: string;
  startDate?: string;
  endDate?: string;
  businessComplexityMin?: number;
  businessComplexityMax?: number;
  technicalComplexityMin?: number;
  technicalComplexityMax?: number;
  aggregateBy?: AggregationLevel;
}

export interface WorkflowMetricsResponseDto {
  projectId: string;
  projectName: string;
  dateRange: {
    start: string;
    end: string;
  };
  aggregationLevel: AggregationLevel;
  summary: ComprehensiveMetricsDto;
  workflows?: WorkflowMetricsSummaryDto[];
  stories?: StoryMetricsSummaryDto[];
  epics?: EpicMetricsSummaryDto[];
  agents?: AgentMetricsSummaryDto[];
  trends: TrendAnalysisDto[];
  generatedAt: string;
}

export interface WorkflowComparisonResponseDto {
  comparison: {
    workflow1: WorkflowMetricsSummaryDto;
    workflow2: WorkflowMetricsSummaryDto;
    percentageDifference: {
      tokensPerLOC: number;
      costPerStory: number;
      avgDuration: number;
      defectsPerStory: number;
    };
    recommendation: string;
  };
  insights: string[];
  generatedAt: string;
}

// Story Execution Details
export interface AgentExecutionDto {
  runId: string;
  agentRole: string;
  agentName: string;
  executionNumber: number;
  startedAt: string;
  finishedAt: string;
  duration: number;
  tokensInput: number;
  tokensOutput: number;
  tokensTotal: number;
  iterations: number;
  locGenerated: number;
  success: boolean;
  metrics: {
    tokensPerLoc?: number;
    locPerPrompt?: number;
    runtimePerLoc?: number;
    runtimePerToken: number;
  };
  outputs: {
    description: string;
  };
}

export interface CommitDto {
  hash: string;
  author: string;
  message: string;
  timestamp: string;
  locAdded: number;
  locDeleted: number;
  filesChanged: string[];
}

export interface StoryExecutionSummaryDto {
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
  totalTime: number;
  totalTokens: number;
  tokensInput: number;
  tokensOutput: number;
  totalLoc: number;
  totalIterations: number;
  aggregateMetrics: {
    tokensPerLoc: number;
    locPerPrompt: number;
    runtimePerLoc: number;
    runtimePerToken: number;
  };
  costEstimate: number;
}

export interface GetStoryExecutionDetailsDto {
  storyId: string;
  includeCommits?: boolean;
  includeFileChanges?: boolean;
}

export interface StoryExecutionDetailsResponseDto {
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
  summary: StoryExecutionSummaryDto;
  commits?: CommitDto[];
  generatedAt: string;
}

// Per Agent Analytics
export interface GetPerAgentMetricsDto {
  projectId: string;
  dateRange?: DateRange;
  startDate?: string;
  endDate?: string;
}

export interface PerAgentAnalyticsResponseDto {
  // Structure to be defined when implemented
  [key: string]: any;
}

// Weekly Analysis
export interface GetWeeklyMetricsDto {
  projectId: string;
  startDate?: string;
  endDate?: string;
}

export interface WeeklyAnalysisResponseDto {
  // Structure to be defined when implemented
  [key: string]: any;
}
