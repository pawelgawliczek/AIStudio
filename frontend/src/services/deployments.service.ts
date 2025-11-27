import api from './api';

export interface Deployment {
  id: string;
  storyId: string | null;
  storyKey: string | null;
  storyTitle: string | null;
  projectId: string | null;
  prNumber: number | null;
  status: DeploymentStatus;
  environment: string;
  branch: string | null;
  commitHash: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  deployedBy: string | null;
  deployedAt: string | null;
  completedAt: string | null;
  duration: number | null; // milliseconds
  errorMessage: string | null;
  approvalMethod: string | null;
  createdAt: string;
  updatedAt: string;
}

export type DeploymentStatus =
  | 'pending'
  | 'approved'
  | 'deploying'
  | 'deployed'
  | 'failed'
  | 'rolled_back';

export interface DeploymentFilters {
  status?: DeploymentStatus;
  environment?: string;
  limit?: number;
  offset?: number;
}

export interface DeploymentListResponse {
  data: Deployment[];
  total: number;
  limit: number;
  offset: number;
}

export interface StoryDeploymentsResponse {
  data: Deployment[];
  total: number;
  successCount: number;
  failedCount: number;
}

export interface DeploymentStats {
  total: number;
  byStatus: Record<string, number>;
  byEnvironment: Record<string, number>;
  todayCount: number;
  todaySuccessCount: number;
  todayFailedCount: number;
  recentDeployments: Deployment[];
}

export const deploymentsService = {
  async getAll(filters: DeploymentFilters = {}): Promise<DeploymentListResponse> {
    const params = new URLSearchParams();
    if (filters.status) params.append('status', filters.status);
    if (filters.environment) params.append('environment', filters.environment);
    if (filters.limit) params.append('limit', filters.limit.toString());
    if (filters.offset) params.append('offset', filters.offset.toString());

    const response = await api.get(`/deployments?${params.toString()}`);
    return response.data;
  },

  async getById(id: string): Promise<Deployment> {
    const response = await api.get(`/deployments/${id}`);
    return response.data;
  },

  async getByStoryId(storyId: string): Promise<StoryDeploymentsResponse> {
    const response = await api.get(`/deployments/story/${storyId}`);
    return response.data;
  },

  async getStats(): Promise<DeploymentStats> {
    const response = await api.get('/deployments/stats');
    return response.data;
  },
};
