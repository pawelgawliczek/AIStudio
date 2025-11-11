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
    if (selectedProject) {
      loadDashboardStats();
    }
  }, [selectedProject]);

  const loadDashboardStats = async () => {
    if (!selectedProject) return;

    try {
      setLoading(true);

      // Fetch stories and epics
      const [storiesResponse, epicsResponse] = await Promise.all([
        storiesApi.getAll({ projectId: selectedProject.id }),
        epicsApi.getAll(selectedProject.id),
      ]);

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
    } catch (error) {
      console.error('Failed to load dashboard stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!selectedProject) {
    return (
      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-6">Dashboard</h1>
        <div className="bg-white shadow rounded-lg p-6">
          <div className="text-center py-12">
            <ChartBarIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-lg font-medium text-gray-900">No Project Selected</h3>
            <p className="mt-1 text-sm text-gray-500">
              Select a project from the dropdown above to view dashboard statistics.
            </p>
            <div className="mt-6">
              <Link
                to="/projects"
                className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
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
          <h1 className="text-3xl font-bold text-gray-900">Project Dashboard</h1>
          <p className="mt-1 text-sm text-gray-600">
            {selectedProject.name} - Overview and Statistics
          </p>
        </div>
        <Link
          to="/projects"
          className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
        >
          <CogIcon className="h-4 w-4 mr-2" />
          Manage Projects
        </Link>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
        </div>
      ) : (
        <>
          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
            {/* Total Stories */}
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <ChartBarIcon className="h-6 w-6 text-gray-400" />
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        Total Stories
                      </dt>
                      <dd className="text-3xl font-semibold text-gray-900">
                        {stats.totalStories}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 px-5 py-3">
                <Link
                  to={`/projects/${selectedProject.id}/stories`}
                  className="text-sm font-medium text-indigo-600 hover:text-indigo-900"
                >
                  View all stories →
                </Link>
              </div>
            </div>

            {/* Completion Rate */}
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <CheckCircleIcon className="h-6 w-6 text-green-400" />
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        Completion Rate
                      </dt>
                      <dd className="text-3xl font-semibold text-gray-900">
                        {stats.completionRate}%
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 px-5 py-3">
                <div className="text-sm text-gray-700">
                  {stats.completedStories} of {stats.totalStories} completed
                </div>
              </div>
            </div>

            {/* In Progress */}
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <ClockIcon className="h-6 w-6 text-blue-400" />
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        In Progress
                      </dt>
                      <dd className="text-3xl font-semibold text-gray-900">
                        {stats.inProgressStories}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 px-5 py-3">
                <Link
                  to={`/planning?projectId=${selectedProject.id}`}
                  className="text-sm font-medium text-indigo-600 hover:text-indigo-900"
                >
                  View planning board →
                </Link>
              </div>
            </div>

            {/* Blocked & Bugs */}
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <ExclamationCircleIcon className="h-6 w-6 text-red-400" />
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        Issues
                      </dt>
                      <dd className="text-3xl font-semibold text-gray-900">
                        {stats.blockedStories + stats.bugCount}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 px-5 py-3">
                <div className="text-sm text-gray-700">
                  {stats.blockedStories} blocked, {stats.bugCount} bugs
                </div>
              </div>
            </div>
          </div>

          {/* Quick Actions & Metrics */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* Quick Actions */}
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
              <div className="space-y-3">
                <Link
                  to={`/planning?projectId=${selectedProject.id}`}
                  className="flex items-center p-3 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors"
                >
                  <div className="flex-shrink-0 h-10 w-10 rounded-lg bg-indigo-600 flex items-center justify-center">
                    <span className="text-white text-xl">🎯</span>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-900">Planning Board</p>
                    <p className="text-xs text-gray-500">Kanban board for story management</p>
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
                    <p className="text-sm font-medium text-gray-900">Epics ({stats.totalEpics})</p>
                    <p className="text-xs text-gray-500">Manage project epics</p>
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
                    <p className="text-sm font-medium text-gray-900">Stories List</p>
                    <p className="text-xs text-gray-500">Filtered list view with search</p>
                  </div>
                </Link>
              </div>
            </div>

            {/* Project Metrics */}
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Project Metrics</h2>
              <div className="space-y-4">
                <Link
                  to={`/code-quality/${selectedProject.id}`}
                  className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:border-indigo-300 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center">
                    <CodeBracketIcon className="h-5 w-5 text-gray-400 mr-3" />
                    <span className="text-sm font-medium text-gray-900">Code Quality</span>
                  </div>
                  <span className="text-indigo-600">→</span>
                </Link>

                <Link
                  to={`/test-coverage/project/${selectedProject.id}`}
                  className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:border-indigo-300 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center">
                    <BeakerIcon className="h-5 w-5 text-gray-400 mr-3" />
                    <span className="text-sm font-medium text-gray-900">Test Coverage</span>
                  </div>
                  <span className="text-indigo-600">→</span>
                </Link>

                <Link
                  to={`/agent-performance/${selectedProject.id}`}
                  className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:border-indigo-300 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center">
                    <ChartBarIcon className="h-5 w-5 text-gray-400 mr-3" />
                    <span className="text-sm font-medium text-gray-900">Agent Performance</span>
                  </div>
                  <span className="text-indigo-600">→</span>
                </Link>
              </div>

              <div className="mt-6 pt-6 border-t border-gray-200">
                <h3 className="text-sm font-medium text-gray-700 mb-3">Project Info</h3>
                <dl className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <dt className="text-gray-500">Total Epics:</dt>
                    <dd className="font-medium text-gray-900">{stats.totalEpics}</dd>
                  </div>
                  <div className="flex justify-between text-sm">
                    <dt className="text-gray-500">Active Stories:</dt>
                    <dd className="font-medium text-gray-900">{stats.inProgressStories}</dd>
                  </div>
                  <div className="flex justify-between text-sm">
                    <dt className="text-gray-500">Bug Count:</dt>
                    <dd className="font-medium text-gray-900">{stats.bugCount}</dd>
                  </div>
                </dl>
              </div>
            </div>
          </div>

          {/* Info Panel */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-blue-900 mb-3">
              📚 Understanding the Views
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <h4 className="font-medium text-blue-900 mb-1">🎯 Planning Board</h4>
                <p className="text-blue-800">
                  Kanban-style board for visualizing story flow. Drag and drop stories between columns.
                  Create stories and bugs here.
                </p>
              </div>
              <div>
                <h4 className="font-medium text-blue-900 mb-1">🟣 Epics</h4>
                <p className="text-blue-800">
                  Large features or initiatives. Group related stories under epics to organize your work.
                </p>
              </div>
              <div>
                <h4 className="font-medium text-blue-900 mb-1">📖 Stories List</h4>
                <p className="text-blue-800">
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
