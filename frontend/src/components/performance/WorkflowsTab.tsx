import { WorkflowMetrics, WeeklyAggregation } from '../../services/metrics.service';

interface WorkflowsTabProps {
  weeklyData: WeeklyAggregation[];
  workflowMetrics: WorkflowMetrics[];
  isLoading: boolean;
}

export function WorkflowsTab({ weeklyData, workflowMetrics, isLoading }: WorkflowsTabProps) {
  const formatNumber = (num?: number) => {
    if (num === undefined || num === null) return '-';
    return num.toLocaleString();
  };

  const formatCost = (cost?: number) => {
    if (cost === undefined || cost === null) return '-';
    return `$${cost.toFixed(2)}`;
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '-';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) return `${hours}h ${minutes}min`;
    return `${minutes}min`;
  };

  const getTrendIcon = (current?: number, previous?: number) => {
    if (!current || !previous) return null;
    const change = ((current - previous) / previous) * 100;
    if (change > 5) return <span className="text-red-600">↑</span>;
    if (change < -5) return <span className="text-green-600">↓</span>;
    return null;
  };

  const getPerformanceIcon = (value: number, threshold: { good: number; warning: number }) => {
    if (value <= threshold.good) return <span className="text-green-600">✓</span>;
    if (value <= threshold.warning) return null;
    return <span className="text-yellow-600">⚠</span>;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Calculate averages across all weeks
  const calculateAverages = () => {
    if (weeklyData.length === 0) return null;

    const totals = weeklyData.reduce(
      (acc, week) => ({
        stories: acc.stories + week.storiesCompleted,
        tokens: acc.tokens + (week.aggregated.avgTokens || 0),
        cost: acc.cost + (week.aggregated.avgCost || 0),
        duration: acc.duration + (week.aggregated.avgDuration || 0),
        loc: acc.loc + (week.aggregated.totalLoc || 0),
        tokensPerLoc: acc.tokensPerLoc + (week.aggregated.avgTokensPerLoc || 0),
        locPerPrompt: acc.locPerPrompt + (week.aggregated.avgLocPerPrompt || 0),
        runtimePerLoc: acc.runtimePerLoc + (week.aggregated.avgRuntimePerLoc || 0),
      }),
      { stories: 0, tokens: 0, cost: 0, duration: 0, loc: 0, tokensPerLoc: 0, locPerPrompt: 0, runtimePerLoc: 0 },
    );

    const count = weeklyData.length;
    return {
      stories: totals.stories / count,
      tokens: totals.tokens / count,
      cost: totals.cost / count,
      duration: totals.duration / count,
      loc: totals.loc / count,
      tokensPerLoc: totals.tokensPerLoc / count,
      locPerPrompt: totals.locPerPrompt / count,
      runtimePerLoc: totals.runtimePerLoc / count,
    };
  };

  const averages = calculateAverages();

  return (
    <div className="space-y-6">
      {/* Weekly Performance Summary */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Weekly Performance Summary</h2>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Week
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  Stories
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  Tokens
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  Duration
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  Cost
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  LOC
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  Success Rate
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {weeklyData.map((week, index) => {
                const prevWeek = index < weeklyData.length - 1 ? weeklyData[index + 1] : null;
                return (
                  <tr key={`${week.year}-W${week.weekNumber}`} className="hover:bg-gray-50">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        Week {week.weekNumber}
                      </div>
                      <div className="text-xs text-gray-500">{week.year}</div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-right">
                      <div className="text-sm text-gray-900 flex items-center justify-end gap-1">
                        {week.storiesCompleted}
                        {getTrendIcon(week.storiesCompleted, prevWeek?.storiesCompleted)}
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-right">
                      <div className="text-sm text-gray-900 flex items-center justify-end gap-1">
                        {formatNumber(week.aggregated.avgTokens)}
                        {getTrendIcon(week.aggregated.avgTokens, prevWeek?.aggregated.avgTokens)}
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-right">
                      <div className="text-sm text-gray-900">
                        {formatDuration(week.aggregated.avgDuration)}
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-right">
                      <div className="text-sm text-gray-900 flex items-center justify-end gap-1">
                        {formatCost(week.aggregated.avgCost)}
                        {getTrendIcon(week.aggregated.avgCost, prevWeek?.aggregated.avgCost)}
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-right">
                      <div className="text-sm text-gray-900">
                        {formatNumber(week.aggregated.totalLoc)}
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-right">
                      <div className="text-sm font-medium text-gray-900">
                        {week.aggregated.successRate.toFixed(0)}%
                      </div>
                    </td>
                  </tr>
                );
              })}
              {averages && (
                <tr className="bg-gray-50 font-semibold">
                  <td className="px-4 py-3 text-sm text-gray-900">Average</td>
                  <td className="px-4 py-3 text-right text-sm text-gray-900">
                    {averages.stories.toFixed(1)}
                  </td>
                  <td className="px-4 py-3 text-right text-sm text-gray-900">
                    {formatNumber(Math.round(averages.tokens))}
                  </td>
                  <td className="px-4 py-3 text-right text-sm text-gray-900">
                    {formatDuration(averages.duration)}
                  </td>
                  <td className="px-4 py-3 text-right text-sm text-gray-900">
                    {formatCost(averages.cost)}
                  </td>
                  <td className="px-4 py-3 text-right text-sm text-gray-900">
                    {formatNumber(Math.round(averages.loc))}
                  </td>
                  <td className="px-4 py-3 text-right text-sm text-gray-900">-</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {weeklyData.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            No weekly data available for the selected period.
          </div>
        )}
      </div>

      {/* Efficiency Metrics */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Detailed Efficiency Metrics</h2>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Week
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  Tokens/LOC
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  LOC/Prompt
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  Runtime/LOC (sec)
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  Iterations
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {weeklyData.map((week, index) => {
                const prevWeek = index < weeklyData.length - 1 ? weeklyData[index + 1] : null;
                const tokensPerLoc = week.aggregated.avgTokensPerLoc || 0;
                const locPerPrompt = week.aggregated.avgLocPerPrompt || 0;
                const runtimePerLoc = week.aggregated.avgRuntimePerLoc || 0;

                return (
                  <tr key={`${week.year}-W${week.weekNumber}`} className="hover:bg-gray-50">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        Week {week.weekNumber}
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-right">
                      <div className="text-sm text-gray-900 flex items-center justify-end gap-1">
                        {tokensPerLoc.toFixed(0)}
                        {getTrendIcon(tokensPerLoc, prevWeek?.aggregated.avgTokensPerLoc)}
                        {getPerformanceIcon(tokensPerLoc, { good: 150, warning: 250 })}
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-right">
                      <div className="text-sm text-gray-900 flex items-center justify-end gap-1">
                        {locPerPrompt.toFixed(1)}
                        {getPerformanceIcon(20 - locPerPrompt, { good: 5, warning: 10 })}
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-right">
                      <div className="text-sm text-gray-900 flex items-center justify-end gap-1">
                        {runtimePerLoc.toFixed(1)}
                        {getPerformanceIcon(runtimePerLoc, { good: 10, warning: 20 })}
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-right">
                      <div className="text-sm text-gray-900">
                        {week.aggregated.avgIterationsPerRun?.toFixed(1) || '-'}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {averages && (
                <tr className="bg-gray-50 font-semibold">
                  <td className="px-4 py-3 text-sm text-gray-900">Average</td>
                  <td className="px-4 py-3 text-right text-sm text-gray-900">
                    {averages.tokensPerLoc.toFixed(0)}
                  </td>
                  <td className="px-4 py-3 text-right text-sm text-gray-900">
                    {averages.locPerPrompt.toFixed(1)}
                  </td>
                  <td className="px-4 py-3 text-right text-sm text-gray-900">
                    {averages.runtimePerLoc.toFixed(1)}
                  </td>
                  <td className="px-4 py-3 text-right text-sm text-gray-900">-</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {weeklyData.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            No efficiency data available for the selected period.
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-blue-900 mb-2">Legend</h3>
        <div className="text-xs text-blue-800 space-y-1">
          <div>
            <span className="text-green-600">↓</span> = Improvement (&gt;5% decrease in
            cost/tokens)
          </div>
          <div>
            <span className="text-red-600">↑</span> = Regression (&gt;5% increase in cost/tokens)
          </div>
          <div>
            <span className="text-green-600">✓</span> = Good performance (within recommended
            thresholds)
          </div>
          <div>
            <span className="text-yellow-600">⚠</span> = Below optimal performance
          </div>
        </div>
      </div>
    </div>
  );
}
