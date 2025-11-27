import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { workflowRunsService, WorkflowRun } from '../services/workflow-runs.service';

interface WorkflowRunsTableProps {
  projectId: string;
  workflows: Array<{ id: string; name: string }>;
  versionFilter?: string; // 'latest', 'all', or specific version like 'v1.2'
}

export function WorkflowRunsTable({ projectId, workflows, versionFilter }: WorkflowRunsTableProps) {
  const navigate = useNavigate();
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [selectedWorkflow, setSelectedWorkflow] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('');

  const { data: allRuns = [], isLoading } = useQuery({
    queryKey: ['workflow-runs-all', projectId],
    queryFn: () =>
      workflowRunsService.getAll(projectId, {
        includeRelations: true,
      }),
  });

  // Apply filters
  const filteredRuns = allRuns.filter((run) => {
    if (selectedWorkflow !== 'all' && run.workflowId !== selectedWorkflow) return false;
    if (selectedStatus !== 'all' && run.status.toLowerCase() !== selectedStatus.toLowerCase()) return false;
    if (dateFilter) {
      const runDate = new Date(run.startedAt).toISOString().split('T')[0];
      if (runDate !== dateFilter) return false;
    }
    // Version filter (AC7)
    if (versionFilter && versionFilter !== 'all') {
      if (versionFilter === 'latest') {
        // Filter to latest version only - need to determine latest version per workflow
        // For single workflow detail page, this works. For multi-workflow, might need refinement
        const latestVersion = run.workflow?.version;
        // Find the highest version in all runs for this workflow
        const workflowRuns = allRuns.filter(r => r.workflowId === run.workflowId);
        const versions = workflowRuns.map(r => r.workflow?.version).filter(Boolean);
        const maxVersion = versions.sort().reverse()[0];
        if (latestVersion !== maxVersion) return false;
      } else {
        // Filter by specific version
        if (run.workflow?.version !== versionFilter) return false;
      }
    }
    return true;
  });

  // Pagination
  const totalPages = Math.ceil(filteredRuns.length / rowsPerPage);
  const paginatedRuns = filteredRuns.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'running':
        return 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300';
      case 'completed':
        return 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300';
      case 'failed':
        return 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300';
      case 'cancelled':
        return 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-300';
      default:
        return 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-300';
    }
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '-';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  const formatCost = (cost?: number) => {
    if (cost === null || cost === undefined) return '-';
    return `$${cost.toFixed(4)}`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  return (
    <div className="mt-8">
      <h2 className="text-2xl font-bold text-fg mb-4">All Workflow Runs</h2>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-fg">Workflow:</label>
          <select
            value={selectedWorkflow}
            onChange={(e) => {
              setSelectedWorkflow(e.target.value);
              setPage(0);
            }}
            className="px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-ring focus:border-accent"
          >
            <option value="all">All Workflows</option>
            {workflows.map((workflow) => (
              <option key={workflow.id} value={workflow.id}>
                {workflow.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-fg">Status:</label>
          <select
            value={selectedStatus}
            onChange={(e) => {
              setSelectedStatus(e.target.value);
              setPage(0);
            }}
            className="px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-ring focus:border-accent"
          >
            <option value="all">All Statuses</option>
            <option value="running">Running</option>
            <option value="completed">Completed</option>
            <option value="failed">Failed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-fg">Date:</label>
          <input
            type="date"
            value={dateFilter}
            onChange={(e) => {
              setDateFilter(e.target.value);
              setPage(0);
            }}
            className="px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-ring focus:border-accent"
          />
        </div>

        {(selectedWorkflow !== 'all' || selectedStatus !== 'all' || dateFilter) && (
          <button
            onClick={() => {
              setSelectedWorkflow('all');
              setSelectedStatus('all');
              setDateFilter('');
              setPage(0);
            }}
            className="text-sm text-muted hover:text-fg underline"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Results count */}
      <div className="mb-4 text-sm text-muted">
        {isLoading ? (
          <span>Loading runs...</span>
        ) : (
          <span>
            Found {filteredRuns.length} run{filteredRuns.length !== 1 ? 's' : ''}
            {(selectedWorkflow !== 'all' || selectedStatus !== 'all' || dateFilter) && ' matching filters'}
          </span>
        )}
      </div>

      {/* Table */}
      <div className="bg-card rounded-lg shadow border border-border overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center items-center p-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-fg"></div>
          </div>
        ) : filteredRuns.length === 0 ? (
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
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
              />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-fg">No workflow runs found</h3>
            <p className="mt-1 text-sm text-muted">
              {selectedWorkflow !== 'all' || selectedStatus !== 'all' || dateFilter
                ? 'Try adjusting your filters.'
                : 'No runs have been executed yet.'}
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-border">
                <thead className="bg-bg-secondary">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">
                      Workflow
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">
                      Started
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">
                      Duration
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">
                      Tokens
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">
                      Cost
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">
                      Story
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-card divide-y divide-border">
                  {paginatedRuns.map((run) => (
                    <tr
                      key={run.id}
                      onClick={() => navigate(`/workflow-runs/${run.id}/monitor`)}
                      className="hover:bg-bg-secondary cursor-pointer transition-colors"
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(run.status)}`}>
                          {run.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-fg">
                        {run.workflow?.name || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-muted">
                        {formatDate(run.startedAt)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-muted">
                        {formatDuration(run.durationSeconds)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-muted">
                        {run.totalTokens?.toLocaleString() || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-muted">
                        {formatCost(run.estimatedCost)}
                      </td>
                      <td className="px-6 py-4 text-sm text-muted max-w-xs truncate">
                        {run.story ? `${run.story.key}: ${run.story.title}` : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="bg-card px-4 py-3 flex items-center justify-between border-t border-border sm:px-6">
              <div className="flex-1 flex justify-between sm:hidden">
                <button
                  onClick={() => setPage(Math.max(0, page - 1))}
                  disabled={page === 0}
                  className="relative inline-flex items-center px-4 py-2 border border-border text-sm font-medium rounded-md text-fg bg-card hover:bg-bg-secondary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
                  disabled={page >= totalPages - 1}
                  className="ml-3 relative inline-flex items-center px-4 py-2 border border-border text-sm font-medium rounded-md text-fg bg-card hover:bg-bg-secondary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
              <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm text-muted">
                    Showing <span className="font-medium">{page * rowsPerPage + 1}</span> to{' '}
                    <span className="font-medium">
                      {Math.min((page + 1) * rowsPerPage, filteredRuns.length)}
                    </span>{' '}
                    of <span className="font-medium">{filteredRuns.length}</span> results
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <label className="text-sm text-muted">Rows per page:</label>
                    <select
                      value={rowsPerPage}
                      onChange={(e) => {
                        setRowsPerPage(Number(e.target.value));
                        setPage(0);
                      }}
                      className="px-2 py-1 border border-border rounded-md text-sm bg-card text-fg"
                    >
                      <option value={5}>5</option>
                      <option value={10}>10</option>
                      <option value={25}>25</option>
                      <option value={50}>50</option>
                    </select>
                  </div>
                  <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                    <button
                      onClick={() => setPage(Math.max(0, page - 1))}
                      disabled={page === 0}
                      className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-border bg-card text-sm font-medium text-muted hover:bg-bg-secondary disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <span className="sr-only">Previous</span>
                      <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path
                          fillRule="evenodd"
                          d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </button>
                    <span className="relative inline-flex items-center px-4 py-2 border border-border bg-card text-sm font-medium text-fg">
                      Page {page + 1} of {totalPages || 1}
                    </span>
                    <button
                      onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
                      disabled={page >= totalPages - 1}
                      className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-border bg-card text-sm font-medium text-muted hover:bg-bg-secondary disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <span className="sr-only">Next</span>
                      <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path
                          fillRule="evenodd"
                          d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </button>
                  </nav>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
