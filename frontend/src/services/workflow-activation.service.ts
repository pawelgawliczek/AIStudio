import { apiClient } from './api.client';

export interface ActivateWorkflowOptions {
  forceOverwrite?: boolean;
  skipBackup?: boolean;
  projectRoot?: string;
}

export interface DeactivateWorkflowOptions {
  keepFiles?: boolean;
}

export interface ActivationResponse {
  success: boolean;
  filesGenerated: string[];
  conflicts?: string[];
  backupLocation?: string;
  activationId: string;
  version: string;
}

export interface DeactivationResponse {
  success: boolean;
  filesRemoved: string[];
  workflowId: string;
  deactivatedAt: string;
}

export interface SyncResponse {
  success: boolean;
  updated: boolean;
  previousVersion: string;
  newVersion: string;
  filesUpdated: string[];
  changes: string[];
}

export interface ActiveWorkflowResponse {
  workflowId?: string;
  workflowName?: string;
  version?: string;
  activatedAt?: string;
  filesGenerated?: string[];
  autoSync?: boolean;
  status?: string;
}

class WorkflowActivationService {
  async activateInClaudeCode(
    projectId: string,
    workflowId: string,
    options?: ActivateWorkflowOptions,
  ): Promise<ActivationResponse> {
    const response = await apiClient.post(
      `/projects/${projectId}/workflows/${workflowId}/activate-claude-code`,
      options || {}
    );
    return response.data;
  }

  async deactivateFromClaudeCode(
    projectId: string,
    options?: DeactivateWorkflowOptions,
  ): Promise<DeactivationResponse> {
    const response = await apiClient.post(
      `/projects/${projectId}/workflows/deactivate-claude-code`,
      options || {}
    );
    return response.data;
  }

  async syncClaudeCode(projectId: string): Promise<SyncResponse> {
    const response = await apiClient.post(
      `/projects/${projectId}/workflows/sync-claude-code`,
      {}
    );
    return response.data;
  }

  async getActiveWorkflow(projectId: string): Promise<ActiveWorkflowResponse> {
    const response = await apiClient.get(
      `/projects/${projectId}/workflows/active-claude-code`
    );
    return response.data;
  }
}

export const workflowActivationService = new WorkflowActivationService();
