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

    const response = await apiClient.get(`/api/test-executions?${params.toString()}`);
    return response.data;
  },

  /**
   * Get detailed test execution by ID
   */
  async getById(id: string): Promise<TestExecution> {
    const response = await apiClient.get(`/api/test-executions/${id}`);
    return response.data;
  },
};
