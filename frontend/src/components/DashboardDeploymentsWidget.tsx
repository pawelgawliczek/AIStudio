import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { deploymentsService } from '../services/deployments.service';
import { DeploymentsTable } from './DeploymentsTable';

export function DashboardDeploymentsWidget() {
  const navigate = useNavigate();

  const { data: stats, isLoading } = useQuery({
    queryKey: ['deployment-stats'],
    queryFn: () => deploymentsService.getStats(),
    refetchInterval: 60000, // Refresh every minute
  });

  return (
    <div className="bg-card rounded-lg shadow border border-border overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <h3 className="text-lg font-semibold text-fg">Recent Deployments</h3>
        <button
          onClick={() => navigate('/deployments')}
          className="text-sm text-accent hover:text-accent/80 font-medium"
        >
          View All →
        </button>
      </div>

      {/* Content */}
      <div className="p-4">
        {isLoading ? (
          <div className="flex justify-center items-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-fg"></div>
          </div>
        ) : stats?.recentDeployments && stats.recentDeployments.length > 0 ? (
          <DeploymentsTable
            deployments={stats.recentDeployments}
            compact={true}
            showStoryColumn={true}
          />
        ) : (
          <div className="text-center py-8">
            <svg
              className="mx-auto h-10 w-10 text-muted"
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
            <p className="mt-2 text-sm text-muted">No deployments yet</p>
          </div>
        )}
      </div>

      {/* Footer Stats */}
      {stats && stats.todayCount > 0 && (
        <div className="px-4 py-3 bg-bg-secondary border-t border-border">
          <p className="text-sm text-muted">
            Today:{' '}
            <span className="text-green-600 dark:text-green-400 font-medium">
              {stats.todaySuccessCount} deployed
            </span>
            {stats.todayFailedCount > 0 && (
              <>
                {' · '}
                <span className="text-red-600 dark:text-red-400 font-medium">
                  {stats.todayFailedCount} failed
                </span>
              </>
            )}
          </p>
        </div>
      )}
    </div>
  );
}
