import { apiClient } from './api.client';
import type { Workflow, CreateWorkflowDto, UpdateWorkflowDto } from '../types';

export const workflowsService = {
  /**
   * Get all workflows for a project
   */
  async getAll(
    projectId: string,
    options?: {
      active?: boolean;
      coordinatorId?: string;
      search?: string;
      includeStats?: boolean;
    }
  ): Promise<Workflow[]> {
    const params: any = {};
    if (options?.active !== undefined) params.active = options.active;
    if (options?.coordinatorId) params.coordinatorId = options.coordinatorId;
    if (options?.search) params.search = options.search;

    const response = await apiClient.get<Workflow[]>(
      `/projects/${projectId}/workflows`,
      { params }
    );
    return response.data;
  },

  /**
   * Get a single workflow by ID
   */
  async getById(projectId: string, id: string, includeStats = false): Promise<Workflow> {
    const response = await apiClient.get<Workflow>(
      `/projects/${projectId}/workflows/${id}`,
      { params: { includeStats } }
    );
    return response.data;
  },

  /**
   * Create a new workflow
   */
  async create(projectId: string, data: CreateWorkflowDto): Promise<Workflow> {
    const response = await apiClient.post<Workflow>(
      `/projects/${projectId}/workflows`,
      data
    );
    return response.data;
  },

  /**
   * Update a workflow
   */
  async update(projectId: string, id: string, data: UpdateWorkflowDto): Promise<Workflow> {
    const response = await apiClient.put<Workflow>(
      `/projects/${projectId}/workflows/${id}`,
      data
    );
    return response.data;
  },

  /**
   * Delete a workflow
   */
  async delete(projectId: string, id: string): Promise<void> {
    await apiClient.delete(`/projects/${projectId}/workflows/${id}`);
  },

  /**
   * Activate a workflow
   */
  async activate(projectId: string, id: string): Promise<Workflow> {
    const response = await apiClient.post<Workflow>(
      `/projects/${projectId}/workflows/${id}/activate`
    );
    return response.data;
  },

  /**
   * Deactivate a workflow
   */
  async deactivate(projectId: string, id: string): Promise<Workflow> {
    const response = await apiClient.post<Workflow>(
      `/projects/${projectId}/workflows/${id}/deactivate`
    );
    return response.data;
  },
};
