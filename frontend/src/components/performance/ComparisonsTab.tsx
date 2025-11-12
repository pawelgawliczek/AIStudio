import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { metricsService, WorkflowComparisonResponse } from '../../services/metrics.service';
import { workflowsService } from '../../services/workflows.service';

interface ComparisonsTabProps {
  projectId: string;
  startDate: string;
  endDate: string;
}

export function ComparisonsTab({ projectId, startDate, endDate }: ComparisonsTabProps) {
  const [workflow1Id, setWorkflow1Id] = useState<string>('');
  const [workflow2Id, setWorkflow2Id] = useState<string>('');
  const [showComparison, setShowComparison] = useState<boolean>(false);

  // Fetch available workflows
  const { data: workflows } = useQuery({
    queryKey: ['workflows', projectId],
    queryFn: () => workflowsService.getAll(projectId),
    enabled: !!projectId,
  });

  // Fetch comparison data
  const { data: comparison, isLoading, error } = useQuery({
    queryKey: ['workflow-comparison', projectId, workflow1Id, workflow2Id, startDate, endDate],
    queryFn: async () => {
      if (!workflow1Id || !workflow2Id) {
        throw new Error('Please select two workflows to compare');
      }
      return metricsService.compareWorkflows(projectId, {
        workflow1Id,
        workflow2Id,
        startDate,
        endDate,
      });
    },
    enabled: showComparison && !!workflow1Id && !!workflow2Id,
  });

  const handleCompare = () => {
    if (workflow1Id && workflow2Id && workflow1Id !== workflow2Id) {
      setShowComparison(true);
    }
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

  const formatDiff = (diff: number, invertColors: boolean = false) => {
    const isPositive = diff > 0;
    const color = invertColors
      ? isPositive
        ? 'text-red-600'
        : 'text-green-600'
      : isPositive
      ? 'text-green-600'
      : 'text-red-600';

    return (
      <span className={`text-sm font-medium ${color}`}>
        {isPositive ? '+' : ''}
        {diff.toFixed(1)}%
      </span>
    );
  };

  const renderComparisonTable = (comparison: WorkflowComparisonResponse) => {
    const { workflow1, workflow2, comparison: comp } = comparison;

    return (
      <div className="space-y-6">
        {/* Winner Badge */}
        <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg p-6 text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Comparison Result</h2>
          {comp.winner === 'tie' ? (
            <p className="text-lg text-gray-700">
              Both workflows perform similarly (within 5% margin)
            </p>
          ) : (
            <p className="text-lg text-gray-700">
              Winner:{' '}
              <span className="text-2xl font-bold text-blue-600">
                {comp.winner === 'workflow1' ? workflow1.workflowName : workflow2.workflowName}
              </span>
            </p>
          )}
          <p className="text-sm text-gray-600 mt-2">
            Based on combined cost, duration, and token efficiency
          </p>
        </div>

        {/* Comparison Tables */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Workflow 1 */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">
              {workflow1.workflowName}
              {comp.winner === 'workflow1' && (
                <span className="ml-2 text-green-600">👑</span>
              )}
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between border-b pb-2">
                <span className="text-sm text-gray-600">Total Runs</span>
                <span className="text-sm font-medium">{workflow1.totalRuns}</span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="text-sm text-gray-600">Success Rate</span>
                <span className="text-sm font-medium">{workflow1.successRate.toFixed(0)}%</span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="text-sm text-gray-600">Avg Duration</span>
                <span className="text-sm font-medium">
                  {formatDuration(workflow1.avgDuration)}
                </span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="text-sm text-gray-600">Avg Tokens</span>
                <span className="text-sm font-medium">{formatNumber(workflow1.avgTokens)}</span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="text-sm text-gray-600">Avg LOC/Story</span>
                <span className="text-sm font-medium">
                  {formatNumber(workflow1.avgLocPerStory)}
                </span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="text-sm text-gray-600">Avg Cost</span>
                <span className="text-sm font-medium">{formatCost(workflow1.avgCost)}</span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="text-sm text-gray-600">Tokens/LOC</span>
                <span className="text-sm font-medium">
                  {workflow1.avgTokensPerLoc?.toFixed(0) || '-'}
                </span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="text-sm text-gray-600">LOC/Prompt</span>
                <span className="text-sm font-medium">
                  {workflow1.avgLocPerPrompt?.toFixed(1) || '-'}
                </span>
              </div>
            </div>
          </div>

          {/* Workflow 2 */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">
              {workflow2.workflowName}
              {comp.winner === 'workflow2' && (
                <span className="ml-2 text-green-600">👑</span>
              )}
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between border-b pb-2">
                <span className="text-sm text-gray-600">Total Runs</span>
                <span className="text-sm font-medium">{workflow2.totalRuns}</span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="text-sm text-gray-600">Success Rate</span>
                <span className="text-sm font-medium">{workflow2.successRate.toFixed(0)}%</span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="text-sm text-gray-600">Avg Duration</span>
                <span className="text-sm font-medium">
                  {formatDuration(workflow2.avgDuration)}
                </span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="text-sm text-gray-600">Avg Tokens</span>
                <span className="text-sm font-medium">{formatNumber(workflow2.avgTokens)}</span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="text-sm text-gray-600">Avg LOC/Story</span>
                <span className="text-sm font-medium">
                  {formatNumber(workflow2.avgLocPerStory)}
                </span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="text-sm text-gray-600">Avg Cost</span>
                <span className="text-sm font-medium">{formatCost(workflow2.avgCost)}</span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="text-sm text-gray-600">Tokens/LOC</span>
                <span className="text-sm font-medium">
                  {workflow2.avgTokensPerLoc?.toFixed(0) || '-'}
                </span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="text-sm text-gray-600">LOC/Prompt</span>
                <span className="text-sm font-medium">
                  {workflow2.avgLocPerPrompt?.toFixed(1) || '-'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Differences */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">
            Performance Differences (Workflow 2 vs Workflow 1)
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            <div className="border rounded-lg p-3">
              <div className="text-xs text-gray-600 mb-1">Tokens</div>
              {formatDiff(comp.tokensDiff, true)}
            </div>
            <div className="border rounded-lg p-3">
              <div className="text-xs text-gray-600 mb-1">Cost</div>
              {formatDiff(comp.costDiff, true)}
            </div>
            <div className="border rounded-lg p-3">
              <div className="text-xs text-gray-600 mb-1">Duration</div>
              {formatDiff(comp.durationDiff, true)}
            </div>
            <div className="border rounded-lg p-3">
              <div className="text-xs text-gray-600 mb-1">LOC</div>
              {formatDiff(comp.locDiff, false)}
            </div>
            <div className="border rounded-lg p-3">
              <div className="text-xs text-gray-600 mb-1">Efficiency</div>
              {formatDiff(comp.efficiencyDiff, true)}
            </div>
          </div>
          <div className="mt-3 text-xs text-gray-600">
            <span className="text-green-600">Green</span> = Better performance |{' '}
            <span className="text-red-600">Red</span> = Worse performance
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Selector */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Compare Workflows</h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Workflow 1
            </label>
            <select
              value={workflow1Id}
              onChange={(e) => setWorkflow1Id(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Select workflow...</option>
              {workflows?.map((wf) => (
                <option key={wf.id} value={wf.id}>
                  {wf.name} (v{wf.version})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Workflow 2
            </label>
            <select
              value={workflow2Id}
              onChange={(e) => setWorkflow2Id(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Select workflow...</option>
              {workflows?.map((wf) => (
                <option key={wf.id} value={wf.id} disabled={wf.id === workflow1Id}>
                  {wf.name} (v{wf.version})
                </option>
              ))}
            </select>
          </div>

          <div>
            <button
              onClick={handleCompare}
              disabled={!workflow1Id || !workflow2Id || workflow1Id === workflow2Id}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              Compare
            </button>
          </div>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Comparing workflows...</p>
          </div>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-red-800 mb-2">Error</h3>
          <p className="text-red-600">
            {error instanceof Error ? error.message : 'Failed to compare workflows'}
          </p>
        </div>
      )}

      {/* Comparison Results */}
      {comparison && !isLoading && !error && renderComparisonTable(comparison)}

      {/* Empty State */}
      {!showComparison && !isLoading && (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <div className="text-gray-400 text-5xl mb-4">📊</div>
          <p className="text-gray-600">
            Select two workflows above and click Compare to see detailed performance comparison.
          </p>
        </div>
      )}
    </div>
  );
}
