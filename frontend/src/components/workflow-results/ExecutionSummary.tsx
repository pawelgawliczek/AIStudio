import { WorkflowRunResults, RunStatus } from '../../services/workflow-runs.service';
import { CoordinatorMetrics } from './CoordinatorMetrics';

interface ExecutionSummaryProps {
  results: WorkflowRunResults;
}

export function ExecutionSummary({ results }: ExecutionSummaryProps) {
  const { workflowRun, summary, efficiency } = results;

  const getStatusColor = (status: RunStatus) => {
    switch (status) {
      case RunStatus.COMPLETED:
        return 'text-green-600 bg-green-100';
      case RunStatus.RUNNING:
        return 'text-accent bg-blue-100';
      case RunStatus.FAILED:
        return 'text-red-600 bg-red-100';
      case RunStatus.CANCELLED:
        return 'text-muted bg-gray-100';
      default:
        return 'text-yellow-600 bg-yellow-100';
    }
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return 'N/A';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${minutes}min`;
    }
    return `${minutes}min`;
  };

  const formatNumber = (num?: number) => {
    if (num === undefined || num === null) return 'N/A';
    return num.toLocaleString();
  };

  const formatCost = (cost?: number) => {
    if (cost === undefined || cost === null) return 'N/A';
    return `$${cost.toFixed(2)}`;
  };

  return (
    <>
      {/* Coordinator Metrics Section - Shows BEFORE ExecutionSummary */}
      <CoordinatorMetrics
        metrics={workflowRun.coordinatorMetrics}
        totalWorkflowTokens={summary.totalTokens}
        totalWorkflowCost={summary.estimatedCost}
      />

      {/* Existing ExecutionSummary */}
      <div className="bg-card rounded-lg shadow p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-fg">Execution Summary</h2>
        <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(workflowRun.status)}`}>
          {workflowRun.status === RunStatus.COMPLETED ? '✓ ' : ''}
          {workflowRun.status}
        </span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-bg-secondary rounded-lg p-4">
          <div className="text-sm text-muted">Duration</div>
          <div className="text-2xl font-bold text-fg">
            {formatDuration(summary.totalDuration)}
          </div>
        </div>

        <div className="bg-bg-secondary rounded-lg p-4">
          <div className="text-sm text-muted">Total Tokens</div>
          <div className="text-2xl font-bold text-fg">
            {formatNumber(summary.totalTokens)}
          </div>
          <div className="text-xs text-muted mt-1">
            In: {formatNumber(workflowRun.totalTokensInput)} | Out: {formatNumber(workflowRun.totalTokensOutput)}
          </div>
        </div>

        <div className="bg-bg-secondary rounded-lg p-4">
          <div className="text-sm text-muted">LOC Generated</div>
          <div className="text-2xl font-bold text-fg">
            {formatNumber(summary.totalLoc)}
          </div>
        </div>

        <div className="bg-bg-secondary rounded-lg p-4">
          <div className="text-sm text-muted">Estimated Cost</div>
          <div className="text-2xl font-bold text-fg">
            {formatCost(summary.estimatedCost)}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div className="border-l-4 border-accent pl-4">
          <div className="text-sm text-muted">Component Runs</div>
          <div className="text-xl font-semibold text-fg">
            {summary.totalComponentRuns}
            <span className="text-sm text-green-600 ml-2">
              ({summary.successfulRuns} success)
            </span>
          </div>
        </div>

        <div className="border-l-4 border-purple-500 pl-4">
          <div className="text-sm text-muted">Total Iterations</div>
          <div className="text-xl font-semibold text-fg">
            {formatNumber(summary.totalIterations)}
          </div>
          <div className="text-xs text-muted">prompts</div>
        </div>

        <div className="border-l-4 border-orange-500 pl-4">
          <div className="text-sm text-muted">Avg Prompts/Component</div>
          <div className="text-xl font-semibold text-fg">
            {workflowRun.avgPromptsPerComponent?.toFixed(1) || 'N/A'}
          </div>
        </div>
      </div>

      {/* Efficiency Metrics */}
      {efficiency && (
        <div className="mt-6 pt-6 border-t border-border">
          <h3 className="text-lg font-semibold text-fg mb-3">Efficiency Metrics</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-blue-50 rounded p-3">
              <div className="text-xs text-accent font-medium">Tokens/LOC</div>
              <div className="text-lg font-bold text-blue-900">{efficiency.tokensPerLoc || 'N/A'}</div>
            </div>
            <div className="bg-green-50 rounded p-3">
              <div className="text-xs text-green-600 font-medium">LOC/Prompt</div>
              <div className="text-lg font-bold text-green-900">{efficiency.locPerPrompt || 'N/A'}</div>
            </div>
            <div className="bg-purple-50 rounded p-3">
              <div className="text-xs text-purple-600 font-medium">Runtime/LOC (sec)</div>
              <div className="text-lg font-bold text-purple-900">{efficiency.runtimePerLoc || 'N/A'}</div>
            </div>
            <div className="bg-orange-50 rounded p-3">
              <div className="text-xs text-orange-600 font-medium">Runtime/Token (sec)</div>
              <div className="text-lg font-bold text-orange-900">{efficiency.runtimePerToken || 'N/A'}</div>
            </div>
          </div>
        </div>
      )}

      {/* Error Message */}
      {workflowRun.errorMessage && (
        <div className="mt-4 p-4 bg-red-100/50 border border-red-200 rounded">
          <div className="flex items-start">
            <span className="text-red-600 font-medium mr-2">Error:</span>
            <span className="text-red-800">{workflowRun.errorMessage}</span>
          </div>
        </div>
      )}
      </div>
    </>
  );
}
