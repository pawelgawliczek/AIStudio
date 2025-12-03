import { apiClient } from './api.client';

export interface ComponentVersion {
  id: string;
  componentId: string;
  versionMajor: number;
  versionMinor: number;
  version: string;
  inputInstructions: string;
  operationInstructions: string;
  outputInstructions: string;
  config: {
    modelId: string;
    temperature: number;
    maxInputTokens?: number;
    maxOutputTokens?: number;
    timeout?: number;
    maxRetries?: number;
    costLimit?: number;
  };
  tools: string[];
  active: boolean;
  checksum?: string;
  checksumAlgorithm?: string;
  changeDescription?: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
}

// CoordinatorVersion removed - coordinators no longer exist (ST-164)

export interface AutoDiff {
  pmChanges?: {
    type: 'added' | 'removed' | 'version_changed';
    oldPM?: { id: string; name: string; version: string };
    newPM?: { id: string; name: string; version: string };
  };
  agentChanges: Array<{
    type: 'added' | 'removed' | 'version_changed';
    agentId: string;
    agentName: string;
    oldVersion?: string;
    newVersion?: string;
  }>;
}

export interface WorkflowVersion {
  id: string;
  workflowId: string;
  versionMajor: number;
  versionMinor: number;
  version: string;
  triggerConfig: {
    type: string;
    filters?: any;
    notifications?: any;
  };
  active: boolean;
  checksum?: string;
  checksumAlgorithm?: string;
  changeDescription?: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  componentVersions?: Array<{
    componentId: string;
    componentName: string;
    version: string;
    versionId: string;
  }>;
  metadata?: {
    autoDiff?: AutoDiff;
  };
  config?: {
    modelId: string;
    temperature: number;
    maxInputTokens?: number;
    maxOutputTokens?: number;
    timeout?: number;
    maxRetries?: number;
    costLimit?: number;
  };
  tools?: string[];
}

export interface VersionComparison {
  entityType: 'component' | 'workflow';
  version1: ComponentVersion | WorkflowVersion;
  version2: ComponentVersion | WorkflowVersion;
  diff: {
    summary: {
      fieldsAdded: number;
      fieldsRemoved: number;
      fieldsModified: number;
    };
    changes: Array<{
      field: string;
      changeType: 'added' | 'removed' | 'modified';
      oldValue?: any;
      newValue?: any;
      description: string;
    }>;
    impactAnalysis?: {
      breakingChanges: boolean;
      affectedWorkflows?: number;
      recommendation: string;
    };
  };
}

export interface ChecksumVerification {
  verified: boolean;
  expectedChecksum: string;
  actualChecksum: string;
  algorithm: string;
  verifiedAt: string;
  mismatchDetails?: string;
}

export const versioningService = {
  /**
   * Component Versioning
   */
  async getComponentVersionHistory(componentId: string): Promise<ComponentVersion[]> {
    const response = await apiClient.get<ComponentVersion[]>(
      `/versioning/components/${componentId}/versions`
    );
    return response.data;
  },

  async getComponentVersion(versionId: string): Promise<ComponentVersion> {
    const response = await apiClient.get<ComponentVersion>(
      `/versioning/components/versions/${versionId}`
    );
    return response.data;
  },

  async createComponentVersion(
    componentId: string,
    data: {
      majorVersion?: number;
      changeDescription?: string;
    }
  ): Promise<ComponentVersion> {
    const response = await apiClient.post<ComponentVersion>(
      `/versioning/components/${componentId}/versions`,
      data
    );
    return response.data;
  },

  async activateComponentVersion(versionId: string): Promise<ComponentVersion> {
    const response = await apiClient.post<ComponentVersion>(
      `/versioning/components/versions/${versionId}/activate`
    );
    return response.data;
  },

  async deactivateComponentVersion(versionId: string): Promise<ComponentVersion> {
    const response = await apiClient.post<ComponentVersion>(
      `/versioning/components/versions/${versionId}/deactivate`
    );
    return response.data;
  },

  async compareComponentVersions(
    versionId1: string,
    versionId2: string
  ): Promise<VersionComparison> {
    const response = await apiClient.get<VersionComparison>(
      `/versioning/components/versions/compare`,
      {
        params: { versionId1, versionId2 },
      }
    );
    return response.data;
  },

  async verifyComponentChecksum(versionId: string): Promise<ChecksumVerification> {
    const response = await apiClient.post<ChecksumVerification>(
      `/versioning/components/versions/${versionId}/verify-checksum`
    );
    return response.data;
  },

  /**
   * Workflow Versioning
   */
  async getWorkflowVersionHistory(workflowId: string): Promise<WorkflowVersion[]> {
    const response = await apiClient.get<WorkflowVersion[]>(
      `/versioning/workflows/${workflowId}/versions`
    );
    return response.data;
  },

  async getWorkflowVersion(versionId: string): Promise<WorkflowVersion> {
    const response = await apiClient.get<WorkflowVersion>(
      `/versioning/workflows/versions/${versionId}`
    );
    return response.data;
  },

  async createWorkflowVersion(
    workflowId: string,
    data: {
      majorVersion?: number;
      changeDescription?: string;
    }
  ): Promise<WorkflowVersion> {
    const response = await apiClient.post<WorkflowVersion>(
      `/versioning/workflows/${workflowId}/versions`,
      data
    );
    return response.data;
  },

  async activateWorkflowVersion(versionId: string): Promise<WorkflowVersion> {
    const response = await apiClient.post<WorkflowVersion>(
      `/versioning/workflows/versions/${versionId}/activate`
    );
    return response.data;
  },

  async deactivateWorkflowVersion(versionId: string): Promise<WorkflowVersion> {
    const response = await apiClient.post<WorkflowVersion>(
      `/versioning/workflows/versions/${versionId}/deactivate`
    );
    return response.data;
  },

  async compareWorkflowVersions(
    versionId1: string,
    versionId2: string
  ): Promise<VersionComparison> {
    const response = await apiClient.get<VersionComparison>(
      `/versioning/workflows/versions/compare`,
      {
        params: { versionId1, versionId2 },
      }
    );
    return response.data;
  },

  async verifyWorkflowChecksum(versionId: string): Promise<ChecksumVerification> {
    const response = await apiClient.post<ChecksumVerification>(
      `/versioning/workflows/versions/${versionId}/verify-checksum`
    );
    return response.data;
  },
};
