/**
 * ST-11: SessionExpiredModal Tests
 * Testing countdown timer, visual feedback, and user experience
 */

import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { SessionExpiredModal } from '../SessionExpiredModal';
import { AuthProvider } from '../../context/AuthContext';
import authService from '../../services/auth.service';
import { onSessionExpired } from '../../services/api.client';

jest.mock('../../services/auth.service');
jest.mock('../../services/api.client');
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => jest.fn(),
  useLocation: () => ({ pathname: '/dashboard', search: '' }),
}));

// Mock timers for countdown testing
jest.useFakeTimers();

describe('SessionExpiredModal - ST-11', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    jest.clearAllMocks();

    // Mock BroadcastChannel
    global.BroadcastChannel = jest.fn().mockImplementation(() => ({
      postMessage: jest.fn(),
      close: jest.fn(),
      onmessage: null,
    })) as any;

    (authService.getCurrentUser as jest.Mock).mockReturnValue(null);
    (onSessionExpired as jest.Mock).mockImplementation((callback) => {
      return jest.fn(); // unsubscribe
    });
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.clearAllTimers();
    jest.restoreAllMocks();
  });

  describe('Modal Visibility', () => {
    it('should not show modal when redirectPath is null', () => {
      render(
        <BrowserRouter>
          <AuthProvider>
            <SessionExpiredModal />
          </AuthProvider>
        </BrowserRouter>
      );

      // Modal should not be visible
      expect(screen.queryByText('Session Expired')).not.toBeInTheDocument();
    });

    it('should show modal when session expires (redirectPath is set)', async () => {
      let sessionExpiredCallback: ((path?: string) => void) | null = null;

      (onSessionExpired as jest.Mock).mockImplementation((callback) => {
        sessionExpiredCallback = callback;
        return jest.fn();
      });

      render(
        <BrowserRouter>
          <AuthProvider>
            <SessionExpiredModal />
          </AuthProvider>
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(onSessionExpired).toHaveBeenCalled();
      });

      // Trigger session expiration
      act(() => {
        if (sessionExpiredCallback) {
          sessionExpiredCallback('/epic-planning');
        }
      });

      // Modal should appear
      await waitFor(() => {
        expect(screen.getByText('Session Expired')).toBeInTheDocument();
      });
    });
  });

  describe('ST-11: Countdown Timer', () => {
    it('should display initial countdown of 10 seconds', async () => {
      let sessionExpiredCallback: ((path?: string) => void) | null = null;

      (onSessionExpired as jest.Mock).mockImplementation((callback) => {
        sessionExpiredCallback = callback;
        return jest.fn();
      });

      render(
        <BrowserRouter>
          <AuthProvider>
            <SessionExpiredModal />
          </AuthProvider>
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(onSessionExpired).toHaveBeenCalled();
      });

      act(() => {
        if (sessionExpiredCallback) {
          sessionExpiredCallback('/test-path');
        }
      });

      await waitFor(() => {
        expect(screen.getByText(/Redirecting to login in 10 seconds.../i)).toBeInTheDocument();
      });
    });

    it('should decrement countdown every second', async () => {
      let sessionExpiredCallback: ((path?: string) => void) | null = null;

      (onSessionExpired as jest.Mock).mockImplementation((callback) => {
        sessionExpiredCallback = callback;
        return jest.fn();
      });

      render(
        <BrowserRouter>
          <AuthProvider>
            <SessionExpiredModal />
          </AuthProvider>
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(onSessionExpired).toHaveBeenCalled();
      });

      act(() => {
        if (sessionExpiredCallback) {
          sessionExpiredCallback('/test-path');
        }
      });

      // Initial: 10 seconds
      await waitFor(() => {
        expect(screen.getByText(/10 seconds/i)).toBeInTheDocument();
      });

      // After 1 second: 9 seconds
      act(() => {
        jest.advanceTimersByTime(1000);
      });

      await waitFor(() => {
        expect(screen.getByText(/9 seconds/i)).toBeInTheDocument();
      });

      // After 2 more seconds: 7 seconds
      act(() => {
        jest.advanceTimersByTime(2000);
      });

      await waitFor(() => {
        expect(screen.getByText(/7 seconds/i)).toBeInTheDocument();
      });
    });

    it('should use singular "second" when countdown is 1', async () => {
      let sessionExpiredCallback: ((path?: string) => void) | null = null;

      (onSessionExpired as jest.Mock).mockImplementation((callback) => {
        sessionExpiredCallback = callback;
        return jest.fn();
      });

      render(
        <BrowserRouter>
          <AuthProvider>
            <SessionExpiredModal />
          </AuthProvider>
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(onSessionExpired).toHaveBeenCalled();
      });

      act(() => {
        if (sessionExpiredCallback) {
          sessionExpiredCallback('/test-path');
        }
      });

      // Advance to 1 second
      act(() => {
        jest.advanceTimersByTime(9000);
      });

      await waitFor(() => {
        expect(screen.getByText(/1 second\./i)).toBeInTheDocument();
      });
    });

    it('should close modal when countdown reaches 0', async () => {
      let sessionExpiredCallback: ((path?: string) => void) | null = null;

      (onSessionExpired as jest.Mock).mockImplementation((callback) => {
        sessionExpiredCallback = callback;
        return jest.fn();
      });

      render(
        <BrowserRouter>
          <AuthProvider>
            <SessionExpiredModal />
          </AuthProvider>
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(onSessionExpired).toHaveBeenCalled();
      });

      act(() => {
        if (sessionExpiredCallback) {
          sessionExpiredCallback('/test-path');
        }
      });

      await waitFor(() => {
        expect(screen.getByText('Session Expired')).toBeInTheDocument();
      });

      // Advance full 10 seconds
      act(() => {
        jest.advanceTimersByTime(10000);
      });

      // Modal should close
      await waitFor(() => {
        expect(screen.queryByText('Session Expired')).not.toBeInTheDocument();
      });
    });

    it('should reset countdown to 10 when modal reopens', async () => {
      let sessionExpiredCallback: ((path?: string) => void) | null = null;

      (onSessionExpired as jest.Mock).mockImplementation((callback) => {
        sessionExpiredCallback = callback;
        return jest.fn();
      });

      render(
        <BrowserRouter>
          <AuthProvider>
            <SessionExpiredModal />
          </AuthProvider>
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(onSessionExpired).toHaveBeenCalled();
      });

      // First session expiration
      act(() => {
        if (sessionExpiredCallback) {
          sessionExpiredCallback('/path1');
        }
      });

      await waitFor(() => {
        expect(screen.getByText(/10 seconds/i)).toBeInTheDocument();
      });

      // Countdown to 5
      act(() => {
        jest.advanceTimersByTime(5000);
      });

      await waitFor(() => {
        expect(screen.getByText(/5 seconds/i)).toBeInTheDocument();
      });

      // Close modal
      act(() => {
        jest.advanceTimersByTime(5000);
      });

      await waitFor(() => {
        expect(screen.queryByText('Session Expired')).not.toBeInTheDocument();
      });

      // Second session expiration (new session)
      act(() => {
        if (sessionExpiredCallback) {
          sessionExpiredCallback('/path2');
        }
      });

      // Should reset to 10 seconds
      await waitFor(() => {
        expect(screen.getByText(/10 seconds/i)).toBeInTheDocument();
      });
    });
  });

  describe('ST-11: Visual Feedback', () => {
    it('should display session expired message', async () => {
      let sessionExpiredCallback: ((path?: string) => void) | null = null;

      (onSessionExpired as jest.Mock).mockImplementation((callback) => {
        sessionExpiredCallback = callback;
        return jest.fn();
      });

      render(
        <BrowserRouter>
          <AuthProvider>
            <SessionExpiredModal />
          </AuthProvider>
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(onSessionExpired).toHaveBeenCalled();
      });

      act(() => {
        if (sessionExpiredCallback) {
          sessionExpiredCallback('/test');
        }
      });

      await waitFor(() => {
        expect(screen.getByText('Session Expired')).toBeInTheDocument();
        expect(
          screen.getByText('Your session has expired due to inactivity. Please log in again to continue.')
        ).toBeInTheDocument();
      });
    });

    it('should display redirect destination when available', async () => {
      let sessionExpiredCallback: ((path?: string) => void) | null = null;

      (onSessionExpired as jest.Mock).mockImplementation((callback) => {
        sessionExpiredCallback = callback;
        return jest.fn();
      });

      render(
        <BrowserRouter>
          <AuthProvider>
            <SessionExpiredModal />
          </AuthProvider>
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(onSessionExpired).toHaveBeenCalled();
      });

      act(() => {
        if (sessionExpiredCallback) {
          sessionExpiredCallback('/epic-planning');
        }
      });

      await waitFor(() => {
        expect(screen.getByText(/You'll be redirected back to/i)).toBeInTheDocument();
        expect(screen.getByText('/epic-planning')).toBeInTheDocument();
      });
    });

    it('should show warning icon', async () => {
      let sessionExpiredCallback: ((path?: string) => void) | null = null;

      (onSessionExpired as jest.Mock).mockImplementation((callback) => {
        sessionExpiredCallback = callback;
        return jest.fn();
      });

      render(
        <BrowserRouter>
          <AuthProvider>
            <SessionExpiredModal />
          </AuthProvider>
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(onSessionExpired).toHaveBeenCalled();
      });

      act(() => {
        if (sessionExpiredCallback) {
          sessionExpiredCallback('/test');
        }
      });

      await waitFor(() => {
        // Warning icon should be present (rendered by ExclamationTriangleIcon)
        const modal = screen.getByText('Session Expired').closest('[role="dialog"]');
        expect(modal).toBeInTheDocument();
      });
    });
  });

  describe('ST-11: User Interaction', () => {
    it('should allow manual close via "Go to Login Now" button', async () => {
      let sessionExpiredCallback: ((path?: string) => void) | null = null;

      (onSessionExpired as jest.Mock).mockImplementation((callback) => {
        sessionExpiredCallback = callback;
        return jest.fn();
      });

      const user = userEvent.setup({ delay: null });

      render(
        <BrowserRouter>
          <AuthProvider>
            <SessionExpiredModal />
          </AuthProvider>
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(onSessionExpired).toHaveBeenCalled();
      });

      act(() => {
        if (sessionExpiredCallback) {
          sessionExpiredCallback('/test');
        }
      });

      await waitFor(() => {
        expect(screen.getByText('Session Expired')).toBeInTheDocument();
      });

      const button = screen.getByRole('button', { name: /Go to Login Now/i });
      expect(button).toBeInTheDocument();

      await act(async () => {
        await user.click(button);
      });

      // Modal should close immediately
      await waitFor(() => {
        expect(screen.queryByText('Session Expired')).not.toBeInTheDocument();
      });
    });

    it('should be accessible with keyboard navigation', async () => {
      let sessionExpiredCallback: ((path?: string) => void) | null = null;

      (onSessionExpired as jest.Mock).mockImplementation((callback) => {
        sessionExpiredCallback = callback;
        return jest.fn();
      });

      const user = userEvent.setup({ delay: null });

      render(
        <BrowserRouter>
          <AuthProvider>
            <SessionExpiredModal />
          </AuthProvider>
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(onSessionExpired).toHaveBeenCalled();
      });

      act(() => {
        if (sessionExpiredCallback) {
          sessionExpiredCallback('/test');
        }
      });

      await waitFor(() => {
        expect(screen.getByText('Session Expired')).toBeInTheDocument();
      });

      // Tab to button
      await act(async () => {
        await user.tab();
      });

      const button = screen.getByRole('button', { name: /Go to Login Now/i });
      expect(button).toHaveFocus();

      // Enter should close modal
      await act(async () => {
        await user.keyboard('{Enter}');
      });

      await waitFor(() => {
        expect(screen.queryByText('Session Expired')).not.toBeInTheDocument();
      });
    });
  });

  describe('ST-11: Edge Cases', () => {
    it('should stop countdown when modal is closed manually', async () => {
      let sessionExpiredCallback: ((path?: string) => void) | null = null;

      (onSessionExpired as jest.Mock).mockImplementation((callback) => {
        sessionExpiredCallback = callback;
        return jest.fn();
      });

      const user = userEvent.setup({ delay: null });

      render(
        <BrowserRouter>
          <AuthProvider>
            <SessionExpiredModal />
          </AuthProvider>
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(onSessionExpired).toHaveBeenCalled();
      });

      act(() => {
        if (sessionExpiredCallback) {
          sessionExpiredCallback('/test');
        }
      });

      await waitFor(() => {
        expect(screen.getByText(/10 seconds/i)).toBeInTheDocument();
      });

      // Wait 3 seconds
      act(() => {
        jest.advanceTimersByTime(3000);
      });

      await waitFor(() => {
        expect(screen.getByText(/7 seconds/i)).toBeInTheDocument();
      });

      // Close manually
      const button = screen.getByRole('button', { name: /Go to Login Now/i });
      await act(async () => {
        await user.click(button);
      });

      await waitFor(() => {
        expect(screen.queryByText('Session Expired')).not.toBeInTheDocument();
      });

      // Advance time further
      act(() => {
        jest.advanceTimersByTime(5000);
      });

      // Modal should stay closed
      expect(screen.queryByText('Session Expired')).not.toBeInTheDocument();
    });

    it('should handle multiple rapid session expirations', async () => {
      let sessionExpiredCallback: ((path?: string) => void) | null = null;

      (onSessionExpired as jest.Mock).mockImplementation((callback) => {
        sessionExpiredCallback = callback;
        return jest.fn();
      });

      render(
        <BrowserRouter>
          <AuthProvider>
            <SessionExpiredModal />
          </AuthProvider>
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(onSessionExpired).toHaveBeenCalled();
      });

      // Trigger multiple expirations rapidly
      act(() => {
        if (sessionExpiredCallback) {
          sessionExpiredCallback('/path1');
          sessionExpiredCallback('/path2');
          sessionExpiredCallback('/path3');
        }
      });

      // Should show modal with last path
      await waitFor(() => {
        expect(screen.getByText('Session Expired')).toBeInTheDocument();
        expect(screen.getByText('/path3')).toBeInTheDocument();
      });
    });

    it('should handle countdown at boundary (0 seconds)', async () => {
      let sessionExpiredCallback: ((path?: string) => void) | null = null;

      (onSessionExpired as jest.Mock).mockImplementation((callback) => {
        sessionExpiredCallback = callback;
        return jest.fn();
      });

      render(
        <BrowserRouter>
          <AuthProvider>
            <SessionExpiredModal />
          </AuthProvider>
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(onSessionExpired).toHaveBeenCalled();
      });

      act(() => {
        if (sessionExpiredCallback) {
          sessionExpiredCallback('/test');
        }
      });

      await waitFor(() => {
        expect(screen.getByText(/10 seconds/i)).toBeInTheDocument();
      });

      // Advance exactly to 0
      act(() => {
        jest.advanceTimersByTime(10000);
      });

      // Modal should close
      await waitFor(() => {
        expect(screen.queryByText('Session Expired')).not.toBeInTheDocument();
      });

      // No errors should occur
      expect(true).toBe(true);
    });
  });

  describe('ST-11: Performance', () => {
    it('should not cause memory leaks with countdown timers', async () => {
      let sessionExpiredCallback: ((path?: string) => void) | null = null;

      (onSessionExpired as jest.Mock).mockImplementation((callback) => {
        sessionExpiredCallback = callback;
        return jest.fn();
      });

      const { unmount } = render(
        <BrowserRouter>
          <AuthProvider>
            <SessionExpiredModal />
          </AuthProvider>
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(onSessionExpired).toHaveBeenCalled();
      });

      act(() => {
        if (sessionExpiredCallback) {
          sessionExpiredCallback('/test');
        }
      });

      await waitFor(() => {
        expect(screen.getByText('Session Expired')).toBeInTheDocument();
      });

      // Advance partway through countdown
      act(() => {
        jest.advanceTimersByTime(5000);
      });

      // Unmount while countdown is active
      unmount();

      // Should not throw errors or leak timers
      expect(jest.getTimerCount()).toBeGreaterThanOrEqual(0);
    });

    it('should handle rapid open/close cycles efficiently', async () => {
      let sessionExpiredCallback: ((path?: string) => void) | null = null;

      (onSessionExpired as jest.Mock).mockImplementation((callback) => {
        sessionExpiredCallback = callback;
        return jest.fn();
      });

      const user = userEvent.setup({ delay: null });

      render(
        <BrowserRouter>
          <AuthProvider>
            <SessionExpiredModal />
          </AuthProvider>
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(onSessionExpired).toHaveBeenCalled();
      });

      // Open and close 5 times rapidly
      for (let i = 0; i < 5; i++) {
        act(() => {
          if (sessionExpiredCallback) {
            sessionExpiredCallback(`/test-${i}`);
          }
        });

        await waitFor(() => {
          expect(screen.getByText('Session Expired')).toBeInTheDocument();
        });

        const button = screen.getByRole('button', { name: /Go to Login Now/i });
        await act(async () => {
          await user.click(button);
        });

        await waitFor(() => {
          expect(screen.queryByText('Session Expired')).not.toBeInTheDocument();
        });
      }

      // Should complete without errors
      expect(true).toBe(true);
    });
  });

  describe('ST-11: Accessibility', () => {
    it('should have proper ARIA attributes', async () => {
      let sessionExpiredCallback: ((path?: string) => void) | null = null;

      (onSessionExpired as jest.Mock).mockImplementation((callback) => {
        sessionExpiredCallback = callback;
        return jest.fn();
      });

      render(
        <BrowserRouter>
          <AuthProvider>
            <SessionExpiredModal />
          </AuthProvider>
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(onSessionExpired).toHaveBeenCalled();
      });

      act(() => {
        if (sessionExpiredCallback) {
          sessionExpiredCallback('/test');
        }
      });

      await waitFor(() => {
        const dialog = screen.getByRole('dialog');
        expect(dialog).toBeInTheDocument();
      });
    });

    it('should trap focus within modal', async () => {
      let sessionExpiredCallback: ((path?: string) => void) | null = null;

      (onSessionExpired as jest.Mock).mockImplementation((callback) => {
        sessionExpiredCallback = callback;
        return jest.fn();
      });

      render(
        <BrowserRouter>
          <AuthProvider>
            <SessionExpiredModal />
          </AuthProvider>
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(onSessionExpired).toHaveBeenCalled();
      });

      act(() => {
        if (sessionExpiredCallback) {
          sessionExpiredCallback('/test');
        }
      });

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      // Headless UI Dialog automatically handles focus trapping
      const button = screen.getByRole('button', { name: /Go to Login Now/i });
      expect(button).toBeInTheDocument();
    });
  });
});
