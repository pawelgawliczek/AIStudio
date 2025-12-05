import { useEffect, useState, useCallback, useRef } from 'react';
import { wsService, useWebSocket } from '../services/websocket.service';

/**
 * ST-176: useTranscriptStream Hook
 *
 * Manages real-time transcript streaming via WebSocket for a component run.
 * Features:
 * - Subscribe/unsubscribe to transcript:line events
 * - Circular buffer to prevent memory bloat
 * - Auto-parse JSONL lines
 * - Line length limits (10KB max)
 * - Connection state tracking
 */

export interface TranscriptLine {
  sequenceNumber: number;
  line: string; // Raw JSONL line
  parsed?: any; // Parsed JSON object (optional)
  timestamp: Date;
}

export interface UseTranscriptStreamOptions {
  componentRunId: string;
  autoSubscribe?: boolean; // Default: true
  parseLines?: boolean; // Default: true - Auto-parse JSONL
  maxLines?: number; // Default: 500 - Circular buffer limit
}

export interface UseTranscriptStreamResult {
  lines: TranscriptLine[];
  isStreaming: boolean;
  isComplete: boolean;
  error: Error | null;
  subscribe: () => void;
  unsubscribe: () => void;
  clear: () => void;
}

const MAX_LINE_LENGTH = 10_000; // 10KB per line limit

export function useTranscriptStream(
  options: UseTranscriptStreamOptions
): UseTranscriptStreamResult {
  const {
    componentRunId,
    autoSubscribe = true,
    parseLines = true,
    maxLines = 500,
  } = options;

  const { isConnected, socket } = useWebSocket();
  const [lines, setLines] = useState<TranscriptLine[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const subscribedRef = useRef(false);

  // Subscribe to transcript stream
  const subscribe = useCallback(() => {
    const currentSocket = wsService.getSocket();
    if (!currentSocket?.connected) {
      setError(new Error('WebSocket not connected'));
      return;
    }

    if (subscribedRef.current) {
      console.warn('[useTranscriptStream] Already subscribed');
      return;
    }

    currentSocket.emit('transcript:subscribe', { componentRunId });
    subscribedRef.current = true;
    setIsStreaming(true);
    setError(null);
  }, [componentRunId]);

  // Unsubscribe from transcript stream
  const unsubscribe = useCallback(() => {
    const currentSocket = wsService.getSocket();
    if (!currentSocket?.connected) {
      return;
    }

    if (!subscribedRef.current) {
      return;
    }

    currentSocket.emit('transcript:unsubscribe', { componentRunId });
    subscribedRef.current = false;
    setIsStreaming(false);
  }, [componentRunId]);

  // Clear buffer
  const clear = useCallback(() => {
    setLines([]);
  }, []);

  // Handle incoming transcript lines
  useEffect(() => {
    if (!socket) return;

    const handleTranscriptLine = (data: {
      componentRunId: string;
      sequenceNumber: number;
      line: string;
      timestamp: string;
    }) => {
      // Only handle lines for our componentRunId
      if (data.componentRunId !== componentRunId) {
        return;
      }

      // Validate line length
      if (data.line.length > MAX_LINE_LENGTH) {
        console.warn(
          `[useTranscriptStream] Line ${data.sequenceNumber} exceeds ${MAX_LINE_LENGTH} chars, truncating`
        );
        data.line = data.line.substring(0, MAX_LINE_LENGTH) + '... [truncated]';
      }

      const transcriptLine: TranscriptLine = {
        sequenceNumber: data.sequenceNumber,
        line: data.line,
        timestamp: new Date(data.timestamp),
      };

      // Parse JSONL if enabled
      if (parseLines) {
        try {
          transcriptLine.parsed = JSON.parse(data.line);
        } catch (parseError) {
          // Silent failure - keep raw line if parse fails
        }
      }

      // Add to circular buffer
      setLines((prevLines) => {
        const newLines = [...prevLines, transcriptLine];
        // Keep only last maxLines
        if (newLines.length > maxLines) {
          return newLines.slice(newLines.length - maxLines);
        }
        return newLines;
      });
    };

    const handleTranscriptComplete = (data: {
      componentRunId: string;
      timestamp: string;
    }) => {
      if (data.componentRunId !== componentRunId) {
        return;
      }

      setIsStreaming(false);
      setIsComplete(true);
      subscribedRef.current = false;
    };

    const handleTranscriptError = (data: {
      componentRunId: string;
      message: string;
      code: string;
    }) => {
      if (data.componentRunId !== componentRunId) {
        return;
      }

      setError(new Error(`${data.code}: ${data.message}`));
      setIsStreaming(false);
      subscribedRef.current = false;
    };

    socket.on('transcript:line', handleTranscriptLine);
    socket.on('transcript:complete', handleTranscriptComplete);
    socket.on('transcript:error', handleTranscriptError);

    return () => {
      socket.off('transcript:line', handleTranscriptLine);
      socket.off('transcript:complete', handleTranscriptComplete);
      socket.off('transcript:error', handleTranscriptError);
    };
  }, [socket, componentRunId, parseLines, maxLines]);

  // Auto-subscribe on mount if enabled
  useEffect(() => {
    if (autoSubscribe && isConnected && !subscribedRef.current) {
      subscribe();
    }

    // Cleanup: unsubscribe on unmount
    return () => {
      if (subscribedRef.current) {
        unsubscribe();
      }
    };
  }, [autoSubscribe, isConnected, subscribe, unsubscribe]);

  return {
    lines,
    isStreaming,
    isComplete,
    error,
    subscribe,
    unsubscribe,
    clear,
  };
}
