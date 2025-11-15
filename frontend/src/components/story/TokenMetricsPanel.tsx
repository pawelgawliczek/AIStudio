import React, { useEffect, useState } from 'react';
import { CurrencyDollarIcon, CpuChipIcon, ClockIcon } from '@heroicons/react/24/outline';
import { api } from '../../services/api';

interface ComponentMetrics {
  componentName: string;
  tokens: number;
  cost: number;
  userPrompts: number;
  iterations: number;
}

interface WorkflowRunMetrics {
  workflowRunId: string;
  workflowName: string;
  status: string;
  startedAt: string;
  completedAt: string | null;
  tokens: number;
  cost: number;
  components: ComponentMetrics[];
}

interface TokenMetrics {
  storyId: string;
  storyKey: string;
  totalTokens: number;
  totalCost: number;
  breakdown: WorkflowRunMetrics[];
}

interface TokenMetricsPanelProps {
  storyId: string;
}

const STATUS_COLORS: Record<string, string> = {
  completed: 'bg-green-100 text-green-800 border-green-200',
  running: 'bg-blue-100 text-blue-800 border-blue-200',
  failed: 'bg-red-100 text-red-800 border-red-200',
  pending: 'bg-gray-100 text-gray-800 border-gray-200',
};

export function TokenMetricsPanel({ storyId }: TokenMetricsPanelProps) {
  const [metrics, setMetrics] = useState<TokenMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedRuns, setExpandedRuns] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadMetrics();
  }, [storyId]);

  const loadMetrics = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await api.get(`/stories/${storyId}/token-metrics`);
      setMetrics(response.data);
    } catch (err: any) {
      console.error('Failed to load token metrics:', err);
      setError(err.response?.data?.message || 'Failed to load token metrics');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleRun = (runId: string) => {
    const newExpanded = new Set(expandedRuns);
    if (newExpanded.has(runId)) {
      newExpanded.delete(runId);
    } else {
      newExpanded.add(runId);
    }
    setExpandedRuns(newExpanded);
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-US').format(num);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const calculateDuration = (start: string, end: string | null) => {
    if (!end) return 'In Progress';
    const duration = new Date(end).getTime() - new Date(start).getTime();
    const minutes = Math.floor(duration / 60000);
    const seconds = Math.floor((duration % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="space-y-3">
            <div className="h-4 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded w-5/6"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 rounded-lg border border-red-200 p-6">
        <p className="text-red-800 text-sm">Error: {error}</p>
      </div>
    );
  }

  if (!metrics || metrics.totalTokens === 0) {
    return (
      <div className="bg-gray-50 rounded-lg border border-gray-200 p-6">
        <div className="flex items-center gap-2 text-gray-500">
          <CurrencyDollarIcon className="w-5 h-5" />
          <p className="text-sm">No execution data available yet. Token metrics will appear after the story is executed through a workflow.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-lg border border-border shadow-md overflow-hidden">
      {/* Header */}
      <div className="border-b border-border p-4 bg-bg-secondary">
        <h2 className="text-lg font-semibold text-fg flex items-center gap-2">
          <CurrencyDollarIcon className="w-5 h-5 text-green-600" />
          Token Usage & Cost
        </h2>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-bg-secondary border-b border-border">
        <div className="bg-card rounded-lg border border-border p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted">Total Tokens</p>
              <p className="text-2xl font-bold text-fg mt-1">{formatNumber(metrics.totalTokens)}</p>
            </div>
            <CpuChipIcon className="w-8 h-8 text-blue-500" />
          </div>
        </div>

        <div className="bg-card rounded-lg border border-border p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted">Total Cost</p>
              <p className="text-2xl font-bold text-green-600 mt-1">${metrics.totalCost.toFixed(2)}</p>
            </div>
            <CurrencyDollarIcon className="w-8 h-8 text-green-500" />
          </div>
        </div>

        <div className="bg-card rounded-lg border border-border p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted">Workflow Runs</p>
              <p className="text-2xl font-bold text-fg mt-1">{metrics.breakdown.length}</p>
            </div>
            <ClockIcon className="w-8 h-8 text-purple-500" />
          </div>
        </div>
      </div>

      {/* Workflow Runs Breakdown */}
      <div className="p-4 space-y-3">
        <h4 className="text-sm font-semibold text-fg mb-3">Workflow Execution History</h4>
        {metrics.breakdown.map((run) => (
          <div key={run.workflowRunId} className="border border-border rounded-lg overflow-hidden">
            {/* Run Header */}
            <button
              onClick={() => toggleRun(run.workflowRunId)}
              className="w-full px-4 py-3 bg-bg-secondary hover:bg-muted transition-colors text-left flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-fg">{run.workflowName}</span>
                <span className={`px-2 py-1 rounded-md text-xs font-medium border ${STATUS_COLORS[run.status] || STATUS_COLORS.pending}`}>
                  {run.status}
                </span>
              </div>
              <div className="flex items-center gap-4 text-sm text-muted">
                <span>{formatNumber(run.tokens)} tokens</span>
                <span className="font-semibold text-green-600">${run.cost.toFixed(2)}</span>
                <svg
                  className={`w-5 h-5 text-muted transition-transform ${expandedRuns.has(run.workflowRunId) ? 'transform rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </button>

            {/* Run Details (Expandable) */}
            {expandedRuns.has(run.workflowRunId) && (
              <div className="bg-card p-4 border-t border-border">
                <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
                  <div>
                    <span className="text-muted">Started:</span>
                    <span className="ml-2 text-fg">{formatDate(run.startedAt)}</span>
                  </div>
                  <div>
                    <span className="text-muted">Duration:</span>
                    <span className="ml-2 text-fg">{calculateDuration(run.startedAt, run.completedAt)}</span>
                  </div>
                </div>

                {run.components.length > 0 && (
                  <div>
                    <h5 className="text-xs font-semibold text-fg mb-2">Component Breakdown</h5>
                    <div className="space-y-2">
                      {run.components.map((comp, idx) => (
                        <div key={idx} className="flex items-center justify-between py-2 px-3 bg-bg-secondary rounded border border-border">
                          <span className="text-sm font-medium text-fg">{comp.componentName}</span>
                          <div className="flex items-center gap-4 text-xs text-muted">
                            <span>{formatNumber(comp.tokens)} tokens</span>
                            <span className="text-green-600 font-semibold">${comp.cost.toFixed(4)}</span>
                            {comp.userPrompts > 0 && (
                              <span className="text-blue-600">{comp.userPrompts} prompts</span>
                            )}
                            {comp.iterations > 0 && (
                              <span className="text-purple-600">{comp.iterations} iterations</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
