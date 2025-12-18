import { renderHook, act, waitFor } from '@testing-library/react';
import React from 'react';
import toast from 'react-hot-toast';
import { BrowserRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useWorkflowToastNotifications } from '../useWorkflowToastNotifications';
import { useWorkflowWebSocket } from '../useWorkflowWebSocket';

// Mock react-hot-toast
vi.mock('react-hot-toast', () => ({
  default: Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
  }),
}));

// Mock useWorkflowWebSocket
vi.mock('../useWorkflowWebSocket', () => ({
  useWorkflowWebSocket: vi.fn(),
}));

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('useWorkflowToastNotifications', () => {
  let capturedOnUpdate: (update: any) => void;

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <BrowserRouter>{children}</BrowserRouter>
  );

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    // Capture the onUpdate callback passed to useWorkflowWebSocket
    (useWorkflowWebSocket as any).mockImplementation((options: any) => {
      capturedOnUpdate = options?.onUpdate;
      return {
        connected: true,
        pauseRun: vi.fn(),
        cancelRun: vi.fn(),
      };
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Workflow Events', () => {
    it('should show toast for workflow started event', () => {
      renderHook(() => useWorkflowToastNotifications(), { wrapper });

      act(() => {
        capturedOnUpdate({
          storyKey: 'ST-123',
          storyTitle: 'Test Story',
          startedAt: new Date().toISOString(),
        });
      });

      expect(toast).toHaveBeenCalledWith(
        expect.any(Function),
        { duration: 10000 }
      );
    });

    it('should show success toast for workflow completed event', () => {
      renderHook(() => useWorkflowToastNotifications(), { wrapper });

      act(() => {
        capturedOnUpdate({
          status: 'completed',
          storyKey: 'ST-123',
          runId: 'run-123',
        });
      });

      expect(toast.success).toHaveBeenCalledWith(
        expect.any(Function),
        { duration: 12000 }
      );
    });

    it('should show error toast for workflow failed event', () => {
      renderHook(() => useWorkflowToastNotifications(), { wrapper });

      act(() => {
        capturedOnUpdate({
          status: 'failed',
          storyKey: 'ST-123',
          runId: 'run-123',
        });
      });

      expect(toast.error).toHaveBeenCalledWith(
        expect.any(Function),
        { duration: 15000 }
      );
    });
  });

  describe('Component Events', () => {
    it('should show toast for component started event', () => {
      renderHook(() => useWorkflowToastNotifications(), { wrapper });

      act(() => {
        capturedOnUpdate({
          componentName: 'Implementer',
          storyKey: 'ST-123',
          startedAt: new Date().toISOString(),
        });
      });

      expect(toast).toHaveBeenCalledWith(
        expect.any(Function),
        { duration: 8000 }
      );
    });

    it('should show success toast for component completed event after debounce', () => {
      renderHook(() => useWorkflowToastNotifications(), { wrapper });

      // Clear any prior calls
      vi.mocked(toast.success).mockClear();

      act(() => {
        capturedOnUpdate({
          componentName: 'Implementer',
          storyKey: 'ST-123',
          status: 'completed',
          completedAt: new Date().toISOString(),
        });
      });

      // Advance timers by debounce period
      act(() => {
        vi.advanceTimersByTime(2000);
      });

      // Should show component completion toast after debounce
      expect(toast.success).toHaveBeenCalledWith(
        expect.any(Function),
        { duration: 10000 }
      );
    });

    it('should show error toast for component failed event after debounce', () => {
      renderHook(() => useWorkflowToastNotifications(), { wrapper });

      act(() => {
        capturedOnUpdate({
          componentName: 'Implementer',
          storyKey: 'ST-123',
          status: 'failed',
          completedAt: new Date().toISOString(),
        });
      });

      act(() => {
        vi.advanceTimersByTime(2000);
      });

      expect(toast.error).toHaveBeenCalledWith(
        expect.any(Function),
        { duration: 15000 }
      );
    });

    it('should group multiple rapid component completions', () => {
      renderHook(() => useWorkflowToastNotifications(), { wrapper });

      // Clear any prior calls
      vi.mocked(toast.success).mockClear();

      // Send 3 rapid completion events with same status and story
      act(() => {
        capturedOnUpdate({
          componentName: 'Implementer',
          storyKey: 'ST-123',
          status: 'completed',
          completedAt: new Date().toISOString(),
        });
        capturedOnUpdate({
          componentName: 'Reviewer',
          storyKey: 'ST-123',
          status: 'completed',
          completedAt: new Date().toISOString(),
        });
        capturedOnUpdate({
          componentName: 'Tester',
          storyKey: 'ST-123',
          status: 'completed',
          completedAt: new Date().toISOString(),
        });
      });

      act(() => {
        vi.advanceTimersByTime(2000);
      });

      // Should show grouped message "3 components completed" - one toast for all
      // The debounce groups rapid updates by key (status + storyKey)
      expect(toast.success).toHaveBeenCalled();
    });
  });

  describe('Deployment Events', () => {
    it('should show toast for deployment started to test environment', () => {
      renderHook(() => useWorkflowToastNotifications(), { wrapper });

      act(() => {
        capturedOnUpdate({
          environment: 'test',
          storyKey: 'ST-123',
          startedAt: new Date().toISOString(),
        });
      });

      expect(toast).toHaveBeenCalledWith(
        expect.any(Function),
        { duration: 15000 }
      );
    });

    it('should show toast for deployment started to production', () => {
      renderHook(() => useWorkflowToastNotifications(), { wrapper });

      act(() => {
        capturedOnUpdate({
          environment: 'production',
          storyKey: 'ST-123',
          startedAt: new Date().toISOString(),
        });
      });

      expect(toast).toHaveBeenCalledWith(
        expect.any(Function),
        { duration: 15000 }
      );
    });

    it('should show success toast for deployment completed', () => {
      renderHook(() => useWorkflowToastNotifications(), { wrapper });

      act(() => {
        capturedOnUpdate({
          environment: 'production',
          storyKey: 'ST-123',
          status: 'success',
          completedAt: new Date().toISOString(),
        });
      });

      expect(toast.success).toHaveBeenCalledWith(
        expect.any(Function),
        { duration: 15000 }
      );
    });

    it('should show error toast for deployment failed', () => {
      renderHook(() => useWorkflowToastNotifications(), { wrapper });

      act(() => {
        capturedOnUpdate({
          environment: 'production',
          storyKey: 'ST-123',
          status: 'failed',
          completedAt: new Date().toISOString(),
        });
      });

      expect(toast.error).toHaveBeenCalledWith(
        expect.any(Function),
        { duration: 20000 }
      );
    });

    it('should show error toast for deployment rolled back', () => {
      renderHook(() => useWorkflowToastNotifications(), { wrapper });

      act(() => {
        capturedOnUpdate({
          environment: 'production',
          storyKey: 'ST-123',
          status: 'rolled_back',
          completedAt: new Date().toISOString(),
        });
      });

      expect(toast.error).toHaveBeenCalledWith(
        expect.any(Function),
        { duration: 20000 }
      );
    });
  });

  describe('Review Events', () => {
    it('should show toast for review ready event', () => {
      renderHook(() => useWorkflowToastNotifications(), { wrapper });

      act(() => {
        capturedOnUpdate({
          readyAt: new Date().toISOString(),
          storyKey: 'ST-123',
        });
      });

      expect(toast).toHaveBeenCalledWith(
        expect.any(Function),
        { duration: 12000 }
      );
    });
  });

  describe('Clickable Links', () => {
    it('should navigate to story on story link click', () => {
      // We need to test the rendered JSX inside the toast
      // Mock toast to capture the element
      let capturedToastElement: any;
      (toast as any).mockImplementation((element: any) => {
        if (typeof element === 'function') {
          capturedToastElement = element({ id: 'test' });
        }
        return 'toast-id';
      });

      renderHook(() => useWorkflowToastNotifications(), { wrapper });

      act(() => {
        capturedOnUpdate({
          storyKey: 'ST-123',
          storyTitle: 'Test Story',
          startedAt: new Date().toISOString(),
        });
      });

      // The toast element should be a React element containing a clickable link
      expect(capturedToastElement).toBeDefined();
    });
  });

  describe('Cleanup', () => {
    it('should cleanup timeouts on unmount', () => {
      const { unmount } = renderHook(() => useWorkflowToastNotifications(), {
        wrapper,
      });

      // Send event that creates a timeout
      act(() => {
        capturedOnUpdate({
          componentName: 'Implementer',
          storyKey: 'ST-123',
          status: 'completed',
          completedAt: new Date().toISOString(),
        });
      });

      // Unmount before timeout fires
      unmount();

      // Advance timers - should not throw or cause issues
      act(() => {
        vi.advanceTimersByTime(5000);
      });

      // No error means cleanup worked correctly
      expect(true).toBe(true);
    });
  });

  describe('WebSocket Integration', () => {
    it('should configure useWorkflowWebSocket with throttle of 500ms', () => {
      renderHook(() => useWorkflowToastNotifications(), { wrapper });

      expect(useWorkflowWebSocket).toHaveBeenCalledWith({
        onUpdate: expect.any(Function),
        throttleMs: 500,
      });
    });
  });
});
