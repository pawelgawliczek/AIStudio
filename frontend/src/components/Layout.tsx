import { useEffect } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { ProjectSelector } from './ProjectSelector';
import { ConnectionStatus } from './ConnectionStatus';
import { NavDropdown } from './NavDropdown';
import { ThemeToggle } from './ThemeToggle';
import { GlobalWorkflowTrackingBar } from './workflow/GlobalWorkflowTrackingBar';
import { SessionExpiredModal } from './SessionExpiredModal';
import { ArrowRightOnRectangleIcon } from '@heroicons/react/24/outline';
import { useProject } from '../context/ProjectContext';
import { useAuth } from '../context/AuthContext';

export function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { selectedProject } = useProject();
  const { isAuthenticated, loading, logout, setRedirectPath } = useAuth();

  // Capture redirect path when user is not authenticated
  useEffect(() => {
    if (!loading && !isAuthenticated) {
      const currentPath = location.pathname + location.search;
      // Save redirect path if accessing a protected route
      if (currentPath !== '/login' && currentPath !== '/register' && currentPath !== '/') {
        setRedirectPath(currentPath);
        sessionStorage.setItem('redirectAfterLogin', currentPath);
      }
      navigate('/login');
    }
  }, [isAuthenticated, loading, navigate, location, setRedirectPath]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-bg flex flex-col">
      {/* Session Expired Modal */}
      <SessionExpiredModal />

      {/* Navigation */}
      <nav className="bg-card shadow-sm border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center gap-8">
              <div className="flex-shrink-0 flex items-center">
                <h1 className="text-lg sm:text-xl font-bold text-accent">Vibe Studio</h1>
              </div>
              <div className="hidden md:flex gap-6">
                <Link
                  to="/dashboard"
                  className="inline-flex items-center px-1 pt-1 text-sm font-medium text-fg hover:text-accent transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-ring rounded"
                >
                  📊 Dashboard
                </Link>

                {selectedProject && (
                  <>
                    <NavDropdown
                      label="Planning"
                      icon="📋"
                      items={[
                        { label: 'Epic Planning', icon: '🎨', path: '/epic-planning' },
                        { label: 'Timeline', icon: '📅', path: '/timeline' },
                        { label: 'Planning Board', icon: '🎯', path: `/planning?projectId=${selectedProject.id}` },
                      ]}
                    />

                    <NavDropdown
                      label="Agents"
                      icon="🤖"
                      items={[
                        { label: 'Components', icon: '🧩', path: '/components' },
                        { label: 'Coordinators', icon: '🤖', path: '/coordinators' },
                        { label: 'Workflows', icon: '⚡', path: '/workflows' },
                        { label: 'Performance', icon: '📊', path: '/analytics/performance' },
                      ]}
                    />

                    <NavDropdown
                      label="Quality"
                      icon="✨"
                      items={[
                        { label: 'Use Cases', icon: '📖', path: '/use-cases' },
                        { label: 'Code Quality', icon: '🔍', path: `/code-quality/${selectedProject.id}` },
                        { label: 'Test Coverage', icon: '🧪', path: `/test-coverage/project/${selectedProject.id}` },
                      ]}
                    />
                  </>
                )}
              </div>
            </div>

            <div className="flex items-center gap-4">
              <ProjectSelector />
              <ConnectionStatus />
              <ThemeToggle />
              <button
                onClick={handleLogout}
                className="inline-flex items-center p-2 text-sm font-medium text-muted hover:text-fg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-ring rounded-md"
                aria-label="Logout"
              >
                <ArrowRightOnRectangleIcon className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Global Workflow Tracking Bar */}
      <GlobalWorkflowTrackingBar />

      {/* Main content */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="bg-card border-t border-border mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <p className="text-center text-sm text-muted">
            Created by{' '}
            <a
              href="https://example.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent hover:text-accent-dark transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-ring rounded"
            >
              Paweł Gawliczek
            </a>
            {' '}@2025
          </p>
        </div>
      </footer>
    </div>
  );
}
