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

  const handleUpdate = (update: any) => {
    // Workflow started event
    if (update.storyKey && update.storyTitle && update.startedAt && !update.status) {
      toast.info(`🎬 Workflow started for ${update.storyKey}: ${update.storyTitle}`, {
        duration: 5000,
        onClick: () => navigate(`/stories/${update.storyKey}`),
      });
    }

    // Workflow completed/failed event
    if (update.status === 'completed') {
      toast.success(`🎉 Workflow completed for ${update.storyKey}`, {
        duration: 5000,
        onClick: () => navigate(`/stories/${update.storyKey}`),
      });
    } else if (update.status === 'failed') {
      toast.error(`💥 Workflow failed for ${update.storyKey}`, {
        duration: 8000, // Longer for errors
        onClick: () => navigate(`/stories/${update.storyKey}`),
      });
    }

    // Component started event
    if (update.componentName && update.storyKey && !update.status && update.startedAt) {
      toast.info(`🚀 ${update.componentName} started for ${update.storyKey}`, {
        duration: 3000, // Shorter for component events
      });
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
            toast.success(`✅ ${update.componentName} completed for ${update.storyKey}`, {
              duration: 3000,
            });
          } else if (update.status === 'failed') {
            toast.error(`❌ ${update.componentName} failed for ${update.storyKey}`, {
              duration: 5000,
            });
          }
        } else {
          // Group multiple rapid completions
          if (update.status === 'completed') {
            toast.success(`✅ ${totalCount} components completed for ${update.storyKey}`, {
              duration: 3000,
            });
          } else if (update.status === 'failed') {
            toast.error(`❌ ${totalCount} components failed for ${update.storyKey}`, {
              duration: 5000,
            });
          }
        }

        eventQueueRef.current.delete(key);
        timeoutsRef.current.delete(key);
      }, 2000));
    }

    // Deployment started event
    if (update.environment && update.storyKey && update.startedAt) {
      const env = update.environment === 'production' ? 'production' : 'test environment';
      const emoji = update.environment === 'production' ? '🚀' : '🧪';
      toast.info(`${emoji} ${update.storyKey} deploying to ${env}...`, {
        duration: update.environment === 'production' ? 10000 : 5000,
        onClick: () => navigate(`/stories/${update.storyKey}`),
      });
    }

    // Deployment completed event
    if (update.environment && update.storyKey && update.completedAt) {
      if (update.status === 'success') {
        const env = update.environment === 'production' ? 'production' : 'test environment';
        const duration = update.environment === 'production' ? 10000 : 5000; // Production toasts persist longer
        toast.success(`🚀 ${update.storyKey} deployed to ${env}!`, {
          duration,
          onClick: () => navigate(`/stories/${update.storyKey}`),
        });
      } else if (update.status === 'failed' || update.status === 'rolled_back') {
        const message = update.status === 'rolled_back'
          ? `⚠️ ${update.storyKey} deployment rolled back`
          : `❌ ${update.storyKey} deployment failed`;
        toast.error(message, {
          duration: 10000,
          onClick: () => navigate(`/stories/${update.storyKey}`),
        });
      }
    }

    // Review ready event
    if (update.readyAt && update.storyKey) {
      toast.info(`👀 ${update.storyKey} is ready for review`, {
        duration: 5000,
        onClick: () => navigate(`/stories/${update.storyKey}`),
      });
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
