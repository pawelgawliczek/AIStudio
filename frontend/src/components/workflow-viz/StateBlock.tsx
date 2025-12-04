/**
 * StateBlock Component
 * ST-168: Individual state visualization with phases matching design
 * Theme-friendly (supports dark/light mode)
 *
 * Design from plan:
 * ┌─ STATE 1: Analysis ─────────────────────────────────── ✓ COMPLETED ─────┐
 * │                                                                         │
 * │  ┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐  │
 * │  │  PRE-EXECUTION   │───▶│   AGENT: BA      │───▶│  POST-EXECUTION  │  │
 * │  │  ────────────    │    │   ────────────   │    │  ────────────    │  │
 * │  │  📋 Read story   │    │  🤖 Analyze req  │    │  📄 Save artifact │  │
 * │  └──────────────────┘    └──────────────────┘    └──────────────────┘  │
 * │                                                                         │
 * │  📊 Tokens: 2,450  ⏱ 45s  📁 Artifacts: BA_ANALYSIS                    │
 * └─────────────────────────────────────────────────────────────────────────┘
 */

import React, { useEffect, useState } from 'react';
import { StateBlockProps, StateStatus, ArtifactInstance, ArtifactAccess } from './types';
import { getStatusClasses, getStatusLabel } from './utils/status-colors';
import { formatDuration, formatTokens } from './utils/format-duration';

// Extended props for artifact and transcript support
interface ExtendedStateBlockProps extends StateBlockProps {
  artifacts?: ArtifactInstance[];
  artifactAccess?: ArtifactAccess[];
  transcriptId?: string;
  onViewLiveFeed?: (componentRunId: string) => void;
  onViewTranscript?: (transcriptId: string) => void;
  onViewArtifact?: (artifactId: string) => void;
}

