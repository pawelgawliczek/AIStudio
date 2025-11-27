import { useState, useEffect, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { WorkflowRunUpdate } from '../types/workflow-tracking';

interface UseWorkflowWebSocketOptions {
  onUpdate?: (update: WorkflowRunUpdate) => void;
  throttleMs?: number;
}

/**
 * Hook for managing WebSocket connection and workflow run updates
 */
export function useWorkflowWebSocket(options: UseWorkflowWebSocketOptions = {}) {
  const { onUpdate, throttleMs = 1000 } = options;
  const [connected, setConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const lastUpdateTimeRef = useRef<number>(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Initialize socket connection
    // Use VITE_WS_URL from build-time env vars, fallback to relative path for nginx proxy
    const wsUrl = import.meta.env.VITE_WS_URL || '/socket.io';

    // ST-108: Extract JWT token from localStorage for authentication
    const getAccessToken = () => {
      try {
        const authData = localStorage.getItem('auth');
        if (authData) {
          const parsed = JSON.parse(authData);
          return parsed.accessToken || parsed.token;
        }
      } catch (error) {
        console.error('[WebSocket] Failed to get access token:', error);
      }
      return null;
    };

    const socket = io(wsUrl, {
      transports: ['websocket'],
      reconnectionAttempts: 5,
      reconnectionDelay: 3000,
      auth: {
        token: getAccessToken(), // ST-108: Pass JWT token in handshake
      },
    });

    socketRef.current = socket;

    // Connection event handlers
    socket.on('connect', () => {
      console.log('[WebSocket] Connected');
      setConnected(true);
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    });

    socket.on('disconnect', () => {
      console.log('[WebSocket] Disconnected');
      setConnected(false);
      // Attempt reconnection after delay
      reconnectTimeoutRef.current = setTimeout(() => {
        if (socketRef.current && !socketRef.current.connected) {
          console.log('[WebSocket] Attempting reconnection...');
          socketRef.current.connect();
        }
      }, 3000);
    });

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
    // ST-108: New toast notification events
    socket.on('deployment:started', handleUpdate);
    socket.on('deployment:completed', handleUpdate);
    socket.on('review:ready', handleUpdate);

    // Cleanup on unmount
    return () => {
      socket.off('workflow:started');
      socket.off('workflow:status');
      socket.off('workflow:progress');
      socket.off('component:started');
      socket.off('component:progress');
      socket.off('component:completed');
      socket.off('queue:updated');
      socket.off('deployment:started');
      socket.off('deployment:completed');
      socket.off('review:ready');
      socket.off('connect');
      socket.off('disconnect');

      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }

      socket.disconnect();
    };
  }, [onUpdate, throttleMs]);

  const pauseRun = useCallback((runId: string) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('workflow:pause', { runId });
    }
  }, []);

  const cancelRun = useCallback((runId: string) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('workflow:cancel', { runId });
    }
  }, []);

  return {
    connected,
    pauseRun,
    cancelRun,
  };
}
