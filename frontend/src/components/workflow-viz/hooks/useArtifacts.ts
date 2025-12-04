/**
 * Hook for managing artifacts via MCP tools
 * Actions: list_artifacts, get_artifact
 */

import { useQuery } from '@tanstack/react-query';
import axios from '../../../lib/axios';

interface UseArtifactsOptions {
  runId: string;
  definitionKey?: string;
  includeContent?: boolean;
  enabled?: boolean;
}

interface Artifact {
  id: string;
  definitionId: string;
  definitionKey: string;
  workflowRunId: string;
  version: number;
  content: string | null;
  contentType: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
}

interface ApiArtifact {
  id: string;
  definitionId: string;
  definitionKey: string;
  workflowRunId: string;
  version: number;
  content: string | null;
  contentType: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
}

/**
 * Transform API response to frontend type
 */
function transformApiArtifact(apiArtifact: ApiArtifact): Artifact {
  return {
    id: apiArtifact.id,
    definitionId: apiArtifact.definitionId,
    definitionKey: apiArtifact.definitionKey,
    workflowRunId: apiArtifact.workflowRunId,
    version: apiArtifact.version,
    content: apiArtifact.content,
    contentType: apiArtifact.contentType,
    createdAt: apiArtifact.createdAt,
    updatedAt: apiArtifact.updatedAt,
    createdBy: apiArtifact.createdBy,
  };
}

export function useArtifacts(options: UseArtifactsOptions) {
  const { runId, definitionKey, includeContent = false, enabled = true } = options;

  // Fetch all artifacts for this workflow run
  const { data, isLoading, error, refetch } = useQuery<Artifact[]>({
    queryKey: ['artifacts', runId, definitionKey, includeContent],
    queryFn: async () => {
      // Get projectId from localStorage (set by ProjectContext)
      const projectId = localStorage.getItem('selectedProjectId') ||
                       localStorage.getItem('currentProjectId');
      if (!projectId) {
        throw new Error('No project selected');
      }

      const params = new URLSearchParams();
      if (definitionKey) {
        params.append('definitionKey', definitionKey);
      }
      params.append('includeContent', includeContent.toString());

      const response = await axios.get<ApiArtifact[]>(
        `/projects/${projectId}/workflow-runs/${runId}/artifacts?${params.toString()}`
      );
      return response.data.map(transformApiArtifact);
    },
    enabled: enabled && !!runId,
  });

  return {
    artifacts: data || [],
    isLoading,
    error,
    refetch,
  };
}

/**
 * Hook for fetching a single artifact with full content
 */
interface UseArtifactOptions {
  artifactId?: string;
  runId?: string;
  definitionKey?: string;
  enabled?: boolean;
}

export function useArtifact(options: UseArtifactOptions) {
  const { artifactId, runId, definitionKey, enabled = true } = options;

  const { data, isLoading, error, refetch } = useQuery<Artifact | null>({
    queryKey: ['artifact', artifactId, runId, definitionKey],
    queryFn: async () => {
      // Get projectId from localStorage (set by ProjectContext)
      const projectId = localStorage.getItem('selectedProjectId') ||
                       localStorage.getItem('currentProjectId');
      if (!projectId) {
        throw new Error('No project selected');
      }

      if (artifactId) {
        // Fetch by artifact ID
        const response = await axios.get<ApiArtifact>(
          `/projects/${projectId}/artifacts/${artifactId}?includeContent=true`
        );
        return transformApiArtifact(response.data);
      } else if (runId && definitionKey) {
        // Fetch by runId + definitionKey
        const response = await axios.get<ApiArtifact>(
          `/projects/${projectId}/workflow-runs/${runId}/artifacts/${definitionKey}?includeContent=true`
        );
        return transformApiArtifact(response.data);
      }
      return null;
    },
    enabled: enabled && (!!artifactId || (!!runId && !!definitionKey)),
  });

  return {
    artifact: data,
    isLoading,
    error,
    refetch,
  };
}
