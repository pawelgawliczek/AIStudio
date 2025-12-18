import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { wsService, useWebSocket } from '../../services/websocket.service';
import { WorkflowRunUpdate } from '../../types/workflow-tracking';
import { useWorkflowWebSocket } from '../useWorkflowWebSocket';
// Create mock socket
let mockSocket: any;
let mockWsService: any;

// Mock the websocket service module
vi.mock('../../services/websocket.service', () => {
  return {
    wsService: {
      getSocket: vi.fn(),
      connect: vi.fn(),
      disconnect: vi.fn(),
      isConnected: vi.fn(),
    },
    useWebSocket: vi.fn(),
  };
});

describe('useWorkflowWebSocket', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Create fresh mockSocket for each test
    mockSocket = {
      on: vi.fn(),
      off: vi.fn(),
      emit: vi.fn(),
      connected: true,
      connect: vi.fn(),
      disconnect: vi.fn(),
    };

    // Setup wsService mock
    (wsService.getSocket as any).mockReturnValue(mockSocket);

    // Setup useWebSocket mock to return socket and connection state
    (useWebSocket as any).mockReturnValue({
      isConnected: true,
      socket: mockSocket,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns connected state from useWebSocket', () => {
    const { result } = renderHook(() => useWorkflowWebSocket());

    expect(result.current.connected).toBe(true);
  });

  it('subscribes to workflow run events on mount', () => {
    renderHook(() => useWorkflowWebSocket());

    expect(mockSocket.on).toHaveBeenCalledWith('workflow:started', expect.any(Function));
    expect(mockSocket.on).toHaveBeenCalledWith('workflow:status', expect.any(Function));
    expect(mockSocket.on).toHaveBeenCalledWith('workflow:progress', expect.any(Function));
    expect(mockSocket.on).toHaveBeenCalledWith('component:started', expect.any(Function));
    expect(mockSocket.on).toHaveBeenCalledWith('component:progress', expect.any(Function));
    expect(mockSocket.on).toHaveBeenCalledWith('component:completed', expect.any(Function));
    expect(mockSocket.on).toHaveBeenCalledWith('queue:updated', expect.any(Function));
    // ST-108: Deployment and review events
    expect(mockSocket.on).toHaveBeenCalledWith('deployment:started', expect.any(Function));
    expect(mockSocket.on).toHaveBeenCalledWith('deployment:completed', expect.any(Function));
    expect(mockSocket.on).toHaveBeenCalledWith('review:ready', expect.any(Function));
  });

  it('unsubscribes from events on unmount', () => {
    const { unmount } = renderHook(() => useWorkflowWebSocket());

    unmount();

    expect(mockSocket.off).toHaveBeenCalledWith('workflow:started', expect.any(Function));
    expect(mockSocket.off).toHaveBeenCalledWith('workflow:status', expect.any(Function));
    expect(mockSocket.off).toHaveBeenCalledWith('workflow:progress', expect.any(Function));
    expect(mockSocket.off).toHaveBeenCalledWith('component:started', expect.any(Function));
    expect(mockSocket.off).toHaveBeenCalledWith('component:progress', expect.any(Function));
    expect(mockSocket.off).toHaveBeenCalledWith('component:completed', expect.any(Function));
    expect(mockSocket.off).toHaveBeenCalledWith('queue:updated', expect.any(Function));
    // ST-108: Deployment and review events
    expect(mockSocket.off).toHaveBeenCalledWith('deployment:started', expect.any(Function));
    expect(mockSocket.off).toHaveBeenCalledWith('deployment:completed', expect.any(Function));
    expect(mockSocket.off).toHaveBeenCalledWith('review:ready', expect.any(Function));
  });

  it('does not subscribe when socket is null', () => {
    (useWebSocket as any).mockReturnValue({
      isConnected: false,
      socket: null,
    });

    renderHook(() => useWorkflowWebSocket());

    expect(mockSocket.on).not.toHaveBeenCalled();
  });

  it('handles workflow:started event', () => {
    const onUpdate = vi.fn();
    renderHook(() => useWorkflowWebSocket({ onUpdate }));

    const callback = mockSocket.on.mock.calls.find(
      (call: any[]) => call[0] === 'workflow:started'
    )?.[1];

    const update: WorkflowRunUpdate = {
      runId: 'run-1',
      type: 'status',
      data: { status: 'running' },
    };

    act(() => {
      callback?.(update);
    });

    expect(onUpdate).toHaveBeenCalledWith(update);
  });

  it('handles workflow:status event', () => {
    const onUpdate = vi.fn();
    renderHook(() => useWorkflowWebSocket({ onUpdate }));

    const callback = mockSocket.on.mock.calls.find(
      (call: any[]) => call[0] === 'workflow:status'
    )?.[1];

    const update: WorkflowRunUpdate = {
      runId: 'run-1',
      type: 'status',
      data: { status: 'completed' },
    };

    act(() => {
      callback?.(update);
    });

    expect(onUpdate).toHaveBeenCalledWith(update);
  });

  it('handles workflow:progress event', () => {
    const onUpdate = vi.fn();
    renderHook(() => useWorkflowWebSocket({ onUpdate }));

    const callback = mockSocket.on.mock.calls.find(
      (call: any[]) => call[0] === 'workflow:progress'
    )?.[1];

    const update: WorkflowRunUpdate = {
      runId: 'run-1',
      type: 'progress',
      data: { progress: 75 },
    };

    act(() => {
      callback?.(update);
    });

    expect(onUpdate).toHaveBeenCalledWith(update);
  });

  it('handles component:started event', () => {
    const onUpdate = vi.fn();
    renderHook(() => useWorkflowWebSocket({ onUpdate }));

    const callback = mockSocket.on.mock.calls.find(
      (call: any[]) => call[0] === 'component:started'
    )?.[1];

    const update: WorkflowRunUpdate = {
      runId: 'run-1',
      type: 'component',
      data: { currentComponent: 'Implementer' },
    };

    act(() => {
      callback?.(update);
    });

    expect(onUpdate).toHaveBeenCalledWith(update);
  });

  it('handles queue:updated event', () => {
    const onUpdate = vi.fn();
    renderHook(() => useWorkflowWebSocket({ onUpdate }));

    const callback = mockSocket.on.mock.calls.find(
      (call: any[]) => call[0] === 'queue:updated'
    )?.[1];

    const update: WorkflowRunUpdate = {
      runId: 'run-1',
      type: 'queue',
      data: { queueStatus: 'running', queuePosition: 1 },
    };

    act(() => {
      callback?.(update);
    });

    expect(onUpdate).toHaveBeenCalledWith(update);
  });

  it('throttles rapid updates', () => {
    vi.useFakeTimers();
    const onUpdate = vi.fn();
    renderHook(() => useWorkflowWebSocket({ onUpdate, throttleMs: 1000 }));

    const callback = mockSocket.on.mock.calls.find(
      (call: any[]) => call[0] === 'workflow:progress'
    )?.[1];

    // Send 5 rapid updates
    for (let i = 0; i < 5; i++) {
      act(() => {
        callback?.({
          runId: 'run-1',
          type: 'progress',
          data: { progress: i * 20 },
        });
      });
    }

    // Should only call once (throttled)
    expect(onUpdate).toHaveBeenCalledTimes(1);

    // Advance time and send another update
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    act(() => {
      callback?.({
        runId: 'run-1',
        type: 'progress',
        data: { progress: 100 },
      });
    });

    // Should call again after throttle period
    expect(onUpdate).toHaveBeenCalledTimes(2);

    vi.useRealTimers();
  });

  it('emits pause event when socket is connected', () => {
    mockSocket.connected = true;
    const { result } = renderHook(() => useWorkflowWebSocket());

    act(() => {
      result.current.pauseRun('run-1');
    });

    expect(mockSocket.emit).toHaveBeenCalledWith('workflow:pause', { runId: 'run-1' });
  });

  it('does not emit pause event when socket is disconnected', () => {
    mockSocket.connected = false;
    const { result } = renderHook(() => useWorkflowWebSocket());

    act(() => {
      result.current.pauseRun('run-1');
    });

    expect(mockSocket.emit).not.toHaveBeenCalled();
  });

  it('emits cancel event when socket is connected', () => {
    mockSocket.connected = true;
    const { result } = renderHook(() => useWorkflowWebSocket());

    act(() => {
      result.current.cancelRun('run-1');
    });

    expect(mockSocket.emit).toHaveBeenCalledWith('workflow:cancel', { runId: 'run-1' });
  });

  it('does not emit cancel event when socket is disconnected', () => {
    mockSocket.connected = false;
    const { result } = renderHook(() => useWorkflowWebSocket());

    act(() => {
      result.current.cancelRun('run-1');
    });

    expect(mockSocket.emit).not.toHaveBeenCalled();
  });

  // ST-108: Deployment Event Tests
  describe('ST-108: Deployment Events', () => {
    it('handles deployment:started event', () => {
      const onUpdate = vi.fn();
      renderHook(() => useWorkflowWebSocket({ onUpdate }));

      const callback = mockSocket.on.mock.calls.find(
        (call: any[]) => call[0] === 'deployment:started'
      )?.[1];

      const update = {
        storyKey: 'ST-123',
        environment: 'test',
        startedAt: new Date().toISOString(),
      };

      act(() => {
        callback?.(update);
      });

      expect(onUpdate).toHaveBeenCalledWith(update);
    });

    it('handles deployment:completed event with success', () => {
      const onUpdate = vi.fn();
      renderHook(() => useWorkflowWebSocket({ onUpdate }));

      const callback = mockSocket.on.mock.calls.find(
        (call: any[]) => call[0] === 'deployment:completed'
      )?.[1];

      const update = {
        storyKey: 'ST-123',
        environment: 'production',
        status: 'success',
        completedAt: new Date().toISOString(),
      };

      act(() => {
        callback?.(update);
      });

      expect(onUpdate).toHaveBeenCalledWith(update);
    });

    it('handles deployment:completed event with failure', () => {
      const onUpdate = vi.fn();
      renderHook(() => useWorkflowWebSocket({ onUpdate }));

      const callback = mockSocket.on.mock.calls.find(
        (call: any[]) => call[0] === 'deployment:completed'
      )?.[1];

      const update = {
        storyKey: 'ST-123',
        environment: 'production',
        status: 'failed',
        error: 'Health check failed',
        completedAt: new Date().toISOString(),
      };

      act(() => {
        callback?.(update);
      });

      expect(onUpdate).toHaveBeenCalledWith(update);
    });

    it('handles review:ready event', () => {
      const onUpdate = vi.fn();
      renderHook(() => useWorkflowWebSocket({ onUpdate }));

      const callback = mockSocket.on.mock.calls.find(
        (call: any[]) => call[0] === 'review:ready'
      )?.[1];

      const update = {
        storyKey: 'ST-123',
        readyAt: new Date().toISOString(),
      };

      act(() => {
        callback?.(update);
      });

      expect(onUpdate).toHaveBeenCalledWith(update);
    });
  });
});
