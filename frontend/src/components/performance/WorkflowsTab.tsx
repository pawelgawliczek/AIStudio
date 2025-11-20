import { useState } from 'react';
import { WorkflowMetrics, WeeklyAggregation } from '../../services/metrics.service';
import { EmptyState } from './EmptyState';

interface WorkflowsTabProps {
  weeklyData: WeeklyAggregation[];
  workflowMetrics: WorkflowMetrics[];
  isLoading: boolean;
}

export function WorkflowsTab({ weeklyData, workflowMetrics, isLoading }: WorkflowsTabProps) {
  const [expandedWeeks, setExpandedWeeks] = useState<Set<string>>(new Set());

  const toggleWeek = (weekKey: string) => {
    setExpandedWeeks((prev) => {
      const next = new Set(prev);
      if (next.has(weekKey)) {
        next.delete(weekKey);
      } else {
        next.add(weekKey);
      }
      return next;
    });
  };

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

  // Show empty state if no data
  if (!isLoading && weeklyData.length === 0) {
    return (
      <EmptyState
        title="No Workflow Data Available"
        message="There are no workflow execution records for the selected time period."
        icon="🔄"
      />
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
        tests: acc.tests + (week.aggregated.testsAdded || 0),
        tokensPerLoc: acc.tokensPerLoc + (week.aggregated.avgTokensPerLoc || 0),
        locPerPrompt: acc.locPerPrompt + (week.aggregated.avgLocPerPrompt || 0),
        runtimePerLoc: acc.runtimePerLoc + (week.aggregated.avgRuntimePerLoc || 0),
      }),
      { stories: 0, tokens: 0, cost: 0, duration: 0, loc: 0, tests: 0, tokensPerLoc: 0, locPerPrompt: 0, runtimePerLoc: 0 },
    );

    const count = weeklyData.length;
    return {
      stories: totals.stories / count,
      tokens: totals.tokens / count,
      cost: totals.cost / count,
      duration: totals.duration / count,
      loc: totals.loc / count,
      tests: totals.tests / count,
      tokensPerLoc: totals.tokensPerLoc / count,
      locPerPrompt: totals.locPerPrompt / count,
      runtimePerLoc: totals.runtimePerLoc / count,
    };
  };

  const averages = calculateAverages();

  return (
    <div className="space-y-6">
      {/* Weekly Performance Summary */}
      <div className="bg-card rounded-lg shadow p-6">
        <h2 className="text-xl font-bold text-fg mb-4">Weekly Performance Summary</h2>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-bg-secondary">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted uppercase">
                  Week
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-muted uppercase">
                  Stories
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-muted uppercase">
                  Tokens
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-muted uppercase">
                  Duration
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-muted uppercase">
                  Cost
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-muted uppercase">
                  LOC
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-muted uppercase">
                  Tests
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-muted uppercase">
                  Success Rate
                </th>
              </tr>
            </thead>
            <tbody className="bg-card divide-y divide-gray-200">
              {weeklyData.map((week, index) => {
                const prevWeek = index < weeklyData.length - 1 ? weeklyData[index + 1] : null;
                const weekKey = `${week.year}-W${week.weekNumber}`;
                const isExpanded = expandedWeeks.has(weekKey);

                return (
                  <>
                    <tr
                      key={weekKey}
                      className="hover:bg-bg-secondary cursor-pointer"
                      onClick={() => toggleWeek(weekKey)}
                    >
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className="text-gray-400">
                            {isExpanded ? '▼' : '▶'}
                          </span>
                          <div>
                            <div className="text-sm font-medium text-fg">
                              Week {week.weekNumber}
                            </div>
                            <div className="text-xs text-muted">{week.year}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-right">
                        <div className="text-sm text-fg flex items-center justify-end gap-1">
                          {week.storiesCompleted}
                          {getTrendIcon(week.storiesCompleted, prevWeek?.storiesCompleted)}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-right">
                        <div className="text-sm text-fg flex items-center justify-end gap-1">
                          {formatNumber(week.aggregated.avgTokens)}
                          {getTrendIcon(week.aggregated.avgTokens, prevWeek?.aggregated.avgTokens)}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-right">
                        <div className="text-sm text-fg">
                          {formatDuration(week.aggregated.avgDuration)}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-right">
                        <div className="text-sm text-fg flex items-center justify-end gap-1">
                          {formatCost(week.aggregated.avgCost)}
                          {getTrendIcon(week.aggregated.avgCost, prevWeek?.aggregated.avgCost)}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-right">
                        <div className="text-sm text-fg">
                          {formatNumber(week.aggregated.totalLoc)}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-right">
                        <div className="text-sm text-fg">
                          {formatNumber(week.aggregated.testsAdded)}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-right">
                        <div className="text-sm font-medium text-fg">
                          {week.aggregated.successRate.toFixed(0)}%
                        </div>
                      </td>
                    </tr>

                    {/* Expanded workflow details */}
                    {isExpanded && week.workflows.length > 0 && (
                      <tr key={`${weekKey}-details`}>
                        <td colSpan={8} className="px-4 py-0 bg-bg-secondary">
                          <div className="py-3 pl-8">
                            <div className="text-xs font-semibold text-muted mb-2 uppercase">
                              Workflows in Week {week.weekNumber}
                            </div>
                            <div className="overflow-x-auto">
                              <table className="min-w-full">
                                <thead>
                                  <tr className="border-b border-border">
                                    <th className="px-3 py-2 text-left text-xs font-medium text-muted">
                                      Workflow
                                    </th>
                                    <th className="px-3 py-2 text-right text-xs font-medium text-muted">
                                      Runs
                                    </th>
                                    <th className="px-3 py-2 text-right text-xs font-medium text-muted">
                                      Success
                                    </th>
                                    <th className="px-3 py-2 text-right text-xs font-medium text-muted">
                                      Tokens
                                    </th>
                                    <th className="px-3 py-2 text-right text-xs font-medium text-muted">
                                      Duration
                                    </th>
                                    <th className="px-3 py-2 text-right text-xs font-medium text-muted">
                                      LOC
                                    </th>
                                    <th className="px-3 py-2 text-right text-xs font-medium text-muted">
                                      Tests
                                    </th>
                                    <th className="px-3 py-2 text-right text-xs font-medium text-muted">
                                      Cost
                                    </th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {week.workflows.map((workflow) => (
                                    <tr
                                      key={workflow.workflowId}
                                      className="border-b border-gray-100 hover:bg-gray-100"
                                    >
                                      <td className="px-3 py-2">
                                        <div className="text-xs font-medium text-fg">
                                          {workflow.workflowName}
                                        </div>
                                        <div className="text-xs text-muted">
                                          v{workflow.workflowVersion}
                                        </div>
                                      </td>
                                      <td className="px-3 py-2 text-right text-xs text-fg">
                                        {workflow.totalRuns}
                                      </td>
                                      <td className="px-3 py-2 text-right">
                                        <span className={`text-xs font-medium ${
                                          workflow.successRate >= 90
                                            ? 'text-green-600'
                                            : workflow.successRate >= 75
                                            ? 'text-yellow-600'
                                            : 'text-red-600'
                                        }`}>
                                          {workflow.successRate.toFixed(0)}%
                                        </span>
                                        <div className="text-xs text-muted">
                                          {workflow.successfulRuns}/{workflow.totalRuns}
                                        </div>
                                      </td>
                                      <td className="px-3 py-2 text-right text-xs text-fg">
                                        {formatNumber(workflow.avgTokens)}
                                      </td>
                                      <td className="px-3 py-2 text-right text-xs text-fg">
                                        {formatDuration(workflow.avgDuration)}
                                      </td>
                                      <td className="px-3 py-2 text-right text-xs text-fg">
                                        {formatNumber(workflow.totalLoc)}
                                      </td>
                                      <td className="px-3 py-2 text-right text-xs text-fg">
                                        {formatNumber(workflow.testsAdded)}
                                      </td>
                                      <td className="px-3 py-2 text-right text-xs text-fg">
                                        {formatCost(workflow.avgCost)}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
              {averages && (
                <tr className="bg-bg-secondary font-semibold">
                  <td className="px-4 py-3 text-sm text-fg">Average</td>
                  <td className="px-4 py-3 text-right text-sm text-fg">
                    {averages.stories.toFixed(1)}
                  </td>
                  <td className="px-4 py-3 text-right text-sm text-fg">
                    {formatNumber(Math.round(averages.tokens))}
                  </td>
                  <td className="px-4 py-3 text-right text-sm text-fg">
                    {formatDuration(averages.duration)}
                  </td>
                  <td className="px-4 py-3 text-right text-sm text-fg">
                    {formatCost(averages.cost)}
                  </td>
                  <td className="px-4 py-3 text-right text-sm text-fg">
                    {formatNumber(Math.round(averages.loc))}
                  </td>
                  <td className="px-4 py-3 text-right text-sm text-fg">
                    {formatNumber(Math.round(averages.tests))}
                  </td>
                  <td className="px-4 py-3 text-right text-sm text-fg">-</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {weeklyData.length === 0 && (
          <div className="text-center py-8 text-muted">
            No weekly data available for the selected period.
          </div>
        )}
      </div>

      {/* Efficiency Metrics */}
      <div className="bg-card rounded-lg shadow p-6">
        <h2 className="text-xl font-bold text-fg mb-4">Detailed Efficiency Metrics</h2>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-bg-secondary">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted uppercase">
                  Week
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-muted uppercase">
                  Tokens/LOC
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-muted uppercase">
                  LOC/Prompt
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-muted uppercase">
                  Runtime/LOC (sec)
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-muted uppercase">
                  Iterations
                </th>
              </tr>
            </thead>
            <tbody className="bg-card divide-y divide-gray-200">
              {weeklyData.map((week, index) => {
                const prevWeek = index < weeklyData.length - 1 ? weeklyData[index + 1] : null;
                const tokensPerLoc = week.aggregated.avgTokensPerLoc || 0;
                const locPerPrompt = week.aggregated.avgLocPerPrompt || 0;
                const runtimePerLoc = week.aggregated.avgRuntimePerLoc || 0;
                const weekKey = `${week.year}-W${week.weekNumber}`;
                const isExpanded = expandedWeeks.has(weekKey);

                return (
                  <>
                    <tr
                      key={weekKey}
                      className="hover:bg-bg-secondary cursor-pointer"
                      onClick={() => toggleWeek(weekKey)}
                    >
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className="text-gray-400">
                            {isExpanded ? '▼' : '▶'}
                          </span>
                          <div className="text-sm font-medium text-fg">
                            Week {week.weekNumber}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-right">
                        <div className="text-sm text-fg flex items-center justify-end gap-1">
                          {tokensPerLoc.toFixed(0)}
                          {getTrendIcon(tokensPerLoc, prevWeek?.aggregated.avgTokensPerLoc)}
                          {getPerformanceIcon(tokensPerLoc, { good: 150, warning: 250 })}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-right">
                        <div className="text-sm text-fg flex items-center justify-end gap-1">
                          {locPerPrompt.toFixed(1)}
                          {getPerformanceIcon(20 - locPerPrompt, { good: 5, warning: 10 })}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-right">
                        <div className="text-sm text-fg flex items-center justify-end gap-1">
                          {runtimePerLoc.toFixed(1)}
                          {getPerformanceIcon(runtimePerLoc, { good: 10, warning: 20 })}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-right">
                        <div className="text-sm text-fg">
                          {week.aggregated.avgIterationsPerRun?.toFixed(1) || '-'}
                        </div>
                      </td>
                    </tr>

                    {/* Expanded workflow efficiency details */}
                    {isExpanded && week.workflows.length > 0 && (
                      <tr key={`${weekKey}-efficiency-details`}>
                        <td colSpan={5} className="px-4 py-0 bg-bg-secondary">
                          <div className="py-3 pl-8">
                            <div className="text-xs font-semibold text-muted mb-2 uppercase">
                              Workflow Efficiency in Week {week.weekNumber}
                            </div>
                            <div className="overflow-x-auto">
                              <table className="min-w-full">
                                <thead>
                                  <tr className="border-b border-border">
                                    <th className="px-3 py-2 text-left text-xs font-medium text-muted">
                                      Workflow
                                    </th>
                                    <th className="px-3 py-2 text-right text-xs font-medium text-muted">
                                      Tokens/LOC
                                    </th>
                                    <th className="px-3 py-2 text-right text-xs font-medium text-muted">
                                      LOC/Prompt
                                    </th>
                                    <th className="px-3 py-2 text-right text-xs font-medium text-muted">
                                      Runtime/LOC (s)
                                    </th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {week.workflows.map((workflow) => (
                                    <tr
                                      key={workflow.workflowId}
                                      className="border-b border-gray-100 hover:bg-gray-100"
                                    >
                                      <td className="px-3 py-2">
                                        <div className="text-xs font-medium text-fg">
                                          {workflow.workflowName}
                                        </div>
                                      </td>
                                      <td className="px-3 py-2 text-right">
                                        <div className="flex items-center justify-end gap-1">
                                          <span className="text-xs text-fg">
                                            {workflow.avgTokensPerLoc?.toFixed(0) || '-'}
                                          </span>
                                          {workflow.avgTokensPerLoc &&
                                            getPerformanceIcon(workflow.avgTokensPerLoc, {
                                              good: 150,
                                              warning: 250,
                                            })}
                                        </div>
                                      </td>
                                      <td className="px-3 py-2 text-right">
                                        <div className="flex items-center justify-end gap-1">
                                          <span className="text-xs text-fg">
                                            {workflow.avgLocPerPrompt?.toFixed(1) || '-'}
                                          </span>
                                          {workflow.avgLocPerPrompt &&
                                            getPerformanceIcon(20 - workflow.avgLocPerPrompt, {
                                              good: 5,
                                              warning: 10,
                                            })}
                                        </div>
                                      </td>
                                      <td className="px-3 py-2 text-right">
                                        <div className="flex items-center justify-end gap-1">
                                          <span className="text-xs text-fg">
                                            {workflow.avgRuntimePerLoc?.toFixed(1) || '-'}
                                          </span>
                                          {workflow.avgRuntimePerLoc &&
                                            getPerformanceIcon(workflow.avgRuntimePerLoc, {
                                              good: 10,
                                              warning: 20,
                                            })}
                                        </div>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
              {averages && (
                <tr className="bg-bg-secondary font-semibold">
                  <td className="px-4 py-3 text-sm text-fg">Average</td>
                  <td className="px-4 py-3 text-right text-sm text-fg">
                    {averages.tokensPerLoc.toFixed(0)}
                  </td>
                  <td className="px-4 py-3 text-right text-sm text-fg">
                    {averages.locPerPrompt.toFixed(1)}
                  </td>
                  <td className="px-4 py-3 text-right text-sm text-fg">
                    {averages.runtimePerLoc.toFixed(1)}
                  </td>
                  <td className="px-4 py-3 text-right text-sm text-fg">-</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {weeklyData.length === 0 && (
          <div className="text-center py-8 text-muted">
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
