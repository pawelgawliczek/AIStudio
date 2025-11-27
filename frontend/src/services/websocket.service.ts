import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import type {
  StoryCreatedEvent,
  StoryUpdatedEvent,
  StoryStatusChangedEvent,
  EpicCreatedEvent,
  EpicUpdatedEvent,
  SubtaskCreatedEvent,
  SubtaskUpdatedEvent,
} from '../types';

// WebSocket URL: Use VITE_WS_URL for explicit server, or same origin for production
// Note: VITE_WS_URL should be full URL (e.g., 'http://localhost:3000') or empty for same-origin
const WS_URL = import.meta.env.VITE_WS_URL || window.location.origin;

/**
 * WebSocket service for real-time updates
 * All events are broadcast globally - no room joining required
 */
class WebSocketService {
  private socket: Socket | null = null;
  private connected = false;

  connect(): Socket | null {
    if (this.socket) {
      return this.socket;
    }

    const token = localStorage.getItem('accessToken');

    // ST-108: Don't connect without a valid token (server will reject)
    if (!token) {
      console.log('[WebSocket] No access token available, skipping connection');
      return null;
    }

    this.socket = io(WS_URL, {
      auth: { token },
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    this.socket.on('connect', () => {
      this.connected = true;
      console.log('WebSocket connected');
    });

    this.socket.on('disconnect', () => {
      this.connected = false;
      console.log('WebSocket disconnected');
    });

    this.socket.on('error', (error) => {
      console.error('WebSocket error:', error);
    });

    return this.socket;
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.connected = false;
    }
  }

  isConnected(): boolean {
    return this.connected;
  }

  getSocket(): Socket | null {
    return this.socket;
  }
}

export const wsService = new WebSocketService();

/**
 * Hook to manage WebSocket connection
 */
export function useWebSocket() {
  const [isConnected, setIsConnected] = useState(false);
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    const connectedSocket = wsService.connect();

    // ST-108: Handle case when no token available (connect returns null)
    if (!connectedSocket) {
      setIsConnected(false);
      setSocket(null);
      return;
    }

    setSocket(connectedSocket);

    const handleConnect = () => setIsConnected(true);
    const handleDisconnect = () => setIsConnected(false);

    connectedSocket.on('connect', handleConnect);
    connectedSocket.on('disconnect', handleDisconnect);

    setIsConnected(connectedSocket.connected);

    return () => {
      connectedSocket.off('connect', handleConnect);
      connectedSocket.off('disconnect', handleDisconnect);
    };
  }, []);

  return {
    isConnected,
    socket,
  };
}

/**
 * Hook to listen to story events
 */
export function useStoryEvents(callbacks: {
  onStoryCreated?: (data: StoryCreatedEvent) => void;
  onStoryUpdated?: (data: StoryUpdatedEvent) => void;
  onStoryStatusChanged?: (data: StoryStatusChangedEvent) => void;
}) {
  const { socket } = useWebSocket();

  useEffect(() => {
    if (!socket) return;

    if (callbacks.onStoryCreated) {
      socket.on('story:created', callbacks.onStoryCreated);
    }
    if (callbacks.onStoryUpdated) {
      socket.on('story:updated', callbacks.onStoryUpdated);
    }
    if (callbacks.onStoryStatusChanged) {
      socket.on('story:status:changed', callbacks.onStoryStatusChanged);
    }

    return () => {
      if (callbacks.onStoryCreated) {
        socket.off('story:created', callbacks.onStoryCreated);
      }
      if (callbacks.onStoryUpdated) {
        socket.off('story:updated', callbacks.onStoryUpdated);
      }
      if (callbacks.onStoryStatusChanged) {
        socket.off('story:status:changed', callbacks.onStoryStatusChanged);
      }
    };
  }, [socket, callbacks]);
}

/**
 * Hook to listen to epic events
 */
export function useEpicEvents(callbacks: {
  onEpicCreated?: (data: EpicCreatedEvent) => void;
  onEpicUpdated?: (data: EpicUpdatedEvent) => void;
}) {
  const { socket } = useWebSocket();

  useEffect(() => {
    if (!socket) return;

    if (callbacks.onEpicCreated) {
      socket.on('epic:created', callbacks.onEpicCreated);
    }
    if (callbacks.onEpicUpdated) {
      socket.on('epic:updated', callbacks.onEpicUpdated);
    }

    return () => {
      if (callbacks.onEpicCreated) {
        socket.off('epic:created', callbacks.onEpicCreated);
      }
      if (callbacks.onEpicUpdated) {
        socket.off('epic:updated', callbacks.onEpicUpdated);
      }
    };
  }, [socket, callbacks]);
}

/**
 * Hook to listen to subtask events
 */
export function useSubtaskEvents(callbacks: {
  onSubtaskCreated?: (data: SubtaskCreatedEvent) => void;
  onSubtaskUpdated?: (data: SubtaskUpdatedEvent) => void;
}) {
  const { socket } = useWebSocket();

  useEffect(() => {
    if (!socket) return;

    if (callbacks.onSubtaskCreated) {
      socket.on('subtask:created', callbacks.onSubtaskCreated);
    }
    if (callbacks.onSubtaskUpdated) {
      socket.on('subtask:updated', callbacks.onSubtaskUpdated);
    }

    return () => {
      if (callbacks.onSubtaskCreated) {
        socket.off('subtask:created', callbacks.onSubtaskCreated);
      }
      if (callbacks.onSubtaskUpdated) {
        socket.off('subtask:updated', callbacks.onSubtaskUpdated);
      }
    };
  }, [socket, callbacks]);
}
