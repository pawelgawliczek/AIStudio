/**
 * ST-173: Transcripts Service
 *
 * Frontend API client for transcript management.
 * Follows the same patterns as other service files.
 */

import { apiClient } from './api.client';

// =============================================================================
// Types
// =============================================================================

/**
 * Summary of a master transcript (orchestrator session)
 */
export interface MasterTranscriptSummary {
  artifactId: string;
  contentPreview: string;
  size: number;
  createdAt: string;
  index: number; // 0=initial, 1=after first compact
}

/**
 * Summary of an agent transcript (spawned component)
 */
export interface AgentTranscriptSummary {
  artifactId: string;
  componentId: string;
  componentName: string;
  contentPreview: string;
  size: number;
  createdAt: string;
}

/**
 * List of all transcripts for a workflow run
 */
export interface TranscriptList {
  master: MasterTranscriptSummary[];
  agents: AgentTranscriptSummary[];
}

/**
 * Full transcript detail
 */
export interface TranscriptDetail {
  id: string;
  content?: string; // Full JSONL content (when includeContent=true)
  contentPreview?: string; // First 500 chars (when includeContent=false)
  contentType: string; // application/x-jsonlines
  size: number;
  transcriptType: 'master' | 'agent';
  componentId?: string;
  componentName?: string;
  createdAt: string;
  index?: number; // For master transcripts
  metrics?: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
}

// =============================================================================
// Service Class
// =============================================================================

class TranscriptsService {
  /**
   * Get all transcripts for a workflow run, grouped by master/agent
   *
   * @param projectId - Project UUID
   * @param runId - Workflow Run UUID
   * @returns List of master and agent transcripts
   */
  async getTranscriptsForRun(projectId: string, runId: string): Promise<TranscriptList> {
    const response = await apiClient.get(
      `/projects/${projectId}/workflow-runs/${runId}/transcripts`
    );
    return response.data;
  }

  /**
   * Get a specific transcript by artifact ID
   *
   * @param projectId - Project UUID
   * @param runId - Workflow Run UUID
   * @param artifactId - Artifact UUID
   * @param includeContent - Whether to include full JSONL content (default: false)
   * @returns Transcript detail
   */
  async getTranscript(
    projectId: string,
    runId: string,
    artifactId: string,
    includeContent = false
  ): Promise<TranscriptDetail> {
    const response = await apiClient.get(
      `/projects/${projectId}/workflow-runs/${runId}/transcripts/${artifactId}`,
      { params: { includeContent: includeContent ? 'true' : undefined } }
    );
    return response.data;
  }

  /**
   * Get transcript for a specific component
   *
   * @param projectId - Project UUID
   * @param runId - Workflow Run UUID
   * @param componentId - Component UUID
   * @param includeContent - Whether to include full JSONL content (default: false)
   * @returns Transcript detail
   */
  async getTranscriptByComponent(
    projectId: string,
    runId: string,
    componentId: string,
    includeContent = false
  ): Promise<TranscriptDetail> {
    const response = await apiClient.get(
      `/projects/${projectId}/workflow-runs/${runId}/transcripts/component/${componentId}`,
      { params: { includeContent: includeContent ? 'true' : undefined } }
    );
    return response.data;
  }

  /**
   * Get master transcript by index
   *
   * @param projectId - Project UUID
   * @param runId - Workflow Run UUID
   * @param index - Master transcript index (0=initial, 1=after first compact)
   * @param includeContent - Whether to include full JSONL content (default: false)
   * @returns Transcript detail with index
   */
  async getMasterTranscript(
    projectId: string,
    runId: string,
    index: number,
    includeContent = false
  ): Promise<TranscriptDetail> {
    const response = await apiClient.get(
      `/projects/${projectId}/workflow-runs/${runId}/transcripts/master/${index}`,
      { params: { includeContent: includeContent ? 'true' : undefined } }
    );
    return response.data;
  }
}

// Export singleton instance
export const transcriptsService = new TranscriptsService();
