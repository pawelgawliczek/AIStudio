import { renderHook, act, waitFor } from '@testing-library/react';
import { useWebSocket } from '../../services/websocket.service';
import { useTestExecutionWebSocket, TestExecutionEvent } from '../useTestExecutionWebSocket';

// Mock the WebSocket service
jest.mock('../../services/websocket.service');

describe('useTestExecutionWebSocket', () => {
  let mockSocket: any;

  beforeEach(() => {
    mockSocket = {
      on: jest.fn(),
      off: jest.fn(),
      emit: jest.fn(),
    };

    (useWebSocket as jest.Mock).mockReturnValue({
      isConnected: true,
      socket: mockSocket,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('initialization', () => {
    it('should register WebSocket event listeners on mount', () => {
      renderHook(() => useTestExecutionWebSocket());

      expect(mockSocket.on).toHaveBeenCalledWith('test:started', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('test:completed', expect.any(Function));
    });

    it('should return connected status', () => {
      const { result } = renderHook(() => useTestExecutionWebSocket());

      expect(result.current.connected).toBe(true);
    });

    it('should handle disconnected socket', () => {
      (useWebSocket as jest.Mock).mockReturnValue({
        isConnected: false,
        socket: null,
      });

      const { result } = renderHook(() => useTestExecutionWebSocket());

      expect(result.current.connected).toBe(false);
    });
  });

  describe('test:started event', () => {
    it('should call onTestStarted callback when event received', async () => {
      const onTestStarted = jest.fn();
      renderHook(() => useTestExecutionWebSocket({ onTestStarted }));

      const testEvent: TestExecutionEvent = {
        executionId: 'exec-123',
        projectId: 'project-uuid',
        testCaseKey: 'TC-AUTH-042',
        testCaseTitle: 'Login test',
        testLevel: 'unit',
        startedAt: '2025-11-27T14:00:00Z',
      };

      // Simulate WebSocket event
      const startedHandler = mockSocket.on.mock.calls.find(
        (call: any[]) => call[0] === 'test:started'
      )[1];
      act(() => {
        startedHandler(testEvent);
      });

      await waitFor(() => {
        expect(onTestStarted).toHaveBeenCalledWith(testEvent);
      });
    });

    it('should not crash if onTestStarted is undefined', async () => {
      renderHook(() => useTestExecutionWebSocket());

      const testEvent: TestExecutionEvent = {
        executionId: 'exec-123',
        projectId: 'project-uuid',
        testCaseKey: 'TC-AUTH-042',
        testCaseTitle: 'Login test',
        startedAt: '2025-11-27T14:00:00Z',
      };

      const startedHandler = mockSocket.on.mock.calls.find(
        (call: any[]) => call[0] === 'test:started'
      )[1];

      expect(() => {
        act(() => {
          startedHandler(testEvent);
        });
      }).not.toThrow();
    });

    it('should handle multiple test:started events', async () => {
      const onTestStarted = jest.fn();
      renderHook(() => useTestExecutionWebSocket({ onTestStarted }));

      const startedHandler = mockSocket.on.mock.calls.find(
        (call: any[]) => call[0] === 'test:started'
      )[1];

      const event1: TestExecutionEvent = {
        executionId: 'exec-1',
        projectId: 'project-uuid',
        testCaseKey: 'TC-001',
        testCaseTitle: 'Test 1',
        startedAt: '2025-11-27T14:00:00Z',
      };

      const event2: TestExecutionEvent = {
        executionId: 'exec-2',
        projectId: 'project-uuid',
        testCaseKey: 'TC-002',
        testCaseTitle: 'Test 2',
        startedAt: '2025-11-27T14:01:00Z',
      };

      act(() => {
        startedHandler(event1);
        startedHandler(event2);
      });

      await waitFor(() => {
        expect(onTestStarted).toHaveBeenCalledTimes(2);
        expect(onTestStarted).toHaveBeenNthCalledWith(1, event1);
        expect(onTestStarted).toHaveBeenNthCalledWith(2, event2);
      });
    });
  });

  describe('test:completed event', () => {
    it('should call onTestCompleted callback when event received', async () => {
      const onTestCompleted = jest.fn();
      renderHook(() => useTestExecutionWebSocket({ onTestCompleted }));

      const testEvent: TestExecutionEvent = {
        executionId: 'exec-123',
        projectId: 'project-uuid',
        testCaseKey: 'TC-AUTH-042',
        testCaseTitle: 'Login test',
        status: 'pass',
        durationMs: 2500,
        coveragePercentage: 85.5,
        reportUrl: '/test-executions/exec-123',
        completedAt: '2025-11-27T14:00:02Z',
      };

      const completedHandler = mockSocket.on.mock.calls.find(
        (call: any[]) => call[0] === 'test:completed'
      )[1];
      act(() => {
        completedHandler(testEvent);
      });

      await waitFor(() => {
        expect(onTestCompleted).toHaveBeenCalledWith(testEvent);
      });
    });

    it('should handle failed test completion', async () => {
      const onTestCompleted = jest.fn();
      renderHook(() => useTestExecutionWebSocket({ onTestCompleted }));

      const testEvent: TestExecutionEvent = {
        executionId: 'exec-456',
        projectId: 'project-uuid',
        testCaseKey: 'TC-E2E-015',
        testCaseTitle: 'Checkout flow',
        status: 'fail',
        durationMs: 12800,
        errorMessage: 'Element not found: #submit-button',
        reportUrl: '/test-executions/exec-456',
        completedAt: '2025-11-27T14:00:15Z',
      };

      const completedHandler = mockSocket.on.mock.calls.find(
        (call: any[]) => call[0] === 'test:completed'
      )[1];
      act(() => {
        completedHandler(testEvent);
      });

      await waitFor(() => {
        expect(onTestCompleted).toHaveBeenCalledWith(testEvent);
      });
    });

    it('should handle skipped test completion', async () => {
      const onTestCompleted = jest.fn();
      renderHook(() => useTestExecutionWebSocket({ onTestCompleted }));

      const testEvent: TestExecutionEvent = {
        executionId: 'exec-789',
        projectId: 'project-uuid',
        testCaseKey: 'TC-INT-087',
        testCaseTitle: 'WebSocket connection',
        status: 'skip',
        durationMs: 0,
        reportUrl: '/test-executions/exec-789',
        completedAt: '2025-11-27T14:00:01Z',
      };

      const completedHandler = mockSocket.on.mock.calls.find(
        (call: any[]) => call[0] === 'test:completed'
      )[1];
      act(() => {
        completedHandler(testEvent);
      });

      await waitFor(() => {
        expect(onTestCompleted).toHaveBeenCalledWith(testEvent);
      });
    });

    it('should not crash if onTestCompleted is undefined', async () => {
      renderHook(() => useTestExecutionWebSocket());

      const testEvent: TestExecutionEvent = {
        executionId: 'exec-123',
        projectId: 'project-uuid',
        testCaseKey: 'TC-AUTH-042',
        testCaseTitle: 'Login test',
        status: 'pass',
        durationMs: 2500,
        reportUrl: '/test-executions/exec-123',
        completedAt: '2025-11-27T14:00:02Z',
      };

      const completedHandler = mockSocket.on.mock.calls.find(
        (call: any[]) => call[0] === 'test:completed'
      )[1];

      expect(() => {
        act(() => {
          completedHandler(testEvent);
        });
      }).not.toThrow();
    });
  });

  describe('cleanup', () => {
    it('should unregister event listeners on unmount', () => {
      const { unmount } = renderHook(() => useTestExecutionWebSocket());

      unmount();

      expect(mockSocket.off).toHaveBeenCalledWith('test:started', expect.any(Function));
      expect(mockSocket.off).toHaveBeenCalledWith('test:completed', expect.any(Function));
    });

    it('should not crash if socket is null during unmount', () => {
      (useWebSocket as jest.Mock).mockReturnValue({
        isConnected: false,
        socket: null,
      });

      const { unmount } = renderHook(() => useTestExecutionWebSocket());

      expect(() => unmount()).not.toThrow();
    });
  });

  describe('callback updates', () => {
    it('should use latest callback when re-rendered', async () => {
      const onTestStarted1 = jest.fn();
      const onTestStarted2 = jest.fn();

      const { rerender } = renderHook(
        ({ callback }) => useTestExecutionWebSocket({ onTestStarted: callback }),
        { initialProps: { callback: onTestStarted1 } }
      );

      // Get the handler
      const startedHandler = mockSocket.on.mock.calls.find(
        (call: any[]) => call[0] === 'test:started'
      )[1];

      // Trigger event with first callback
      const testEvent: TestExecutionEvent = {
        executionId: 'exec-123',
        projectId: 'project-uuid',
        testCaseKey: 'TC-001',
        testCaseTitle: 'Test 1',
        startedAt: '2025-11-27T14:00:00Z',
      };

      act(() => {
        startedHandler(testEvent);
      });

      await waitFor(() => {
        expect(onTestStarted1).toHaveBeenCalledWith(testEvent);
      });

      // Update callback
      rerender({ callback: onTestStarted2 });

      // Trigger event with second callback
      const testEvent2: TestExecutionEvent = {
        executionId: 'exec-456',
        projectId: 'project-uuid',
        testCaseKey: 'TC-002',
        testCaseTitle: 'Test 2',
        startedAt: '2025-11-27T14:01:00Z',
      };

      act(() => {
        startedHandler(testEvent2);
      });

      await waitFor(() => {
        expect(onTestStarted2).toHaveBeenCalledWith(testEvent2);
      });
    });
  });

  describe('edge cases', () => {
    it('should handle malformed event data', async () => {
      const onTestCompleted = jest.fn();
      renderHook(() => useTestExecutionWebSocket({ onTestCompleted }));

      const malformedEvent = {
        // Missing required fields
        executionId: 'exec-123',
      };

      const completedHandler = mockSocket.on.mock.calls.find(
        (call: any[]) => call[0] === 'test:completed'
      )[1];

      act(() => {
        completedHandler(malformedEvent);
      });

      await waitFor(() => {
        expect(onTestCompleted).toHaveBeenCalledWith(malformedEvent);
      });
    });

    it('should handle events when socket reconnects', () => {
      const { rerender } = renderHook(() => useTestExecutionWebSocket());

      // Simulate disconnect
      (useWebSocket as jest.Mock).mockReturnValue({
        isConnected: false,
        socket: null,
      });
      rerender();

      // Simulate reconnect
      const newMockSocket = {
        on: jest.fn(),
        off: jest.fn(),
        emit: jest.fn(),
      };
      (useWebSocket as jest.Mock).mockReturnValue({
        isConnected: true,
        socket: newMockSocket,
      });
      rerender();

      // Verify listeners are re-registered
      expect(newMockSocket.on).toHaveBeenCalledWith('test:started', expect.any(Function));
      expect(newMockSocket.on).toHaveBeenCalledWith('test:completed', expect.any(Function));
    });
  });
});
