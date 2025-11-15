import axios from 'axios';
import type { Story, Epic, Subtask, FilterStoryDto, UpdateStoryStatusDto, CreateStoryDto, UpdateStoryDto } from '../types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

// Create axios instance
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Stories API
export const storiesApi = {
  getAll: (filters?: FilterStoryDto) =>
    api.get<Story[]>('/stories', { params: filters }),

  getOne: (id: string) =>
    api.get<Story>(`/stories/${id}`),

  create: (data: CreateStoryDto) =>
    api.post<Story>('/stories', data),

  update: (id: string, data: UpdateStoryDto) =>
    api.patch<Story>(`/stories/${id}`, data),

  updateStatus: (id: string, data: UpdateStoryStatusDto) =>
    api.patch<Story>(`/stories/${id}/status`, data),

  updatePriority: (id: string, priority: number) =>
    api.patch<Story>(`/stories/${id}/priority`, { priority }),

  reassignEpic: (id: string, epicId: string | null, priority?: number) =>
    api.patch<Story>(`/stories/${id}/epic`, { epicId, priority }),

  delete: (id: string) =>
    api.delete(`/stories/${id}`),
};

// Runs API
export const runsApi = {
  getByStory: (storyId: string) =>
    api.get(`/runs/story/${storyId}`),

  getByProject: (projectId: string) =>
    api.get(`/runs/project/${projectId}`),

  getStatistics: (storyId: string) =>
    api.get(`/runs/story/${storyId}/statistics`),
};

// Commits API
export const commitsApi = {
  getByStory: (storyId: string) =>
    api.get(`/commits/story/${storyId}`),

  getByProject: (projectId: string) =>
    api.get(`/commits/project/${projectId}`),

  getStatistics: (storyId: string) =>
    api.get(`/commits/story/${storyId}/statistics`),
};

// Epics API
export const epicsApi = {
  getAll: (projectId: string) =>
    api.get<Epic[]>('/epics', { params: { projectId } }),

  getOne: (id: string) =>
    api.get<Epic>(`/epics/${id}`),

  create: (data: { projectId: string; title: string; description: string; priority?: number }) =>
    api.post<Epic>('/epics', data),

  update: (id: string, data: Partial<Epic>) =>
    api.patch<Epic>(`/epics/${id}`, data),

  updatePriority: (id: string, priority: number) =>
    api.patch<Epic>(`/epics/${id}/priority`, { priority }),

  delete: (id: string) =>
    api.delete(`/epics/${id}`),

  getPlanningOverview: (projectId?: string) =>
    api.get('/epics/planning/overview', { params: projectId ? { projectId } : {} }),
};

// Subtasks API
export const subtasksApi = {
  getAll: (storyId: string) =>
    api.get<Subtask[]>('/subtasks', { params: { storyId } }),
};

// Layers API
export const layersApi = {
  getAll: (projectId: string) =>
    api.get('/layers', { params: { projectId } }),
};

// Components API
export const componentsApi = {
  getAll: (projectId: string) =>
    api.get('/components', { params: { projectId } }),
};

// Workflow runs API
export const workflowRunsApi = {
  getActiveWorkflowForProject: async (projectId: string) => {
    const response = await api.get(`/projects/${projectId}/workflow-runs/active/current`);
    return response.data;
  },
};

// Export named functions for convenience
export const getActiveWorkflowForProject = workflowRunsApi.getActiveWorkflowForProject;

// Export api as named export for convenience
export { api };

export default api;
