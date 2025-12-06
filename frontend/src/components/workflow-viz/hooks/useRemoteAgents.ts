/**
 * ST-182: Hook for fetching online remote agents
 *
 * Used to check if laptop agent is available for transcript streaming.
 */

import { useQuery } from '@tanstack/react-query';
import axios from '../../../lib/axios';

interface RemoteAgent {
  id: string;
  hostname: string;
  status: 'online' | 'offline';
  capabilities: string[];
  claudeCodeAvailable: boolean;
  claudeCodeVersion: string | null;
  lastSeenAt: string;
}

interface UseRemoteAgentsOptions {
  capability?: string;
  enabled?: boolean;
  refetchInterval?: number;
}

export function useRemoteAgents(options: UseRemoteAgentsOptions = {}) {
  const { capability, enabled = true, refetchInterval = 30000 } = options;

  const { data, isLoading, error, refetch } = useQuery<RemoteAgent[]>({
    queryKey: ['remote-agents', capability],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (capability) {
        params.append('capability', capability);
      }
      const response = await axios.get<{ agents: RemoteAgent[] }>(
        `/remote-agent/online?${params.toString()}`
      );
      return response.data.agents || [];
    },
    refetchInterval,
    enabled,
  });

  // Find first agent with watch-transcripts capability (for live streaming)
  const streamingAgent = data?.find(
    (agent) =>
      agent.status === 'online' &&
      agent.capabilities.includes('watch-transcripts')
  );

  return {
    agents: data || [],
    isLoading,
    error,
    refetch,
    // Convenience for transcript streaming
    hasStreamingAgent: !!streamingAgent,
    streamingAgent,
    // Legacy aliases
    hasTailFileAgent: !!streamingAgent,
    tailFileAgent: streamingAgent,
  };
}
