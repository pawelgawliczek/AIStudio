import { apiClient } from './api.client';
import type { UseCase, UseCaseVersion, CreateUseCaseDto, UpdateUseCaseDto } from '../types';

export const useCasesService = {
  // Get all use cases with optional filters
  async getAll(params?: {
    projectId?: string;
    area?: string;
    search?: string;
  }): Promise<UseCase[]> {
    const response = await apiClient.get('/api/use-cases', { params });
    return response.data;
  },

  // Get single use case by ID
  async getById(id: string): Promise<UseCase> {
    const response = await apiClient.get(`/api/use-cases/${id}`);
    return response.data;
  },

  // Search use cases (semantic, text, or component-based)
  async search(params: {
    projectId: string;
    query: string;
    mode?: 'semantic' | 'text' | 'component';
    component?: string;
    layer?: string;
    limit?: number;
  }): Promise<UseCase[]> {
    const response = await apiClient.get('/api/use-cases/search', { params });
    return response.data;
  },

  // Create new use case
  async create(data: CreateUseCaseDto): Promise<UseCase> {
    const response = await apiClient.post('/api/use-cases', data);
    return response.data;
  },

  // Update use case (creates new version)
  async update(id: string, data: UpdateUseCaseDto): Promise<UseCase> {
    const response = await apiClient.put(`/api/use-cases/${id}`, data);
    return response.data;
  },

  // Delete use case
  async delete(id: string): Promise<void> {
    await apiClient.delete(`/api/use-cases/${id}`);
  },

  // Get version history for use case
  async getVersionHistory(useCaseId: string): Promise<UseCaseVersion[]> {
    const response = await apiClient.get(`/api/use-cases/${useCaseId}/versions`);
    return response.data;
  },

  // Link use case to story
  async linkToStory(useCaseId: string, storyId: string): Promise<void> {
    await apiClient.post('/api/use-cases/link', {
      useCaseId,
      storyId,
    });
  },

  // Unlink use case from story
  async unlinkFromStory(useCaseId: string, storyId: string): Promise<void> {
    await apiClient.delete(`/api/use-cases/link/${useCaseId}/${storyId}`);
  },

  // Find related use cases
  async findRelated(useCaseId: string, limit?: number): Promise<UseCase[]> {
    const response = await apiClient.get(`/api/use-cases/${useCaseId}/related`, {
      params: { limit },
    });
    return response.data;
  },

  // Regenerate embeddings (admin only)
  async regenerateEmbeddings(projectId: string): Promise<void> {
    await apiClient.post('/api/use-cases/regenerate-embeddings', { projectId });
  },
};
