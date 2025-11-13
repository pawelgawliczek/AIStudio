import { ComponentMetrics } from '../../services/metrics.service';
import { EmptyState } from './EmptyState';

interface ComponentsTabProps {
  componentMetrics: ComponentMetrics[];
  isLoading: boolean;
}

export function ComponentsTab({ componentMetrics, isLoading }: ComponentsTabProps) {
  const formatNumber = (num?: number) => {
    if (num === undefined || num === null) return '-';
    return num.toLocaleString();
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '-';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) return `${hours}h ${minutes}min`;
    return `${minutes}min`;
  };

  const formatCost = (cost?: number) => {
    if (cost === undefined || cost === null) return '-';
    return `$${cost.toFixed(2)}`;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Show empty state if no data
  if (!isLoading && componentMetrics.length === 0) {
    return (
      <EmptyState
        title="No Component Data Available"
        message="There are no component execution records for the selected time period."
        icon="🧩"
      />
    );
  }

  // Sort by total runs descending
  const sortedComponents = [...componentMetrics].sort((a, b) => b.totalRuns - a.totalRuns);

  return (
    <div className="space-y-6">
      {/* Component Performance Table */}
      <div className="bg-card rounded-lg shadow p-6">
        <h2 className="text-xl font-bold text-fg mb-4">Component Performance</h2>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-bg-secondary">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted uppercase">
                  Component
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-muted uppercase">
                  Total Runs
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-muted uppercase">
                  Success Rate
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-muted uppercase">
                  Avg Duration
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-muted uppercase">
                  Avg Tokens
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-muted uppercase">
                  Total LOC
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-muted uppercase">
                  Avg Cost
                </th>
              </tr>
            </thead>
            <tbody className="bg-card divide-y divide-gray-200">
              {sortedComponents.map((component) => (
                <tr key={component.componentId} className="hover:bg-bg-secondary">
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="text-sm font-medium text-fg">
                      {component.componentName}
                    </div>
                    {component.avgRunsPerWorkflow !== undefined && (
                      <div className="text-xs text-muted">
                        {component.avgRunsPerWorkflow.toFixed(1)} runs/workflow
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-right">
                    <div className="text-sm text-fg">{component.totalRuns}</div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-right">
                    <div
                      className={`text-sm font-medium ${
                        component.successRate >= 90
                          ? 'text-green-600'
                          : component.successRate >= 75
                          ? 'text-yellow-600'
                          : 'text-red-600'
                      }`}
                    >
                      {component.successRate.toFixed(0)}%
                    </div>
                    <div className="text-xs text-muted">
                      {component.successfulRuns}/{component.totalRuns}
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-right">
                    <div className="text-sm text-fg">
                      {formatDuration(component.avgDuration)}
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-right">
                    <div className="text-sm text-fg">
                      {formatNumber(component.avgTokens)}
                    </div>
                    {component.avgTokensPerLoc !== undefined && (
                      <div className="text-xs text-muted">
                        {component.avgTokensPerLoc.toFixed(0)} tokens/LOC
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-right">
                    <div className="text-sm text-fg">
                      {formatNumber(component.totalLoc)}
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-right">
                    <div className="text-sm text-fg">{formatCost(component.avgCost)}</div>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-bg-secondary font-semibold">
              <tr>
                <td className="px-4 py-3 text-sm text-fg">Total</td>
                <td className="px-4 py-3 text-right text-sm text-fg">
                  {componentMetrics.reduce((sum, c) => sum + c.totalRuns, 0)}
                </td>
                <td className="px-4 py-3 text-right text-sm text-fg">-</td>
                <td className="px-4 py-3 text-right text-sm text-fg">-</td>
                <td className="px-4 py-3 text-right text-sm text-fg">
                  {formatNumber(
                    Math.round(
                      componentMetrics.reduce((sum, c) => sum + (c.totalTokens || 0), 0),
                    ),
                  )}
                </td>
                <td className="px-4 py-3 text-right text-sm text-fg">
                  {formatNumber(componentMetrics.reduce((sum, c) => sum + (c.totalLoc || 0), 0))}
                </td>
                <td className="px-4 py-3 text-right text-sm text-fg">
                  {formatCost(
                    componentMetrics.reduce((sum, c) => sum + (c.totalCost || 0), 0),
                  )}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {componentMetrics.length === 0 && (
          <div className="text-center py-8 text-muted">
            No component data available for the selected period.
          </div>
        )}
      </div>

      {/* Efficiency Breakdown */}
      {componentMetrics.length > 0 && (
        <div className="bg-card rounded-lg shadow p-6">
          <h2 className="text-xl font-bold text-fg mb-4">Efficiency Breakdown</h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Most Efficient (by tokens/LOC) */}
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-green-900 mb-2">
                Most Efficient (Tokens/LOC)
              </h3>
              {[...componentMetrics]
                .filter((c) => c.avgTokensPerLoc)
                .sort((a, b) => (a.avgTokensPerLoc || 0) - (b.avgTokensPerLoc || 0))
                .slice(0, 3)
                .map((component, i) => (
                  <div key={component.componentId} className="text-xs text-green-800 py-1">
                    {i + 1}. {component.componentName}:{' '}
                    <strong>{component.avgTokensPerLoc?.toFixed(0)}</strong>
                  </div>
                ))}
            </div>

            {/* Most Productive (by LOC/prompt) */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-blue-900 mb-2">
                Most Productive (LOC/Prompt)
              </h3>
              {[...componentMetrics]
                .filter((c) => c.avgLocPerPrompt)
                .sort((a, b) => (b.avgLocPerPrompt || 0) - (a.avgLocPerPrompt || 0))
                .slice(0, 3)
                .map((component, i) => (
                  <div key={component.componentId} className="text-xs text-blue-800 py-1">
                    {i + 1}. {component.componentName}:{' '}
                    <strong>{component.avgLocPerPrompt?.toFixed(1)}</strong>
                  </div>
                ))}
            </div>

            {/* Most Reliable (by success rate) */}
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-purple-900 mb-2">
                Most Reliable (Success Rate)
              </h3>
              {[...componentMetrics]
                .sort((a, b) => b.successRate - a.successRate)
                .slice(0, 3)
                .map((component, i) => (
                  <div key={component.componentId} className="text-xs text-purple-800 py-1">
                    {i + 1}. {component.componentName}:{' '}
                    <strong>{component.successRate.toFixed(0)}%</strong>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
