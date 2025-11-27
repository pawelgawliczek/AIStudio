import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Refresh as RefreshIcon } from '@mui/icons-material';
import {
  deploymentsService,
  Deployment,
  DeploymentStatus,
} from '../services/deployments.service';
import { DeploymentsTable } from '../components/DeploymentsTable';

export function DeploymentHistoryPage() {
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [statusFilter, setStatusFilter] = useState<DeploymentStatus | 'all'>('all');
  const [environmentFilter, setEnvironmentFilter] = useState<string>('all');

  const {
    data: deploymentsResponse,
    isLoading,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ['deployments', statusFilter, environmentFilter, page, rowsPerPage],
    queryFn: () =>
      deploymentsService.getAll({
        status: statusFilter === 'all' ? undefined : statusFilter,
        environment: environmentFilter === 'all' ? undefined : environmentFilter,
        limit: rowsPerPage,
        offset: page * rowsPerPage,
      }),
  });

  const deployments = deploymentsResponse?.data || [];
  const total = deploymentsResponse?.total || 0;
  const totalPages = Math.ceil(total / rowsPerPage);

  const hasActiveFilters = statusFilter !== 'all' || environmentFilter !== 'all';

  const clearFilters = () => {
    setStatusFilter('all');
    setEnvironmentFilter('all');
    setPage(0);
  };

  return (
    <div className="container mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-fg">Deployments</h1>
          <p className="mt-1 text-sm text-muted">
            View deployment history across all stories and environments
          </p>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="inline-flex items-center gap-2 px-4 py-2 border border-border rounded-lg text-sm font-medium text-fg bg-card hover:bg-bg-secondary disabled:opacity-50 transition-colors"
        >
          <RefreshIcon className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-fg">Status:</label>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as DeploymentStatus | 'all');
              setPage(0);
            }}
            className="px-3 py-2 border border-border rounded-lg bg-card text-fg focus:ring-2 focus:ring-ring focus:border-accent"
          >
            <option value="all">All Statuses</option>
            <option value="deployed">Deployed</option>
            <option value="failed">Failed</option>
            <option value="rolled_back">Rolled Back</option>
            <option value="deploying">Deploying</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-fg">Environment:</label>
          <select
            value={environmentFilter}
            onChange={(e) => {
              setEnvironmentFilter(e.target.value);
              setPage(0);
            }}
            className="px-3 py-2 border border-border rounded-lg bg-card text-fg focus:ring-2 focus:ring-ring focus:border-accent"
          >
            <option value="all">All Environments</option>
            <option value="production">Production</option>
            <option value="test">Test</option>
          </select>
        </div>

        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="text-sm text-muted hover:text-fg underline"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Results count */}
      <div className="mb-4 text-sm text-muted">
        {isLoading ? (
          <span>Loading deployments...</span>
        ) : (
          <span>
            Found {total} deployment{total !== 1 ? 's' : ''}
            {hasActiveFilters && ' matching filters'}
          </span>
        )}
      </div>

      {/* Table */}
      <DeploymentsTable
        deployments={deployments}
        isLoading={isLoading}
        showStoryColumn={true}
        emptyMessage={
          hasActiveFilters
            ? 'No deployments match your filters'
            : 'No deployments found'
        }
      />

      {/* Pagination */}
      {deployments.length > 0 && (
        <div className="mt-4 bg-card rounded-lg shadow border border-border px-4 py-3 flex items-center justify-between sm:px-6">
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
                  {Math.min((page + 1) * rowsPerPage, total)}
                </span>{' '}
                of <span className="font-medium">{total}</span> results
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
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>
              <nav
                className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px"
                aria-label="Pagination"
              >
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
      )}
    </div>
  );
}
