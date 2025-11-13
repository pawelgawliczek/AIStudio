import { useState } from 'react';
import { ComponentRunDetails, RunStatus } from '../../services/workflow-runs.service';

interface ComponentTimelineProps {
  componentRuns: ComponentRunDetails[];
}

export function ComponentTimeline({ componentRuns }: ComponentTimelineProps) {
  const [expandedRun, setExpandedRun] = useState<string | null>(null);

  const getStatusIcon = (status: RunStatus, success: boolean) => {
    if (status === RunStatus.COMPLETED && success) {
      return <span className="text-green-600">✓</span>;
    }
    if (status === RunStatus.FAILED || (status === RunStatus.COMPLETED && !success)) {
      return <span className="text-red-600">✗</span>;
    }
    if (status === RunStatus.RUNNING) {
      return <span className="text-blue-600">⟳</span>;
    }
    return <span className="text-gray-400">○</span>;
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return 'N/A';
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}min ${secs}s`;
  };

  const formatNumber = (num?: number) => {
    if (num === undefined || num === null) return 'N/A';
    return num.toLocaleString();
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-xl font-bold text-gray-900 mb-4">
        Component Execution Timeline ({componentRuns.length} runs)
      </h2>

      <div className="space-y-3">
        {componentRuns.map((run, index) => (
          <div key={run.id} className="border border-gray-200 rounded-lg overflow-hidden">
            {/* Component Header */}
            <div
              className="bg-gray-50 p-4 cursor-pointer hover:bg-gray-100 transition"
              onClick={() => setExpandedRun(expandedRun === run.id ? null : run.id)}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-3 flex-1">
                  <div className="text-2xl mt-1">
                    {getStatusIcon(run.status, run.success)}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-semibold text-gray-900">
                        [{index + 1}] {run.componentName}
                      </h3>
                      {run.status === RunStatus.RUNNING && (
                        <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">
                          Running
                        </span>
                      )}
                    </div>
                    {run.componentDescription && (
                      <p className="text-sm text-gray-600 mt-1">{run.componentDescription}</p>
                    )}
                    <div className="flex items-center gap-4 mt-2 text-sm text-gray-600">
                      <span>Duration: <strong>{formatDuration(run.durationSeconds)}</strong></span>
                      <span>Tokens: <strong>{formatNumber(run.totalTokens)}</strong></span>
                      {run.locGenerated !== undefined && run.locGenerated > 0 && (
                        <span>LOC: <strong>{formatNumber(run.locGenerated)}</strong></span>
                      )}
                      {run.userPrompts !== undefined && (
                        <span>Prompts: <strong>{run.userPrompts}</strong></span>
                      )}
                    </div>
                  </div>
                </div>
                <button className="text-gray-400 hover:text-gray-600">
                  {expandedRun === run.id ? '▼' : '▶'}
                </button>
              </div>
            </div>

            {/* Expanded Details */}
            {expandedRun === run.id && (
              <div className="p-4 bg-white border-t border-gray-200">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
                  <div>
                    <div className="text-xs text-gray-500">Started</div>
                    <div className="text-sm font-medium">
                      {new Date(run.startedAt).toLocaleString()}
                    </div>
                  </div>
                  {run.finishedAt && (
                    <div>
                      <div className="text-xs text-gray-500">Finished</div>
                      <div className="text-sm font-medium">
                        {new Date(run.finishedAt).toLocaleString()}
                      </div>
                    </div>
                  )}
                  <div>
                    <div className="text-xs text-gray-500">Iterations</div>
                    <div className="text-sm font-medium">
                      {run.systemIterations || 'N/A'} system iterations
                    </div>
                  </div>
                </div>

                {/* Metrics */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                  <div className="bg-blue-50 rounded p-2">
                    <div className="text-xs text-blue-600">Tokens/LOC</div>
                    <div className="text-lg font-bold text-blue-900">
                      {run.tokensPerLoc?.toFixed(2) || 'N/A'}
                    </div>
                  </div>
                  <div className="bg-green-50 rounded p-2">
                    <div className="text-xs text-green-600">LOC/Prompt</div>
                    <div className="text-lg font-bold text-green-900">
                      {run.locPerPrompt?.toFixed(2) || 'N/A'}
                    </div>
                  </div>
                  <div className="bg-purple-50 rounded p-2">
                    <div className="text-xs text-purple-600">Runtime/LOC</div>
                    <div className="text-lg font-bold text-purple-900">
                      {run.runtimePerLoc?.toFixed(2) || 'N/A'}
                    </div>
                  </div>
                  <div className="bg-orange-50 rounded p-2">
                    <div className="text-xs text-orange-600">Runtime/Token</div>
                    <div className="text-lg font-bold text-orange-900">
                      {run.runtimePerToken?.toFixed(4) || 'N/A'}
                    </div>
                  </div>
                </div>

                {/* Files Modified */}
                {run.filesModified && run.filesModified.length > 0 && (
                  <div className="mb-4">
                    <div className="text-sm font-medium text-gray-700 mb-2">
                      Files Modified ({run.filesModified.length})
                    </div>
                    <div className="bg-gray-50 rounded p-2 max-h-32 overflow-y-auto">
                      {run.filesModified.map((file, i) => (
                        <div key={i} className="text-xs font-mono text-gray-700 py-1">
                          {file}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Commits */}
                {run.commits && run.commits.length > 0 && (
                  <div className="mb-4">
                    <div className="text-sm font-medium text-gray-700 mb-2">
                      Commits ({run.commits.length})
                    </div>
                    <div className="space-y-1">
                      {run.commits.map((commit, i) => (
                        <div key={i} className="text-xs font-mono bg-gray-50 rounded px-2 py-1">
                          {commit}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Error Message */}
                {run.errorMessage && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded">
                    <div className="text-sm text-red-800">
                      <strong>Error:</strong> {run.errorMessage}
                    </div>
                  </div>
                )}

                {/* Output Preview */}
                {run.output && (
                  <div className="mt-4">
                    <div className="text-sm font-medium text-gray-700 mb-2">Output</div>
                    <div className="bg-gray-900 text-gray-100 rounded p-3 max-h-48 overflow-y-auto">
                      <pre className="text-xs whitespace-pre-wrap">{run.output}</pre>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}

        {componentRuns.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            No component runs recorded yet.
          </div>
        )}
      </div>
    </div>
  );
}
