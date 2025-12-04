/**
 * Hook for live agent execution stream via WebSocket
 * Subscribes to component:output events for real-time agent output
 */

import { useState, useEffect, useCallback } from 'react';
import { useWebSocket } from '../../../services/websocket.service';

interface UseAgentStreamOptions {
  runId: string;
  maxOutputs?: number;
  enabled?: boolean;
}

interface AgentOutput {
  componentRunId: string;
  componentName: string;
  timestamp: string;
  output: string;
  type: 'stdout' | 'stderr' | 'info' | 'error';
}

interface ComponentOutputEvent {
  runId: string;
  componentRunId: string;
  componentName: string;
  output: string;
  type: 'stdout' | 'stderr' | 'info' | 'error';
  timestamp: string;
}

export function useLiveStream(options: UseAgentStreamOptions) {
  const { runId, maxOutputs = 100, enabled = true } = options;
  const { socket, isConnected } = useWebSocket();
  const [outputs, setOutputs] = useState<AgentOutput[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);

  // Subscribe to component output events
  useEffect(() => {
    if (!socket || !isConnected || !enabled || !runId) {
      setIsStreaming(false);
      return;
    }

    setIsStreaming(true);

    const handleComponentOutput = (event: ComponentOutputEvent) => {
      // Only process events for this workflow run
      if (event.runId !== runId) return;

      const newOutput: AgentOutput = {
        componentRunId: event.componentRunId,
        componentName: event.componentName,
        timestamp: event.timestamp,
        output: event.output,
        type: event.type,
      };

      setOutputs((prev) => {
        const updated = [...prev, newOutput];
        // Keep only the most recent N outputs
        if (updated.length > maxOutputs) {
          return updated.slice(updated.length - maxOutputs);
        }
        return updated;
      });
    };

    // Subscribe to output events
    socket.on('component:output', handleComponentOutput);

    return () => {
      socket.off('component:output', handleComponentOutput);
      setIsStreaming(false);
    };
  }, [socket, isConnected, runId, enabled, maxOutputs]);

  // Clear outputs
  const clearOutputs = useCallback(() => {
    setOutputs([]);
  }, []);

  // Get outputs for a specific component
  const getComponentOutputs = useCallback(
    (componentRunId: string) => {
      return outputs.filter((output) => output.componentRunId === componentRunId);
    },
    [outputs]
  );

  // Get latest output
  const latestOutput = outputs.length > 0 ? outputs[outputs.length - 1] : null;

  return {
    outputs,
    latestOutput,
    isStreaming,
    clearOutputs,
    getComponentOutputs,
  };
}
