import type {
  Story,
  CreateStoryDto,
  UpdateStoryDto,
  UpdateStoryStatusDto,
  FilterStoryDto,
  PaginatedResponse,
} from '../types';
import { apiClient } from './api.client';

export const storiesService = {
  /**
   * Get all stories with optional filters
   */
  async getAll(filters?: FilterStoryDto): Promise<PaginatedResponse<Story>> {
    const response = await apiClient.get<PaginatedResponse<Story>>('/stories', {
      params: filters,
    });
    return response.data;
  },

  /**
   * Get a single story by ID
   */
  async getById(id: string): Promise<Story> {
    const response = await apiClient.get<Story>(`/stories/${id}`);
    return response.data;
  },

  /**
   * Create a new story
   */
  async create(data: CreateStoryDto): Promise<Story> {
    const response = await apiClient.post<Story>('/stories', data);
    return response.data;
  },

  /**
   * Update a story
   */
  async update(id: string, data: UpdateStoryDto): Promise<Story> {
    const response = await apiClient.patch<Story>(`/stories/${id}`, data);
    return response.data;
  },

  /**
   * Update story status
   */
  async updateStatus(id: string, data: UpdateStoryStatusDto): Promise<Story> {
    const response = await apiClient.patch<Story>(`/stories/${id}/status`, data);
    return response.data;
  },

  /**
   * Assign story to framework
   */
  async assignFramework(id: string, frameworkId: string): Promise<Story> {
    const response = await apiClient.patch<Story>(`/stories/${id}/framework`, {
      frameworkId,
    });
    return response.data;
  },

  /**
   * Delete a story
   */
  async delete(id: string): Promise<void> {
    await apiClient.delete(`/stories/${id}`);
  },
};
