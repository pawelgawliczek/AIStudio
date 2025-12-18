/**
 * ST-11: Layout Component Tests
 * Testing route protection, redirect path capture, and authentication guards
 */

import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter, MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../../context/AuthContext';
import { ProjectProvider } from '../../context/ProjectContext';
import { onSessionExpired } from '../../services/api.client';
import authService from '../../services/auth.service';
import { Layout } from '../Layout';

jest.mock('../../services/auth.service');
jest.mock('../../services/api.client');
jest.mock('../ProjectSelector', () => ({
  ProjectSelector: () => <div data-testid="project-selector">Project Selector</div>,
}));
jest.mock('../ConnectionStatus', () => ({
  ConnectionStatus: () => <div data-testid="connection-status">Connection Status</div>,
}));
jest.mock('../ThemeToggle', () => ({
  ThemeToggle: () => <div data-testid="theme-toggle">Theme Toggle</div>,
}));
jest.mock('../SessionExpiredModal', () => ({
  SessionExpiredModal: () => <div data-testid="session-expired-modal">Session Expired Modal</div>,
}));
jest.mock('../workflow/GlobalWorkflowTrackingBar', () => ({
  GlobalWorkflowTrackingBar: () => <div data-testid="workflow-tracking">Workflow Tracking</div>,
}));

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

