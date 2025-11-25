import { apiClient } from './api.client';
import type {
  Story,
  CreateStoryDto,
  UpdateStoryDto,
  UpdateStoryStatusDto,
  FilterStoryDto,
  PaginatedResponse,
} from '../types';

export const storiesService = {
  /**
   * Get all stories with optional filters
   */
  async getAll(filters?: FilterStoryDto): Promise<PaginatedResponse<Story>> {
    const response = await apiClient.get<PaginatedResponse<Story>>('/api/stories', {
      params: filters,
    });
    return response.data;
  },

  /**
   * Get a single story by ID
   */
  async getById(id: string): Promise<Story> {
    const response = await apiClient.get<Story>(`/api/stories/${id}`);
    return response.data;
  },

  /**
   * Create a new story
   */
  async create(data: CreateStoryDto): Promise<Story> {
    const response = await apiClient.post<Story>('/api/stories', data);
    return response.data;
  },

  /**
   * Update a story
   */
  async update(id: string, data: UpdateStoryDto): Promise<Story> {
    const response = await apiClient.patch<Story>(`/api/stories/${id}`, data);
    return response.data;
  },

  /**
   * Update story status
   */
  async updateStatus(id: string, data: UpdateStoryStatusDto): Promise<Story> {
    const response = await apiClient.patch<Story>(`/api/stories/${id}/status`, data);
    return response.data;
  },

  /**
   * Assign story to framework
   */
  async assignFramework(id: string, frameworkId: string): Promise<Story> {
    const response = await apiClient.patch<Story>(`/api/stories/${id}/framework`, {
      frameworkId,
    });
    return response.data;
  },

  /**
   * Delete a story
   */
  async delete(id: string): Promise<void> {
    await apiClient.delete(`/api/stories/${id}`);
  },
};
