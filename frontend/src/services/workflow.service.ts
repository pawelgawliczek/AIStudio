/**
 * Workflow Service
 * ST-195: High-level workflow operations (teams, execution)
 */

import { apiClient } from './api.client';

export interface Team {
  id: string;
  name: string;
  description?: string;
  stateCount?: number;
}

export interface ExecuteStoryResponse {
  runId: string;
  workflowId: string;
  status: string;
}

export const workflowService = {
  /**
   * List all teams/workflows for a project
   */
  async listTeams(projectId: string): Promise<Team[]> {
    const response = await apiClient.get<Team[]>(`/projects/${projectId}/workflows`);
    return response.data;
  },

  /**
   * Execute a story with a team/workflow
   */
  async executeStoryWithTeam(storyId: string, teamId: string): Promise<ExecuteStoryResponse> {
    const response = await apiClient.post<ExecuteStoryResponse>(
      `/stories/${storyId}/execute`,
      { workflowId: teamId }
    );
    return response.data;
  },
};
