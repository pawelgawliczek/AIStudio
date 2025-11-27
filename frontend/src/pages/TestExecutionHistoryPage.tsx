import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Refresh as RefreshIcon } from '@mui/icons-material';
import toast from 'react-hot-toast';
import { useProject } from '../context/ProjectContext';
import { LiveActivityFeed } from '../components/test-execution/LiveActivityFeed';
import { TestExecutionTable } from '../components/test-execution/TestExecutionTable';
import {
  useTestExecutionWebSocket,
  TestExecutionEvent,
} from '../hooks/useTestExecutionWebSocket';

// MOCK DATA - Backend GET endpoints not implemented yet
const mockExecutions: Array<{
  id: string;
  testCaseKey: string;
  testCaseTitle: string;
  testLevel: string;
  status: 'pass' | 'fail' | 'skip' | 'error';
  durationMs: number;
  executedAt: string;
  environment: string;
  coveragePercentage?: number;
  errorMessage?: string;
}> = [
  {
    id: 'exec-1',
    testCaseKey: 'TC-AUTH-001',
    testCaseTitle: 'User login with valid credentials',
    testLevel: 'integration',
    status: 'pass' as const,
    durationMs: 1250,
    executedAt: new Date().toISOString(),
    environment: 'docker',
    coveragePercentage: 85.4,
  },
  {
    id: 'exec-2',
    testCaseKey: 'TC-AUTH-002',
    testCaseTitle: 'User login with invalid password',
    testLevel: 'integration',
    status: 'pass' as const,
    durationMs: 980,
    executedAt: new Date(Date.now() - 3600000).toISOString(),
    environment: 'docker',
    coveragePercentage: 82.1,
  },
  {
    id: 'exec-3',
    testCaseKey: 'TC-EXEC-001',
    testCaseTitle: 'Execute story with valid workflow',
    testLevel: 'unit',
    status: 'fail' as const,
    durationMs: 2340,
    executedAt: new Date(Date.now() - 7200000).toISOString(),
    environment: 'docker',
    errorMessage: 'Expected workflowId to be defined',
    coveragePercentage: 78.9,
  },
];

