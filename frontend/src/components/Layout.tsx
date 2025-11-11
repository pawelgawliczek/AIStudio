import { Outlet, Link, useNavigate } from 'react-router-dom';
import { ProjectSelector } from './ProjectSelector';
import { ConnectionStatus } from './ConnectionStatus';
import { ArrowRightOnRectangleIcon } from '@heroicons/react/24/outline';
import { useProject } from '../context/ProjectContext';

export function Layout() {
  const navigate = useNavigate();
  const { selectedProject } = useProject();

  const handleLogout = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('user');
    localStorage.removeItem('selectedProjectId');
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-bg flex flex-col">
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
                <Link
                  to="/projects"
                  className="inline-flex items-center px-1 pt-1 text-sm font-medium text-fg hover:text-accent transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-ring rounded"
                >
                  📋 Projects
                </Link>
                <Link
                  to="/planning"
                  className="inline-flex items-center px-1 pt-1 text-sm font-medium text-fg hover:text-accent transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-ring rounded"
                >
                  🎯 Planning
                </Link>
                {selectedProject && (
                  <>
                    <Link
                      to={`/code-quality/${selectedProject}`}
                      className="inline-flex items-center px-1 pt-1 text-sm font-medium text-fg hover:text-accent transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-ring rounded"
                    >
                      🔍 Code Quality
                    </Link>
                    <Link
                      to={`/agent-performance/${selectedProject}`}
                      className="inline-flex items-center px-1 pt-1 text-sm font-medium text-fg hover:text-accent transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-ring rounded"
                    >
                      📈 Agent Performance
                    </Link>
                    <Link
                      to={`/test-coverage/project/${selectedProject}`}
                      className="inline-flex items-center px-1 pt-1 text-sm font-medium text-fg hover:text-accent transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-ring rounded"
                    >
                      🧪 Test Coverage
                    </Link>
                  </>
                )}
              </div>
            </div>

            <div className="flex items-center gap-4">
              <ProjectSelector />
              <ConnectionStatus />
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
              href="https://pawelgawliczek.cloud/"
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
