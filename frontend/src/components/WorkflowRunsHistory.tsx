import { useQuery } from '@tanstack/react-query';
import { workflowRunsService } from '../services/workflow-runs.service';

interface WorkflowRunsHistoryProps {
  workflowId: string;
  projectId: string;
}

export function WorkflowRunsHistory({ workflowId, projectId }: WorkflowRunsHistoryProps) {
  const { data: runs = [], isLoading } = useQuery({
    queryKey: ['workflow-runs', workflowId],
    queryFn: () =>
      workflowRunsService.getAll(projectId, {
        workflowId,
        includeRelations: true,
      }),
  });

  // Count runs by status
  const completedCount = runs.filter((r) => r.status.toLowerCase() === 'completed').length;
  const failedCount = runs.filter((r) => r.status.toLowerCase() === 'failed').length;
  const runningCount = runs.filter((r) => r.status.toLowerCase() === 'running').length;

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 p-2">
        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600"></div>
        <span className="text-sm text-muted">Loading runs...</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-sm font-medium text-fg">
        {runs.length} {runs.length === 1 ? 'run' : 'runs'}
      </span>
      {completedCount > 0 && (
        <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-green-100 text-green-800 border border-green-200">
          {completedCount} completed
        </span>
      )}
      {failedCount > 0 && (
        <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-red-100 text-red-800 border border-red-200">
          {failedCount} failed
        </span>
      )}
      {runningCount > 0 && (
        <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-blue-100 text-blue-800 border border-blue-200">
          {runningCount} running
        </span>
      )}
    </div>
  );
}
