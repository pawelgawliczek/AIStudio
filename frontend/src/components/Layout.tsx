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
    <div className="min-h-screen bg-gray-50">
      {/* Navigation */}
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center space-x-8">
              <div className="flex-shrink-0 flex items-center">
                <h1 className="text-xl font-bold text-indigo-600">AI Studio</h1>
              </div>
              <div className="flex space-x-8">
                <Link
                  to="/dashboard"
                  className="inline-flex items-center px-1 pt-1 text-sm font-medium text-gray-900 hover:text-indigo-600"
                >
                  📊 Dashboard
                </Link>
                <Link
                  to="/projects"
                  className="inline-flex items-center px-1 pt-1 text-sm font-medium text-gray-900 hover:text-indigo-600"
                >
                  📋 Projects
                </Link>
                <Link
                  to="/planning"
                  className="inline-flex items-center px-1 pt-1 text-sm font-medium text-gray-900 hover:text-indigo-600"
                >
                  🎯 Planning
                </Link>
                {selectedProject && (
                  <>
                    <Link
                      to={`/code-quality/${selectedProject}`}
                      className="inline-flex items-center px-1 pt-1 text-sm font-medium text-gray-900 hover:text-indigo-600"
                    >
                      🔍 Code Quality
                    </Link>
                    <Link
                      to={`/agent-performance/${selectedProject}`}
                      className="inline-flex items-center px-1 pt-1 text-sm font-medium text-gray-900 hover:text-indigo-600"
                    >
                      📈 Agent Performance
                    </Link>
                  </>
                )}
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <ProjectSelector />
              <ConnectionStatus />
              <button
                onClick={handleLogout}
                className="inline-flex items-center px-3 py-2 text-sm font-medium text-gray-700 hover:text-gray-900"
              >
                <ArrowRightOnRectangleIcon className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Outlet />
      </main>
    </div>
  );
}
