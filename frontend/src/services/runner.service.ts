import { apiClient } from './api.client';

/**
 * Runner Service
 * ST-195: Workflow Control & Results Dashboard
 *
 * API client for workflow runner control endpoints.
 * Provides methods for pause, resume, repeat, advance, and status retrieval.
 */

export interface RunnerStatus {
  runId: string;
  status: string;
  currentStateId?: string;
  checkpoint?: unknown;
  resourceUsage?: {
    tokensUsed: number;
    agentSpawns: number;
    stateTransitions: number;
    durationMs: number;
  };
}

export interface RunnerResponse {
  success: boolean;
  runId: string;
  status: string;
  message?: string;
}

export interface StartRunnerParams {
  workflowId: string;
  storyId?: string;
  triggeredBy?: string;
}

export interface RepeatStepParams {
  reason?: string;
  feedback?: string;
}

export interface AdvanceStepParams {
  output?: Record<string, unknown>;
  skipToState?: string;
}

export const runnerService = {
  /**
   * Get workflow run status
   * GET /api/runner/:runId/status
   */
  async getStatus(runId: string): Promise<RunnerStatus> {
    const response = await apiClient.get<RunnerStatus>(`/runner/${runId}/status`);
    return response.data;
  },

  /**
   * Start workflow run
   * POST /runner/:runId/start
   */
  async startRunner(runId: string, params: StartRunnerParams): Promise<RunnerResponse> {
    const response = await apiClient.post<RunnerResponse>(`/runner/${runId}/start`, params);
    return response.data;
  },

  /**
   * Pause workflow run
   * POST /runner/:runId/pause
   */
  async pauseRunner(runId: string, reason?: string): Promise<RunnerResponse> {
    const response = await apiClient.post<RunnerResponse>(`/runner/${runId}/pause`, {
      reason,
    });
    return response.data;
  },

  /**
   * Resume paused workflow run
   * POST /runner/:runId/resume
   */
  async resumeRunner(runId: string): Promise<RunnerResponse> {
    const response = await apiClient.post<RunnerResponse>(`/runner/${runId}/resume`, {});
    return response.data;
  },

  /**
   * Repeat current step with feedback
   * POST /runner/:runId/repeat
   */
  async repeatStep(runId: string, params: RepeatStepParams): Promise<RunnerResponse> {
    const response = await apiClient.post<RunnerResponse>(`/runner/${runId}/repeat`, params);
    return response.data;
  },

  /**
   * Advance to next phase or skip to state
   * POST /runner/:runId/advance
   */
  async advanceStep(runId: string, params: AdvanceStepParams): Promise<RunnerResponse> {
    const response = await apiClient.post<RunnerResponse>(`/runner/${runId}/advance`, params);
    return response.data;
  },
};
