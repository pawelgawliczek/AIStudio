import { renderHook, act, waitFor } from '@testing-library/react';
import { io } from 'socket.io-client';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  wsService,
  useWebSocket,
  useStoryEvents,
  useEpicEvents,
  useSubtaskEvents,
  useWorkflowRunEvents,
} from '../websocket.service';
// Mock localStorage
const mockLocalStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
Object.defineProperty(global, 'localStorage', { value: mockLocalStorage });

// Mock socket.io-client - mockSocket created per test
let mockSocket: any;

vi.mock('socket.io-client', () => ({
  io: vi.fn(),
}));

describe('WebSocketService', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Create fresh mockSocket for each test
    mockSocket = {
      on: vi.fn(),
      off: vi.fn(),
      emit: vi.fn(),
      disconnect: vi.fn(),
      connected: false,
    };

    // Make io return our mockSocket
    (io as any).mockReturnValue(mockSocket);

    // Reset singleton state by disconnecting
    wsService.disconnect();
  });

  afterEach(() => {
    wsService.disconnect();
  });

  describe('connect', () => {
    it('should not connect without access token', () => {
      mockLocalStorage.getItem.mockReturnValue(null);

      const result = wsService.connect();

      expect(result).toBeNull();
      expect(io).not.toHaveBeenCalled();
    });

    it('should connect with valid access token', () => {
      mockLocalStorage.getItem.mockReturnValue('valid-token');

      const result = wsService.connect();

      expect(result).toBe(mockSocket);
      expect(io).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          auth: { token: 'valid-token' },
          transports: ['websocket'],
          reconnection: true,
          reconnectionAttempts: 5,
          reconnectionDelay: 1000,
        })
      );
    });

    it('should return existing socket if already connected', () => {
      mockLocalStorage.getItem.mockReturnValue('valid-token');

      const first = wsService.connect();
      const second = wsService.connect();

      expect(first).toBe(second);
      expect(io).toHaveBeenCalledTimes(1);
    });

    it('should set up connect/disconnect/error handlers', () => {
      mockLocalStorage.getItem.mockReturnValue('valid-token');

      wsService.connect();

      expect(mockSocket.on).toHaveBeenCalledWith('connect', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('disconnect', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('error', expect.any(Function));
    });

    it('should log connection on connect event', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      mockLocalStorage.getItem.mockReturnValue('valid-token');

      wsService.connect();

      // Get the connect handler and call it
      const connectHandler = mockSocket.on.mock.calls.find(
        (call) => call[0] === 'connect'
      )?.[1];
      connectHandler?.();

      expect(consoleSpy).toHaveBeenCalledWith('WebSocket connected');
      consoleSpy.mockRestore();
    });

    it('should log disconnection on disconnect event', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      mockLocalStorage.getItem.mockReturnValue('valid-token');

      wsService.connect();

      // Get the disconnect handler and call it
      const disconnectHandler = mockSocket.on.mock.calls.find(
        (call) => call[0] === 'disconnect'
      )?.[1];
      disconnectHandler?.();

      expect(consoleSpy).toHaveBeenCalledWith('WebSocket disconnected');
      consoleSpy.mockRestore();
    });

    it('should log errors on error event', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockLocalStorage.getItem.mockReturnValue('valid-token');

      wsService.connect();

      // Get the error handler and call it
      const errorHandler = mockSocket.on.mock.calls.find(
        (call) => call[0] === 'error'
      )?.[1];
      errorHandler?.(new Error('Test error'));

      expect(consoleSpy).toHaveBeenCalledWith('WebSocket error:', expect.any(Error));
      consoleSpy.mockRestore();
    });
  });

  describe('disconnect', () => {
    it('should disconnect socket and clear reference', () => {
      mockLocalStorage.getItem.mockReturnValue('valid-token');
      wsService.connect();

      wsService.disconnect();

      expect(mockSocket.disconnect).toHaveBeenCalled();
      expect(wsService.getSocket()).toBeNull();
      expect(wsService.isConnected()).toBe(false);
    });

    it('should be safe to call when not connected', () => {
      expect(() => wsService.disconnect()).not.toThrow();
    });
  });

  describe('isConnected', () => {
    it('should return false when not connected', () => {
      expect(wsService.isConnected()).toBe(false);
    });

    it('should return true after connect event', () => {
      mockLocalStorage.getItem.mockReturnValue('valid-token');
      wsService.connect();

      // Simulate connect event
      const connectHandler = mockSocket.on.mock.calls.find(
        (call) => call[0] === 'connect'
      )?.[1];
      connectHandler?.();

      expect(wsService.isConnected()).toBe(true);
    });

    it('should return false after disconnect event', () => {
      mockLocalStorage.getItem.mockReturnValue('valid-token');
      wsService.connect();

      // Simulate connect then disconnect
      const connectHandler = mockSocket.on.mock.calls.find(
        (call) => call[0] === 'connect'
      )?.[1];
      connectHandler?.();

      const disconnectHandler = mockSocket.on.mock.calls.find(
        (call) => call[0] === 'disconnect'
      )?.[1];
      disconnectHandler?.();

      expect(wsService.isConnected()).toBe(false);
    });
  });

  describe('getSocket', () => {
    it('should return null when not connected', () => {
      expect(wsService.getSocket()).toBeNull();
    });

    it('should return socket after connection', () => {
      mockLocalStorage.getItem.mockReturnValue('valid-token');
      wsService.connect();

      expect(wsService.getSocket()).toBe(mockSocket);
    });
  });
});

