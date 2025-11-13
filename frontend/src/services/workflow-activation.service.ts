import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

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
  private getAuthHeaders() {
    const token = localStorage.getItem('accessToken');
    return {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    };
  }

  async activateInClaudeCode(
    projectId: string,
    workflowId: string,
    options?: ActivateWorkflowOptions,
  ): Promise<ActivationResponse> {
    const response = await axios.post(
      `${API_BASE_URL}/projects/${projectId}/workflows/${workflowId}/activate-claude-code`,
      options || {},
      this.getAuthHeaders(),
    );
    return response.data;
  }

  async deactivateFromClaudeCode(
    projectId: string,
    options?: DeactivateWorkflowOptions,
  ): Promise<DeactivationResponse> {
    const response = await axios.post(
      `${API_BASE_URL}/projects/${projectId}/workflows/deactivate-claude-code`,
      options || {},
      this.getAuthHeaders(),
    );
    return response.data;
  }

  async syncClaudeCode(projectId: string): Promise<SyncResponse> {
    const response = await axios.post(
      `${API_BASE_URL}/projects/${projectId}/workflows/sync-claude-code`,
      {},
      this.getAuthHeaders(),
    );
    return response.data;
  }

  async getActiveWorkflow(projectId: string): Promise<ActiveWorkflowResponse> {
    const response = await axios.get(
      `${API_BASE_URL}/projects/${projectId}/workflows/active-claude-code`,
      this.getAuthHeaders(),
    );
    return response.data;
  }
}

export const workflowActivationService = new WorkflowActivationService();
