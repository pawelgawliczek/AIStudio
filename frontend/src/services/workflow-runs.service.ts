import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

export enum RunStatus {
  PENDING = 'PENDING',
  RUNNING = 'RUNNING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
}

export interface WorkflowRun {
  id: string;
  projectId: string;
  workflowId: string;
  storyId?: string;
  epicId?: string;
  startedAt: string;
  finishedAt?: string;
  durationSeconds?: number;
  totalUserPrompts?: number;
  totalIterations?: number;
  totalInterventions?: number;
  avgPromptsPerComponent?: number;
  totalTokensInput?: number;
  totalTokensOutput?: number;
  totalTokens?: number;
  totalLocGenerated?: number;
  estimatedCost?: number;
  status: RunStatus;
  errorMessage?: string;
  coordinatorDecisions?: any;
  createdAt: string;
  updatedAt: string;
  workflow?: {
    id: string;
    name: string;
    version: string;
  };
  story?: {
    id: string;
    key: string;
    title: string;
  };
  componentRuns?: ComponentRunSummary[];
}

export interface ComponentRunSummary {
  id: string;
  componentId: string;
  componentName: string;
  startedAt: string;
  finishedAt?: string;
  durationSeconds?: number;
  totalTokens?: number;
  locGenerated?: number;
  status: RunStatus;
  success: boolean;
}

export interface WorkflowRunResults {
  workflowRun: WorkflowRun;
  componentRuns: ComponentRunDetails[];
  summary: {
    totalComponentRuns: number;
    successfulRuns: number;
    failedRuns: number;
    totalDuration?: number;
    totalTokens?: number;
    totalLoc?: number;
    totalIterations?: number;
    estimatedCost?: number;
  };
  efficiency: {
    tokensPerLoc?: string;
    locPerPrompt?: string;
    runtimePerLoc?: string;
    runtimePerToken?: string;
  };
  coordinatorDecisions?: any;
}

export interface ComponentRunDetails {
  id: string;
  componentId: string;
  componentName: string;
  componentDescription?: string;
  startedAt: string;
  finishedAt?: string;
  durationSeconds?: number;
  userPrompts?: number;
  systemIterations?: number;
  tokensInput?: number;
  tokensOutput?: number;
  totalTokens?: number;
  locGenerated?: number;
  filesModified?: string[];
  commits?: string[];
  tokensPerLoc?: number;
  locPerPrompt?: number;
  runtimePerLoc?: number;
  runtimePerToken?: number;
  status: RunStatus;
  success: boolean;
  errorMessage?: string;
  output?: string;
}

export interface CreateWorkflowRunDto {
  workflowId: string;
  storyId?: string;
  epicId?: string;
  startedAt: string;
  finishedAt?: string;
  durationSeconds?: number;
  totalUserPrompts?: number;
  totalIterations?: number;
  totalInterventions?: number;
  avgPromptsPerComponent?: number;
  totalTokensInput?: number;
  totalTokensOutput?: number;
  totalTokens?: number;
  totalLocGenerated?: number;
  estimatedCost?: number;
  status?: RunStatus;
  errorMessage?: string;
  coordinatorDecisions?: any;
}

class WorkflowRunsService {
  private getAuthHeaders() {
    const token = localStorage.getItem('token');
    return {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    };
  }

  async create(
    projectId: string,
    data: CreateWorkflowRunDto,
  ): Promise<WorkflowRun> {
    const response = await axios.post(
      `${API_BASE_URL}/api/projects/${projectId}/workflow-runs`,
      data,
      this.getAuthHeaders(),
    );
    return response.data;
  }

  async getAll(
    projectId: string,
    options?: {
      workflowId?: string;
      storyId?: string;
      status?: RunStatus;
      includeRelations?: boolean;
    },
  ): Promise<WorkflowRun[]> {
    const params = new URLSearchParams();
    if (options?.workflowId) params.append('workflowId', options.workflowId);
    if (options?.storyId) params.append('storyId', options.storyId);
    if (options?.status) params.append('status', options.status);
    if (options?.includeRelations) params.append('includeRelations', 'true');

    const response = await axios.get(
      `${API_BASE_URL}/api/projects/${projectId}/workflow-runs?${params.toString()}`,
      this.getAuthHeaders(),
    );
    return response.data;
  }

  async getOne(id: string, includeRelations = false): Promise<WorkflowRun> {
    const params = includeRelations ? '?includeRelations=true' : '';
    const response = await axios.get(
      `${API_BASE_URL}/api/projects/${id.split('/')[0]}/workflow-runs/${id}${params}`,
      this.getAuthHeaders(),
    );
    return response.data;
  }

  async getResults(projectId: string, id: string): Promise<WorkflowRunResults> {
    const response = await axios.get(
      `${API_BASE_URL}/api/projects/${projectId}/workflow-runs/${id}/results`,
      this.getAuthHeaders(),
    );
    return response.data;
  }

  async update(id: string, data: Partial<CreateWorkflowRunDto>): Promise<WorkflowRun> {
    const response = await axios.put(
      `${API_BASE_URL}/api/projects/${id.split('/')[0]}/workflow-runs/${id}`,
      data,
      this.getAuthHeaders(),
    );
    return response.data;
  }

  async delete(projectId: string, id: string): Promise<void> {
    await axios.delete(
      `${API_BASE_URL}/api/projects/${projectId}/workflow-runs/${id}`,
      this.getAuthHeaders(),
    );
  }
}

export const workflowRunsService = new WorkflowRunsService();
