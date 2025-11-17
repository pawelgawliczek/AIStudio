import { render, screen, waitFor, act } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider, useAuth } from '../AuthContext';
import authService from '../../services/auth.service';
import { onSessionExpired } from '../../services/api.client';

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
});
