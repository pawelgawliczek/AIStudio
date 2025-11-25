import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useWorkflowWebSocket } from '../useWorkflowWebSocket';
import { WorkflowRunUpdate } from '../../types/workflow-tracking';

// Mock socket.io-client
vi.mock('socket.io-client', () => ({
  io: vi.fn(),
}));

import { io } from 'socket.io-client';

describe('useWorkflowWebSocket', () => {
  let mockSocket: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockSocket = {
      on: vi.fn(),
      off: vi.fn(),
      emit: vi.fn(),
      connected: false,
      connect: vi.fn(),
      disconnect: vi.fn(),
    };

    (io as any).mockReturnValue(mockSocket);
  });

  it('initializes socket connection', () => {
    renderHook(() => useWorkflowWebSocket());

    expect(io).toHaveBeenCalledWith(expect.any(String), expect.any(Object));
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
    expect(mockSocket.on).toHaveBeenCalledWith('connect', expect.any(Function));
    expect(mockSocket.on).toHaveBeenCalledWith('disconnect', expect.any(Function));
  });

  it('unsubscribes from events on unmount', () => {
    const { unmount } = renderHook(() => useWorkflowWebSocket());

    unmount();

    expect(mockSocket.off).toHaveBeenCalledWith('workflow:started');
    expect(mockSocket.off).toHaveBeenCalledWith('workflow:status');
    expect(mockSocket.off).toHaveBeenCalledWith('workflow:progress');
    expect(mockSocket.off).toHaveBeenCalledWith('component:started');
    expect(mockSocket.off).toHaveBeenCalledWith('component:progress');
    expect(mockSocket.off).toHaveBeenCalledWith('component:completed');
    expect(mockSocket.off).toHaveBeenCalledWith('queue:updated');
  });

  it('updates connected state on connect', () => {
    const { result } = renderHook(() => useWorkflowWebSocket());

    // Get the connect callback
    const connectCallback = mockSocket.on.mock.calls.find(
      (call: any[]) => call[0] === 'connect'
    )?.[1];

    // Simulate connection
    act(() => {
      mockSocket.connected = true;
      connectCallback?.();
    });

    expect(result.current.connected).toBe(true);
  });

  it('updates connected state on disconnect', () => {
    const { result } = renderHook(() => useWorkflowWebSocket());

    // Simulate connection first
    act(() => {
      mockSocket.connected = true;
      const connectCallback = mockSocket.on.mock.calls.find(
        (call: any[]) => call[0] === 'connect'
      )?.[1];
      connectCallback?.();
    });

    // Get the disconnect callback
    const disconnectCallback = mockSocket.on.mock.calls.find(
      (call: any[]) => call[0] === 'disconnect'
    )?.[1];

    // Simulate disconnection
    act(() => {
      mockSocket.connected = false;
      disconnectCallback?.();
    });

    expect(result.current.connected).toBe(false);
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

  it('emits pause event', () => {
    const { result } = renderHook(() => useWorkflowWebSocket());

    act(() => {
      result.current.pauseRun('run-1');
    });

    expect(mockSocket.emit).toHaveBeenCalledWith('workflow:pause', { runId: 'run-1' });
  });

  it('emits cancel event', () => {
    const { result } = renderHook(() => useWorkflowWebSocket());

    act(() => {
      result.current.cancelRun('run-1');
    });

    expect(mockSocket.emit).toHaveBeenCalledWith('workflow:cancel', { runId: 'run-1' });
  });

  it('reconnects on disconnect', () => {
    vi.useFakeTimers();
    renderHook(() => useWorkflowWebSocket());

    const disconnectCallback = mockSocket.on.mock.calls.find(
      (call: any[]) => call[0] === 'disconnect'
    )?.[1];

    act(() => {
      disconnectCallback?.();
    });

    // Should attempt reconnect after delay
    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(mockSocket.connect).toHaveBeenCalled();

    vi.useRealTimers();
  });
});
