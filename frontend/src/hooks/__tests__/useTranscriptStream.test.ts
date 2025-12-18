/**
 * Unit Tests for useTranscriptStream Hook (ST-176)
 *
 * Tests real-time transcript streaming hook with:
 * - WebSocket subscription/unsubscription
 * - Circular buffer management (maxLines)
 * - Connection state tracking
 * - Auto-retry on errors
 * - Line parsing (JSONL)
 * - Security: Line length limits
 *
 * @see ST-176: Real-Time Agent Transcript Streaming in Web GUI
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useWebSocket } from '../../services/websocket.service';
import { useTranscriptStream } from '../useTranscriptStream';
let mockSocket: any;
// Mock the websocket service module
vi.mock('../../services/websocket.service', () => {
  return {
    useWebSocket: vi.fn(),
  };
});

describe('useTranscriptStream', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    // Create fresh mockSocket for each test
    mockSocket = {
      on: vi.fn(),
      off: vi.fn(),
      emit: vi.fn(),
      connected: true,
    };

    // Setup useWebSocket mock
    (useWebSocket as any).mockReturnValue({
      isConnected: true,
      socket: mockSocket,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe('Subscription Management', () => {
    const componentRunId = 'run-123';

    it('should subscribe to transcript:line event on mount', () => {
      renderHook(() => useTranscriptStream({ componentRunId, autoSubscribe: true }));

      expect(mockSocket.on).toHaveBeenCalledWith('transcript:line', expect.any(Function));
    });

    it('should subscribe to transcript:complete event on mount', () => {
      renderHook(() => useTranscriptStream({ componentRunId, autoSubscribe: true }));

      expect(mockSocket.on).toHaveBeenCalledWith('transcript:complete', expect.any(Function));
    });

    it('should subscribe to transcript:error event on mount', () => {
      renderHook(() => useTranscriptStream({ componentRunId, autoSubscribe: true }));

      expect(mockSocket.on).toHaveBeenCalledWith('transcript:error', expect.any(Function));
    });

    it('should emit transcript:subscribe when autoSubscribe enabled', () => {
      renderHook(() => useTranscriptStream({ componentRunId, autoSubscribe: true }));

      expect(mockSocket.emit).toHaveBeenCalledWith('transcript:subscribe', { componentRunId });
    });

    it('should not emit transcript:subscribe when autoSubscribe disabled', () => {
      renderHook(() => useTranscriptStream({ componentRunId, autoSubscribe: false }));

      expect(mockSocket.emit).not.toHaveBeenCalledWith('transcript:subscribe', expect.any(Object));
    });

    it('should unsubscribe from events on unmount', () => {
      const { unmount } = renderHook(() =>
        useTranscriptStream({ componentRunId, autoSubscribe: true })
      );

      unmount();

      expect(mockSocket.off).toHaveBeenCalledWith('transcript:line', expect.any(Function));
      expect(mockSocket.off).toHaveBeenCalledWith('transcript:complete', expect.any(Function));
      expect(mockSocket.off).toHaveBeenCalledWith('transcript:error', expect.any(Function));
    });

    it('should emit transcript:unsubscribe on unmount', () => {
      const { unmount } = renderHook(() =>
        useTranscriptStream({ componentRunId, autoSubscribe: true })
      );

      unmount();

      expect(mockSocket.emit).toHaveBeenCalledWith('transcript:unsubscribe', { componentRunId });
    });

    it('should provide manual subscribe function', () => {
      const { result } = renderHook(() =>
        useTranscriptStream({ componentRunId, autoSubscribe: false })
      );

      act(() => {
        result.current.subscribe();
      });

      expect(mockSocket.emit).toHaveBeenCalledWith('transcript:subscribe', { componentRunId });
    });

    it('should provide manual unsubscribe function', () => {
      const { result } = renderHook(() =>
        useTranscriptStream({ componentRunId, autoSubscribe: true })
      );

      act(() => {
        result.current.unsubscribe();
      });

      expect(mockSocket.emit).toHaveBeenCalledWith('transcript:unsubscribe', { componentRunId });
    });
  });

  describe('Line Buffering', () => {
    const componentRunId = 'run-123';

    it('should add incoming lines to buffer', () => {
      const { result } = renderHook(() =>
        useTranscriptStream({ componentRunId, autoSubscribe: true })
      );

      const callback = mockSocket.on.mock.calls.find(call => call[0] === 'transcript:line')?.[1];

      act(() => {
        callback?.({
          componentRunId,
          line: '{"content": "test"}',
          sequenceNumber: 1,
          timestamp: new Date(),
        });
      });

      expect(result.current.lines).toHaveLength(1);
      expect(result.current.lines[0].line).toBe('{"content": "test"}');
    });

    it('should maintain sequence order', () => {
      const { result } = renderHook(() =>
        useTranscriptStream({ componentRunId, autoSubscribe: true })
      );

      const callback = mockSocket.on.mock.calls.find(call => call[0] === 'transcript:line')?.[1];

      act(() => {
        callback?.({ componentRunId, line: 'line1', sequenceNumber: 1, timestamp: new Date() });
        callback?.({ componentRunId, line: 'line2', sequenceNumber: 2, timestamp: new Date() });
        callback?.({ componentRunId, line: 'line3', sequenceNumber: 3, timestamp: new Date() });
      });

      expect(result.current.lines).toHaveLength(3);
      expect(result.current.lines[0].sequenceNumber).toBe(1);
      expect(result.current.lines[1].sequenceNumber).toBe(2);
      expect(result.current.lines[2].sequenceNumber).toBe(3);
    });

    it('should enforce circular buffer limit (maxLines)', () => {
      const { result } = renderHook(() =>
        useTranscriptStream({ componentRunId, maxLines: 100, autoSubscribe: true })
      );

      const callback = mockSocket.on.mock.calls.find(call => call[0] === 'transcript:line')?.[1];

      // Add 150 lines
      act(() => {
        for (let i = 1; i <= 150; i++) {
          callback?.({
            componentRunId,
            line: `line${i}`,
            sequenceNumber: i,
            timestamp: new Date(),
          });
        }
      });

      // Should only keep last 100
      expect(result.current.lines).toHaveLength(100);
      expect(result.current.lines[0].sequenceNumber).toBe(51); // Lines 51-150
      expect(result.current.lines[99].sequenceNumber).toBe(150);
    });

    it('should provide clear function to empty buffer', () => {
      const { result } = renderHook(() =>
        useTranscriptStream({ componentRunId, autoSubscribe: true })
      );

      const callback = mockSocket.on.mock.calls.find(call => call[0] === 'transcript:line')?.[1];

      act(() => {
        callback?.({ componentRunId, line: 'test', sequenceNumber: 1, timestamp: new Date() });
      });

      expect(result.current.lines).toHaveLength(1);

      act(() => {
        result.current.clear();
      });

      expect(result.current.lines).toHaveLength(0);
    });
  });

  describe('JSONL Parsing', () => {
    const componentRunId = 'run-123';

    it('should parse JSONL when parseLines enabled', () => {
      const { result } = renderHook(() =>
        useTranscriptStream({ componentRunId, parseLines: true, autoSubscribe: true })
      );

      const callback = mockSocket.on.mock.calls.find(call => call[0] === 'transcript:line')?.[1];

      act(() => {
        callback?.({
          componentRunId,
          line: '{"type": "text_delta", "content": "hello"}',
          sequenceNumber: 1,
          timestamp: new Date(),
        });
      });

      expect(result.current.lines[0].parsed).toEqual({
        type: 'text_delta',
        content: 'hello',
      });
    });

    it('should not parse JSONL when parseLines disabled', () => {
      const { result } = renderHook(() =>
        useTranscriptStream({ componentRunId, parseLines: false, autoSubscribe: true })
      );

      const callback = mockSocket.on.mock.calls.find(call => call[0] === 'transcript:line')?.[1];

      act(() => {
        callback?.({
          componentRunId,
          line: '{"content": "test"}',
          sequenceNumber: 1,
          timestamp: new Date(),
        });
      });

      expect(result.current.lines[0].parsed).toBeUndefined();
    });

    it('should handle invalid JSON gracefully', () => {
      const { result } = renderHook(() =>
        useTranscriptStream({ componentRunId, parseLines: true, autoSubscribe: true })
      );

      const callback = mockSocket.on.mock.calls.find(call => call[0] === 'transcript:line')?.[1];

      act(() => {
        callback?.({
          componentRunId,
          line: 'not valid json',
          sequenceNumber: 1,
          timestamp: new Date(),
        });
      });

      // Should still add to buffer with null parsed
      expect(result.current.lines).toHaveLength(1);
      expect(result.current.lines[0].parsed).toBeNull();
    });
  });

  describe('Connection State', () => {
    const componentRunId = 'run-123';

    it('should return isStreaming=true when connected', () => {
      const { result } = renderHook(() =>
        useTranscriptStream({ componentRunId, autoSubscribe: true })
      );

      const callback = mockSocket.on.mock.calls.find(call => call[0] === 'transcript:line')?.[1];

      act(() => {
        callback?.({ componentRunId, line: 'test', sequenceNumber: 1, timestamp: new Date() });
      });

      expect(result.current.isStreaming).toBe(true);
    });

    it('should return isStreaming=false on transcript:complete', () => {
      const { result } = renderHook(() =>
        useTranscriptStream({ componentRunId, autoSubscribe: true })
      );

      const callback = mockSocket.on.mock.calls.find(
        call => call[0] === 'transcript:complete'
      )?.[1];

      act(() => {
        callback?.({ componentRunId, totalLines: 100 });
      });

      expect(result.current.isStreaming).toBe(false);
    });

    it('should track connectionState as "connecting" initially', () => {
      (useWebSocket as any).mockReturnValue({
        isConnected: false,
        socket: null,
      });

      const { result } = renderHook(() =>
        useTranscriptStream({ componentRunId, autoSubscribe: true })
      );

      expect(result.current.connectionState).toBe('connecting');
    });

    it('should track connectionState as "connected" when streaming', () => {
      const { result } = renderHook(() =>
        useTranscriptStream({ componentRunId, autoSubscribe: true })
      );

      const callback = mockSocket.on.mock.calls.find(call => call[0] === 'transcript:line')?.[1];

      act(() => {
        callback?.({ componentRunId, line: 'test', sequenceNumber: 1, timestamp: new Date() });
      });

      expect(result.current.connectionState).toBe('connected');
    });

    it('should track connectionState as "error" on transcript:error', () => {
      const { result } = renderHook(() =>
        useTranscriptStream({ componentRunId, autoSubscribe: true })
      );

      const callback = mockSocket.on.mock.calls.find(call => call[0] === 'transcript:error')?.[1];

      act(() => {
        callback?.({ componentRunId, message: 'File not found', code: 'FILE_NOT_FOUND' });
      });

      expect(result.current.connectionState).toBe('error');
      expect(result.current.error).not.toBeNull();
    });
  });

  describe('Error Handling and Retry', () => {
    const componentRunId = 'run-123';

    it('should capture error from transcript:error event', () => {
      const { result } = renderHook(() =>
        useTranscriptStream({ componentRunId, autoSubscribe: true })
      );

      const callback = mockSocket.on.mock.calls.find(call => call[0] === 'transcript:error')?.[1];

      act(() => {
        callback?.({ componentRunId, message: 'Stream error', code: 'STREAM_ERROR' });
      });

      expect(result.current.error).toEqual(
        expect.objectContaining({ message: 'Stream error' })
      );
    });

    it('should provide retry function', () => {
      const { result } = renderHook(() =>
        useTranscriptStream({ componentRunId, autoSubscribe: true })
      );

      const errorCallback = mockSocket.on.mock.calls.find(
        call => call[0] === 'transcript:error'
      )?.[1];

      act(() => {
        errorCallback?.({ componentRunId, message: 'Error', code: 'ERROR' });
      });

      expect(result.current.error).not.toBeNull();

      // Clear emit calls
      mockSocket.emit.mockClear();

      act(() => {
        result.current.retry();
      });

      expect(result.current.error).toBeNull();
      expect(mockSocket.emit).toHaveBeenCalledWith('transcript:subscribe', { componentRunId });
    });

    it('should auto-retry after 3 seconds when autoRetry enabled', async () => {
      const { result } = renderHook(() =>
        useTranscriptStream({ componentRunId, autoSubscribe: true, autoRetry: true })
      );

      const errorCallback = mockSocket.on.mock.calls.find(
        call => call[0] === 'transcript:error'
      )?.[1];

      act(() => {
        errorCallback?.({ componentRunId, message: 'Error', code: 'ERROR' });
      });

      expect(result.current.error).not.toBeNull();

      // Clear emit calls
      mockSocket.emit.mockClear();

      // Fast-forward 3 seconds
      act(() => {
        vi.advanceTimersByTime(3000);
      });

      await waitFor(() => {
        expect(mockSocket.emit).toHaveBeenCalledWith('transcript:subscribe', { componentRunId });
      });
    });

    it('should not auto-retry when autoRetry disabled', async () => {
      const { result } = renderHook(() =>
        useTranscriptStream({ componentRunId, autoSubscribe: true, autoRetry: false })
      );

      const errorCallback = mockSocket.on.mock.calls.find(
        call => call[0] === 'transcript:error'
      )?.[1];

      act(() => {
        errorCallback?.({ componentRunId, message: 'Error', code: 'ERROR' });
      });

      mockSocket.emit.mockClear();

      act(() => {
        vi.advanceTimersByTime(5000);
      });

      expect(mockSocket.emit).not.toHaveBeenCalledWith('transcript:subscribe', expect.any(Object));
    });
  });

  describe('Security: Line Length Limits', () => {
    const componentRunId = 'run-123';

    it('should truncate lines exceeding 10KB', () => {
      const { result } = renderHook(() =>
        useTranscriptStream({ componentRunId, autoSubscribe: true })
      );

      const callback = mockSocket.on.mock.calls.find(call => call[0] === 'transcript:line')?.[1];

      const longLine = 'a'.repeat(15000); // 15KB

      act(() => {
        callback?.({
          componentRunId,
          line: longLine,
          sequenceNumber: 1,
          timestamp: new Date(),
        });
      });

      expect(result.current.lines[0].line.length).toBeLessThanOrEqual(10000);
      expect(result.current.lines[0].line).toContain('[TRUNCATED]');
    });

    it('should not truncate lines under 10KB', () => {
      const { result } = renderHook(() =>
        useTranscriptStream({ componentRunId, autoSubscribe: true })
      );

      const callback = mockSocket.on.mock.calls.find(call => call[0] === 'transcript:line')?.[1];

      const normalLine = 'a'.repeat(5000); // 5KB

      act(() => {
        callback?.({
          componentRunId,
          line: normalLine,
          sequenceNumber: 1,
          timestamp: new Date(),
        });
      });

      expect(result.current.lines[0].line).toBe(normalLine);
      expect(result.current.lines[0].line).not.toContain('[TRUNCATED]');
    });
  });

  describe('WebSocket Not Connected', () => {
    const componentRunId = 'run-123';

    it('should handle missing socket gracefully', () => {
      (useWebSocket as any).mockReturnValue({
        isConnected: false,
        socket: null,
      });

      const { result } = renderHook(() =>
        useTranscriptStream({ componentRunId, autoSubscribe: true })
      );

      expect(result.current.connectionState).toBe('connecting');
      expect(result.current.lines).toEqual([]);
    });

    it('should not subscribe when socket is null', () => {
      (useWebSocket as any).mockReturnValue({
        isConnected: false,
        socket: null,
      });

      renderHook(() => useTranscriptStream({ componentRunId, autoSubscribe: true }));

      expect(mockSocket.emit).not.toHaveBeenCalled();
    });
  });
});
