import { useEffect, useCallback, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import type {
  Story,
  Epic,
  Subtask,
  WebSocketMessage,
  StoryCreatedEvent,
  StoryUpdatedEvent,
  StoryStatusChangedEvent,
  EpicCreatedEvent,
  EpicUpdatedEvent,
  SubtaskCreatedEvent,
  SubtaskUpdatedEvent,
  UserJoinedEvent,
  UserLeftEvent,
  TypingEvent,
} from '../types';

const WS_URL = import.meta.env.VITE_WS_URL || 'http://localhost:3000';

/**
 * WebSocket service for real-time updates
 */
class WebSocketService {
  private socket: Socket | null = null;
  private connected = false;

  connect(): Socket | null {
    if (this.socket && this.connected) {
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

  joinRoom(room: string, userId: string, userName: string): void {
    if (this.socket) {
      this.socket.emit('join-room', { room, userId, userName });
    }
  }

  leaveRoom(room: string): void {
    if (this.socket) {
      this.socket.emit('leave-room', { room });
    }
  }

  emitTyping(entityId: string, entityType: string, userId: string, userName: string): void {
    if (this.socket) {
      this.socket.emit('typing', { entityId, entityType, userId, userName });
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
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const socket = wsService.connect();
    socketRef.current = socket;

    // ST-108: Handle case when no token available (connect returns null)
    if (!socket) {
      setIsConnected(false);
      return;
    }

    const handleConnect = () => setIsConnected(true);
    const handleDisconnect = () => setIsConnected(false);

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);

    setIsConnected(socket.connected);

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
    };
  }, []);

  const joinRoom = useCallback((room: string, userId: string, userName: string) => {
    wsService.joinRoom(room, userId, userName);
  }, []);

  const leaveRoom = useCallback((room: string) => {
    wsService.leaveRoom(room);
  }, []);

  return {
    isConnected,
    socket: socketRef.current,
    joinRoom,
    leaveRoom,
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

/**
 * Hook to listen to presence events
 */
export function usePresenceEvents(callbacks: {
  onUserJoined?: (data: UserJoinedEvent) => void;
  onUserLeft?: (data: UserLeftEvent) => void;
  onTyping?: (data: TypingEvent) => void;
}) {
  const { socket } = useWebSocket();

  useEffect(() => {
    if (!socket) return;

    if (callbacks.onUserJoined) {
      socket.on('user-joined', callbacks.onUserJoined);
    }
    if (callbacks.onUserLeft) {
      socket.on('user-left', callbacks.onUserLeft);
    }
    if (callbacks.onTyping) {
      socket.on('typing', callbacks.onTyping);
    }

    return () => {
      if (callbacks.onUserJoined) {
        socket.off('user-joined', callbacks.onUserJoined);
      }
      if (callbacks.onUserLeft) {
        socket.off('user-left', callbacks.onUserLeft);
      }
      if (callbacks.onTyping) {
        socket.off('typing', callbacks.onTyping);
      }
    };
  }, [socket, callbacks]);
}
