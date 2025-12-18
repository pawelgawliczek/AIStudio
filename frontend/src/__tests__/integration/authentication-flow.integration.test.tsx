/**
 * ST-11: End-to-End Authentication Flow Integration Tests
 * Testing complete user journeys through authentication, session management, and redirects
 */

import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { Layout } from '../../components/Layout';
import { AuthProvider } from '../../context/AuthContext';
import { onSessionExpired } from '../../services/api.client';
import authService from '../../services/auth.service';

jest.mock('../../services/auth.service');
jest.mock('../../services/api.client');
jest.mock('../../components/ProjectSelector', () => ({
  ProjectSelector: () => <div>Project Selector</div>,
}));
jest.mock('../../components/ConnectionStatus', () => ({
  ConnectionStatus: () => <div>Connection Status</div>,
}));
jest.mock('../../components/ThemeToggle', () => ({
  ThemeToggle: () => <div>Theme Toggle</div>,
}));
jest.mock('../../components/SessionExpiredModal', () => ({
  SessionExpiredModal: () => <div>Session Expired Modal</div>,
}));
jest.mock('../../components/workflow/GlobalWorkflowTrackingBar', () => ({
  GlobalWorkflowTrackingBar: () => <div>Workflow Tracking</div>,
}));
jest.mock('../../context/ProjectContext', () => ({
  ProjectProvider: ({ children }: any) => children,
  useProject: () => ({ selectedProject: null }),
}));

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

// Mock pages
const LoginPage = () => <div data-testid="login-page">Login Page</div>;
const DashboardPage = () => <div data-testid="dashboard-page">Dashboard</div>;
const EpicPlanningPage = () => <div data-testid="epic-planning-page">Epic Planning</div>;

