import { apiClient } from './api.client';
import type { CoordinatorAgent, CreateCoordinatorDto, UpdateCoordinatorDto } from '../types';

export const coordinatorsService = {
  /**
   * Get all coordinators for a project
   */
  async getAll(
    projectId: string,
    options?: {
      active?: boolean;
      domain?: string;
      search?: string;
      includeStats?: boolean;
    }
  ): Promise<CoordinatorAgent[]> {
    const params: any = {};
    if (options?.active !== undefined) params.active = options.active;
    if (options?.domain) params.domain = options.domain;
    if (options?.search) params.search = options.search;

    const response = await apiClient.get<CoordinatorAgent[]>(
      `/projects/${projectId}/coordinators`,
      { params }
    );
    return response.data;
  },

  /**
   * Get a single coordinator by ID
   */
  async getById(projectId: string, id: string, includeStats = false): Promise<CoordinatorAgent> {
    const response = await apiClient.get<CoordinatorAgent>(
      `/projects/${projectId}/coordinators/${id}`,
      { params: { includeStats } }
    );
    return response.data;
  },

  /**
   * Create a new coordinator
   */
  async create(projectId: string, data: CreateCoordinatorDto): Promise<CoordinatorAgent> {
    const response = await apiClient.post<CoordinatorAgent>(
      `/projects/${projectId}/coordinators`,
      data
    );
    return response.data;
  },

  /**
   * Update a coordinator
   */
  async update(projectId: string, id: string, data: UpdateCoordinatorDto): Promise<CoordinatorAgent> {
    const response = await apiClient.put<CoordinatorAgent>(
      `/projects/${projectId}/coordinators/${id}`,
      data
    );
    return response.data;
  },

  /**
   * Delete a coordinator
   */
  async delete(projectId: string, id: string): Promise<void> {
    await apiClient.delete(`/projects/${projectId}/coordinators/${id}`);
  },

  /**
   * Activate a coordinator
   */
  async activate(projectId: string, id: string): Promise<CoordinatorAgent> {
    const response = await apiClient.post<CoordinatorAgent>(
      `/projects/${projectId}/coordinators/${id}/activate`
    );
    return response.data;
  },

  /**
   * Deactivate a coordinator
   */
  async deactivate(projectId: string, id: string): Promise<CoordinatorAgent> {
    const response = await apiClient.post<CoordinatorAgent>(
      `/projects/${projectId}/coordinators/${id}/deactivate`
    );
    return response.data;
  },
};
