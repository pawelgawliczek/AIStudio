/**
 * StateBlock Component
 * ST-168: Individual state visualization with phases
 */

import React, { useEffect, useState } from 'react';
import { StateBlockProps, StateStatus } from './types';
import { getStatusClasses, getStatusLabel } from './utils/status-colors';
import { formatDuration, formatTokens } from './utils/format-duration';

export const StateBlock: React.FC<StateBlockProps> = ({
  state,
  componentRun,
  isExpanded,
  onToggle,
  variant,
}) => {
  const [liveDuration, setLiveDuration] = useState<string>('');

  // Determine state status from componentRun or state itself (for tests/simple data)
  const getStateStatus = (): StateStatus => {
    // First check componentRun (production data)
    if (componentRun?.status) return componentRun.status as StateStatus;
    // Fallback to state.status (test data / simple mode)
    if ((state as any).status) return (state as any).status as StateStatus;
    return 'pending';
  };

  const status = getStateStatus();

  // Live duration updates for running states
  useEffect(() => {
    if (status === 'running' && componentRun?.startedAt) {
      const interval = setInterval(() => {
        setLiveDuration(formatDuration(componentRun.startedAt));
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [status, componentRun?.startedAt]);

  // Truncate name for compact variant
  const displayName =
    variant === 'compact' ? state.name.substring(0, 4) : state.name;

  const handleClick = () => {
    onToggle();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onToggle();
    }
  };

  return (
    <div className="border border-gray-700 rounded-lg overflow-hidden my-2">
      {/* Header - Always visible */}
      <button
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        className="w-full p-4 flex items-center justify-between hover:bg-gray-800/50 transition-colors text-left"
        aria-expanded={isExpanded}
        aria-controls={`state-${state.id}`}
        role="button"
        tabIndex={0}
      >
        <div className="flex items-center gap-3 flex-1">
          <div className="text-gray-400">
            {isExpanded ? '▼' : '▶'}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold">{displayName}</h3>
              {state.requiresApproval && (
                <span
                  data-testid="approval-gate-icon"
                  className="text-xs text-purple-400"
                  title="Approval required"
                >
                  👤
                </span>
              )}
              {variant === 'full' && (
                <span className="text-xs text-gray-500">
                  {state.runLocation === 'laptop' ? (
                    <span data-testid="laptop-icon" title="Runs on laptop">
                      💻 laptop
                    </span>
                  ) : (
                    <span data-testid="local-icon" title="Runs locally">
                      🖥 local
                    </span>
                  )}
                </span>
              )}
            </div>
            {state.requiresApproval && !isExpanded && (
              <div className="text-xs text-purple-400 mt-1">
                Approval required after completion
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span data-testid="state-status" className={getStatusClasses(status)}>
            {getStatusLabel(status)}
          </span>
        </div>
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div
          id={`state-${state.id}`}
          data-testid={`state-block-expanded-${state.id}`}
          className="p-4 border-t border-gray-700 bg-gray-900/50"
        >
          {/* Phase visualization */}
          <div className="space-y-4">
            {/* Pre-execution phase */}
            <div className="border-l-4 border-gray-600 pl-4">
              <div className="text-sm font-semibold text-gray-400 mb-1">
                PRE-EXECUTION
              </div>
              {state.preExecutionInstructions && (
                <div className="text-xs text-gray-500 mt-2">
                  {state.preExecutionInstructions}
                </div>
              )}
            </div>

            {/* Agent execution phase */}
            <div className="border-l-4 border-blue-500 pl-4">
              <div className="text-sm font-semibold text-blue-400 mb-1">
                AGENT EXECUTION
              </div>
              {componentRun && (
                <div className="text-xs text-gray-500 mt-2">
                  Component: {componentRun.componentName || 'Unknown'}
                  {status === 'running' && (
                    <span className="ml-2 text-blue-400">▶ EXECUTING...</span>
                  )}
                </div>
              )}
            </div>

            {/* Post-execution phase */}
            <div className="border-l-4 border-gray-600 pl-4">
              <div className="text-sm font-semibold text-gray-400 mb-1">
                POST-EXECUTION
              </div>
              {state.postExecutionInstructions && (
                <div className="text-xs text-gray-500 mt-2">
                  {state.postExecutionInstructions}
                </div>
              )}
            </div>
          </div>

          {/* Metrics */}
          {componentRun && (
            <div className="mt-4 pt-4 border-t border-gray-700">
              <div className="text-sm text-gray-400 space-y-1">
                {componentRun.tokenMetrics && (
                  <div>
                    📊 Tokens:{' '}
                    <span className="text-gray-200">
                      {formatTokens(componentRun.tokenMetrics.inputTokens)}{' '}
                    </span>
                    in /{' '}
                    <span className="text-gray-200">
                      {formatTokens(componentRun.tokenMetrics.outputTokens)}
                    </span>{' '}
                    out /{' '}
                    <span className="text-gray-200">
                      {formatTokens(componentRun.tokenMetrics.totalTokens)}
                    </span>{' '}
                    total
                  </div>
                )}
                {componentRun.completedAt ? (
                  <div>
                    ⏱{' '}
                    {formatDuration(
                      componentRun.startedAt,
                      componentRun.completedAt
                    )}
                  </div>
                ) : (
                  status === 'running' && (
                    <div data-testid="live-duration">
                      ⏱ {liveDuration || formatDuration(componentRun.startedAt)}
                    </div>
                  )
                )}
              </div>
            </div>
          )}

          {/* Error display */}
          {status === 'failed' && componentRun?.errorMessage && (
            <div className="mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded">
              <div className="flex items-start gap-2">
                <span data-testid="error-icon" className="text-red-400">
                  ⚠️
                </span>
                <div className="flex-1">
                  <div className="text-sm text-red-400 font-semibold mb-1">
                    Error
                  </div>
                  <div className="text-xs text-red-300">
                    {componentRun.errorMessage}
                  </div>
                </div>
              </div>
              <button
                className="mt-3 px-3 py-1 text-xs rounded bg-blue-500/20 hover:bg-blue-500/30 text-blue-400"
                aria-label="Retry"
              >
                Retry
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
