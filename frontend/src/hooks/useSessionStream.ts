/**
 * ST-160: Session Streaming Hook
 *
 * Provides real-time streaming of Claude Code session output via WebSocket.
 * Supports session subscription, question detection, and live output viewing.
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { useWebSocket } from '../services/websocket.service';

/**
 * Session stream event from the backend
 */
export interface SessionStreamEvent {
  componentRunId?: string;
  type: string;
  sequenceNumber: number;
  timestamp: string;
  payload: Record<string, unknown>;
}

/**
 * Question detected event
 */
export interface QuestionEvent {
  questionId: string;
  componentRunId?: string;
  sessionId: string;
  questionText: string;
  canHandoff: boolean;
  executionType: string;
  timestamp: string;
}

/**
 * Session status from getSessionStatus endpoint
 */
export interface SessionStatus {
  isActive: boolean;
  agentId?: string;
  agentHostname?: string;
  currentJobId?: string;
  pendingQuestions: number;
  lastEventAt?: string;
}

/**
 * Hook configuration
 */
export interface UseSessionStreamOptions {
  workflowRunId: string;
  componentRunId?: string;
  autoSubscribe?: boolean;
  maxEvents?: number;
}

/**
 * Hook return value
 */
export interface UseSessionStreamReturn {
  // Connection state
  isSubscribed: boolean;
  isConnected: boolean;

  // Stream data
  events: SessionStreamEvent[];
  textOutput: string[];
  currentActivity: string;

  // Questions
  pendingQuestion: QuestionEvent | null;
  questionHistory: QuestionEvent[];

  // Status
  sessionStatus: SessionStatus | null;

  // Actions
  subscribe: () => void;
  unsubscribe: () => void;
  clearEvents: () => void;
}

/**
 * Hook for subscribing to real-time session streaming
 */
export function useSessionStream(options: UseSessionStreamOptions): UseSessionStreamReturn {
  const { workflowRunId, componentRunId, autoSubscribe = true, maxEvents = 500 } = options;
  const { socket, isConnected } = useWebSocket();

  // State
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [events, setEvents] = useState<SessionStreamEvent[]>([]);
  const [textOutput, setTextOutput] = useState<string[]>([]);
  const [currentActivity, setCurrentActivity] = useState<string>('idle');
  const [pendingQuestion, setPendingQuestion] = useState<QuestionEvent | null>(null);
  const [questionHistory, setQuestionHistory] = useState<QuestionEvent[]>([]);
  const [sessionStatus, setSessionStatus] = useState<SessionStatus | null>(null);

  // Ref for event handlers to avoid stale closures
  const workflowRunIdRef = useRef(workflowRunId);
  workflowRunIdRef.current = workflowRunId;

  // Subscribe to session stream
  const subscribe = useCallback(() => {
    if (!socket || isSubscribed) return;

    socket.emit('session:subscribe', {
      workflowRunId,
      componentRunId,
    });
  }, [socket, workflowRunId, componentRunId, isSubscribed]);

  // Unsubscribe from session stream
  const unsubscribe = useCallback(() => {
    if (!socket || !isSubscribed) return;

    socket.emit('session:unsubscribe', {
      workflowRunId,
      componentRunId,
    });
    setIsSubscribed(false);
  }, [socket, workflowRunId, componentRunId, isSubscribed]);

  // Clear events
  const clearEvents = useCallback(() => {
    setEvents([]);
    setTextOutput([]);
  }, []);

  // Handle socket events
  useEffect(() => {
    if (!socket) return;

    // Handle subscription confirmation
    const handleSubscribed = (data: { workflowRunId: string; success: boolean }) => {
      if (data.workflowRunId === workflowRunIdRef.current && data.success) {
        setIsSubscribed(true);
        console.log(`[ST-160] Subscribed to session stream for ${data.workflowRunId}`);
      }
    };

    // Handle unsubscription confirmation
    const handleUnsubscribed = (data: { workflowRunId: string }) => {
      if (data.workflowRunId === workflowRunIdRef.current) {
        setIsSubscribed(false);
        console.log(`[ST-160] Unsubscribed from session stream for ${data.workflowRunId}`);
      }
    };

    // Handle session history (initial events on subscribe)
    const handleHistory = (data: { workflowRunId: string; events: SessionStreamEvent[] }) => {
      if (data.workflowRunId === workflowRunIdRef.current) {
        setEvents(data.events.slice(-maxEvents));

        // Extract text output from events
        const texts = data.events
          .filter((e) => e.type === 'text' && e.payload.text)
          .map((e) => e.payload.text as string);
        setTextOutput(texts.slice(-maxEvents));
      }
    };

    // Handle progress events
    const handleProgress = (data: {
      componentRunId?: string;
      type: string;
      sequenceNumber: number;
      payload: Record<string, unknown>;
    }) => {
      const event: SessionStreamEvent = {
        ...data,
        timestamp: new Date().toISOString(),
      };

      setEvents((prev) => [...prev.slice(-(maxEvents - 1)), event]);

      // Update current activity
      if (data.type === 'activity_change' && data.payload.activity) {
        setCurrentActivity(data.payload.activity as string);
      }

      // Extract text output
      if (data.type === 'text' && data.payload.text) {
        setTextOutput((prev) => [...prev.slice(-(maxEvents - 1)), data.payload.text as string]);
      }
    };

    // Handle question events
    const handleQuestion = (data: QuestionEvent) => {
      setPendingQuestion(data);
      setQuestionHistory((prev) => [...prev, data]);
      setCurrentActivity('waiting_for_answer');
    };

    // Handle session updates (for broadcasting)
    const handleSessionUpdate = (data: { type: string; content: string; timestamp: string }) => {
      if (data.type === 'text') {
        setTextOutput((prev) => [...prev.slice(-(maxEvents - 1)), data.content]);
      }
    };

    // Handle workflow events (progress, question, etc.)
    socket.on('session:subscribed', handleSubscribed);
    socket.on('session:unsubscribed', handleUnsubscribed);
    socket.on('session:history', handleHistory);
    socket.on(`workflow:${workflowRunId}:progress`, handleProgress);
    socket.on(`workflow:${workflowRunId}:question`, handleQuestion);
    socket.on('session:update', handleSessionUpdate);

    // Auto-subscribe if enabled
    if (autoSubscribe && isConnected && !isSubscribed) {
      subscribe();
    }

    return () => {
      socket.off('session:subscribed', handleSubscribed);
      socket.off('session:unsubscribed', handleUnsubscribed);
      socket.off('session:history', handleHistory);
      socket.off(`workflow:${workflowRunId}:progress`, handleProgress);
      socket.off(`workflow:${workflowRunId}:question`, handleQuestion);
      socket.off('session:update', handleSessionUpdate);
    };
  }, [socket, workflowRunId, autoSubscribe, isConnected, isSubscribed, subscribe, maxEvents]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (isSubscribed) {
        unsubscribe();
      }
    };
  }, [isSubscribed, unsubscribe]);

  return {
    isSubscribed,
    isConnected,
    events,
    textOutput,
    currentActivity,
    pendingQuestion,
    questionHistory,
    sessionStatus,
    subscribe,
    unsubscribe,
    clearEvents,
  };
}
