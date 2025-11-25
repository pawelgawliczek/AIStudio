import { apiClient } from './api.client';
import type { Component, CreateComponentDto, UpdateComponentDto } from '../types';

export const componentsService = {
  /**
   * Get all components for a project
   */
  async getAll(
    projectId: string,
    options?: {
      active?: boolean;
      tags?: string[];
      search?: string;
      includeStats?: boolean;
    }
  ): Promise<Component[]> {
    const params: any = {};
    if (options?.active !== undefined) params.active = options.active;
    if (options?.tags) params.tags = options.tags.join(',');
    if (options?.search) params.search = options.search;

    const response = await apiClient.get<Component[]>(
      `/api/projects/${projectId}/components`,
      { params }
    );
    return response.data;
  },

  /**
   * Get a single component by ID
   */
  async getById(projectId: string, id: string, includeStats = false): Promise<Component> {
    const response = await apiClient.get<Component>(
      `/api/projects/${projectId}/components/${id}`,
      { params: { includeStats } }
    );
    return response.data;
  },

  /**
   * Create a new component
   */
  async create(projectId: string, data: CreateComponentDto): Promise<Component> {
    const response = await apiClient.post<Component>(
      `/api/projects/${projectId}/components`,
      data
    );
    return response.data;
  },

  /**
   * Update a component
   */
  async update(projectId: string, id: string, data: UpdateComponentDto): Promise<Component> {
    const response = await apiClient.put<Component>(
      `/api/projects/${projectId}/components/${id}`,
      data
    );
    return response.data;
  },

  /**
   * Delete a component
   */
  async delete(projectId: string, id: string): Promise<void> {
    await apiClient.delete(`/api/projects/${projectId}/components/${id}`);
  },

  /**
   * Activate a component
   */
  async activate(projectId: string, id: string): Promise<Component> {
    const response = await apiClient.post<Component>(
      `/api/projects/${projectId}/components/${id}/activate`
    );
    return response.data;
  },

  /**
   * Deactivate a component
   */
  async deactivate(projectId: string, id: string): Promise<Component> {
    const response = await apiClient.post<Component>(
      `/api/projects/${projectId}/components/${id}/deactivate`
    );
    return response.data;
  },

  /**
   * Test a component with sample data
   */
  async test(projectId: string, id: string, testInput: any): Promise<any> {
    const response = await apiClient.post(
      `/api/projects/${projectId}/components/${id}/test`,
      testInput
    );
    return response.data;
  },
};
