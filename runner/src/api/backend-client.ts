/**
 * Backend Client
 * API client for communicating with the VibeStudio backend
 */

import axios, { AxiosInstance } from 'axios';
import {
  Workflow,
  WorkflowState,
  WorkflowRun,
  StoryContext,
  ComponentRun,
} from '../types';

/**
 * Workflow run update payload
 */
export interface WorkflowRunUpdate {
  status?: string;
  isPaused?: boolean;
  pauseReason?: string | null;
  errorMessage?: string;
}

/**
 * Component run start payload
 */
export interface ComponentRunStart {
  workflowRunId: string;
  componentId: string;
}

/**
 * Component run complete payload
 */
export interface ComponentRunComplete {
  componentRunId: string;
  success: boolean;
  output?: unknown;
  errorMessage?: string;
  tokensInput?: number;
  tokensOutput?: number;
  // ST-147: Turn tracking
  turnMetrics?: {
    totalTurns: number;
    manualPrompts: number;
    autoContinues: number;
  };
}

/**
 * Backend API Client
 */
export class BackendClient {
  private client: AxiosInstance;

  constructor(baseUrl: string) {
    this.client = axios.create({
      baseURL: baseUrl,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Add request logging
    this.client.interceptors.request.use(config => {
      console.log(`[BackendClient] ${config.method?.toUpperCase()} ${config.url}`);
      return config;
    });

    // Add response error handling
    this.client.interceptors.response.use(
      response => response,
      error => {
        console.error(`[BackendClient] Error:`, error.message);
        throw error;
      }
    );
  }

  /**
   * Get workflow with states
   */
  async getWorkflow(workflowId: string): Promise<Workflow> {
    const response = await this.client.get<Workflow>(`/api/workflows/${workflowId}`);
    return response.data;
  }

  /**
   * Get workflow states (ordered)
   */
  async getWorkflowStates(workflowId: string): Promise<WorkflowState[]> {
    const response = await this.client.get<WorkflowState[]>(
      `/api/workflows/${workflowId}/states`
    );
    return response.data.sort((a, b) => a.order - b.order);
  }

  /**
   * Get workflow run
   */
  async getWorkflowRun(runId: string): Promise<WorkflowRun> {
    const response = await this.client.get<WorkflowRun>(`/api/workflow-runs/${runId}`);
    return response.data;
  }

  /**
   * Update workflow run
   */
  async updateWorkflowRun(runId: string, update: WorkflowRunUpdate): Promise<WorkflowRun> {
    const response = await this.client.patch<WorkflowRun>(
      `/api/workflow-runs/${runId}`,
      update
    );
    return response.data;
  }

  /**
   * Get story context
   */
  async getStory(storyId: string): Promise<StoryContext> {
    const response = await this.client.get<StoryContext>(`/api/stories/${storyId}`);
    return response.data;
  }

  /**
   * Get component details
   */
  async getComponent(componentId: string): Promise<{
    id: string;
    name: string;
    inputInstructions: string;
    operationInstructions: string;
    outputInstructions: string;
    tools: string[];
    config: {
      modelId?: string;
      temperature?: number;
      maxRetries?: number;
      timeout?: number;
    };
    onFailure: 'stop' | 'skip' | 'retry' | 'pause';
  }> {
    const response = await this.client.get(`/api/components/${componentId}`);
    return response.data;
  }

  /**
   * Record component run start
   */
  async recordAgentStart(payload: ComponentRunStart): Promise<ComponentRun> {
    const response = await this.client.post<ComponentRun>(
      `/api/component-runs`,
      payload
    );
    return response.data;
  }

  /**
   * Record component run completion
   */
  async recordAgentComplete(payload: ComponentRunComplete): Promise<ComponentRun> {
    const response = await this.client.patch<ComponentRun>(
      `/api/component-runs/${payload.componentRunId}`,
      {
        status: payload.success ? 'completed' : 'failed',
        output: payload.output,
        errorMessage: payload.errorMessage,
        tokensInput: payload.tokensInput,
        tokensOutput: payload.tokensOutput,
        completedAt: new Date().toISOString(),
        // ST-147: Turn tracking
        totalTurns: payload.turnMetrics?.totalTurns,
        manualPrompts: payload.turnMetrics?.manualPrompts,
        autoContinues: payload.turnMetrics?.autoContinues,
      }
    );
    return response.data;
  }

  /**
   * Get team context (for orchestrator)
   */
  async getTeamContext(runId: string): Promise<{
    runId: string;
    workflow: Workflow;
    story: StoryContext | null;
    previousOutputs: Record<string, unknown>;
  }> {
    const response = await this.client.get(`/api/runner/team-context/${runId}`);
    return response.data;
  }

  /**
   * Save checkpoint to database
   */
  async saveCheckpoint(checkpoint: {
    runId: string;
    workflowId: string;
    storyId?: string;
    checkpointData: unknown;
  }): Promise<void> {
    await this.client.post('/api/runner/checkpoints', checkpoint);
  }

  /**
   * Load checkpoint from database
   */
  async loadCheckpoint(runId: string): Promise<unknown | null> {
    try {
      const response = await this.client.get(`/api/runner/checkpoints/${runId}`);
      return response.data.checkpointData;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Delete checkpoint
   */
  async deleteCheckpoint(runId: string): Promise<void> {
    await this.client.delete(`/api/runner/checkpoints/${runId}`);
  }

  /**
   * Report runner status
   */
  async reportStatus(runId: string, status: {
    state: string;
    currentStateId?: string;
    resourceUsage: {
      tokensUsed: number;
      agentSpawns: number;
      stateTransitions: number;
      durationMs: number;
    };
    warnings?: string[];
  }): Promise<void> {
    await this.client.post(`/api/runner/status/${runId}`, status);
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.client.get('/api/health');
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get breakpoints for a workflow run
   * ST-146: Breakpoint System
   */
  async getBreakpoints(runId: string): Promise<{
    breakpoints: Breakpoint[];
    breakpointsModifiedAt?: string;
  }> {
    const response = await this.client.get(`/api/runner/breakpoints/${runId}`);
    return response.data;
  }

  /**
   * Record breakpoint hit
   * ST-146: Breakpoint System
   */
  async recordBreakpointHit(breakpointId: string, context: {
    tokensUsed: number;
    agentSpawns: number;
    stateTransitions: number;
    durationMs: number;
  }): Promise<void> {
    await this.client.post(`/api/runner/breakpoints/${breakpointId}/hit`, {
      hitAt: new Date().toISOString(),
      context,
    });
  }

  /**
   * Check if runner should pause for breakpoint at given state/position
   * Returns breakpoint info if should pause, null otherwise
   * ST-146: Breakpoint System
   */
  async checkBreakpoint(
    runId: string,
    stateId: string,
    position: 'before' | 'after',
    context: BreakpointContext
  ): Promise<{
    shouldPause: boolean;
    breakpoint?: Breakpoint;
    reason?: string;
  }> {
    const response = await this.client.post(`/api/runner/breakpoints/${runId}/check`, {
      stateId,
      position,
      context,
    });
    return response.data;
  }

  /**
   * Create an approval request for a state
   * ST-148: Approval Gates
   */
  async createApprovalRequest(payload: CreateApprovalPayload): Promise<ApprovalRequest> {
    const response = await this.client.post<ApprovalRequest>(
      '/api/runner/approvals',
      payload
    );
    return response.data;
  }

  /**
   * Get pending approval for a workflow run
   * ST-148: Approval Gates
   */
  async getPendingApproval(runId: string): Promise<ApprovalRequest | null> {
    try {
      const response = await this.client.get<ApprovalRequest>(
        `/api/runner/approvals/${runId}/pending`
      );
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Get the latest approval for a workflow run (for resume check)
   * ST-148: Approval Gates
   */
  async getLatestApproval(runId: string): Promise<ApprovalRequest | null> {
    try {
      const response = await this.client.get<ApprovalRequest>(
        `/api/runner/approvals/${runId}/latest`
      );
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        return null;
      }
      throw error;
    }
  }
}

/**
 * Breakpoint type
 * ST-146: Breakpoint System
 */
export interface Breakpoint {
  id: string;
  stateId: string;
  stateName: string;
  stateOrder: number;
  position: 'before' | 'after';
  isActive: boolean;
  isTemporary: boolean;
  condition: Record<string, unknown> | null;
  hitAt: string | null;
  createdAt: string;
}

/**
 * Context for breakpoint evaluation
 * ST-146: Breakpoint System
 */
export interface BreakpointContext {
  tokensUsed: number;
  agentSpawns: number;
  stateTransitions: number;
  durationMs: number;
  currentStateIndex: number;
  totalStates: number;
  previousStateOutput?: Record<string, unknown>;
}

/**
 * Approval request type
 * ST-148: Approval Gates
 */
export interface ApprovalRequest {
  id: string;
  workflowRunId: string;
  stateId: string;
  projectId: string;
  stateName: string;
  stateOrder: number;
  requestedBy: string;
  requestedAt: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  contextSummary?: string;
  artifactKeys: string[];
  tokensUsed: number;
  resolvedAt?: string;
  resolvedBy?: string;
  resolution?: 'approved' | 'rejected' | 'cancelled';
  reason?: string;
  reExecutionMode?: 'feedback_injection' | 'artifact_edit' | 'both' | 'none';
  feedback?: string;
  editedArtifacts: string[];
}

/**
 * Create approval request payload
 * ST-148: Approval Gates
 */
export interface CreateApprovalPayload {
  workflowRunId: string;
  stateId: string;
  projectId: string;
  stateName: string;
  stateOrder: number;
  requestedBy: string;
  contextSummary?: string;
  artifactKeys?: string[];
  tokensUsed?: number;
}
