/**
 * ExecutionHistory Component
 * ST-168: Past runs list with transcript access (Design 6)
 */

import React, { useState } from 'react';

export interface ExecutionRun {
  id: string;
  status: 'completed' | 'running' | 'failed' | 'cancelled' | 'paused';
  startedAt: string;
  completedAt: string | null;
  totalTokens: number;
  statesExecuted: StateExecution[];
  artifacts: string[];
  error?: string;
}

export interface StateExecution {
  order: number;
  name: string;
  status: 'completed' | 'running' | 'failed' | 'skipped' | 'approved';
  duration: number; // seconds
}

export interface ExecutionHistoryProps {
  runs: ExecutionRun[];
  onViewTranscript?: (runId: string, stateOrder?: number) => void;
  onViewLogs?: (runId: string, stateOrder?: number) => void;
  onViewArtifacts?: (runId: string) => void;
  onDownloadTranscript?: (runId: string) => void;
  onViewError?: (runId: string) => void;
  onResume?: (runId: string) => void;
}

const getStatusColor = (status: ExecutionRun['status']): string => {
  switch (status) {
    case 'completed':
      return 'bg-green-500/20 text-green-400';
    case 'running':
      return 'bg-blue-500/20 text-blue-400 animate-pulse';
    case 'failed':
      return 'bg-red-500/20 text-red-400';
    case 'paused':
      return 'bg-yellow-500/20 text-yellow-400';
    case 'cancelled':
      return 'bg-gray-500/20 text-gray-400';
    default:
      return 'bg-muted/20 text-muted';
  }
};

const getStatusIcon = (status: ExecutionRun['status']): string => {
  switch (status) {
    case 'completed':
      return '✓';
    case 'running':
      return '▶▶';
    case 'failed':
      return '✗';
    case 'paused':
      return '⏸';
    case 'cancelled':
      return '○';
    default:
      return '○';
  }
};

const getStateStatusColor = (status: StateExecution['status']): string => {
  switch (status) {
    case 'completed':
      return 'text-green-400';
    case 'running':
      return 'text-blue-400';
    case 'failed':
      return 'text-red-400';
    case 'skipped':
      return 'text-gray-500';
    case 'approved':
      return 'text-green-400';
    default:
      return 'text-gray-400';
  }
};

const getStateStatusIcon = (status: StateExecution['status']): string => {
  switch (status) {
    case 'completed':
      return '✓ Complete';
    case 'running':
      return '▶ Running';
    case 'failed':
      return '✗ Failed';
    case 'skipped':
      return '○ Skipped';
    case 'approved':
      return '✓ Approved';
    default:
      return '○ Pending';
  }
};