export function TestExecutionHistoryPage() {
  const navigate = useNavigate();
  const { selectedProject } = useProject();
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [testLevelFilter, setTestLevelFilter] = useState<string>('all');
  const [liveActivity, setLiveActivity] = useState<TestExecutionEvent[]>([]);

  // MOCK QUERY - Replace with real API call when backend is ready
  const {
    data: executionsResponse,
    isLoading,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ['test-executions', selectedProject?.id, statusFilter, testLevelFilter, page, rowsPerPage],
    queryFn: async () => {
      // Simulate API delay
      await new Promise((resolve) => setTimeout(resolve, 300));

      let filtered = mockExecutions;

      if (statusFilter !== 'all') {
        filtered = filtered.filter((e) => e.status === statusFilter);
      }

      if (testLevelFilter !== 'all') {
        filtered = filtered.filter((e) => e.testLevel === testLevelFilter);
      }

      return {
        data: filtered,
        total: filtered.length,
      };
    },
    enabled: !!selectedProject,
  });

  const executions = executionsResponse?.data || [];
  const total = executionsResponse?.total || 0;
  const totalPages = Math.ceil(total / rowsPerPage);

  // WebSocket handlers
  const handleTestStarted = useCallback((event: TestExecutionEvent) => {
    setLiveActivity((prev) => [event, ...prev].slice(0, 10));
    toast(`🧪 Test started: ${event.testCaseKey}`, {
      duration: 3000,
      position: 'bottom-right',
    });
  }, []);

  const handleTestCompleted = useCallback(
    (event: TestExecutionEvent) => {
      setLiveActivity((prev) =>
        prev.map((item) => (item.executionId === event.executionId ? event : item))
      );

      // Show toast notification with action
      const icon = event.status === 'pass' ? '✅' : event.status === 'fail' ? '❌' : '⏭️';
      toast.custom(
        (t) => (
          <div
            className={`${
              t.visible ? 'animate-enter' : 'animate-leave'
            } max-w-md w-full bg-card shadow-lg rounded-lg pointer-events-auto flex ring-1 ring-border`}
          >
            <div className="flex-1 w-0 p-4">
              <div className="flex items-start">
                <div className="flex-shrink-0 pt-0.5">
                  <span className="text-2xl">{icon}</span>
                </div>
                <div className="ml-3 flex-1">
                  <p className="text-sm font-medium text-fg">
                    Test{' '}
                    {event.status === 'pass'
                      ? 'Passed'
                      : event.status === 'fail'
                      ? 'Failed'
                      : 'Completed'}
                  </p>
                  <p className="mt-1 text-sm text-muted">
                    {event.testCaseKey}: {event.testCaseTitle}
                  </p>
                  {event.durationMs !== undefined && (
                    <p className="mt-1 text-xs text-muted">
                      Duration: {(event.durationMs / 1000).toFixed(2)}s
                      {event.coveragePercentage &&
                        ` | Coverage: ${event.coveragePercentage.toFixed(1)}%`}
                    </p>
                  )}
                </div>
              </div>
            </div>
            <div className="flex border-l border-border">
              <button
                onClick={() => {
                  navigate(event.reportUrl || `/test-executions/${event.executionId}`);
                  toast.dismiss(t.id);
                }}
                className="w-full border border-transparent rounded-none rounded-r-lg p-4 flex items-center justify-center text-sm font-medium text-accent hover:text-accent-hover focus:outline-none"
              >
                View Report
              </button>
            </div>
            <div className="flex border-l border-border">
              <button
                onClick={() => toast.dismiss(t.id)}
                className="w-full border border-transparent rounded-none rounded-r-lg p-4 flex items-center justify-center text-sm font-medium text-muted hover:text-fg focus:outline-none"
              >
                Dismiss
              </button>
            </div>
          </div>
        ),
        { duration: 10000 }
      );

      // Refetch the list to include the new execution
      refetch();
    },
    [navigate, refetch]
  );

  useTestExecutionWebSocket({
    onTestStarted: handleTestStarted,
    onTestCompleted: handleTestCompleted,
  });

  const hasActiveFilters = statusFilter !== 'all' || testLevelFilter !== 'all';

  const clearFilters = () => {
    setStatusFilter('all');
    setTestLevelFilter('all');
    setPage(0);
  };

  if (!selectedProject) {
    return (
      <div className="container mx-auto px-4 py-6">
        <div className="bg-card rounded-lg shadow p-6 border border-border">
          <p className="text-muted">Please select a project to view test executions.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-fg">Test Execution History</h1>
          <p className="mt-1 text-sm text-muted">
            Real-time test execution tracking and reporting
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

      {/* Live Activity Feed */}
      <div className="mb-6">
        <LiveActivityFeed items={liveActivity} autoScroll={true} />
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-fg">Status:</label>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(0);
            }}
            className="px-3 py-2 border border-border rounded-lg bg-card text-fg focus:ring-2 focus:ring-ring focus:border-accent"
          >
            <option value="all">All Statuses</option>
            <option value="pass">Pass</option>
            <option value="fail">Fail</option>
            <option value="skip">Skip</option>
            <option value="error">Error</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-fg">Test Level:</label>
          <select
            value={testLevelFilter}
            onChange={(e) => {
              setTestLevelFilter(e.target.value);
              setPage(0);
            }}
            className="px-3 py-2 border border-border rounded-lg bg-card text-fg focus:ring-2 focus:ring-ring focus:border-accent"
          >
            <option value="all">All Levels</option>
            <option value="unit">Unit</option>
            <option value="integration">Integration</option>
            <option value="e2e">E2E</option>
          </select>
        </div>

        {hasActiveFilters && (
          <button onClick={clearFilters} className="text-sm text-muted hover:text-fg underline">
            Clear filters
          </button>
        )}
      </div>

      {/* Results count */}
      <div className="mb-4 text-sm text-muted">
        {isLoading ? (
          <span>Loading test executions...</span>
        ) : (
          <span>
            Found {total} test execution{total !== 1 ? 's' : ''}
            {hasActiveFilters && ' matching filters'}
          </span>
        )}
      </div>

      {/* Table */}
      <TestExecutionTable
        executions={executions}
        isLoading={isLoading}
        emptyMessage={
          hasActiveFilters
            ? 'No test executions match your filters'
            : 'No test executions found'
        }
      />

      {/* Pagination */}
      {executions.length > 0 && (
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
                <span className="font-medium">{Math.min((page + 1) * rowsPerPage, total)}</span> of{' '}
                <span className="font-medium">{total}</span> results
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
