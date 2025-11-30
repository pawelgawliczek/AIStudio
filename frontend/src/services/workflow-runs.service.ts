import { apiClient } from './api.client';

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
    // ST-147: Session telemetry aggregates
    totalTurns?: number;
    totalManualPrompts?: number;
    totalAutoContinues?: number;
    automationRate?: number;
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
  // ST-147: Session telemetry per component
  totalTurns?: number;
  manualPrompts?: number;
  autoContinues?: number;
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
  async create(
    projectId: string,
    data: CreateWorkflowRunDto,
  ): Promise<WorkflowRun> {
    const response = await apiClient.post(
      `/projects/${projectId}/workflow-runs`,
      data
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
    const params: any = {};
    if (options?.workflowId) params.workflowId = options.workflowId;
    if (options?.storyId) params.storyId = options.storyId;
    if (options?.status) params.status = options.status;
    if (options?.includeRelations) params.includeRelations = 'true';

    const response = await apiClient.get(
      `/projects/${projectId}/workflow-runs`,
      { params }
    );
    return response.data;
  }

  async getOne(id: string, includeRelations = false): Promise<WorkflowRun> {
    const params = includeRelations ? { includeRelations: 'true' } : {};
    const response = await apiClient.get(
      `/projects/${id.split('/')[0]}/workflow-runs/${id}`,
      { params }
    );
    return response.data;
  }

  async getResults(projectId: string, id: string): Promise<WorkflowRunResults> {
    const response = await apiClient.get(
      `/projects/${projectId}/workflow-runs/${id}/results`
    );
    return response.data;
  }

  async update(id: string, data: Partial<CreateWorkflowRunDto>): Promise<WorkflowRun> {
    const response = await apiClient.put(
      `/projects/${id.split('/')[0]}/workflow-runs/${id}`,
      data
    );
    return response.data;
  }

  async delete(projectId: string, id: string): Promise<void> {
    await apiClient.delete(
      `/projects/${projectId}/workflow-runs/${id}`
    );
  }
}

export const workflowRunsService = new WorkflowRunsService();
