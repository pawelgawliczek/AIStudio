import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowBack } from '@mui/icons-material';
import { format } from 'date-fns';
import { testExecutionService } from '../services/test-execution.service';

export function TestExecutionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const {
    data: executionData,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['test-execution', id],
    queryFn: () => testExecutionService.getById(id!),
    enabled: !!id,
  });

  // Transform backend response to match component expectations
  const execution = executionData
    ? {
        ...executionData,
        testCaseKey: executionData.testCase.key,
        testCaseTitle: executionData.testCase.title,
        testLevel: executionData.testCase.testLevel,
      }
    : null;

  const getStatusBadge = (status?: string) => {
    const badges = {
      pass: { text: '✅ Passed', color: 'text-green-600 bg-green-50 border-green-200' },
      fail: { text: '❌ Failed', color: 'text-red-600 bg-red-50 border-red-200' },
      skip: { text: '⏭️ Skipped', color: 'text-yellow-600 bg-yellow-50 border-yellow-200' },
      error: { text: '⚠️ Error', color: 'text-orange-600 bg-orange-50 border-orange-200' },
    };
    return badges[status as keyof typeof badges] || badges.error;
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-6">
        <p className="text-muted">Loading test execution details...</p>
      </div>
    );
  }

  if (error || !execution) {
    return (
      <div className="container mx-auto px-4 py-6">
        <p className="text-red-600">Failed to load test execution details</p>
      </div>
    );
  }

  const statusBadge = getStatusBadge(execution.status);

  return (
    <div className="container mx-auto px-4 py-6">
      {/* Back button */}
      <button
        onClick={() => navigate('/test-executions')}
        className="inline-flex items-center gap-2 text-sm text-muted hover:text-fg mb-6 transition-colors"
      >
        <ArrowBack className="h-4 w-4" />
        Back to Test Executions
      </button>

      {/* Header */}
      <div className="bg-card rounded-lg shadow border border-border p-6 mb-6">
        <h1 className="text-2xl font-bold text-fg mb-2">Test Execution Report</h1>
        <h2 className="text-lg text-fg mb-4">
          {execution.testCaseKey}: {execution.testCaseTitle}
        </h2>
        <div>
          <span
            className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${statusBadge.color}`}
          >
            {statusBadge.text}
          </span>
        </div>
      </div>

      {/* Metadata */}
      <div className="bg-card rounded-lg shadow border border-border p-6 mb-6">
        <h3 className="text-lg font-semibold text-fg mb-4 border-b border-border pb-2">
          Metadata
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <span className="text-sm text-muted">Execution ID:</span>
            <p className="text-sm text-fg font-mono">{execution.id}</p>
          </div>
          <div>
            <span className="text-sm text-muted">Test Case:</span>
            <p className="text-sm text-fg">{execution.testCaseKey}</p>
          </div>
          <div>
            <span className="text-sm text-muted">Test Level:</span>
            <p className="text-sm text-fg capitalize">
              {execution.testLevel === 'e2e' ? 'End-to-End (E2E)' : execution.testLevel}
            </p>
          </div>
          {execution.story && (
            <div>
              <span className="text-sm text-muted">Story:</span>
              <p className="text-sm text-fg">
                {execution.story.key} ({execution.story.title})
              </p>
            </div>
          )}
          {execution.commit && (
            <div>
              <span className="text-sm text-muted">Commit:</span>
              <p className="text-sm text-fg font-mono">
                {execution.commit.hash} "{execution.commit.message}"
              </p>
            </div>
          )}
          <div>
            <span className="text-sm text-muted">Environment:</span>
            <p className="text-sm text-fg capitalize">{execution.environment}</p>
          </div>
          <div>
            <span className="text-sm text-muted">Executed At:</span>
            <p className="text-sm text-fg">
              {format(new Date(execution.executedAt), 'yyyy-MM-dd HH:mm:ss')} UTC
            </p>
          </div>
          <div>
            <span className="text-sm text-muted">Duration:</span>
            <p className="text-sm text-fg">{(execution.durationMs / 1000).toFixed(2)}s</p>
          </div>
          <div>
            <span className="text-sm text-muted">Status:</span>
            <p className="text-sm text-fg capitalize">{execution.status}</p>
          </div>
        </div>
      </div>

      {/* Error Details (if failed) */}
      {execution.status === 'fail' && execution.errorMessage && (
        <div className="bg-card rounded-lg shadow border border-border p-6 mb-6">
          <h3 className="text-lg font-semibold text-fg mb-4 border-b border-border pb-2">
            Error Details
          </h3>
          <div className="mb-4">
            <span className="text-sm text-muted">Error Message:</span>
            <p className="text-sm text-red-600 font-mono mt-1">{execution.errorMessage}</p>
          </div>
          {execution.stackTrace && (
            <div>
              <span className="text-sm text-muted">Stack Trace:</span>
              <pre className="mt-2 p-4 bg-bg-secondary rounded border border-border text-xs text-fg overflow-x-auto font-mono">
                {execution.stackTrace}
              </pre>
            </div>
          )}
        </div>
      )}

      {/* Coverage Metrics */}
      {execution.coveragePercentage != null && (
        <div className="bg-card rounded-lg shadow border border-border p-6 mb-6">
          <h3 className="text-lg font-semibold text-fg mb-4 border-b border-border pb-2">
            Coverage Metrics
          </h3>
          <div className="space-y-3">
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-sm text-muted">Line Coverage:</span>
                <span className="text-sm text-fg font-medium">
                  {execution.coveragePercentage.toFixed(1)}%{' '}
                  {execution.linesCovered !== undefined && execution.linesTotal !== undefined && (
                    <span className="text-muted">
                      ({execution.linesCovered} / {execution.linesTotal} lines)
                    </span>
                  )}
                </span>
              </div>
              <div className="w-full bg-bg-secondary rounded-full h-2">
                <div
                  className="bg-green-600 h-2 rounded-full transition-all"
                  style={{ width: `${execution.coveragePercentage}%` }}
                ></div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="bg-card rounded-lg shadow border border-border p-6">
        <h3 className="text-lg font-semibold text-fg mb-4 border-b border-border pb-2">
          Actions
        </h3>
        <div className="flex flex-wrap gap-3">
          <button
            className="px-4 py-2 border border-border rounded-lg text-sm font-medium text-fg bg-card hover:bg-bg-secondary transition-colors"
            onClick={() => alert('Rerun Test - Not implemented yet')}
          >
            Rerun Test
          </button>
          {execution.status === 'fail' && (
            <button
              className="px-4 py-2 border border-border rounded-lg text-sm font-medium text-fg bg-card hover:bg-bg-secondary transition-colors"
              onClick={() => alert('Create Bug Story - Not implemented yet')}
            >
              Create Bug Story
            </button>
          )}
          <button
            className="px-4 py-2 border border-border rounded-lg text-sm font-medium text-fg bg-card hover:bg-bg-secondary transition-colors"
            onClick={() => alert('View Related Executions - Not implemented yet')}
          >
            View Related Executions
          </button>
        </div>
      </div>
    </div>
  );
}
