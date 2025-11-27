import { useEffect, useCallback, useRef } from 'react';
import { wsService, useWebSocket } from '../services/websocket.service';
import { WorkflowRunUpdate } from '../types/workflow-tracking';

interface UseWorkflowWebSocketOptions {
  onUpdate?: (update: WorkflowRunUpdate) => void;
  throttleMs?: number;
}

/**
 * Hook for workflow-specific WebSocket events
 * Uses shared wsService singleton to avoid multiple connections
 */
export function useWorkflowWebSocket(options: UseWorkflowWebSocketOptions = {}) {
  const { onUpdate, throttleMs = 1000 } = options;
  const { isConnected, socket } = useWebSocket();
  const lastUpdateTimeRef = useRef<number>(0);

  // Subscribe to workflow events
  useEffect(() => {
    if (!socket) return;

    // Workflow run event handlers
    const handleUpdate = (update: WorkflowRunUpdate) => {
      // Throttle updates to prevent overwhelming re-renders
      const now = Date.now();
      if (now - lastUpdateTimeRef.current >= throttleMs) {
        lastUpdateTimeRef.current = now;
        onUpdate?.(update);
      }
    };

    socket.on('workflow:started', handleUpdate);
    socket.on('workflow:status', handleUpdate);
    socket.on('workflow:progress', handleUpdate);
    socket.on('component:started', handleUpdate);
    socket.on('component:progress', handleUpdate);
    socket.on('component:completed', handleUpdate);
    socket.on('queue:updated', handleUpdate);
    socket.on('deployment:started', handleUpdate);
    socket.on('deployment:completed', handleUpdate);
    socket.on('review:ready', handleUpdate);

    return () => {
      socket.off('workflow:started', handleUpdate);
      socket.off('workflow:status', handleUpdate);
      socket.off('workflow:progress', handleUpdate);
      socket.off('component:started', handleUpdate);
      socket.off('component:progress', handleUpdate);
      socket.off('component:completed', handleUpdate);
      socket.off('queue:updated', handleUpdate);
      socket.off('deployment:started', handleUpdate);
      socket.off('deployment:completed', handleUpdate);
      socket.off('review:ready', handleUpdate);
    };
  }, [socket, onUpdate, throttleMs]);

  const pauseRun = useCallback((runId: string) => {
    const currentSocket = wsService.getSocket();
    if (currentSocket?.connected) {
      currentSocket.emit('workflow:pause', { runId });
    }
  }, []);

  const cancelRun = useCallback((runId: string) => {
    const currentSocket = wsService.getSocket();
    if (currentSocket?.connected) {
      currentSocket.emit('workflow:cancel', { runId });
    }
  }, []);

  return {
    connected: isConnected,
    pauseRun,
    cancelRun,
  };
}
