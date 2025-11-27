import { useEffect } from 'react';
import { useWebSocket } from '../services/websocket.service';

export interface TestExecutionEvent {
  executionId: string;
  projectId: string;
  testCaseKey: string;
  testCaseTitle: string;
  testLevel?: string;
  status?: 'pass' | 'fail' | 'skip' | 'error';
  durationMs?: number;
  errorMessage?: string;
  coveragePercentage?: number;
  reportUrl?: string;
  startedAt?: string;
  completedAt?: string;
}

interface UseTestExecutionWebSocketOptions {
  onTestStarted?: (event: TestExecutionEvent) => void;
  onTestCompleted?: (event: TestExecutionEvent) => void;
}

/**
 * Hook for test execution WebSocket events
 * Listens to test:started and test:completed events
 *
 * @example
 * useTestExecutionWebSocket({
 *   onTestStarted: (event) => {
 *     console.log('Test started:', event.testCaseKey);
 *   },
 *   onTestCompleted: (event) => {
 *     toast.success(`Test ${event.status}: ${event.testCaseKey}`);
 *   }
 * });
 */
export function useTestExecutionWebSocket(options: UseTestExecutionWebSocketOptions = {}) {
  const { onTestStarted, onTestCompleted } = options;
  const { isConnected, socket } = useWebSocket();

  useEffect(() => {
    if (!socket) return;

    const handleStarted = (event: TestExecutionEvent) => {
      onTestStarted?.(event);
    };

    const handleCompleted = (event: TestExecutionEvent) => {
      onTestCompleted?.(event);
    };

    socket.on('test:started', handleStarted);
    socket.on('test:completed', handleCompleted);

    return () => {
      socket.off('test:started', handleStarted);
      socket.off('test:completed', handleCompleted);
    };
  }, [socket, onTestStarted, onTestCompleted]);

  return {
    connected: isConnected,
  };
}