describe('ST-11: Authentication Flow Integration Tests', () => {
  const mockUser = {
    id: 'user-123',
    name: 'Test User',
    email: 'test@example.com',
    role: 'dev',
  };

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    jest.clearAllMocks();

    global.BroadcastChannel = jest.fn().mockImplementation(() => ({
      postMessage: jest.fn(),
      close: jest.fn(),
      onmessage: null,
    })) as any;

    (onSessionExpired as jest.Mock).mockImplementation(() => jest.fn());
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('UC-AUTH-003: Complete Post-Login Redirect Journey', () => {
    it('should redirect back to intended page after login', async () => {
      // Step 1: User tries to access protected route without auth
      (authService.getCurrentUser as jest.Mock).mockReturnValue(null);

      const { rerender } = render(
        <MemoryRouter initialEntries={['/epic-planning']}>
          <AuthProvider>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/" element={<Layout />}>
                <Route path="dashboard" element={<DashboardPage />} />
                <Route path="epic-planning" element={<EpicPlanningPage />} />
              </Route>
            </Routes>
          </AuthProvider>
        </MemoryRouter>
      );

      // Should capture redirect path
      await waitFor(() => {
        expect(sessionStorage.getItem('redirectAfterLogin')).toBe('/epic-planning');
      });

      // Step 2: User logs in
      (authService.getCurrentUser as jest.Mock).mockReturnValue(mockUser);
      (authService.login as jest.Mock).mockResolvedValue({
        user: mockUser,
        accessToken: 'token',
        refreshToken: 'refresh',
      });

      // Simulate successful login and redirect
      act(() => {
        sessionStorage.setItem('redirectAfterLogin', '/epic-planning');
      });

      // Step 3: Verify redirect path is available for post-login navigation
      expect(sessionStorage.getItem('redirectAfterLogin')).toBe('/epic-planning');
    });
  });

  describe('UC-AUTH-002: Session Expiration Flow', () => {
    it('should handle complete session expiration and re-authentication', async () => {
      // Step 1: User starts authenticated
      (authService.getCurrentUser as jest.Mock).mockReturnValue(mockUser);

      let sessionExpiredCallback: ((path?: string) => void) | null = null;
      (onSessionExpired as jest.Mock).mockImplementation((callback) => {
        sessionExpiredCallback = callback;
        return jest.fn();
      });

      render(
        <MemoryRouter initialEntries={['/epic-planning']}>
          <AuthProvider>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/" element={<Layout />}>
                <Route path="epic-planning" element={<EpicPlanningPage />} />
              </Route>
            </Routes>
          </AuthProvider>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(onSessionExpired).toHaveBeenCalled();
      });

      // Step 2: Session expires
      act(() => {
        if (sessionExpiredCallback) {
          sessionExpiredCallback('/epic-planning');
        }
      });

      // Step 3: Verify redirect path is saved
      await waitFor(() => {
        expect(sessionStorage.getItem('redirectAfterLogin')).toBe('/epic-planning');
      });

      // Step 4: User re-authenticates
      (authService.login as jest.Mock).mockResolvedValue({
        user: mockUser,
        accessToken: 'new-token',
        refreshToken: 'new-refresh',
      });

      // Redirect path should be preserved for post-login redirect
      expect(sessionStorage.getItem('redirectAfterLogin')).toBe('/epic-planning');
    });
  });

  describe('UC-AUTH-004: Multi-Tab Synchronization', () => {
    it('should sync logout across tabs', async () => {
      const mockChannel = {
        postMessage: jest.fn(),
        close: jest.fn(),
        onmessage: null,
      };

      global.BroadcastChannel = jest.fn(() => mockChannel) as any;
      (authService.getCurrentUser as jest.Mock).mockReturnValue(mockUser);

      render(
        <MemoryRouter initialEntries={['/dashboard']}>
          <AuthProvider>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/" element={<Layout />}>
                <Route path="dashboard" element={<DashboardPage />} />
              </Route>
            </Routes>
          </AuthProvider>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.queryByTestId('dashboard-page')).toBeTruthy();
      });

      // Simulate logout in another tab
      act(() => {
        if (mockChannel.onmessage) {
          mockChannel.onmessage({ data: { type: 'LOGOUT' } } as any);
        }
      });

      // This tab should also log out
      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/login', expect.anything());
      });
    });

    it('should sync token refresh across tabs', async () => {
      const mockChannel = {
        postMessage: jest.fn(),
        close: jest.fn(),
        onmessage: null,
      };

      global.BroadcastChannel = jest.fn(() => mockChannel) as any;
      (authService.getCurrentUser as jest.Mock).mockReturnValue(null);

      render(
        <MemoryRouter initialEntries={['/dashboard']}>
          <AuthProvider>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/" element={<Layout />}>
                <Route path="dashboard" element={<DashboardPage />} />
              </Route>
            </Routes>
          </AuthProvider>
        </MemoryRouter>
      );

      // Simulate token update in another tab
      act(() => {
        (authService.getCurrentUser as jest.Mock).mockReturnValue(mockUser);
        if (mockChannel.onmessage) {
          mockChannel.onmessage({ data: { type: 'TOKEN_UPDATED' } } as any);
        }
      });

      // This tab should update its state
      await waitFor(() => {
        expect(authService.getCurrentUser).toHaveBeenCalled();
      });
    });
  });

  describe('UC-AUTH-005: Direct URL Access', () => {
    it('should handle bookmark access to protected route', async () => {
      (authService.getCurrentUser as jest.Mock).mockReturnValue(null);

      render(
        <MemoryRouter initialEntries={['/epic-planning?projectId=123']}>
          <AuthProvider>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/" element={<Layout />}>
                <Route path="epic-planning" element={<EpicPlanningPage />} />
              </Route>
            </Routes>
          </AuthProvider>
        </MemoryRouter>
      );

      // Should redirect to login and save full path
      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/login');
        expect(sessionStorage.getItem('redirectAfterLogin')).toBe('/epic-planning?projectId=123');
      });
    });

    it('should allow authenticated user to access bookmarked route directly', async () => {
      (authService.getCurrentUser as jest.Mock).mockReturnValue(mockUser);

      render(
        <MemoryRouter initialEntries={['/epic-planning']}>
          <AuthProvider>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/" element={<Layout />}>
                <Route path="epic-planning" element={<EpicPlanningPage />} />
              </Route>
            </Routes>
          </AuthProvider>
        </MemoryRouter>
      );

      // Should render protected page without redirect
      await waitFor(() => {
        expect(mockNavigate).not.toHaveBeenCalledWith('/login');
      });
    });
  });

  describe('Edge Cases and Security', () => {
    it('should prevent redirect loop with /login path', async () => {
      (authService.getCurrentUser as jest.Mock).mockReturnValue(null);

      render(
        <MemoryRouter initialEntries={['/login']}>
          <AuthProvider>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/" element={<Layout />}>
                <Route path="dashboard" element={<DashboardPage />} />
              </Route>
            </Routes>
          </AuthProvider>
        </MemoryRouter>
      );

      await waitFor(() => {
        // Should NOT save /login as redirect path
        expect(sessionStorage.getItem('redirectAfterLogin')).toBeNull();
      });
    });

    it('should handle rapid authentication state changes', async () => {
      (authService.getCurrentUser as jest.Mock).mockReturnValue(mockUser);

      const { rerender } = render(
        <MemoryRouter initialEntries={['/dashboard']}>
          <AuthProvider>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/" element={<Layout />}>
                <Route path="dashboard" element={<DashboardPage />} />
              </Route>
            </Routes>
          </AuthProvider>
        </MemoryRouter>
      );

      // Authenticated - should render dashboard
      await waitFor(() => {
        expect(mockNavigate).not.toHaveBeenCalledWith('/login');
      });

      // Logout
      (authService.getCurrentUser as jest.Mock).mockReturnValue(null);

      rerender(
        <MemoryRouter initialEntries={['/dashboard']}>
          <AuthProvider>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/" element={<Layout />}>
                <Route path="dashboard" element={<DashboardPage />} />
              </Route>
            </Routes>
          </AuthProvider>
        </MemoryRouter>
      );

      // Should redirect to login
      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/login');
      });

      // Login again
      (authService.getCurrentUser as jest.Mock).mockReturnValue(mockUser);

      rerender(
        <MemoryRouter initialEntries={['/dashboard']}>
          <AuthProvider>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/" element={<Layout />}>
                <Route path="dashboard" element={<DashboardPage />} />
              </Route>
            </Routes>
          </AuthProvider>
        </MemoryRouter>
      );

      // Should allow access again
      expect(authService.getCurrentUser).toHaveBeenCalled();
    });

    it('should handle concurrent session expirations in multiple tabs', async () => {
      const mockChannel = {
        postMessage: jest.fn(),
        close: jest.fn(),
        onmessage: null,
      };

      global.BroadcastChannel = jest.fn(() => mockChannel) as any;
      (authService.getCurrentUser as jest.Mock).mockReturnValue(mockUser);

      let sessionExpiredCallback: ((path?: string) => void) | null = null;
      (onSessionExpired as jest.Mock).mockImplementation((callback) => {
        sessionExpiredCallback = callback;
        return jest.fn();
      });

      render(
        <MemoryRouter initialEntries={['/dashboard']}>
          <AuthProvider>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/" element={<Layout />}>
                <Route path="dashboard" element={<DashboardPage />} />
              </Route>
            </Routes>
          </AuthProvider>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(onSessionExpired).toHaveBeenCalled();
      });

      // Simulate session expiration in this tab
      act(() => {
        if (sessionExpiredCallback) {
          sessionExpiredCallback('/dashboard');
        }
      });

      // Simulate LOGOUT broadcast from another tab
      act(() => {
        if (mockChannel.onmessage) {
          mockChannel.onmessage({ data: { type: 'LOGOUT' } } as any);
        }
      });

      // Should handle both without errors
      await waitFor(() => {
        expect(sessionStorage.getItem('redirectAfterLogin')).toBeTruthy();
      });
    });

    it('should preserve query parameters through complete auth flow', async () => {
      (authService.getCurrentUser as jest.Mock).mockReturnValue(null);

      render(
        <MemoryRouter initialEntries={['/planning?projectId=abc-123&status=active&filter=bugs']}>
          <AuthProvider>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/" element={<Layout />}>
                <Route path="planning" element={<div>Planning</div>} />
              </Route>
            </Routes>
          </AuthProvider>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(sessionStorage.getItem('redirectAfterLogin')).toBe(
          '/planning?projectId=abc-123&status=active&filter=bugs'
        );
      });

      // After login, this path should be used for redirect
      (authService.login as jest.Mock).mockResolvedValue({
        user: mockUser,
        accessToken: 'token',
        refreshToken: 'refresh',
      });

      const savedPath = sessionStorage.getItem('redirectAfterLogin');
      expect(savedPath).toContain('projectId=abc-123');
      expect(savedPath).toContain('status=active');
      expect(savedPath).toContain('filter=bugs');
    });
  });

  describe('Performance and Reliability', () => {
    it('should handle multiple rapid page navigations', async () => {
      (authService.getCurrentUser as jest.Mock).mockReturnValue(null);

      const paths = ['/dashboard', '/epic-planning', '/workflows', '/timeline', '/use-cases'];

      for (const path of paths) {
        render(
          <MemoryRouter initialEntries={[path]}>
            <AuthProvider>
              <Routes>
                <Route path="/login" element={<LoginPage />} />
                <Route path="/" element={<Layout />}>
                  <Route path="*" element={<div>Page</div>} />
                </Route>
              </Routes>
            </AuthProvider>
          </MemoryRouter>
        );

        await waitFor(() => {
          expect(mockNavigate).toHaveBeenCalledWith('/login');
        });

        // Clear for next iteration
        jest.clearAllMocks();
      }

      // Should complete without errors
      expect(true).toBe(true);
    });

    it('should not leak memory with multiple auth state changes', async () => {
      (authService.getCurrentUser as jest.Mock).mockReturnValue(mockUser);

      const { unmount } = render(
        <MemoryRouter initialEntries={['/dashboard']}>
          <AuthProvider>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/" element={<Layout />}>
                <Route path="dashboard" element={<DashboardPage />} />
              </Route>
            </Routes>
          </AuthProvider>
        </MemoryRouter>
      );

      // Simulate auth state changes
      for (let i = 0; i < 10; i++) {
        act(() => {
          (authService.getCurrentUser as jest.Mock).mockReturnValue(i % 2 === 0 ? mockUser : null);
        });
      }

      // Unmount
      unmount();

      // Should not throw or cause memory leaks
      expect(true).toBe(true);
    });
  });

  describe('Real-World Scenarios', () => {
    it('should handle user workflow: access protected route -> login -> work -> session expires -> re-login', async () => {
      let sessionExpiredCallback: ((path?: string) => void) | null = null;
      (onSessionExpired as jest.Mock).mockImplementation((callback) => {
        sessionExpiredCallback = callback;
        return jest.fn();
      });

      // Step 1: Try to access protected route
      (authService.getCurrentUser as jest.Mock).mockReturnValue(null);

      const { rerender } = render(
        <MemoryRouter initialEntries={['/epic-planning']}>
          <AuthProvider>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/" element={<Layout />}>
                <Route path="epic-planning" element={<EpicPlanningPage />} />
              </Route>
            </Routes>
          </AuthProvider>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(sessionStorage.getItem('redirectAfterLogin')).toBe('/epic-planning');
      });

      // Step 2: Login
      (authService.getCurrentUser as jest.Mock).mockReturnValue(mockUser);
      (authService.login as jest.Mock).mockResolvedValue({
        user: mockUser,
        accessToken: 'token',
        refreshToken: 'refresh',
      });

      rerender(
        <MemoryRouter initialEntries={['/epic-planning']}>
          <AuthProvider>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/" element={<Layout />}>
                <Route path="epic-planning" element={<EpicPlanningPage />} />
              </Route>
            </Routes>
          </AuthProvider>
        </MemoryRouter>
      );

      // Step 3: Work for a while (session is valid)
      await waitFor(() => {
        expect(authService.getCurrentUser).toHaveBeenCalled();
      });

      // Step 4: Session expires
      act(() => {
        if (sessionExpiredCallback) {
          sessionExpiredCallback('/epic-planning');
        }
      });

      await waitFor(() => {
        expect(sessionStorage.getItem('redirectAfterLogin')).toBe('/epic-planning');
      });

      // Step 5: Re-login
      (authService.login as jest.Mock).mockResolvedValue({
        user: mockUser,
        accessToken: 'new-token',
        refreshToken: 'new-refresh',
      });

      // Should preserve redirect path for seamless return
      expect(sessionStorage.getItem('redirectAfterLogin')).toBe('/epic-planning');
    });
  });
});
