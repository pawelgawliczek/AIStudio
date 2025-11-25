import { apiClient } from './api.client';
import type {
  TestExecution,
  ReportTestExecutionDto,
  TestExecutionStatistics,
} from '../types';

class TestExecutionsService {
  /**
   * Report a new test execution (typically called by CI/CD)
   */
  async report(data: ReportTestExecutionDto): Promise<TestExecution> {
    const response = await apiClient.post<TestExecution>('/test-executions/report', data);
    return response.data;
  }

  /**
   * Get all executions for a test case
   */
  async getByTestCase(testCaseId: string): Promise<TestExecution[]> {
    const response = await apiClient.get<TestExecution[]>(
      `/test-executions/test-case/${testCaseId}`
    );
    return response.data;
  }

  /**
   * Get all executions for a story
   */
  async getByStory(storyId: string): Promise<TestExecution[]> {
    const response = await apiClient.get<TestExecution[]>(
      `/test-executions/story/${storyId}`
    );
    return response.data;
  }

  /**
   * Get statistics for a test case
   */
  async getStatistics(testCaseId: string): Promise<TestExecutionStatistics> {
    const response = await apiClient.get<TestExecutionStatistics>(
      `/test-executions/test-case/${testCaseId}/statistics`
    );
    return response.data;
  }

  /**
   * Get a single execution by ID
   */
  async findOne(id: string): Promise<TestExecution> {
    const response = await apiClient.get<TestExecution>(`/test-executions/${id}`);
    return response.data;
  }
}

export const testExecutionsService = new TestExecutionsService();
