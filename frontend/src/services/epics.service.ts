import type {
  Epic,
  CreateEpicDto,
  UpdateEpicDto,
  FilterEpicDto,
} from '../types';
import { apiClient } from './api.client';

export const epicsService = {
  /**
   * Get all epics with optional filters
   */
  async getAll(filters?: FilterEpicDto): Promise<Epic[]> {
    const response = await apiClient.get<Epic[]>('/epics', {
      params: filters,
    });
    return response.data;
  },

  /**
   * Get a single epic by ID
   */
  async getById(id: string): Promise<Epic> {
    const response = await apiClient.get<Epic>(`/epics/${id}`);
    return response.data;
  },

  /**
   * Create a new epic
   */
  async create(data: CreateEpicDto): Promise<Epic> {
    const response = await apiClient.post<Epic>('/epics', data);
    return response.data;
  },

  /**
   * Update an epic
   */
  async update(id: string, data: UpdateEpicDto): Promise<Epic> {
    const response = await apiClient.patch<Epic>(`/epics/${id}`, data);
    return response.data;
  },

  /**
   * Delete an epic
   */
  async delete(id: string): Promise<void> {
    await apiClient.delete(`/epics/${id}`);
  },
};
