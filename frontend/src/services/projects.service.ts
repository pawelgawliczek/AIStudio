import { apiClient } from './api.client';
import type { Project } from '../types';

export const projectsService = {
  /**
   * Get all projects
   */
  async getAll(): Promise<Project[]> {
    const response = await apiClient.get<Project[]>('/api/projects');
    return response.data;
  },

  /**
   * Get a single project by ID
   */
  async getById(id: string): Promise<Project> {
    const response = await apiClient.get<Project>(`/api/projects/${id}`);
    return response.data;
  },

  /**
   * Create a new project
   */
  async create(data: { name: string; description?: string }): Promise<Project> {
    const response = await apiClient.post<Project>('/api/projects', data);
    return response.data;
  },

  /**
   * Update a project
   */
  async update(id: string, data: { name?: string; description?: string }): Promise<Project> {
    const response = await apiClient.patch<Project>(`/api/projects/${id}`, data);
    return response.data;
  },

  /**
   * Delete a project
   */
  async delete(id: string): Promise<void> {
    await apiClient.delete(`/api/projects/${id}`);
  },
};
