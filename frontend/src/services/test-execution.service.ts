import { apiClient } from './api.client';

export interface TestExecutionFilters {
  projectId?: string;
  status?: 'pass' | 'fail' | 'skip' | 'error';
  testLevel?: 'unit' | 'integration' | 'e2e';
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
}

export interface TestExecution {
  id: string;
  testCaseId: string;
  testCase: {
    id: string;
    key: string;
    title: string;
    testLevel: string;
    projectId: string;
  };
  story?: {
    id: string;
    key: string;
    title: string;
  };
  commit?: {
    hash: string;
    message: string;
    author: string;
    timestamp: string;
  };
  status: 'pass' | 'fail' | 'skip' | 'error';
  durationMs: number;
  executedAt: string;
  errorMessage?: string;
  stackTrace?: string;
  coveragePercentage?: number;
  linesCovered?: number;
  linesTotal?: number;
  environment: string;
  ciRunId?: string;
}

export interface TestExecutionListResponse {
  data: TestExecution[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
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

export interface TestTrendDay {
  date: string;
  unit: {
    passed: number;
    failed: number;
    coverage: number;
  };
  integration: {
    passed: number;
    failed: number;
    coverage: number;
  };
  e2e: {
    passed: number;
    failed: number;
    coverage: number;
  };
}

export interface FlakyTest {
  testKey: string;
  title: string;
  testLevel: string;
  totalRuns: number;
  passCount: number;
  failCount: number;
  passRate: number;
  failRate: number;
  lastFailedAt: string | null;
}

export interface SlowTest {
  testKey: string;
  title: string;
  testLevel: string;
  avgDurationMs: number;
  maxDurationMs: number;
  runCount: number;
}

export interface TestTrendDataPoint {
  date: string;
  totalTests: number;
  passRate: number;
  avgDurationMs: number;
  coverage: number;
}

export interface TestPerformanceTrends {
  trends: TestTrendDataPoint[];
}

export const testExecutionService = {
  /**
   * Get paginated list of test executions with filters
   */
  async list(filters: TestExecutionFilters = {}): Promise<TestExecutionListResponse> {
    const params = new URLSearchParams();

    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        params.append(key, value.toString());
      }
    });

    const response = await apiClient.get(`/test-executions?${params.toString()}`);
    return response.data;
  },

  /**
   * Get detailed test execution by ID
   */
  async getById(id: string): Promise<TestExecution> {
    const response = await apiClient.get(`/test-executions/${id}`);
    return response.data;
  },

  /**
   * ST-132: Get project test execution summary by test level
   */
  async getProjectSummary(projectId: string): Promise<TestSummaryByLevel> {
    const response = await apiClient.get(`/test-executions/project/${projectId}/summary`);
    return response.data;
  },

  /**
   * ST-132: Get project test execution trends over time
   */
  async getProjectTrends(projectId: string, days: number = 30): Promise<TestTrendDay[]> {
    const response = await apiClient.get(`/test-executions/project/${projectId}/trends?days=${days}`);
    return response.data;
  },

  /**
   * ST-137: Get flaky tests analytics
   */
  async getFlakyTests(
    projectId: string,
    days: number = 30,
    threshold: number = 0.1
  ): Promise<FlakyTest[]> {
    const params = new URLSearchParams({
      projectId,
      days: days.toString(),
      threshold: threshold.toString(),
    });
    const response = await apiClient.get(`/test-executions/analytics/flaky-tests?${params.toString()}`);
    return response.data;
  },

  /**
   * ST-137: Get slow tests analytics
   */
  async getSlowTests(projectId: string, limit: number = 10): Promise<SlowTest[]> {
    const params = new URLSearchParams({
      projectId,
      limit: limit.toString(),
    });
    const response = await apiClient.get(`/test-executions/analytics/slow-tests?${params.toString()}`);
    return response.data;
  },

  /**
   * ST-137: Get test performance trends
   */
  async getTestPerformanceTrends(projectId: string, days: number = 30): Promise<TestPerformanceTrends> {
    const params = new URLSearchParams({
      projectId,
      days: days.toString(),
    });
    const response = await apiClient.get(`/test-executions/analytics/trends?${params.toString()}`);
    return response.data;
  },
};
