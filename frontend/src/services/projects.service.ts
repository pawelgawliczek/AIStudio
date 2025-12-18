import type { Project } from '../types';
import { apiClient } from './api.client';

export const projectsService = {
  /**
   * Get all projects
   */
  async getAll(): Promise<Project[]> {
    const response = await apiClient.get<Project[]>('/projects');
    return response.data;
  },

  /**
   * Get a single project by ID
   */
  async getById(id: string): Promise<Project> {
    const response = await apiClient.get<Project>(`/projects/${id}`);
    return response.data;
  },

  /**
   * Create a new project
   */
  async create(data: { name: string; description?: string }): Promise<Project> {
    const response = await apiClient.post<Project>('/projects', data);
    return response.data;
  },

  /**
   * Update a project
   */
  async update(id: string, data: { name?: string; description?: string }): Promise<Project> {
    const response = await apiClient.patch<Project>(`/projects/${id}`, data);
    return response.data;
  },

  /**
   * Delete a project
   */
  async delete(id: string): Promise<void> {
    await apiClient.delete(`/projects/${id}`);
  },
};
