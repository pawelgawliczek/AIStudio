import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useProject } from '../context/ProjectContext';
import { storiesApi, epicsApi } from '../services/api';
import {
  ChartBarIcon,
  ClockIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  BeakerIcon,
  CodeBracketIcon,
  CogIcon,
} from '@heroicons/react/24/outline';

interface DashboardStats {
  totalStories: number;
  totalEpics: number;
  completedStories: number;
  inProgressStories: number;
  blockedStories: number;
  bugCount: number;
  completionRate: number;
}

export function DashboardPage() {
  const { selectedProject, projects } = useProject();
  const [stats, setStats] = useState<DashboardStats>({
    totalStories: 0,
    totalEpics: 0,
    completedStories: 0,
    inProgressStories: 0,
    blockedStories: 0,
    bugCount: 0,
    completionRate: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log('[DashboardPage] selectedProject changed:', selectedProject);
    if (selectedProject) {
      loadDashboardStats();
    }
  }, [selectedProject]);

  const loadDashboardStats = async () => {
    if (!selectedProject) return;

    try {
      console.log('[DashboardPage] Loading stats for project:', selectedProject.id);
      setLoading(true);

      // Fetch stories and epics
      const [storiesResponse, epicsResponse] = await Promise.all([
        storiesApi.getAll({ projectId: selectedProject.id }),
        epicsApi.getAll(selectedProject.id),
      ]);

      console.log('[DashboardPage] Got responses:', { storiesResponse, epicsResponse });

      // Extract data from responses
      const stories = Array.isArray(storiesResponse.data)
        ? storiesResponse.data
        : ((storiesResponse.data as any)?.data || []);

      const epics = Array.isArray(epicsResponse.data)
        ? epicsResponse.data
        : ((epicsResponse.data as any)?.data || []);

      // Calculate stats
      const completed = stories.filter((s: any) => s.status === 'done').length;
      const inProgress = stories.filter((s: any) =>
        ['planning', 'analysis', 'architecture', 'implementation', 'review', 'qa'].includes(s.status)
      ).length;
      const blocked = stories.filter((s: any) => s.status === 'blocked').length;
      const bugs = stories.filter((s: any) => s.type === 'bug').length;

      setStats({
        totalStories: stories.length,
        totalEpics: epics.length,
        completedStories: completed,
        inProgressStories: inProgress,
        blockedStories: blocked,
        bugCount: bugs,
        completionRate: stories.length > 0 ? Math.round((completed / stories.length) * 100) : 0,
      });
      console.log('[DashboardPage] Stats calculated:', stats);
    } catch (error) {
      console.error('[DashboardPage] Failed to load dashboard stats:', error);
    } finally {
      console.log('[DashboardPage] Loading complete, setting loading -> false');
      setLoading(false);
    }
  };

  if (!selectedProject) {
    return (
      <div>
        <h1 className="text-3xl font-bold text-fg mb-6">Dashboard</h1>
        <div className="bg-card shadow rounded-lg p-6 border border-border">
          <div className="text-center py-12">
            <ChartBarIcon className="mx-auto h-12 w-12 text-muted" />
            <h3 className="mt-2 text-lg font-medium text-fg">No Project Selected</h3>
            <p className="mt-1 text-sm text-muted">
              Select a project from the dropdown above to view dashboard statistics.
            </p>
            <div className="mt-6">
              <Link
                to="/projects"
                className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700"
              >
                <CogIcon className="h-5 w-5 mr-2" />
                Manage Projects
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-fg">Project Dashboard</h1>
          <p className="mt-1 text-sm text-muted">
            {selectedProject.name} - Overview and Statistics
          </p>
        </div>
        <Link
          to="/projects"
          className="inline-flex items-center px-3 py-2 border border-border shadow-sm text-sm font-medium rounded-md text-fg bg-card hover:bg-muted"
        >
          <CogIcon className="h-4 w-4 mr-2" />
          Manage Projects
        </Link>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
        </div>
      ) : (
        <>
          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
            {/* Total Stories */}
            <div className="bg-card overflow-hidden shadow rounded-lg border border-border">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <ChartBarIcon className="h-6 w-6 text-muted" />
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-muted truncate">
                        Total Stories
                      </dt>
                      <dd className="text-3xl font-semibold text-fg">
                        {stats.totalStories}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
              <div className="bg-bg-secondary px-5 py-3">
                <Link
                  to={`/projects/${selectedProject.id}/stories`}
                  className="text-sm font-medium text-accent hover:text-accent-dark"
                >
                  View all stories →
                </Link>
              </div>
            </div>

            {/* Completion Rate */}
            <div className="bg-card overflow-hidden shadow rounded-lg border border-border">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <CheckCircleIcon className="h-6 w-6 text-green-500" />
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-muted truncate">
                        Completion Rate
                      </dt>
                      <dd className="text-3xl font-semibold text-fg">
                        {stats.completionRate}%
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
              <div className="bg-bg-secondary px-5 py-3">
                <div className="text-sm text-fg">
                  {stats.completedStories} of {stats.totalStories} completed
                </div>
              </div>
            </div>

            {/* In Progress */}
            <div className="bg-card overflow-hidden shadow rounded-lg border border-border">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <ClockIcon className="h-6 w-6 text-blue-500" />
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-muted truncate">
                        In Progress
                      </dt>
                      <dd className="text-3xl font-semibold text-fg">
                        {stats.inProgressStories}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
              <div className="bg-bg-secondary px-5 py-3">
                <Link
                  to={`/planning?projectId=${selectedProject.id}`}
                  className="text-sm font-medium text-accent hover:text-accent-dark"
                >
                  View planning board →
                </Link>
              </div>
            </div>

            {/* Blocked & Bugs */}
            <div className="bg-card overflow-hidden shadow rounded-lg border border-border">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <ExclamationCircleIcon className="h-6 w-6 text-red-500" />
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-muted truncate">
                        Issues
                      </dt>
                      <dd className="text-3xl font-semibold text-fg">
                        {stats.blockedStories + stats.bugCount}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
              <div className="bg-bg-secondary px-5 py-3">
                <div className="text-sm text-fg">
                  {stats.blockedStories} blocked, {stats.bugCount} bugs
                </div>
              </div>
            </div>
          </div>

          {/* Quick Actions & Metrics */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* Quick Actions */}
            <div className="bg-card shadow rounded-lg p-6 border border-border">
              <h2 className="text-lg font-semibold text-fg mb-4">Quick Actions</h2>
              <div className="space-y-3">
                <Link
                  to={`/planning?projectId=${selectedProject.id}`}
                  className="flex items-center p-3 bg-primary-50 rounded-lg hover:bg-primary-100 transition-colors"
                >
                  <div className="flex-shrink-0 h-10 w-10 rounded-lg bg-primary-600 flex items-center justify-center">
                    <span className="text-white text-xl">🎯</span>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-fg">Planning Board</p>
                    <p className="text-xs text-muted">Kanban board for story management</p>
                  </div>
                </Link>

                <Link
                  to={`/projects/${selectedProject.id}/epics`}
                  className="flex items-center p-3 bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors"
                >
                  <div className="flex-shrink-0 h-10 w-10 rounded-lg bg-purple-600 flex items-center justify-center">
                    <span className="text-white text-xl">🟣</span>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-fg">Epics ({stats.totalEpics})</p>
                    <p className="text-xs text-muted">Manage project epics</p>
                  </div>
                </Link>

                <Link
                  to={`/projects/${selectedProject.id}/stories`}
                  className="flex items-center p-3 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                >
                  <div className="flex-shrink-0 h-10 w-10 rounded-lg bg-blue-600 flex items-center justify-center">
                    <span className="text-white text-xl">📖</span>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-fg">Stories List</p>
                    <p className="text-xs text-muted">Filtered list view with search</p>
                  </div>
                </Link>
              </div>
            </div>

            {/* Project Metrics */}
            <div className="bg-card shadow rounded-lg p-6 border border-border">
              <h2 className="text-lg font-semibold text-fg mb-4">Project Metrics</h2>
              <div className="space-y-4">
                <Link
                  to={`/code-quality/${selectedProject.id}`}
                  className="flex items-center justify-between p-3 border border-border rounded-lg hover:border-accent hover:bg-bg-secondary transition-colors"
                >
                  <div className="flex items-center">
                    <CodeBracketIcon className="h-5 w-5 text-muted mr-3" />
                    <span className="text-sm font-medium text-fg">Code Quality</span>
                  </div>
                  <span className="text-accent">→</span>
                </Link>

                <Link
                  to={`/test-coverage/project/${selectedProject.id}`}
                  className="flex items-center justify-between p-3 border border-border rounded-lg hover:border-accent hover:bg-bg-secondary transition-colors"
                >
                  <div className="flex items-center">
                    <BeakerIcon className="h-5 w-5 text-muted mr-3" />
                    <span className="text-sm font-medium text-fg">Test Coverage</span>
                  </div>
                  <span className="text-accent">→</span>
                </Link>

                <Link
                  to={`/agent-performance/${selectedProject.id}`}
                  className="flex items-center justify-between p-3 border border-border rounded-lg hover:border-accent hover:bg-bg-secondary transition-colors"
                >
                  <div className="flex items-center">
                    <ChartBarIcon className="h-5 w-5 text-muted mr-3" />
                    <span className="text-sm font-medium text-fg">Agent Performance</span>
                  </div>
                  <span className="text-accent">→</span>
                </Link>
              </div>

              <div className="mt-6 pt-6 border-t border-border">
                <h3 className="text-sm font-medium text-fg mb-3">Project Info</h3>
                <dl className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <dt className="text-muted">Total Epics:</dt>
                    <dd className="font-medium text-fg">{stats.totalEpics}</dd>
                  </div>
                  <div className="flex justify-between text-sm">
                    <dt className="text-muted">Active Stories:</dt>
                    <dd className="font-medium text-fg">{stats.inProgressStories}</dd>
                  </div>
                  <div className="flex justify-between text-sm">
                    <dt className="text-muted">Bug Count:</dt>
                    <dd className="font-medium text-fg">{stats.bugCount}</dd>
                  </div>
                </dl>
              </div>
            </div>
          </div>

          {/* Info Panel */}
          <div className="bg-bg-secondary border border-border rounded-lg p-6">
            <h3 className="text-lg font-semibold text-fg mb-3">
              📚 Understanding the Views
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <h4 className="font-medium text-fg mb-1">🎯 Planning Board</h4>
                <p className="text-muted">
                  Kanban-style board for visualizing story flow. Drag and drop stories between columns.
                  Create stories and bugs here.
                </p>
              </div>
              <div>
                <h4 className="font-medium text-fg mb-1">🟣 Epics</h4>
                <p className="text-muted">
                  Large features or initiatives. Group related stories under epics to organize your work.
                </p>
              </div>
              <div>
                <h4 className="font-medium text-fg mb-1">📖 Stories List</h4>
                <p className="text-muted">
                  Filtered list view with search and filters. Better for finding specific stories or bugs.
                  Create stories and bugs here too.
                </p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
