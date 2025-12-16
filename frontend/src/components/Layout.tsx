import { useEffect, useState } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { Dialog, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import { ProjectSelector } from './ProjectSelector';
import { ConnectionStatus } from './ConnectionStatus';
import { NavDropdown } from './NavDropdown';
import { ThemeToggle } from './ThemeToggle';
import { MultiRunStatusBar } from './workflow/MultiRunStatusBar';
import { SessionExpiredModal } from './SessionExpiredModal';
import {
  ArrowRightOnRectangleIcon,
  Bars3Icon,
  XMarkIcon,
  ChevronDownIcon
} from '@heroicons/react/24/outline';
import { useProject } from '../context/ProjectContext';
import { useAuth } from '../context/AuthContext';
import { terminology } from '../utils/terminology';

export function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { selectedProject } = useProject();
  const { isAuthenticated, loading, logout, setRedirectPath } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

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

  // Close mobile menu on route change
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

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
            <div className="flex items-center gap-4 sm:gap-8 flex-1 min-w-0">
              {/* Mobile menu button */}
              <button
                onClick={() => setIsMobileMenuOpen(true)}
                className="md:hidden inline-flex items-center justify-center p-2 rounded-md text-fg hover:text-accent hover:bg-accent/10 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-ring transition-colors flex-shrink-0"
                aria-label="Open menu"
              >
                <Bars3Icon className="h-6 w-6" />
              </button>

              <div className="flex-shrink-0 flex items-center">
                <h1 className="text-lg sm:text-xl font-bold text-accent">Vibe Studio</h1>
              </div>

              {/* Desktop navigation */}
              <div className="hidden md:flex gap-4 lg:gap-6">
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
                        { label: terminology.workflows, icon: '⚡', path: '/workflows' },
                        { label: 'Team Runs', icon: '🏃', path: '/team-runs' },
                        { label: terminology.components, icon: '🧩', path: '/components' },
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

                    <NavDropdown
                      label="DevOps"
                      icon="⚙️"
                      items={[
                        { label: 'Deployments', icon: '🚀', path: '/deployments' },
                        { label: 'Test Executions', icon: '🧪', path: '/test-executions' },
                        { label: 'Backups', icon: '💾', path: '/backups' },
                      ]}
                    />
                  </>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
              {/* ProjectSelector hidden on mobile - shown in hamburger menu */}
              <div className="hidden md:block">
                <ProjectSelector />
              </div>
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

      {/* Mobile Menu */}
      <Transition.Root show={isMobileMenuOpen} as={Fragment}>
        <Dialog as="div" className="relative z-50 md:hidden" onClose={setIsMobileMenuOpen}>
          <Transition.Child
            as={Fragment}
            enter="ease-in-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in-out duration-300"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/50 transition-opacity" />
          </Transition.Child>

          <div className="fixed inset-0 overflow-hidden">
            <div className="absolute inset-0 overflow-hidden">
              <div className="pointer-events-none fixed inset-y-0 left-0 flex max-w-full">
                <Transition.Child
                  as={Fragment}
                  enter="transform transition ease-in-out duration-300"
                  enterFrom="-translate-x-full"
                  enterTo="translate-x-0"
                  leave="transform transition ease-in-out duration-300"
                  leaveFrom="translate-x-0"
                  leaveTo="-translate-x-full"
                >
                  <Dialog.Panel className="pointer-events-auto w-screen max-w-md">
                    <div className="flex h-full flex-col overflow-y-scroll bg-card shadow-xl">
                      {/* Header */}
                      <div className="flex items-center justify-between px-4 py-6 border-b border-border">
                        <Dialog.Title className="text-lg font-bold text-accent">
                          Vibe Studio
                        </Dialog.Title>
                        <button
                          type="button"
                          className="rounded-md text-fg hover:text-accent focus:outline-none focus:ring-2 focus:ring-ring transition-colors"
                          onClick={() => setIsMobileMenuOpen(false)}
                          aria-label="Close menu"
                        >
                          <XMarkIcon className="h-6 w-6" />
                        </button>
                      </div>

                      {/* Project Selector for Mobile */}
                      <div className="px-4 py-4 border-b border-border">
                        <div className="text-sm font-medium text-muted mb-2">Project</div>
                        <ProjectSelector />
                      </div>

                      {/* Navigation Items */}
                      <div className="flex-1 px-4 py-6">
                        <nav className="space-y-1">
                          {/* Dashboard Link */}
                          <Link
                            to="/dashboard"
                            className="flex items-center gap-3 px-3 py-3 text-base font-medium text-fg hover:bg-accent/10 hover:text-accent rounded-md transition-colors"
                            onClick={() => setIsMobileMenuOpen(false)}
                          >
                            <span>📊</span>
                            <span>Dashboard</span>
                          </Link>

                          {selectedProject && (
                            <>
                              {/* Planning Section */}
                              <MobileNavSection
                                label="Planning"
                                icon="📋"
                                items={[
                                  { label: 'Epic Planning', icon: '🎨', path: '/epic-planning' },
                                  { label: 'Timeline', icon: '📅', path: '/timeline' },
                                  { label: 'Planning Board', icon: '🎯', path: `/planning?projectId=${selectedProject.id}` },
                                ]}
                                onItemClick={() => setIsMobileMenuOpen(false)}
                              />

                              {/* Agents Section */}
                              <MobileNavSection
                                label="Agents"
                                icon="🤖"
                                items={[
                                  { label: terminology.workflows, icon: '⚡', path: '/workflows' },
                                  { label: 'Team Runs', icon: '🏃', path: '/team-runs' },
                                  { label: terminology.components, icon: '🧩', path: '/components' },
                                  { label: 'Performance', icon: '📊', path: '/analytics/performance' },
                                ]}
                                onItemClick={() => setIsMobileMenuOpen(false)}
                              />

                              {/* Quality Section */}
                              <MobileNavSection
                                label="Quality"
                                icon="✨"
                                items={[
                                  { label: 'Use Cases', icon: '📖', path: '/use-cases' },
                                  { label: 'Code Quality', icon: '🔍', path: `/code-quality/${selectedProject.id}` },
                                  { label: 'Test Coverage', icon: '🧪', path: `/test-coverage/project/${selectedProject.id}` },
                                ]}
                                onItemClick={() => setIsMobileMenuOpen(false)}
                              />

                              {/* DevOps Section */}
                              <MobileNavSection
                                label="DevOps"
                                icon="⚙️"
                                items={[
                                  { label: 'Deployments', icon: '🚀', path: '/deployments' },
                                  { label: 'Test Executions', icon: '🧪', path: '/test-executions' },
                                  { label: 'Backups', icon: '💾', path: '/backups' },
                                ]}
                                onItemClick={() => setIsMobileMenuOpen(false)}
                              />
                            </>
                          )}
                        </nav>
                      </div>

                      {/* Footer Actions */}
                      <div className="border-t border-border px-4 py-4 space-y-4">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-muted">Theme</span>
                          <ThemeToggle />
                        </div>
                        <button
                          onClick={() => {
                            setIsMobileMenuOpen(false);
                            handleLogout();
                          }}
                          className="flex items-center gap-3 w-full px-3 py-3 text-base font-medium text-fg hover:bg-accent/10 hover:text-accent rounded-md transition-colors"
                        >
                          <ArrowRightOnRectangleIcon className="h-5 w-5" />
                          <span>Logout</span>
                        </button>
                      </div>
                    </div>
                  </Dialog.Panel>
                </Transition.Child>
              </div>
            </div>
          </div>
        </Dialog>
      </Transition.Root>

      {/* Multi-Run Progress Tracker Status Bar */}
      <MultiRunStatusBar />

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

// Mobile Navigation Section Component
interface MobileNavSectionProps {
  label: string;
  icon?: string;
  items: Array<{ label: string; path: string; icon?: string }>;
  onItemClick: () => void;
}

function MobileNavSection({ label, icon, items, onItemClick }: MobileNavSectionProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="space-y-1">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center justify-between w-full px-3 py-3 text-base font-medium text-fg hover:bg-accent/10 hover:text-accent rounded-md transition-colors"
        aria-expanded={isExpanded}
      >
        <div className="flex items-center gap-3">
          {icon && <span>{icon}</span>}
          <span>{label}</span>
        </div>
        <ChevronDownIcon
          className={`h-5 w-5 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
        />
      </button>

      {isExpanded && (
        <div className="pl-6 space-y-1">
          {items.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              onClick={onItemClick}
              className="flex items-center gap-3 px-3 py-2 text-sm text-muted hover:bg-accent/10 hover:text-accent rounded-md transition-colors"
            >
              {item.icon && <span>{item.icon}</span>}
              <span>{item.label}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
