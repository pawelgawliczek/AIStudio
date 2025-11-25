import { CoordinatorMetrics as CoordinatorMetricsType } from '../../services/workflow-runs.service';

interface CoordinatorMetricsProps {
  metrics: CoordinatorMetricsType | undefined;
  totalWorkflowTokens?: number;
  totalWorkflowCost?: number;
}

export function CoordinatorMetrics({
  metrics,
  totalWorkflowTokens,
  totalWorkflowCost
}: CoordinatorMetricsProps) {
  // Handle missing metrics (pre-ST-17 workflows) - BR-5
  if (!metrics) {
    return (
      <div className="bg-card rounded-lg shadow p-6 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-xl">🤖</span>
          <h2 className="text-xl font-bold text-fg">Coordinator Overhead</h2>
        </div>
        <div className="text-sm text-muted p-4 bg-yellow-50 border border-yellow-200 rounded">
          Coordinator metrics not available for this workflow run.
          This workflow was executed before ST-17 (Nov 18, 2025) when coordinator metrics tracking was implemented.
        </div>
      </div>
    );
  }

  // Calculate percentages (BR-3, BR-6)
  const tokenPercentage = totalWorkflowTokens && metrics.totalTokens
    ? ((metrics.totalTokens / totalWorkflowTokens) * 100).toFixed(1)
    : null;

  const costPercentage = totalWorkflowCost && metrics.costUsd
    ? ((metrics.costUsd / totalWorkflowCost) * 100).toFixed(1)
    : null;

  return (
    <div className="bg-card rounded-lg shadow p-6 mb-6 border-l-4 border-purple-500">
      {/* Header - BR-1 Visual Separation */}
      <div className="flex items-center gap-2 mb-4">
        <span className="text-xl">🤖</span>
        <h2 className="text-xl font-bold text-fg">Coordinator Overhead</h2>
        <span className="text-xs text-muted ml-2">
          (Orchestration layer - decision-making, component spawning)
        </span>
      </div>

      {/* Metrics Grid - BR-2, BR-3, BR-4 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">

        {/* Token Metrics - BR-2 */}
        <div className="bg-purple-50 rounded-lg p-4">
          <div className="text-sm text-purple-600 font-medium">Total Tokens</div>
          <div className="text-2xl font-bold text-purple-900">
            {metrics.totalTokens?.toLocaleString() || 'N/A'}
          </div>
          <div className="text-xs text-muted mt-1">
            In: {metrics.tokensInput?.toLocaleString() || 0} |
            Out: {metrics.tokensOutput?.toLocaleString() || 0}
          </div>
          {tokenPercentage && (
            <div className="text-xs text-purple-600 mt-1 font-medium">
              {tokenPercentage}% of workflow
            </div>
          )}
        </div>

        {/* Cost Metrics - BR-3 */}
        <div className="bg-green-50 rounded-lg p-4">
          <div className="text-sm text-green-600 font-medium">Coordinator Cost</div>
          <div className="text-2xl font-bold text-green-900">
            ${metrics.costUsd?.toFixed(4) || '0.0000'}
          </div>
          <div className="text-xs text-muted mt-1">
            In: ${((metrics.tokensInput || 0) * 0.000003).toFixed(4)} |
            Out: ${((metrics.tokensOutput || 0) * 0.000015).toFixed(4)}
          </div>
          {costPercentage && (
            <div className="text-xs text-green-600 mt-1 font-medium">
              {costPercentage}% of workflow
            </div>
          )}
        </div>

        {/* Decision Metrics - BR-4 */}
        <div className="bg-blue-50 rounded-lg p-4">
          <div className="text-sm text-blue-600 font-medium">Tool Calls</div>
          <div className="text-2xl font-bold text-blue-900">
            {metrics.toolCalls || 0}
          </div>
          <div className="text-xs text-muted mt-1">
            Spawning, status updates, context
          </div>
        </div>

        {/* Iteration Metrics - BR-4 / ST-68 Enhanced */}
        <div className="bg-orange-50 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="text-sm text-orange-600 font-medium">Coordinator Prompts</div>
            <div
              className="text-orange-400 cursor-help"
              title="Includes human guidance + automated tool calls (component spawning, status checks)"
            >
              <svg className="w-4 h-4" width="16" height="16" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.5"/>
                <path d="M8 7V11M8 5.5V5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </div>
          </div>
          <div className="text-2xl font-bold text-orange-900">
            {metrics.userPrompts || 0}
          </div>
          <div className="text-xs text-muted mt-1">
            Iterations: {metrics.iterations || 0}
          </div>
        </div>
      </div>

      {/* Data Source Indicator */}
      <div className="mt-4 text-xs text-muted">
        <span>Metrics source: {metrics.dataSource || 'unknown'}</span>
        {/* ST-110: Removed transcriptPath display - now using /context command */}
      </div>
    </div>
  );
}
