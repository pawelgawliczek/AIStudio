import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export enum RunStatus {
  PENDING = 'PENDING',
  RUNNING = 'RUNNING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
}

export interface CoordinatorMetrics {
  tokensInput?: number; // Total context tokens from /context
  tokensOutput?: number;
  totalTokens?: number;
  costUsd?: number;
  toolCalls?: number;
  userPrompts?: number;
  iterations?: number;
  dataSource?: 'context' | 'otel' | 'transcript'; // ST-110: Added 'context' for /context-based metrics
  // ST-110: Token breakdown from /context command (replaces cache metrics)
  tokensSystemPrompt?: number;
  tokensSystemTools?: number;
  tokensMcpTools?: number;
  tokensMemoryFiles?: number;
  tokensMessages?: number;
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
  coordinatorMetrics?: CoordinatorMetrics;
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
  executionOrder?: number; // ST-57: 0 for orchestrator, 1+ for components
  startedAt: string;
  finishedAt?: string;
  durationSeconds?: number;
  tokensInput?: number; // ST-57: Input tokens
  tokensOutput?: number; // ST-57: Output tokens
  totalTokens?: number;
  cost?: number; // ST-57: Cost in USD
  toolCalls?: number; // ST-57: Number of tool calls
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
  executionOrder?: number; // ST-57: 0 for orchestrator, 1+ for components
  startedAt: string;
  finishedAt?: string;
  durationSeconds?: number;
  userPrompts?: number;
  systemIterations?: number;
  tokensInput?: number;
  tokensOutput?: number;
  totalTokens?: number;
  // ST-110: Token breakdown from /context command
  tokensSystemPrompt?: number;
  tokensSystemTools?: number;
  tokensMcpTools?: number;
  tokensMemoryFiles?: number;
  tokensMessages?: number;
  cost?: number; // ST-57: Cost in USD
  toolCalls?: number; // ST-57: Number of tool calls
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
    const token = localStorage.getItem('accessToken');
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
      `${API_BASE_URL}/projects/${projectId}/workflow-runs`,
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
      `${API_BASE_URL}/projects/${projectId}/workflow-runs?${params.toString()}`,
      this.getAuthHeaders(),
    );
    return response.data;
  }

  async getOne(id: string, includeRelations = false): Promise<WorkflowRun> {
    const params = includeRelations ? '?includeRelations=true' : '';
    const response = await axios.get(
      `${API_BASE_URL}/projects/${id.split('/')[0]}/workflow-runs/${id}${params}`,
      this.getAuthHeaders(),
    );
    return response.data;
  }

  async getResults(projectId: string, id: string): Promise<WorkflowRunResults> {
    const response = await axios.get(
      `${API_BASE_URL}/projects/${projectId}/workflow-runs/${id}/results`,
      this.getAuthHeaders(),
    );
    return response.data;
  }

  async update(id: string, data: Partial<CreateWorkflowRunDto>): Promise<WorkflowRun> {
    const response = await axios.put(
      `${API_BASE_URL}/projects/${id.split('/')[0]}/workflow-runs/${id}`,
      data,
      this.getAuthHeaders(),
    );
    return response.data;
  }

  async delete(projectId: string, id: string): Promise<void> {
    await axios.delete(
      `${API_BASE_URL}/projects/${projectId}/workflow-runs/${id}`,
      this.getAuthHeaders(),
    );
  }
}

export const workflowRunsService = new WorkflowRunsService();
