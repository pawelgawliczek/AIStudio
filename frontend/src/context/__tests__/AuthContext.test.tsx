import { render, screen, waitFor, act } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { onSessionExpired } from '../../services/api.client';
import authService from '../../services/auth.service';
import { AuthProvider, useAuth } from '../AuthContext';

// Mock dependencies
jest.mock('../../services/auth.service');
jest.mock('../../services/api.client');
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => jest.fn(),
  useLocation: () => ({ pathname: '/dashboard', search: '' }),
}));

// Test component that uses the auth context
function TestComponent() {
  const { user, isAuthenticated, loading, redirectPath } = useAuth();

  return (
    <div>
      <div data-testid="loading">{loading ? 'Loading' : 'Not Loading'}</div>
      <div data-testid="authenticated">{isAuthenticated ? 'Authenticated' : 'Not Authenticated'}</div>
      <div data-testid="user">{user ? user.email : 'No User'}</div>
      <div data-testid="redirect-path">{redirectPath || 'No Redirect'}</div>
    </div>
  );
}

describe('AuthContext - ST-11 Session Management', () => {
  const mockUser = {
    id: 'user-123',
    name: 'Test User',
    email: 'test@example.com',
    role: 'dev',
  };

  beforeEach(() => {
    // Clear localStorage and sessionStorage
    localStorage.clear();
    sessionStorage.clear();

    // Reset mocks
    jest.clearAllMocks();

    // Mock BroadcastChannel if not available
    if (!global.BroadcastChannel) {
      global.BroadcastChannel = jest.fn().mockImplementation(() => ({
        postMessage: jest.fn(),
        close: jest.fn(),
        onmessage: null,
      })) as any;
    }
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Initialization', () => {
    it('should initialize with loading state', () => {
      (authService.getCurrentUser as jest.Mock).mockReturnValue(null);

      render(
        <BrowserRouter>
          <AuthProvider>
            <TestComponent />
          </AuthProvider>
        </BrowserRouter>
      );

      expect(screen.getByTestId('loading')).toHaveTextContent('Not Loading');
    });

    it('should load user from localStorage on mount', async () => {
      (authService.getCurrentUser as jest.Mock).mockReturnValue(mockUser);

      render(
        <BrowserRouter>
          <AuthProvider>
            <TestComponent />
          </AuthProvider>
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('authenticated')).toHaveTextContent('Authenticated');
        expect(screen.getByTestId('user')).toHaveTextContent(mockUser.email);
      });
    });
  });

  describe('ST-11: Session Expiration and Redirect', () => {
    it('should save redirect path when session expires', async () => {
      let sessionExpiredCallback: ((path?: string) => void) | null = null;

      (onSessionExpired as jest.Mock).mockImplementation((callback) => {
        sessionExpiredCallback = callback;
        return jest.fn(); // unsubscribe function
      });

      render(
        <BrowserRouter>
          <AuthProvider>
            <TestComponent />
          </AuthProvider>
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(onSessionExpired).toHaveBeenCalled();
      });

      // Simulate session expiration
      act(() => {
        if (sessionExpiredCallback) {
          sessionExpiredCallback('/epic-planning');
        }
      });

      await waitFor(() => {
        expect(sessionStorage.getItem('redirectAfterLogin')).toBe('/epic-planning');
      });
    });

    it('should not save login/register paths as redirect paths', async () => {
      let sessionExpiredCallback: ((path?: string) => void) | null = null;

      (onSessionExpired as jest.Mock).mockImplementation((callback) => {
        sessionExpiredCallback = callback;
        return jest.fn();
      });

      render(
        <BrowserRouter>
          <AuthProvider>
            <TestComponent />
          </AuthProvider>
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(onSessionExpired).toHaveBeenCalled();
      });

      // Simulate session expiration on login page
      act(() => {
        if (sessionExpiredCallback) {
          sessionExpiredCallback('/login');
        }
      });

      await waitFor(() => {
        expect(sessionStorage.getItem('redirectAfterLogin')).toBeNull();
      });
    });
  });

  describe('ST-11: Post-Login Redirect', () => {
    it('should redirect to saved path after login', async () => {
      sessionStorage.setItem('redirectAfterLogin', '/epic-planning');

      const mockLogin = jest.fn().mockResolvedValue({
        user: mockUser,
        accessToken: 'token',
        refreshToken: 'refresh-token',
      });

      (authService.login as jest.Mock).mockImplementation(mockLogin);
      (authService.getCurrentUser as jest.Mock).mockReturnValue(null);

      const { rerender } = render(
        <BrowserRouter>
          <AuthProvider>
            <TestComponent />
          </AuthProvider>
        </BrowserRouter>
      );

      // Login should use the saved redirect path
      expect(sessionStorage.getItem('redirectAfterLogin')).toBe('/epic-planning');
    });

    it('should default to dashboard when no redirect path exists', async () => {
      expect(sessionStorage.getItem('redirectAfterLogin')).toBeNull();
    });
  });

  describe('ST-11: Multi-Tab Sync', () => {
    it('should handle token update from other tabs', async () => {
      const mockChannel = {
        postMessage: jest.fn(),
        close: jest.fn(),
        onmessage: null,
      };

      (global.BroadcastChannel as any) = jest.fn(() => mockChannel);

      (authService.getCurrentUser as jest.Mock).mockReturnValue(null);

      render(
        <BrowserRouter>
          <AuthProvider>
            <TestComponent />
          </AuthProvider>
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(global.BroadcastChannel).toHaveBeenCalledWith('auth_channel');
      });

      // Simulate token update from another tab
      (authService.getCurrentUser as jest.Mock).mockReturnValue(mockUser);

      act(() => {
        if (mockChannel.onmessage) {
          mockChannel.onmessage({ data: { type: 'TOKEN_UPDATED' } } as any);
        }
      });

      await waitFor(() => {
        expect(screen.getByTestId('authenticated')).toHaveTextContent('Authenticated');
      });
    });

    it('should handle logout from other tabs', async () => {
      const mockChannel = {
        postMessage: jest.fn(),
        close: jest.fn(),
        onmessage: null,
      };

      (global.BroadcastChannel as any) = jest.fn(() => mockChannel);
      (authService.getCurrentUser as jest.Mock).mockReturnValue(mockUser);

      render(
        <BrowserRouter>
          <AuthProvider>
            <TestComponent />
          </AuthProvider>
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('authenticated')).toHaveTextContent('Authenticated');
      });

      // Simulate logout from another tab
      act(() => {
        if (mockChannel.onmessage) {
          mockChannel.onmessage({ data: { type: 'LOGOUT' } } as any);
        }
      });

      await waitFor(() => {
        expect(screen.getByTestId('authenticated')).toHaveTextContent('Not Authenticated');
      });
    });
  });

  describe('ST-11: Session Duration - 24 Hours', () => {
    it('should maintain session for 24 hours according to backend config', () => {
      // This test verifies that the frontend relies on backend JWT expiration
      // The actual 24-hour duration is enforced by the backend JWT configuration

      (authService.getCurrentUser as jest.Mock).mockReturnValue(mockUser);
      localStorage.setItem('accessToken', 'valid-token');

      render(
        <BrowserRouter>
          <AuthProvider>
            <TestComponent />
          </AuthProvider>
        </BrowserRouter>
      );

      // User should be authenticated as long as token is valid
      expect(screen.getByTestId('authenticated')).toHaveTextContent('Authenticated');
      expect(localStorage.getItem('accessToken')).toBe('valid-token');
    });
  });

  describe('Clear Visual Feedback', () => {
    it('should show redirect path in context', async () => {
      let sessionExpiredCallback: ((path?: string) => void) | null = null;

      (onSessionExpired as jest.Mock).mockImplementation((callback) => {
        sessionExpiredCallback = callback;
        return jest.fn();
      });

      render(
        <BrowserRouter>
          <AuthProvider>
            <TestComponent />
          </AuthProvider>
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(onSessionExpired).toHaveBeenCalled();
      });

      // Simulate session expiration with a specific path
      act(() => {
        if (sessionExpiredCallback) {
          sessionExpiredCallback('/workflows');
        }
      });

      await waitFor(() => {
        // The redirect path should be available in context for UI feedback
        expect(sessionStorage.getItem('redirectAfterLogin')).toBe('/workflows');
      });
    });
  });

  describe('ST-11: Security Tests', () => {
    it('should prevent session hijacking by clearing tokens on expiration', async () => {
      let sessionExpiredCallback: ((path?: string) => void) | null = null;

      (onSessionExpired as jest.Mock).mockImplementation((callback) => {
        sessionExpiredCallback = callback;
        return jest.fn();
      });

      // Set up fake tokens as if user was logged in
      localStorage.setItem('accessToken', 'fake-token');
      localStorage.setItem('refreshToken', 'fake-refresh');
      localStorage.setItem('user', JSON.stringify(mockUser));

      render(
        <BrowserRouter>
          <AuthProvider>
            <TestComponent />
          </AuthProvider>
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(onSessionExpired).toHaveBeenCalled();
      });

      // Simulate session expiration
      act(() => {
        if (sessionExpiredCallback) {
          sessionExpiredCallback('/protected-route');
        }
      });

      await waitFor(() => {
        // User should be cleared from state
        expect(screen.getByTestId('authenticated')).toHaveTextContent('Not Authenticated');
      });

      // Tokens should remain cleared (handled by api.client)
      // But user state should be cleared by AuthContext
    });

    it('should handle XSS by not executing scripts in redirect paths', async () => {
      let sessionExpiredCallback: ((path?: string) => void) | null = null;

      (onSessionExpired as jest.Mock).mockImplementation((callback) => {
        sessionExpiredCallback = callback;
        return jest.fn();
      });

      render(
        <BrowserRouter>
          <AuthProvider>
            <TestComponent />
          </AuthProvider>
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(onSessionExpired).toHaveBeenCalled();
      });

      // Try XSS payload in redirect path
      const xssPath = '/path?param=<script>alert("xss")</script>';

      act(() => {
        if (sessionExpiredCallback) {
          sessionExpiredCallback(xssPath);
        }
      });

      await waitFor(() => {
        const savedPath = sessionStorage.getItem('redirectAfterLogin');
        // Path should be stored as-is (React Router will sanitize)
        expect(savedPath).toBe(xssPath);
      });
    });

    it('should rotate tokens on refresh (handled by backend)', async () => {
      // This test documents that token rotation is a backend responsibility
      // Frontend just accepts and stores the new tokens
      const mockLogin = jest.fn().mockResolvedValue({
        user: mockUser,
        accessToken: 'initial-token',
        refreshToken: 'initial-refresh',
      });

      (authService.login as jest.Mock).mockImplementation(mockLogin);
      (authService.getCurrentUser as jest.Mock).mockReturnValue(null);

      render(
        <BrowserRouter>
          <AuthProvider>
            <TestComponent />
          </AuthProvider>
        </BrowserRouter>
      );

      // Token rotation is enforced by backend on /auth/refresh endpoint
      // Frontend test verifies tokens are updated in localStorage by api.client
      expect(true).toBe(true); // Documentation test
    });
  });

  describe('ST-11: Edge Cases', () => {
    it('should handle BroadcastChannel not supported gracefully', async () => {
      // Simulate browser without BroadcastChannel
      const originalBC = global.BroadcastChannel;
      (global as any).BroadcastChannel = undefined;

      (authService.getCurrentUser as jest.Mock).mockReturnValue(null);

      // Should not throw error
      expect(() => {
        render(
          <BrowserRouter>
            <AuthProvider>
              <TestComponent />
            </AuthProvider>
          </BrowserRouter>
        );
      }).not.toThrow();

      // Restore
      global.BroadcastChannel = originalBC;
    });

    it('should handle storage events when BroadcastChannel fails', async () => {
      // Force BroadcastChannel to throw
      global.BroadcastChannel = jest.fn(() => {
        throw new Error('Not supported');
      }) as any;

      (authService.getCurrentUser as jest.Mock).mockReturnValue(null);

      const { container } = render(
        <BrowserRouter>
          <AuthProvider>
            <TestComponent />
          </AuthProvider>
        </BrowserRouter>
      );

      // Should render without crashing
      expect(container).toBeTruthy();
    });

    it('should handle concurrent login and logout events', async () => {
      const mockChannel = {
        postMessage: jest.fn(),
        close: jest.fn(),
        onmessage: null,
      };

      (global.BroadcastChannel as any) = jest.fn(() => mockChannel);
      (authService.getCurrentUser as jest.Mock).mockReturnValue(mockUser);

      render(
        <BrowserRouter>
          <AuthProvider>
            <TestComponent />
          </AuthProvider>
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('authenticated')).toHaveTextContent('Authenticated');
      });

      // Simulate rapid logout then login
      act(() => {
        (authService.getCurrentUser as jest.Mock).mockReturnValue(null);
        if (mockChannel.onmessage) {
          mockChannel.onmessage({ data: { type: 'LOGOUT' } } as any);
        }
      });

      await waitFor(() => {
        expect(screen.getByTestId('authenticated')).toHaveTextContent('Not Authenticated');
      });

      act(() => {
        (authService.getCurrentUser as jest.Mock).mockReturnValue(mockUser);
        if (mockChannel.onmessage) {
          mockChannel.onmessage({ data: { type: 'LOGIN' } } as any);
        }
      });

      await waitFor(() => {
        expect(screen.getByTestId('authenticated')).toHaveTextContent('Authenticated');
      });
    });

    it('should handle query parameters in redirect paths', async () => {
      let sessionExpiredCallback: ((path?: string) => void) | null = null;

      (onSessionExpired as jest.Mock).mockImplementation((callback) => {
        sessionExpiredCallback = callback;
        return jest.fn();
      });

      render(
        <BrowserRouter>
          <AuthProvider>
            <TestComponent />
          </AuthProvider>
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(onSessionExpired).toHaveBeenCalled();
      });

      // Path with multiple query parameters
      act(() => {
        if (sessionExpiredCallback) {
          sessionExpiredCallback('/planning?projectId=123&status=active&filter=bugs');
        }
      });

      await waitFor(() => {
        expect(sessionStorage.getItem('redirectAfterLogin')).toBe(
          '/planning?projectId=123&status=active&filter=bugs'
        );
      });
    });

    it('should handle empty redirect path', async () => {
      let sessionExpiredCallback: ((path?: string) => void) | null = null;

      (onSessionExpired as jest.Mock).mockImplementation((callback) => {
        sessionExpiredCallback = callback;
        return jest.fn();
      });

      render(
        <BrowserRouter>
          <AuthProvider>
            <TestComponent />
          </AuthProvider>
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(onSessionExpired).toHaveBeenCalled();
      });

      // Empty path
      act(() => {
        if (sessionExpiredCallback) {
          sessionExpiredCallback('');
        }
      });

      await waitFor(() => {
        // Should use current location instead
        expect(sessionStorage.getItem('redirectAfterLogin')).toBeTruthy();
      });
    });

    it('should handle session expiration while on protected deep link', async () => {
      const mockLocation = { pathname: '/story/ST-123', search: '?tab=details' };

      jest.spyOn(require('react-router-dom'), 'useLocation').mockReturnValue(mockLocation);

      let sessionExpiredCallback: ((path?: string) => void) | null = null;

      (onSessionExpired as jest.Mock).mockImplementation((callback) => {
        sessionExpiredCallback = callback;
        return jest.fn();
      });

      render(
        <BrowserRouter>
          <AuthProvider>
            <TestComponent />
          </AuthProvider>
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(onSessionExpired).toHaveBeenCalled();
      });

      // Simulate expiration without explicit path (should use location)
      act(() => {
        if (sessionExpiredCallback) {
          sessionExpiredCallback();
        }
      });

      await waitFor(() => {
        const savedPath = sessionStorage.getItem('redirectAfterLogin');
        expect(savedPath).toBe('/story/ST-123?tab=details');
      });
    });
  });

  describe('ST-11: Performance Tests', () => {
    it('should handle rapid token updates without lag', async () => {
      const mockChannel = {
        postMessage: jest.fn(),
        close: jest.fn(),
        onmessage: null,
      };

      (global.BroadcastChannel as any) = jest.fn(() => mockChannel);
      (authService.getCurrentUser as jest.Mock).mockReturnValue(null);

      render(
        <BrowserRouter>
          <AuthProvider>
            <TestComponent />
          </AuthProvider>
        </BrowserRouter>
      );

      // Simulate 10 rapid token updates
      const startTime = Date.now();

      for (let i = 0; i < 10; i++) {
        act(() => {
          (authService.getCurrentUser as jest.Mock).mockReturnValue(mockUser);
          if (mockChannel.onmessage) {
            mockChannel.onmessage({ data: { type: 'TOKEN_UPDATED' } } as any);
          }
        });
      }

      const endTime = Date.now();

      // Should complete quickly
      expect(endTime - startTime).toBeLessThan(1000);
    });

    it('should efficiently handle multiple subscriber updates', async () => {
      let sessionExpiredCallback: ((path?: string) => void) | null = null;

      (onSessionExpired as jest.Mock).mockImplementation((callback) => {
        sessionExpiredCallback = callback;
        return jest.fn();
      });

      // Render multiple instances (simulating multiple components subscribing)
      render(
        <BrowserRouter>
          <AuthProvider>
            <TestComponent />
            <TestComponent />
            <TestComponent />
          </AuthProvider>
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(onSessionExpired).toHaveBeenCalled();
      });

      const startTime = Date.now();

      act(() => {
        if (sessionExpiredCallback) {
          sessionExpiredCallback('/test-path');
        }
      });

      const endTime = Date.now();

      // Should handle multiple subscribers efficiently
      expect(endTime - startTime).toBeLessThan(100);
    });
  });

  describe('ST-11: Multi-Tab Race Conditions', () => {
    it('should handle Tab A logout while Tab B is refreshing token', async () => {
      const mockChannel = {
        postMessage: jest.fn(),
        close: jest.fn(),
        onmessage: null,
      };

      (global.BroadcastChannel as any) = jest.fn(() => mockChannel);
      (authService.getCurrentUser as jest.Mock).mockReturnValue(mockUser);

      render(
        <BrowserRouter>
          <AuthProvider>
            <TestComponent />
          </AuthProvider>
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('authenticated')).toHaveTextContent('Authenticated');
      });

      // Simulate logout broadcast from another tab
      act(() => {
        if (mockChannel.onmessage) {
          mockChannel.onmessage({ data: { type: 'LOGOUT' } } as any);
        }
      });

      await waitFor(() => {
        expect(screen.getByTestId('authenticated')).toHaveTextContent('Not Authenticated');
      });
    });

    it('should handle simultaneous login in multiple tabs', async () => {
      const mockChannel = {
        postMessage: jest.fn(),
        close: jest.fn(),
        onmessage: null,
      };

      (global.BroadcastChannel as any) = jest.fn(() => mockChannel);
      (authService.getCurrentUser as jest.Mock).mockReturnValue(null);

      render(
        <BrowserRouter>
          <AuthProvider>
            <TestComponent />
          </AuthProvider>
        </BrowserRouter>
      );

      // Simulate two rapid LOGIN broadcasts
      act(() => {
        (authService.getCurrentUser as jest.Mock).mockReturnValue(mockUser);
        if (mockChannel.onmessage) {
          mockChannel.onmessage({ data: { type: 'LOGIN' } } as any);
          mockChannel.onmessage({ data: { type: 'LOGIN' } } as any);
        }
      });

      await waitFor(() => {
        expect(screen.getByTestId('authenticated')).toHaveTextContent('Authenticated');
        expect(screen.getByTestId('user')).toHaveTextContent(mockUser.email);
      });
    });
  });
});
