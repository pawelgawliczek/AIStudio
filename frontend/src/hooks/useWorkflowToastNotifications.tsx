import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useWorkflowWebSocket } from './useWorkflowWebSocket';

/**
 * ST-108: Hook for displaying toast notifications for workflow events
 *
 * Maps WebSocket events to toast messages with:
 * - Different durations for different event types
 * - Spam prevention for rapid component completions
 * - Click-to-navigate functionality
 * - Emoji indicators for visual clarity
 */
export function useWorkflowToastNotifications() {
  const navigate = useNavigate();
  const eventQueueRef = useRef<Map<string, number>>(new Map());
  const timeoutsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  // Helper to create clickable story link
  const storyLink = (storyKey: string, text?: string) => {
    const displayText = text || storyKey;
    return (
      <span
        onClick={() => navigate(`/story/${storyKey}`)}
        style={{ cursor: 'pointer', textDecoration: 'underline', fontWeight: 500 }}
      >
        {displayText}
      </span>
    );
  };

  // Helper to create clickable run link
  const runLink = (runId: string, storyKey?: string) => {
    const displayText = storyKey || 'View run';
    return (
      <span
        onClick={() => navigate(`/workflow-runs/${runId}`)}
        style={{ cursor: 'pointer', textDecoration: 'underline', fontWeight: 500 }}
      >
        {displayText}
      </span>
    );
  };

  const handleUpdate = (update: any) => {
    console.log('[Toast] Received WebSocket update:', update);

    // Workflow started event
    if (update.storyKey && update.storyTitle && update.startedAt && !update.status) {
      toast(
        (t) => (
          <span>
            🎬 Workflow started for {storyLink(update.storyKey)}: {update.storyTitle}
          </span>
        ),
        { duration: 10000 }
      );
    }

    // Workflow completed/failed event (has runId for linking)
    if (update.status === 'completed' && update.storyKey) {
      toast.success(
        (t) => (
          <span>
            🎉 Workflow completed for {update.runId ? runLink(update.runId, update.storyKey) : storyLink(update.storyKey)}
          </span>
        ),
        { duration: 12000 }
      );
    } else if (update.status === 'failed' && update.storyKey) {
      toast.error(
        (t) => (
          <span>
            💥 Workflow failed for {update.runId ? runLink(update.runId, update.storyKey) : storyLink(update.storyKey)}
          </span>
        ),
        { duration: 15000 }
      );
    }

    // Component started event
    if (update.componentName && update.storyKey && !update.status && update.startedAt) {
      toast(
        (t) => (
          <span>
            🚀 {update.componentName} started for {storyLink(update.storyKey)}
          </span>
        ),
        { duration: 8000 }
      );
    }

    // Component completed event (with spam prevention)
    if (update.componentName && update.storyKey && update.status && update.completedAt) {
      const key = `component:${update.status}:${update.storyKey}`;
      const count = eventQueueRef.current.get(key) || 0;

      eventQueueRef.current.set(key, count + 1);

      // Debounce: Wait 2 seconds before showing grouped toast
      clearTimeout(timeoutsRef.current.get(key));
      timeoutsRef.current.set(key, setTimeout(() => {
        const totalCount = eventQueueRef.current.get(key) || 1;

        if (totalCount === 1) {
          if (update.status === 'completed') {
            toast.success(
              (t) => (
                <span>
                  ✅ {update.componentName} completed for {storyLink(update.storyKey)}
                </span>
              ),
              { duration: 10000 }
            );
          } else if (update.status === 'failed') {
            toast.error(
              (t) => (
                <span>
                  ❌ {update.componentName} failed for {storyLink(update.storyKey)}
                </span>
              ),
              { duration: 15000 }
            );
          }
        } else {
          // Group multiple rapid completions
          if (update.status === 'completed') {
            toast.success(
              (t) => (
                <span>
                  ✅ {totalCount} components completed for {storyLink(update.storyKey)}
                </span>
              ),
              { duration: 10000 }
            );
          } else if (update.status === 'failed') {
            toast.error(
              (t) => (
                <span>
                  ❌ {totalCount} components failed for {storyLink(update.storyKey)}
                </span>
              ),
              { duration: 15000 }
            );
          }
        }

        eventQueueRef.current.delete(key);
        timeoutsRef.current.delete(key);
      }, 2000));
    }

    // Deployment started event
    if (update.environment && update.storyKey && update.startedAt && !update.completedAt) {
      const env = update.environment === 'production' ? 'production' : 'test environment';
      const emoji = update.environment === 'production' ? '🚀' : '🧪';
      toast(
        (t) => (
          <span>
            {emoji} {storyLink(update.storyKey)} deploying to {env}...
          </span>
        ),
        { duration: 15000 }
      );
    }

    // Deployment completed event
    if (update.environment && update.storyKey && update.completedAt) {
      if (update.status === 'success') {
        const env = update.environment === 'production' ? 'production' : 'test environment';
        toast.success(
          (t) => (
            <span>
              🚀 {storyLink(update.storyKey)} deployed to {env}!
            </span>
          ),
          { duration: 15000 }
        );
      } else if (update.status === 'failed' || update.status === 'rolled_back') {
        const message = update.status === 'rolled_back' ? 'deployment rolled back' : 'deployment failed';
        const emoji = update.status === 'rolled_back' ? '⚠️' : '❌';
        toast.error(
          (t) => (
            <span>
              {emoji} {storyLink(update.storyKey)} {message}
            </span>
          ),
          { duration: 20000 }
        );
      }
    }

    // Review ready event
    if (update.readyAt && update.storyKey) {
      toast(
        (t) => (
          <span>
            👀 {storyLink(update.storyKey)} is ready for review
          </span>
        ),
        { duration: 12000 }
      );
    }
  };

  // Initialize WebSocket connection with event handler
  useWorkflowWebSocket({
    onUpdate: handleUpdate,
    throttleMs: 500, // Throttle updates to prevent overwhelming re-renders
  });

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      timeoutsRef.current.forEach((timeout) => clearTimeout(timeout));
      timeoutsRef.current.clear();
      eventQueueRef.current.clear();
    };
  }, []);
}
