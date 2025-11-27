import { useNavigate } from 'react-router-dom';
import { Deployment, DeploymentStatus } from '../services/deployments.service';

interface DeploymentsTableProps {
  deployments: Deployment[];
  isLoading?: boolean;
  showStoryColumn?: boolean;
  compact?: boolean;
  emptyMessage?: string;
}

export function DeploymentsTable({
  deployments,
  isLoading = false,
  showStoryColumn = true,
  compact = false,
  emptyMessage = 'No deployments found',
}: DeploymentsTableProps) {
  const navigate = useNavigate();

  const getStatusColor = (status: DeploymentStatus) => {
    switch (status) {
      case 'deployed':
        return 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300';
      case 'failed':
        return 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300';
      case 'rolled_back':
        return 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300';
      case 'deploying':
        return 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300';
      case 'pending':
        return 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-300';
      case 'approved':
        return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300';
      default:
        return 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-300';
    }
  };

  const getStatusIcon = (status: DeploymentStatus) => {
    switch (status) {
      case 'deployed':
        return '✓';
      case 'failed':
        return '✗';
      case 'rolled_back':
        return '↺';
      case 'deploying':
        return '⟳';
      case 'pending':
        return '○';
      case 'approved':
        return '✓';
      default:
        return '•';
    }
  };

  const formatDuration = (ms: number | null) => {
    if (!ms) return '-';
    const seconds = Math.floor(ms / 1000);
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  const formatRelativeTime = (dateString: string | null) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min${diffMins !== 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
    return date.toLocaleDateString();
  };

  const formatDateTime = (dateString: string | null) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString();
  };

  const handleRowClick = (deployment: Deployment) => {
    if (deployment.storyKey) {
      navigate(`/stories/${deployment.storyKey}`);
    }
  };

  if (isLoading) {
    return (
      <div className="bg-card rounded-lg shadow border border-border overflow-hidden">
        <div className="flex justify-center items-center p-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-fg"></div>
        </div>
      </div>
    );
  }

  if (deployments.length === 0) {
    return (
      <div className="bg-card rounded-lg shadow border border-border overflow-hidden">
        <div className="p-12 text-center">
          <svg
            className="mx-auto h-12 w-12 text-muted"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
            />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-fg">{emptyMessage}</h3>
          <p className="mt-1 text-sm text-muted">
            Deployments will appear here once stories are deployed.
          </p>
        </div>
      </div>
    );
  }

  // Compact mode for dashboard widget
  if (compact) {
    return (
      <div className="divide-y divide-border">
        {deployments.map((deployment) => (
          <div
            key={deployment.id}
            onClick={() => handleRowClick(deployment)}
            className="flex items-center gap-3 py-2 px-1 hover:bg-bg-secondary cursor-pointer transition-colors"
          >
            <span
              className={`flex-shrink-0 w-6 h-6 flex items-center justify-center text-xs font-medium rounded-full ${getStatusColor(deployment.status)}`}
            >
              {getStatusIcon(deployment.status)}
            </span>
            <span className="text-sm font-medium text-fg truncate">
              {deployment.storyKey || '-'}
            </span>
            <span className="text-sm text-muted truncate flex-1">
              {deployment.storyTitle || '-'}
            </span>
            <span className="text-xs text-muted flex-shrink-0">
              {deployment.environment === 'production' ? 'prod' : deployment.environment}
            </span>
            <span className="text-xs text-muted flex-shrink-0">
              {formatRelativeTime(deployment.completedAt || deployment.createdAt)}
            </span>
          </div>
        ))}
      </div>
    );
  }

  // Full table mode
  return (
    <div className="bg-card rounded-lg shadow border border-border overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-border">
          <thead className="bg-bg-secondary">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">
                Status
              </th>
              {showStoryColumn && (
                <>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">
                    Story
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">
                    Title
                  </th>
                </>
              )}
              <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">
                Environment
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">
                Deployed By
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">
                Duration
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">
                Completed
              </th>
            </tr>
          </thead>
          <tbody className="bg-card divide-y divide-border">
            {deployments.map((deployment) => (
              <tr
                key={deployment.id}
                onClick={() => handleRowClick(deployment)}
                className="hover:bg-bg-secondary cursor-pointer transition-colors"
              >
                <td className="px-6 py-4 whitespace-nowrap">
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(deployment.status)}`}
                  >
                    <span>{getStatusIcon(deployment.status)}</span>
                    <span className="capitalize">{deployment.status.replace('_', ' ')}</span>
                  </span>
                </td>
                {showStoryColumn && (
                  <>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-fg">
                      {deployment.storyKey || '-'}
                    </td>
                    <td className="px-6 py-4 text-sm text-muted max-w-xs truncate">
                      {deployment.storyTitle || '-'}
                    </td>
                  </>
                )}
                <td className="px-6 py-4 whitespace-nowrap">
                  <span
                    className={`px-2 py-1 text-xs font-medium rounded ${
                      deployment.environment === 'production'
                        ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300'
                        : 'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-800 dark:text-cyan-300'
                    }`}
                  >
                    {deployment.environment}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-muted">
                  {deployment.deployedBy || '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-muted">
                  {formatDuration(deployment.duration)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-muted">
                  {formatRelativeTime(deployment.completedAt)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