describe('useWebSocket', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSocket.on.mockClear();
    mockSocket.off.mockClear();
    wsService.disconnect();
  });

  afterEach(() => {
    wsService.disconnect();
  });

  it('should return isConnected=false when no token', () => {
    mockLocalStorage.getItem.mockReturnValue(null);

    const { result } = renderHook(() => useWebSocket());

    expect(result.current.isConnected).toBe(false);
    expect(result.current.socket).toBeNull();
  });

  it('should connect and return socket when token present', () => {
    mockLocalStorage.getItem.mockReturnValue('valid-token');

    const { result } = renderHook(() => useWebSocket());

    expect(result.current.socket).toBe(mockSocket);
  });

  it('should register connect/disconnect handlers', () => {
    mockLocalStorage.getItem.mockReturnValue('valid-token');

    renderHook(() => useWebSocket());

    // Verify event handlers are registered
    expect(mockSocket.on).toHaveBeenCalledWith('connect', expect.any(Function));
    expect(mockSocket.on).toHaveBeenCalledWith('disconnect', expect.any(Function));
  });

  it('should return initial connected state from socket', () => {
    mockLocalStorage.getItem.mockReturnValue('valid-token');
    mockSocket.connected = false;

    const { result } = renderHook(() => useWebSocket());

    // Initial state should reflect socket.connected
    expect(result.current.isConnected).toBe(false);
  });

  it('should cleanup event listeners on unmount', () => {
    mockLocalStorage.getItem.mockReturnValue('valid-token');

    const { unmount } = renderHook(() => useWebSocket());

    unmount();

    expect(mockSocket.off).toHaveBeenCalledWith('connect', expect.any(Function));
    expect(mockSocket.off).toHaveBeenCalledWith('disconnect', expect.any(Function));
  });
});

