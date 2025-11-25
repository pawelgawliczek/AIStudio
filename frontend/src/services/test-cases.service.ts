import { apiClient } from './api.client';
import type {
  TestCase,
  CreateTestCaseDto,
  UpdateTestCaseDto,
  SearchTestCaseDto,
  UseCaseCoverage,
  ComponentCoverage,
  CoverageGap,
  PaginatedResponse,
} from '../types';

class TestCasesService {
  /**
   * Create a new test case
   */
  async create(data: CreateTestCaseDto): Promise<TestCase> {
    const response = await apiClient.post<TestCase>('/test-cases', data);
    return response.data;
  }

  /**
   * Get all test cases with optional filtering
   */
  async findAll(params?: SearchTestCaseDto): Promise<PaginatedResponse<TestCase>> {
    const response = await apiClient.get<PaginatedResponse<TestCase>>('/test-cases', {
      params,
    });
    return response.data;
  }

  /**
   * Get a single test case by ID
   */
  async findOne(id: string): Promise<TestCase> {
    const response = await apiClient.get<TestCase>(`/test-cases/${id}`);
    return response.data;
  }

  /**
   * Update a test case
   */
  async update(id: string, data: UpdateTestCaseDto): Promise<TestCase> {
    const response = await apiClient.put<TestCase>(`/test-cases/${id}`, data);
    return response.data;
  }

  /**
   * Delete a test case
   */
  async delete(id: string): Promise<void> {
    await apiClient.delete(`/test-cases/${id}`);
  }

  /**
   * Get coverage for a specific use case
   */
  async getUseCaseCoverage(useCaseId: string): Promise<UseCaseCoverage> {
    const response = await apiClient.get<UseCaseCoverage>(
      `/test-cases/use-case/${useCaseId}/coverage`
    );
    return response.data;
  }

  /**
   * Get coverage gaps for a use case
   */
  async getCoverageGaps(useCaseId: string): Promise<CoverageGap[]> {
    const response = await apiClient.get<CoverageGap[]>(
      `/test-cases/use-case/${useCaseId}/gaps`
    );
    return response.data;
  }

  /**
   * Get component coverage for a project
   */
  async getComponentCoverage(
    projectId: string,
    component?: string
  ): Promise<ComponentCoverage[]> {
    const params = component ? { component } : undefined;
    const response = await apiClient.get<ComponentCoverage[]>(
      `/test-cases/project/${projectId}/component-coverage`,
      { params }
    );
    return response.data;
  }
}

export const testCasesService = new TestCasesService();
