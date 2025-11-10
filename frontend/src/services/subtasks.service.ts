import { apiClient } from './api.client';
import type {
  Subtask,
  CreateSubtaskDto,
  UpdateSubtaskDto,
  FilterSubtaskDto,
} from '../types';

export const subtasksService = {
  /**
   * Get all subtasks with optional filters
   */
  async getAll(filters?: FilterSubtaskDto): Promise<Subtask[]> {
    const response = await apiClient.get<Subtask[]>('/subtasks', {
      params: filters,
    });
    return response.data;
  },

  /**
   * Get a single subtask by ID
   */
  async getById(id: string): Promise<Subtask> {
    const response = await apiClient.get<Subtask>(`/subtasks/${id}`);
    return response.data;
  },

  /**
   * Create a new subtask
   */
  async create(data: CreateSubtaskDto): Promise<Subtask> {
    const response = await apiClient.post<Subtask>('/subtasks', data);
    return response.data;
  },

  /**
   * Update a subtask
   */
  async update(id: string, data: UpdateSubtaskDto): Promise<Subtask> {
    const response = await apiClient.patch<Subtask>(`/subtasks/${id}`, data);
    return response.data;
  },

  /**
   * Delete a subtask
   */
  async delete(id: string): Promise<void> {
    await apiClient.delete(`/subtasks/${id}`);
  },
};
