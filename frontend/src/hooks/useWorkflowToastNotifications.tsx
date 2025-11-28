import { useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import { useWorkflowWebSocket } from './useWorkflowWebSocket';

/**
 * ST-108: Hook for displaying toast notifications for workflow events
 *
 * Maps WebSocket events to toast messages with:
 * - Different durations for different event types
 * - Spam prevention for rapid component completions
 * - Emoji indicators for visual clarity
 *
 * Note: Uses string-based toasts for reliability (JSX toasts had rendering issues)
 */
export function useWorkflowToastNotifications() {
  const eventQueueRef = useRef<Map<string, { count: number; lastUpdate: any }>>(new Map());
  const timeoutsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  const handleUpdate = (update: any) => {
    console.log('[Toast] Received WebSocket update:', update);

    // Deployment completed event - CHECK FIRST (most specific)
    if (update.environment && update.storyKey && update.completedAt) {
      const env = update.environment === 'production' ? 'production' : 'test environment';
      if (update.status === 'success') {
        toast.success(`🚀 ${update.storyKey} deployed to ${env}!`, { duration: 15000 });
      } else if (update.status === 'failed') {
        toast.error(`❌ ${update.storyKey} deployment to ${env} failed`, { duration: 20000 });
      } else if (update.status === 'rolled_back') {
        toast.error(`⚠️ ${update.storyKey} deployment rolled back`, { duration: 20000 });
      }
      return; // Exit early
    }

    // Deployment started event
    if (update.environment && update.storyKey && update.startedAt && !update.completedAt) {
      const env = update.environment === 'production' ? 'production' : 'test environment';
      const emoji = update.environment === 'production' ? '🚀' : '🧪';
      toast(`${emoji} ${update.storyKey} deploying to ${env}...`, { duration: 15000 });
      return;
    }

    // Component completed event (with spam prevention)
    if (update.componentName && update.storyKey && update.status && update.completedAt) {
      const key = `component:${update.status}:${update.storyKey}`;
      const existing = eventQueueRef.current.get(key);
      const count = existing ? existing.count + 1 : 1;

      eventQueueRef.current.set(key, { count, lastUpdate: update });

      // Debounce: Wait 2 seconds before showing grouped toast
      clearTimeout(timeoutsRef.current.get(key));
      timeoutsRef.current.set(key, setTimeout(() => {
        const data = eventQueueRef.current.get(key);
        if (!data) return;

        const { count: totalCount, lastUpdate: lastData } = data;

        if (totalCount === 1) {
          if (lastData.status === 'completed') {
            toast.success(`✅ ${lastData.componentName} completed for ${lastData.storyKey}`, { duration: 10000 });
          } else if (lastData.status === 'failed') {
            toast.error(`❌ ${lastData.componentName} failed for ${lastData.storyKey}`, { duration: 15000 });
          }
        } else {
          // Group multiple rapid completions
          if (lastData.status === 'completed') {
            toast.success(`✅ ${totalCount} components completed for ${lastData.storyKey}`, { duration: 10000 });
          } else if (lastData.status === 'failed') {
            toast.error(`❌ ${totalCount} components failed for ${lastData.storyKey}`, { duration: 15000 });
          }
        }

        eventQueueRef.current.delete(key);
        timeoutsRef.current.delete(key);
      }, 2000));
      return;
    }

    // Component started event
    if (update.componentName && update.storyKey && !update.status && update.startedAt) {
      toast(`🚀 ${update.componentName} started for ${update.storyKey}`, { duration: 8000 });
      return;
    }

    // Workflow completed/failed event
    if (update.status === 'completed' && update.storyKey && !update.componentName && !update.environment) {
      toast.success(`🎉 Workflow completed for ${update.storyKey}`, { duration: 12000 });
      return;
    } else if (update.status === 'failed' && update.storyKey && !update.componentName && !update.environment) {
      toast.error(`💥 Workflow failed for ${update.storyKey}`, { duration: 15000 });
      return;
    }

    // Workflow started event
    if (update.storyKey && update.storyTitle && update.startedAt && !update.status && !update.componentName) {
      toast(`🎬 Workflow started for ${update.storyKey}: ${update.storyTitle}`, { duration: 10000 });
      return;
    }

    // Review ready event
    if (update.readyAt && update.storyKey) {
      toast(`👀 ${update.storyKey} is ready for review`, { duration: 12000 });
      return;
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
