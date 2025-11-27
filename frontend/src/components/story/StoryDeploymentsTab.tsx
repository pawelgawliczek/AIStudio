import { useQuery } from '@tanstack/react-query';
import { Refresh as RefreshIcon } from '@mui/icons-material';
import { deploymentsService } from '../../services/deployments.service';
import { DeploymentsTable } from '../DeploymentsTable';

interface StoryDeploymentsTabProps {
  storyId: string;
}

export function StoryDeploymentsTab({ storyId }: StoryDeploymentsTabProps) {
  const {
    data: deploymentsResponse,
    isLoading,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ['story-deployments', storyId],
    queryFn: () => deploymentsService.getByStoryId(storyId),
    enabled: !!storyId,
  });

  const deployments = deploymentsResponse?.data || [];
  const successCount = deploymentsResponse?.successCount || 0;
  const failedCount = deploymentsResponse?.failedCount || 0;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-fg">Deployment History</h2>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="inline-flex items-center gap-2 px-3 py-1.5 border border-border rounded-lg text-sm font-medium text-fg bg-card hover:bg-bg-secondary disabled:opacity-50 transition-colors"
        >
          <RefreshIcon className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Table */}
      <DeploymentsTable
        deployments={deployments}
        isLoading={isLoading}
        showStoryColumn={false}
        emptyMessage="No deployments for this story"
      />

      {/* Summary */}
      {deployments.length > 0 && (
        <div className="mt-4 text-sm text-muted">
          Total: {deployments.length} deployment{deployments.length !== 1 ? 's' : ''} (
          <span className="text-green-600 dark:text-green-400">{successCount} successful</span>
          {failedCount > 0 && (
            <>
              , <span className="text-red-600 dark:text-red-400">{failedCount} failed</span>
            </>
          )}
          )
        </div>
      )}
    </div>
  );
}