describe('useStoryEvents', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSocket.on.mockClear();
    mockSocket.off.mockClear();
    wsService.disconnect();
    mockLocalStorage.getItem.mockReturnValue('valid-token');
  });

  afterEach(() => {
    wsService.disconnect();
  });

  it('should subscribe to story:created event', () => {
    const onStoryCreated = vi.fn();

    renderHook(() => useStoryEvents({ onStoryCreated }));

    expect(mockSocket.on).toHaveBeenCalledWith('story:created', onStoryCreated);
  });

  it('should subscribe to story:updated event', () => {
    const onStoryUpdated = vi.fn();

    renderHook(() => useStoryEvents({ onStoryUpdated }));

    expect(mockSocket.on).toHaveBeenCalledWith('story:updated', onStoryUpdated);
  });

  it('should subscribe to story:status:changed event', () => {
    const onStoryStatusChanged = vi.fn();

    renderHook(() => useStoryEvents({ onStoryStatusChanged }));

    expect(mockSocket.on).toHaveBeenCalledWith('story:status:changed', onStoryStatusChanged);
  });

  it('should unsubscribe from events on unmount', () => {
    const onStoryCreated = vi.fn();
    const onStoryUpdated = vi.fn();
    const onStoryStatusChanged = vi.fn();

    const { unmount } = renderHook(() =>
      useStoryEvents({ onStoryCreated, onStoryUpdated, onStoryStatusChanged })
    );

    unmount();

    expect(mockSocket.off).toHaveBeenCalledWith('story:created', onStoryCreated);
    expect(mockSocket.off).toHaveBeenCalledWith('story:updated', onStoryUpdated);
    expect(mockSocket.off).toHaveBeenCalledWith('story:status:changed', onStoryStatusChanged);
  });

  it('should not subscribe when callback is not provided', () => {
    renderHook(() => useStoryEvents({}));

    expect(mockSocket.on).not.toHaveBeenCalledWith('story:created', expect.any(Function));
  });
});

describe('useEpicEvents', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSocket.on.mockClear();
    mockSocket.off.mockClear();
    wsService.disconnect();
    mockLocalStorage.getItem.mockReturnValue('valid-token');
  });

  afterEach(() => {
    wsService.disconnect();
  });

  it('should subscribe to epic:created event', () => {
    const onEpicCreated = vi.fn();

    renderHook(() => useEpicEvents({ onEpicCreated }));

    expect(mockSocket.on).toHaveBeenCalledWith('epic:created', onEpicCreated);
  });

  it('should subscribe to epic:updated event', () => {
    const onEpicUpdated = vi.fn();

    renderHook(() => useEpicEvents({ onEpicUpdated }));

    expect(mockSocket.on).toHaveBeenCalledWith('epic:updated', onEpicUpdated);
  });

  it('should unsubscribe from events on unmount', () => {
    const onEpicCreated = vi.fn();
    const onEpicUpdated = vi.fn();

    const { unmount } = renderHook(() => useEpicEvents({ onEpicCreated, onEpicUpdated }));

    unmount();

    expect(mockSocket.off).toHaveBeenCalledWith('epic:created', onEpicCreated);
    expect(mockSocket.off).toHaveBeenCalledWith('epic:updated', onEpicUpdated);
  });
});

describe('useSubtaskEvents', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSocket.on.mockClear();
    mockSocket.off.mockClear();
    wsService.disconnect();
    mockLocalStorage.getItem.mockReturnValue('valid-token');
  });

  afterEach(() => {
    wsService.disconnect();
  });

  it('should subscribe to subtask:created event', () => {
    const onSubtaskCreated = vi.fn();

    renderHook(() => useSubtaskEvents({ onSubtaskCreated }));

    expect(mockSocket.on).toHaveBeenCalledWith('subtask:created', onSubtaskCreated);
  });

  it('should subscribe to subtask:updated event', () => {
    const onSubtaskUpdated = vi.fn();

    renderHook(() => useSubtaskEvents({ onSubtaskUpdated }));

    expect(mockSocket.on).toHaveBeenCalledWith('subtask:updated', onSubtaskUpdated);
  });

  it('should unsubscribe from events on unmount', () => {
    const onSubtaskCreated = vi.fn();
    const onSubtaskUpdated = vi.fn();

    const { unmount } = renderHook(() =>
      useSubtaskEvents({ onSubtaskCreated, onSubtaskUpdated })
    );

    unmount();

    expect(mockSocket.off).toHaveBeenCalledWith('subtask:created', onSubtaskCreated);
    expect(mockSocket.off).toHaveBeenCalledWith('subtask:updated', onSubtaskUpdated);
  });
});
