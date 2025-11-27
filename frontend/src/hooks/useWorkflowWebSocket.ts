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
  const [authToken, setAuthToken] = useState<string | null>(() => localStorage.getItem('accessToken'));
  const socketRef = useRef<Socket | null>(null);
  const lastUpdateTimeRef = useRef<number>(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Listen for auth changes (login/logout) via storage events AND BroadcastChannel
  useEffect(() => {
    // Storage events (cross-tab communication)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'accessToken') {
        setAuthToken(e.newValue);
      }
      // Also handle auth_event which is used for cross-tab communication
      if (e.key === 'auth_event') {
        const token = localStorage.getItem('accessToken');
        setAuthToken(token);
      }
    };

    // BroadcastChannel (same-tab and cross-tab communication)
    // This catches token refreshes from API client in the same tab
    let channel: BroadcastChannel | null = null;
    try {
      channel = new BroadcastChannel('auth_channel');
      channel.onmessage = (event) => {
        if (event.data?.type === 'TOKEN_UPDATED' && event.data?.accessToken) {
          console.log('[WebSocket] Token updated via BroadcastChannel');
          setAuthToken(event.data.accessToken);
        }
        if (event.data?.type === 'LOGOUT') {
          console.log('[WebSocket] Logout received via BroadcastChannel');
          setAuthToken(null);
        }
      };
    } catch (error) {
      // BroadcastChannel not supported, rely on storage events only
      console.warn('[WebSocket] BroadcastChannel not supported, using storage events only');
    }

    // Check for token on mount (in case user is already logged in)
    const currentToken = localStorage.getItem('accessToken');
    if (currentToken !== authToken) {
      setAuthToken(currentToken);
    }

    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      channel?.close();
    };
  }, [authToken]);

  // Main WebSocket connection effect
  useEffect(() => {
    // ST-108: Don't connect without authentication - backend will reject anyway
    if (!authToken) {
      console.log('[WebSocket] No auth token available, skipping connection');
      setConnected(false);
      return;
    }

    // Initialize socket connection
    // Use VITE_WS_URL from build-time env vars, fallback to window origin for production
    const wsUrl = import.meta.env.VITE_WS_URL || window.location.origin;

    console.log('[WebSocket] Connecting to:', wsUrl);

    const socket = io(wsUrl, {
      transports: ['websocket', 'polling'], // Allow fallback to polling if WebSocket fails
      reconnectionAttempts: 5,
      reconnectionDelay: 3000,
      auth: {
        token: authToken, // ST-108: Pass JWT token in handshake
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

    socket.on('connect_error', (error) => {
      console.error('[WebSocket] Connection error:', error.message);
      setConnected(false);
    });

    socket.on('disconnect', (reason) => {
      console.log('[WebSocket] Disconnected:', reason);
      setConnected(false);
      // Only attempt reconnection if not intentionally disconnected
      if (reason !== 'io client disconnect') {
        reconnectTimeoutRef.current = setTimeout(() => {
          if (socketRef.current && !socketRef.current.connected) {
            console.log('[WebSocket] Attempting reconnection...');
            socketRef.current.connect();
          }
        }, 3000);
      }
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

    // Cleanup on unmount or auth change
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
      socket.off('connect_error');
      socket.off('disconnect');

      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }

      socket.disconnect();
      socketRef.current = null;
    };
  }, [authToken, onUpdate, throttleMs]);

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