export const StateBlock: React.FC<ExtendedStateBlockProps> = ({
  state,
  componentRun,
  isExpanded,
  onToggle,
  variant,
  artifacts = [],
  artifactAccess = [],
  transcriptId,
  onViewLiveFeed,
  onViewTranscript,
  onViewArtifact,
}) => {
  const [liveDuration, setLiveDuration] = useState<string>('');

  // Determine state status from componentRun or state itself
  const getStateStatus = (): StateStatus => {
    if (componentRun?.status) return componentRun.status as StateStatus;
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

  const handleClick = () => onToggle();

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onToggle();
    }
  };

  // Get phase status based on overall state status
  const getPhaseStatus = (phase: 'pre' | 'agent' | 'post') => {
    if (status === 'completed') return 'completed';
    if (status === 'failed') return phase === 'agent' ? 'failed' : 'completed';
    if (status === 'running') {
      if (phase === 'pre') return 'completed';
      if (phase === 'agent') return 'running';
      return 'pending';
    }
    return 'pending';
  };

  // Status icon for each phase
  const PhaseStatusIcon: React.FC<{ phaseStatus: string }> = ({ phaseStatus }) => {
    switch (phaseStatus) {
      case 'completed':
        return <span className="text-green-600 dark:text-green-400">✓</span>;
      case 'running':
        return <span className="text-blue-600 dark:text-blue-400 animate-pulse">▶</span>;
      case 'failed':
        return <span className="text-red-600 dark:text-red-400">✕</span>;
      default:
        return <span className="text-gray-400 dark:text-gray-500">○</span>;
    }
  };

  // Progress calculation for running states
  const getProgress = () => {
    if (status === 'completed') return 100;
    if (status === 'running') {
      const preStatus = getPhaseStatus('pre');
      const agentStatus = getPhaseStatus('agent');
      if (preStatus === 'completed' && agentStatus === 'running') return 50;
      if (preStatus === 'completed') return 33;
      return 10;
    }
    return 0;
  };

  // Border color based on status (theme-aware)
  const getBorderColor = () => {
    switch (status) {
      case 'completed':
        return 'border-green-400 dark:border-green-500/50';
      case 'running':
        return 'border-blue-400 dark:border-blue-500/50';
      case 'failed':
        return 'border-red-400 dark:border-red-500/50';
      case 'paused':
        return 'border-yellow-400 dark:border-yellow-500/50';
      default:
        return 'border-gray-300 dark:border-gray-700';
    }
  };

  // Header background based on status (theme-aware)
  const getHeaderBg = () => {
    switch (status) {
      case 'completed':
        return 'bg-green-50 dark:bg-green-500/10';
      case 'running':
        return 'bg-blue-50 dark:bg-blue-500/10';
      case 'failed':
        return 'bg-red-50 dark:bg-red-500/10';
      case 'paused':
        return 'bg-yellow-50 dark:bg-yellow-500/10';
      default:
        return 'bg-gray-50 dark:bg-gray-800/50';
    }
  };

  // Phase box classes based on phase status (theme-aware)
  const getPhaseBoxClasses = (phaseStatus: string) => {
    switch (phaseStatus) {
      case 'completed':
        return 'border-green-300 dark:border-green-500/30 bg-green-50 dark:bg-green-500/5';
      case 'running':
        return 'border-blue-400 dark:border-blue-500/50 bg-blue-50 dark:bg-blue-500/10';
      case 'failed':
        return 'border-red-300 dark:border-red-500/30 bg-red-50 dark:bg-red-500/5';
      default:
        return 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50';
    }
  };

  return (
    <div
      className={`rounded-lg overflow-hidden border-2 ${getBorderColor()} transition-all duration-200`}
    >
      {/* State Header */}
      <button
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        className={`w-full p-3 flex items-center justify-between ${getHeaderBg()} hover:bg-gray-100 dark:hover:bg-gray-800/80 transition-colors text-left`}
        aria-expanded={isExpanded}
        aria-controls={`state-${state.id}`}
        role="button"
        tabIndex={0}
      >
        <div className="flex items-center gap-3">
          <div className="text-gray-500 dark:text-gray-400 text-sm">
            {isExpanded ? '▼' : '▶'}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500 dark:text-gray-500 font-mono">
                STATE {state.order}:
              </span>
              <h3 className="font-semibold text-gray-900 dark:text-white">{displayName}</h3>
              {state.requiresApproval && (
                <span
                  data-testid="approval-gate-icon"
                  className="px-1.5 py-0.5 text-xs bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-400 rounded"
                  title="Approval required"
                >
                  👤 Approval
                </span>
              )}
              <span className="text-xs text-gray-500 dark:text-gray-500">
                {state.runLocation === 'laptop' ? '💻 laptop' : '🖥 local'}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span data-testid="state-status" className={getStatusClasses(status)}>
            {status === 'completed' && '✓ '}
            {status === 'running' && '▶ '}
            {status === 'failed' && '✕ '}
            {status === 'paused' && '⏸ '}
            {getStatusLabel(status)}
          </span>
        </div>
      </button>

      {/* Progress bar for running states */}
      {status === 'running' && (
        <div className="h-1 bg-gray-200 dark:bg-gray-700">
          <div
            className="h-full bg-blue-500 transition-all duration-500 animate-pulse"
            style={{ width: `${getProgress()}%` }}
          />
        </div>
      )}

      {/* Always show phase visualization for full variant, or when expanded */}
      {(variant === 'full' || isExpanded) && (
        <div
          id={`state-${state.id}`}
          data-testid={`state-block-expanded-${state.id}`}
          className="p-4 bg-white dark:bg-gray-900/80"
        >
          {/* Three-phase horizontal layout */}
          <div className="flex items-stretch gap-2 mb-4">
            {/* PRE-EXECUTION Phase */}
            <div className={`flex-1 rounded-lg border ${getPhaseBoxClasses(getPhaseStatus('pre'))} p-3`}>
              <div className="flex items-center gap-2 mb-2">
                <PhaseStatusIcon phaseStatus={getPhaseStatus('pre')} />
                <span className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                  Pre-Execution
                </span>
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-500">
                {state.preExecutionInstructions ? (
                  <div className="line-clamp-2">{state.preExecutionInstructions}</div>
                ) : (
                  <span className="italic">No pre-instructions</span>
                )}
              </div>
            </div>

            {/* Arrow */}
            <div className="flex items-center text-gray-400 dark:text-gray-500">→</div>

            {/* AGENT Phase - Clickable for live feed or transcript */}
            <div
              className={`flex-1 rounded-lg border ${getPhaseBoxClasses(getPhaseStatus('agent'))} p-3 ${
                componentRun ? 'cursor-pointer hover:ring-2 hover:ring-blue-400/50 transition-all' : ''
              }`}
              onClick={() => {
                if (!componentRun) return;
                if (status === 'running' && onViewLiveFeed) {
                  onViewLiveFeed(componentRun.id);
                } else if ((status === 'completed' || status === 'failed') && transcriptId && onViewTranscript) {
                  onViewTranscript(transcriptId);
                }
              }}
              role={componentRun ? 'button' : undefined}
              tabIndex={componentRun ? 0 : undefined}
            >
              <div className="flex items-center gap-2 mb-2">
                <PhaseStatusIcon phaseStatus={getPhaseStatus('agent')} />
                <span className="text-xs font-semibold text-blue-700 dark:text-blue-400 uppercase tracking-wider">
                  🤖 Agent
                </span>
                {status === 'running' && (
                  <span className="ml-auto text-xs text-blue-600 dark:text-blue-400 animate-pulse">
                    Executing...
                  </span>
                )}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-500">
                {componentRun ? (
                  <div>
                    <div className="text-gray-700 dark:text-gray-300 font-medium">
                      {componentRun.componentName || 'Component'}
                    </div>
                    {status === 'running' && liveDuration && (
                      <div className="text-blue-600 dark:text-blue-400 mt-1">⏱ {liveDuration}</div>
                    )}
                    {/* Action button for live feed or transcript */}
                    <div className="mt-2">
                      {status === 'running' ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onViewLiveFeed?.(componentRun.id);
                          }}
                          className="px-2 py-1 text-xs rounded bg-blue-100 dark:bg-blue-500/20 hover:bg-blue-200 dark:hover:bg-blue-500/30 text-blue-700 dark:text-blue-400 transition-colors"
                        >
                          📡 Live Feed
                        </button>
                      ) : (status === 'completed' || status === 'failed') && transcriptId ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onViewTranscript?.(transcriptId);
                          }}
                          className="px-2 py-1 text-xs rounded bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 transition-colors"
                        >
                          📜 View Transcript
                        </button>
                      ) : null}
                    </div>
                  </div>
                ) : (
                  <span className="italic">No agent assigned</span>
                )}
              </div>
            </div>

            {/* Arrow */}
            <div className="flex items-center text-gray-400 dark:text-gray-500">→</div>

            {/* POST-EXECUTION Phase */}
            <div className={`flex-1 rounded-lg border ${getPhaseBoxClasses(getPhaseStatus('post'))} p-3`}>
              <div className="flex items-center gap-2 mb-2">
                <PhaseStatusIcon phaseStatus={getPhaseStatus('post')} />
                <span className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                  Post-Execution
                </span>
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-500">
                {state.postExecutionInstructions ? (
                  <div className="line-clamp-2">{state.postExecutionInstructions}</div>
                ) : (
                  <span className="italic">No post-instructions</span>
                )}
              </div>
            </div>
          </div>

          {/* Metrics bar at bottom */}
          {componentRun && (
            <div className="flex items-center gap-4 pt-3 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400">
              {componentRun.tokenMetrics && (
                <div className="flex items-center gap-1">
                  <span>📊</span>
                  <span className="text-gray-700 dark:text-gray-300">
                    {formatTokens(componentRun.tokenMetrics.totalTokens)}
                  </span>
                  <span>tokens</span>
                </div>
              )}
              {(componentRun.completedAt || status === 'running') && (
                <div className="flex items-center gap-1">
                  <span>⏱</span>
                  <span className="text-gray-700 dark:text-gray-300" data-testid="live-duration">
                    {componentRun.completedAt
                      ? formatDuration(componentRun.startedAt, componentRun.completedAt)
                      : liveDuration || formatDuration(componentRun.startedAt)}
                  </span>
                </div>
              )}
              {state.requiresApproval && (
                <div className="flex items-center gap-1 text-purple-600 dark:text-purple-400">
                  <span>👤</span>
                  <span>Approval required</span>
                </div>
              )}
            </div>
          )}

          {/* Artifacts section */}
          {(artifacts.length > 0 || artifactAccess.length > 0) && (
            <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
              <div className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-2">
                📁 Artifacts
              </div>
              <div className="flex flex-wrap gap-2">
                {/* Show artifact access rules */}
                {artifactAccess.map((access) => {
                  const existingArtifact = artifacts.find(a => a.definitionKey === access.definitionKey);
                  return (
                    <button
                      key={access.definitionKey}
                      onClick={() => existingArtifact && onViewArtifact?.(existingArtifact.id)}
                      className={`px-2 py-1 text-xs rounded transition-colors ${
                        existingArtifact
                          ? 'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-500/30 cursor-pointer'
                          : access.accessType === 'write'
                          ? 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                      }`}
                      disabled={!existingArtifact}
                      title={
                        existingArtifact
                          ? `View ${access.definitionName} (v${existingArtifact.version})`
                          : access.accessType === 'write'
                          ? `Will create: ${access.definitionName}`
                          : `Requires: ${access.definitionName}`
                      }
                    >
                      {access.accessType === 'read' && '📥 '}
                      {access.accessType === 'write' && '📤 '}
                      {access.accessType === 'required' && '🔒 '}
                      {access.definitionKey}
                      {existingArtifact && ` v${existingArtifact.version}`}
                    </button>
                  );
                })}
                {/* Show artifacts without access rules (created by this state) */}
                {artifacts
                  .filter(a => !artifactAccess.find(acc => acc.definitionKey === a.definitionKey))
                  .map((artifact) => (
                    <button
                      key={artifact.id}
                      onClick={() => onViewArtifact?.(artifact.id)}
                      className="px-2 py-1 text-xs rounded bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-500/30 cursor-pointer transition-colors"
                      title={`View ${artifact.definitionName} (v${artifact.version})`}
                    >
                      📄 {artifact.definitionKey} v{artifact.version}
                    </button>
                  ))}
              </div>
            </div>
          )}

          {/* Error display */}
          {status === 'failed' && componentRun?.errorMessage && (
            <div className="mt-3 p-3 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded">
              <div className="flex items-start gap-2">
                <span data-testid="error-icon" className="text-red-600 dark:text-red-400">⚠️</span>
                <div className="flex-1">
                  <div className="text-sm text-red-700 dark:text-red-400 font-semibold mb-1">Error</div>
                  <div className="text-xs text-red-600 dark:text-red-300">{componentRun.errorMessage}</div>
                </div>
              </div>
              <button
                className="mt-3 px-3 py-1 text-xs rounded bg-blue-100 dark:bg-blue-500/20 hover:bg-blue-200 dark:hover:bg-blue-500/30 text-blue-700 dark:text-blue-400"
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