const formatDuration = (seconds: number): string => {
  if (seconds < 60) {
    return `${seconds}s`;
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
};

const formatTimestamp = (timestamp: string): string => {
  return new Date(timestamp).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
};

const calculateDuration = (startedAt: string, completedAt: string | null): string => {
  const start = new Date(startedAt).getTime();
  const end = completedAt ? new Date(completedAt).getTime() : Date.now();
  const durationSeconds = Math.floor((end - start) / 1000);
  return formatDuration(durationSeconds);
};

const formatNumber = (num: number): string => {
  return num.toLocaleString();
};

export const ExecutionHistory: React.FC<ExecutionHistoryProps> = ({
  runs,
  onViewTranscript,
  onViewLogs,
  onViewArtifacts,
  onDownloadTranscript,
  onViewError,
  onResume,
}) => {
  const [expandedRuns, setExpandedRuns] = useState<Set<string>>(new Set());

  const toggleRun = (runId: string) => {
    setExpandedRuns((prev) => {
      const next = new Set(prev);
      if (next.has(runId)) {
        next.delete(runId);
      } else {
        next.add(runId);
      }
      return next;
    });
  };

  if (runs.length === 0) {
    return (
      <div
        className="border border-gray-700 rounded-lg bg-gray-900 p-8"
        data-testid="execution-history-empty"
      >
        <div className="text-center text-gray-500">
          No execution history available
        </div>
      </div>
    );
  }

  return (
    <div
      className="border border-gray-700 rounded-lg bg-gray-900"
      data-testid="execution-history"
      role="region"
      aria-label="Execution history"
    >
      <div className="p-3 border-b border-gray-700">
        <h3 className="font-semibold text-gray-200">Execution History</h3>
      </div>

      <div className="divide-y divide-gray-700">
        {runs.map((run) => {
          const isExpanded = expandedRuns.has(run.id);
          const duration = calculateDuration(run.startedAt, run.completedAt);

          return (
            <div key={run.id} className="p-3" data-testid={`run-${run.id}`}>
              {/* Run Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 flex-1">
                  <button
                    onClick={() => toggleRun(run.id)}
                    className="text-gray-400 hover:text-gray-200"
                    data-testid={`toggle-run-${run.id}`}
                    aria-label={isExpanded ? 'Collapse run details' : 'Expand run details'}
                  >
                    {isExpanded ? '▼' : '▶'}
                  </button>

                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-200">
                        Run: {run.id.slice(0, 8)}
                      </span>
                      <span
                        className={`px-2 py-1 text-xs rounded ${getStatusColor(run.status)}`}
                        data-testid={`run-status-${run.id}`}
                      >
                        {getStatusIcon(run.status)} {run.status.toUpperCase()}
                      </span>
                    </div>

                    <div className="flex items-center gap-4 text-xs text-gray-500 mt-1">
                      <span data-testid={`run-start-${run.id}`}>
                        Started: {formatTimestamp(run.startedAt)}
                      </span>
                      <span data-testid={`run-duration-${run.id}`}>
                        Duration: {duration}
                      </span>
                      <span data-testid={`run-tokens-${run.id}`}>
                        Tokens: {formatNumber(run.totalTokens)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Expanded Details */}
              {isExpanded && (
                <div className="mt-3 pl-6" data-testid={`run-details-${run.id}`}>
                  {/* States Executed Table */}
                  <div className="mb-4">
                    <h4 className="text-sm font-medium text-gray-300 mb-2">
                      States Executed:
                    </h4>
                    <div className="bg-gray-800 rounded overflow-hidden">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-gray-700">
                            <th className="px-3 py-2 text-left text-gray-400 font-medium w-12">
                              #
                            </th>
                            <th className="px-3 py-2 text-left text-gray-400 font-medium">
                              State
                            </th>
                            <th className="px-3 py-2 text-left text-gray-400 font-medium">
                              Status
                            </th>
                            <th className="px-3 py-2 text-left text-gray-400 font-medium">
                              Duration
                            </th>
                            <th className="px-3 py-2 text-left text-gray-400 font-medium">
                              Actions
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {run.statesExecuted.map((state) => (
                            <tr
                              key={state.order}
                              className="border-b border-gray-700 last:border-b-0"
                              data-testid={`state-row-${run.id}-${state.order}`}
                            >
                              <td className="px-3 py-2 text-gray-400">{state.order}</td>
                              <td className="px-3 py-2 text-gray-200">{state.name}</td>
                              <td
                                className={`px-3 py-2 ${getStateStatusColor(state.status)}`}
                                data-testid={`state-status-${run.id}-${state.order}`}
                              >
                                {getStateStatusIcon(state.status)}
                              </td>
                              <td className="px-3 py-2 text-gray-400">
                                {formatDuration(state.duration)}
                              </td>
                              <td className="px-3 py-2">
                                <div className="flex items-center gap-2">
                                  {onViewTranscript && (
                                    <button
                                      onClick={() => onViewTranscript(run.id, state.order)}
                                      className="text-xs text-blue-400 hover:text-blue-300"
                                      data-testid={`transcript-${run.id}-${state.order}`}
                                    >
                                      [Transcript]
                                    </button>
                                  )}
                                  {onViewLogs && (
                                    <button
                                      onClick={() => onViewLogs(run.id, state.order)}
                                      className="text-xs text-gray-400 hover:text-gray-300"
                                      data-testid={`logs-${run.id}-${state.order}`}
                                    >
                                      [Logs]
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Artifacts */}
                  {run.artifacts.length > 0 && (
                    <div className="mb-4" data-testid={`artifacts-${run.id}`}>
                      <div className="text-sm text-gray-300">
                        <span className="font-medium">Artifacts Created:</span>{' '}
                        {run.artifacts.join(', ')}
                      </div>
                      <div className="flex items-center gap-3 mt-2">
                        {onViewArtifacts && (
                          <button
                            onClick={() => onViewArtifacts(run.id)}
                            className="text-xs text-blue-400 hover:text-blue-300"
                            data-testid={`view-artifacts-${run.id}`}
                          >
                            [View All Artifacts]
                          </button>
                        )}
                        {onDownloadTranscript && (
                          <button
                            onClick={() => onDownloadTranscript(run.id)}
                            className="text-xs text-gray-400 hover:text-gray-300"
                            data-testid={`download-transcript-${run.id}`}
                          >
                            [Download Full Transcript]
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Error Display */}
                  {run.status === 'failed' && run.error && (
                    <div className="mb-4" data-testid={`error-${run.id}`}>
                      <div className="p-3 bg-red-900/20 border border-red-700 rounded">
                        <div className="text-sm text-red-400 font-medium mb-1">Error:</div>
                        <div className="text-sm text-red-300">{run.error}</div>
                      </div>
                      <div className="flex items-center gap-3 mt-2">
                        {onViewError && (
                          <button
                            onClick={() => onViewError(run.id)}
                            className="text-xs text-red-400 hover:text-red-300"
                            data-testid={`view-error-${run.id}`}
                          >
                            [View Error Details]
                          </button>
                        )}
                        {onResume && (
                          <button
                            onClick={() => onResume(run.id)}
                            className="text-xs text-yellow-400 hover:text-yellow-300"
                            data-testid={`resume-${run.id}`}
                          >
                            [Resume from Checkpoint]
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