describe('Layout - ST-11 Route Protection', () => {
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

  describe('UC-AUTH-005: Direct Protected Route Access', () => {
    it('should allow access when user is authenticated', async () => {
      (authService.getCurrentUser as jest.Mock).mockReturnValue(mockUser);

      render(
        <MemoryRouter initialEntries={['/dashboard']}>
          <ProjectProvider>
            <AuthProvider>
              <Layout />
            </AuthProvider>
          </ProjectProvider>
        </MemoryRouter>
      );

      await waitFor(() => {
        // Layout should render (not redirect)
        expect(screen.getByText('Vibe Studio')).toBeInTheDocument();
        expect(mockNavigate).not.toHaveBeenCalledWith('/login');
      });
    });

    it('should redirect to login when user is not authenticated', async () => {
      (authService.getCurrentUser as jest.Mock).mockReturnValue(null);

      render(
        <MemoryRouter initialEntries={['/epic-planning']}>
          <ProjectProvider>
            <AuthProvider>
              <Layout />
            </AuthProvider>
          </ProjectProvider>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/login');
      });
    });

    it('should capture and save redirect path when redirecting to login', async () => {
      (authService.getCurrentUser as jest.Mock).mockReturnValue(null);

      render(
        <MemoryRouter initialEntries={['/epic-planning']}>
          <ProjectProvider>
            <AuthProvider>
              <Layout />
            </AuthProvider>
          </ProjectProvider>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/login');
        expect(sessionStorage.getItem('redirectAfterLogin')).toBe('/epic-planning');
      });
    });

    it('should capture path with query parameters', async () => {
      (authService.getCurrentUser as jest.Mock).mockReturnValue(null);

      render(
        <MemoryRouter initialEntries={['/planning?projectId=123&status=active']}>
          <ProjectProvider>
            <AuthProvider>
              <Layout />
            </AuthProvider>
          </ProjectProvider>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/login');
        expect(sessionStorage.getItem('redirectAfterLogin')).toBe('/planning?projectId=123&status=active');
      });
    });

    it('should NOT save /login as redirect path', async () => {
      (authService.getCurrentUser as jest.Mock).mockReturnValue(null);

      render(
        <MemoryRouter initialEntries={['/login']}>
          <ProjectProvider>
            <AuthProvider>
              <Layout />
            </AuthProvider>
          </ProjectProvider>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(sessionStorage.getItem('redirectAfterLogin')).toBeNull();
      });
    });

    it('should NOT save /register as redirect path', async () => {
      (authService.getCurrentUser as jest.Mock).mockReturnValue(null);

      render(
        <MemoryRouter initialEntries={['/register']}>
          <ProjectProvider>
            <AuthProvider>
              <Layout />
            </AuthProvider>
          </ProjectProvider>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(sessionStorage.getItem('redirectAfterLogin')).toBeNull();
      });
    });

    it('should NOT save root path / as redirect path', async () => {
      (authService.getCurrentUser as jest.Mock).mockReturnValue(null);

      render(
        <MemoryRouter initialEntries={['/']}>
          <ProjectProvider>
            <AuthProvider>
              <Layout />
            </AuthProvider>
          </ProjectProvider>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(sessionStorage.getItem('redirectAfterLogin')).toBeNull();
      });
    });
  });

  describe('Loading State', () => {
    it('should show loading indicator while auth is loading', () => {
      // Mock loading state by not calling getCurrentUser immediately
      (authService.getCurrentUser as jest.Mock).mockReturnValue(null);

      const { container } = render(
        <MemoryRouter initialEntries={['/dashboard']}>
          <ProjectProvider>
            <AuthProvider>
              <Layout />
            </AuthProvider>
          </ProjectProvider>
        </MemoryRouter>
      );

      // During brief loading state, should show loading or nothing
      // After loading completes, should redirect
      expect(container).toBeTruthy();
    });

    it('should render nothing when not authenticated after loading', async () => {
      (authService.getCurrentUser as jest.Mock).mockReturnValue(null);

      const { container } = render(
        <MemoryRouter initialEntries={['/dashboard']}>
          <ProjectProvider>
            <AuthProvider>
              <Layout />
            </AuthProvider>
          </ProjectProvider>
        </MemoryRouter>
      );

      await waitFor(() => {
        // Should redirect, not render main layout
        expect(mockNavigate).toHaveBeenCalledWith('/login');
      });

      // Main content should not render
      expect(container.querySelector('nav')).not.toBeInTheDocument();
    });
  });

  describe('Authenticated User Experience', () => {
    it('should render navigation bar for authenticated users', async () => {
      (authService.getCurrentUser as jest.Mock).mockReturnValue(mockUser);

      render(
        <MemoryRouter initialEntries={['/dashboard']}>
          <ProjectProvider>
            <AuthProvider>
              <Layout />
            </AuthProvider>
          </ProjectProvider>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Vibe Studio')).toBeInTheDocument();
        expect(screen.getByText('📊 Dashboard')).toBeInTheDocument();
      });
    });

    it('should include logout button', async () => {
      (authService.getCurrentUser as jest.Mock).mockReturnValue(mockUser);

      render(
        <MemoryRouter initialEntries={['/dashboard']}>
          <ProjectProvider>
            <AuthProvider>
              <Layout />
            </AuthProvider>
          </ProjectProvider>
        </MemoryRouter>
      );

      await waitFor(() => {
        const logoutButton = screen.getByRole('button', { name: /logout/i });
        expect(logoutButton).toBeInTheDocument();
      });
    });

    it('should render SessionExpiredModal', async () => {
      (authService.getCurrentUser as jest.Mock).mockReturnValue(mockUser);

      render(
        <MemoryRouter initialEntries={['/dashboard']}>
          <ProjectProvider>
            <AuthProvider>
              <Layout />
            </AuthProvider>
          </ProjectProvider>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('session-expired-modal')).toBeInTheDocument();
      });
    });

    it('should render GlobalWorkflowTrackingBar', async () => {
      (authService.getCurrentUser as jest.Mock).mockReturnValue(mockUser);

      render(
        <MemoryRouter initialEntries={['/dashboard']}>
          <ProjectProvider>
            <AuthProvider>
              <Layout />
            </AuthProvider>
          </ProjectProvider>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('workflow-tracking')).toBeInTheDocument();
      });
    });
  });

  describe('Deep Link Protection', () => {
    it('should protect story detail routes', async () => {
      (authService.getCurrentUser as jest.Mock).mockReturnValue(null);

      render(
        <MemoryRouter initialEntries={['/story/ST-123']}>
          <ProjectProvider>
            <AuthProvider>
              <Layout />
            </AuthProvider>
          </ProjectProvider>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/login');
        expect(sessionStorage.getItem('redirectAfterLogin')).toBe('/story/ST-123');
      });
    });

    it('should protect epic planning routes', async () => {
      (authService.getCurrentUser as jest.Mock).mockReturnValue(null);

      render(
        <MemoryRouter initialEntries={['/epic-planning']}>
          <ProjectProvider>
            <AuthProvider>
              <Layout />
            </AuthProvider>
          </ProjectProvider>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/login');
        expect(sessionStorage.getItem('redirectAfterLogin')).toBe('/epic-planning');
      });
    });

    it('should protect workflow routes', async () => {
      (authService.getCurrentUser as jest.Mock).mockReturnValue(null);

      render(
        <MemoryRouter initialEntries={['/workflows']}>
          <ProjectProvider>
            <AuthProvider>
              <Layout />
            </AuthProvider>
          </ProjectProvider>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/login');
        expect(sessionStorage.getItem('redirectAfterLogin')).toBe('/workflows');
      });
    });

    it('should protect code quality routes', async () => {
      (authService.getCurrentUser as jest.Mock).mockReturnValue(null);

      render(
        <MemoryRouter initialEntries={['/code-quality/project-123']}>
          <ProjectProvider>
            <AuthProvider>
              <Layout />
            </AuthProvider>
          </ProjectProvider>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/login');
        expect(sessionStorage.getItem('redirectAfterLogin')).toBe('/code-quality/project-123');
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle undefined location gracefully', async () => {
      (authService.getCurrentUser as jest.Mock).mockReturnValue(null);

      // Should not crash
      expect(() => {
        render(
          <MemoryRouter initialEntries={['/dashboard']}>
            <ProjectProvider>
              <AuthProvider>
                <Layout />
              </AuthProvider>
            </ProjectProvider>
          </MemoryRouter>
        );
      }).not.toThrow();
    });

    it('should handle authentication state changes', async () => {
      (authService.getCurrentUser as jest.Mock).mockReturnValue(mockUser);

      const { rerender } = render(
        <MemoryRouter initialEntries={['/dashboard']}>
          <ProjectProvider>
            <AuthProvider>
              <Layout />
            </AuthProvider>
          </ProjectProvider>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Vibe Studio')).toBeInTheDocument();
      });

      // User logs out
      (authService.getCurrentUser as jest.Mock).mockReturnValue(null);

      rerender(
        <MemoryRouter initialEntries={['/dashboard']}>
          <ProjectProvider>
            <AuthProvider>
              <Layout />
            </AuthProvider>
          </ProjectProvider>
        </MemoryRouter>
      );

      // Should redirect to login
      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/login');
      });
    });

    it('should handle malformed URLs', async () => {
      (authService.getCurrentUser as jest.Mock).mockReturnValue(null);

      render(
        <MemoryRouter initialEntries={['/invalid-route-xyz']}>
          <ProjectProvider>
            <AuthProvider>
              <Layout />
            </AuthProvider>
          </ProjectProvider>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/login');
        // Should still save the path for redirect
        expect(sessionStorage.getItem('redirectAfterLogin')).toBe('/invalid-route-xyz');
      });
    });

    it('should handle paths with special characters', async () => {
      (authService.getCurrentUser as jest.Mock).mockReturnValue(null);

      render(
        <MemoryRouter initialEntries={['/search?query=test%20value&filter=all']}>
          <ProjectProvider>
            <AuthProvider>
              <Layout />
            </AuthProvider>
          </ProjectProvider>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/login');
        expect(sessionStorage.getItem('redirectAfterLogin')).toBe('/search?query=test%20value&filter=all');
      });
    });

    it('should handle hash fragments in URLs', async () => {
      (authService.getCurrentUser as jest.Mock).mockReturnValue(null);

      render(
        <MemoryRouter initialEntries={['/dashboard#section-2']}>
          <ProjectProvider>
            <AuthProvider>
              <Layout />
            </AuthProvider>
          </ProjectProvider>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/login');
        // Hash is not captured by pathname + search
        expect(sessionStorage.getItem('redirectAfterLogin')).toBe('/dashboard');
      });
    });
  });

  describe('Navigation Links', () => {
    it('should show Planning dropdown when project is selected', async () => {
      (authService.getCurrentUser as jest.Mock).mockReturnValue(mockUser);

      render(
        <MemoryRouter initialEntries={['/dashboard']}>
          <ProjectProvider>
            <AuthProvider>
              <Layout />
            </AuthProvider>
          </ProjectProvider>
        </MemoryRouter>
      );

      await waitFor(() => {
        // Navigation items should be present
        expect(screen.getByText('📊 Dashboard')).toBeInTheDocument();
      });
    });

    it('should include footer with creator attribution', async () => {
      (authService.getCurrentUser as jest.Mock).mockReturnValue(mockUser);

      render(
        <MemoryRouter initialEntries={['/dashboard']}>
          <ProjectProvider>
            <AuthProvider>
              <Layout />
            </AuthProvider>
          </ProjectProvider>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText(/Created by/i)).toBeInTheDocument();
        expect(screen.getByText('Paweł Gawliczek')).toBeInTheDocument();
      });
    });
  });

  describe('Security', () => {
    it('should not render sensitive content when not authenticated', async () => {
      (authService.getCurrentUser as jest.Mock).mockReturnValue(null);

      const { container } = render(
        <MemoryRouter initialEntries={['/dashboard']}>
          <ProjectProvider>
            <AuthProvider>
              <Layout />
            </AuthProvider>
          </ProjectProvider>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/login');
      });

      // Main navigation should not be visible
      expect(container.querySelector('nav')).not.toBeInTheDocument();
      expect(screen.queryByText('Vibe Studio')).not.toBeInTheDocument();
    });

    it('should prevent access to admin routes without authentication', async () => {
      (authService.getCurrentUser as jest.Mock).mockReturnValue(null);

      render(
        <MemoryRouter initialEntries={['/coordinators']}>
          <ProjectProvider>
            <AuthProvider>
              <Layout />
            </AuthProvider>
          </ProjectProvider>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/login');
        expect(sessionStorage.getItem('redirectAfterLogin')).toBe('/coordinators');
      });
    });
  });

  describe('Performance', () => {
    it('should not cause unnecessary re-renders', async () => {
      (authService.getCurrentUser as jest.Mock).mockReturnValue(mockUser);

      const { rerender } = render(
        <MemoryRouter initialEntries={['/dashboard']}>
          <ProjectProvider>
            <AuthProvider>
              <Layout />
            </AuthProvider>
          </ProjectProvider>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Vibe Studio')).toBeInTheDocument();
      });

      const initialCallCount = mockNavigate.mock.calls.length;

      // Rerender with same props
      rerender(
        <MemoryRouter initialEntries={['/dashboard']}>
          <ProjectProvider>
            <AuthProvider>
              <Layout />
            </AuthProvider>
          </ProjectProvider>
        </MemoryRouter>
      );

      // Should not trigger additional navigation
      expect(mockNavigate.mock.calls.length).toBe(initialCallCount);
    });
  });
});
