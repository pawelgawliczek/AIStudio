/**
 * FullStatePanel Component
 * ST-168: Full-featured panel for Workflow Monitor Page
 * Theme-friendly (supports dark/light mode)
 */

import React from 'react';
import { FullStatePanelProps } from './types';
import { StateBlock } from './StateBlock';

export const FullStatePanel: React.FC<FullStatePanelProps> = ({
  states,
  componentRuns,
  expandedStates,
  onToggle,
  showLiveStream,
  showArtifacts,
  showBreakpointControls,
  artifacts = [],
  artifactAccess = {},
  transcriptIds = {},
  onViewLiveFeed,
  onViewTranscript,
  onViewArtifact,
}) => {
  const sortedStates = [...states].sort((a, b) => a.order - b.order);

  return (
    <div data-testid="full-state-panel" className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Main state list - takes 2 columns */}
      <div className="lg:col-span-2 space-y-4">
        {sortedStates.map((state, index) => {
          const componentRun = componentRuns?.find(
            (run) => run.id === state.id || run.componentId === state.componentId
          );

          return (
            <React.Fragment key={state.id}>
              {/* Breakpoint indicator between states */}
              {index > 0 && (
                <div className="flex justify-center py-1">
                  <div className="h-4 w-px bg-gray-300 dark:bg-gray-600" />
                </div>
              )}
              <StateBlock
                state={state}
                componentRun={componentRun}
                isExpanded={expandedStates.has(state.id)}
                onToggle={() => onToggle(state.id)}
                variant="full"
                artifacts={artifacts.filter(a => {
                  // Filter artifacts that belong to this state (via artifactAccess)
                  const stateAccess = artifactAccess[state.id] || [];
                  return stateAccess.some(acc => acc.definitionKey === a.definitionKey);
                })}
                artifactAccess={artifactAccess[state.id]}
                transcriptId={componentRun ? transcriptIds[componentRun.id] : undefined}
                onViewLiveFeed={onViewLiveFeed}
                onViewTranscript={onViewTranscript}
                onViewArtifact={onViewArtifact}
              />
            </React.Fragment>
          );
        })}
      </div>

      {/* Side panels - 1 column */}
      <div className="space-y-4">
        {showLiveStream && (
          <div
            data-testid="live-execution-stream"
            className="p-4 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm"
          >
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
              Live Execution Stream
            </h3>
            <div className="text-xs">
              <div className="flex items-center gap-2 mb-2">
                <span
                  data-testid="ws-status-connected"
                  className="w-2 h-2 bg-green-500 rounded-full animate-pulse"
                />
                <span className="text-green-700 dark:text-green-400">Connected</span>
              </div>
              <div className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg text-gray-500 dark:text-gray-400 min-h-[100px]">
                No active execution
              </div>
            </div>
          </div>
        )}

        {showArtifacts && (
          <div
            data-testid="artifact-panel"
            className="p-4 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm"
          >
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
              Artifacts ({artifacts.length})
            </h3>
            {artifacts.length > 0 ? (
              <div className="space-y-2">
                {artifacts.map((artifact) => (
                  <div
                    key={artifact.id}
                    className="p-2 bg-gray-50 dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700 hover:border-blue-500 dark:hover:border-blue-400 transition-colors cursor-pointer"
                    onClick={() => onViewArtifact?.(artifact.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-gray-500 dark:text-gray-400">
                          {artifact.type === 'markdown' ? '📄' :
                           artifact.type === 'json' ? '📋' :
                           artifact.type === 'code' ? '💻' :
                           artifact.type === 'image' ? '🖼️' : '📁'}
                        </span>
                        <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                          {artifact.definitionName}
                        </span>
                      </div>
                      <span className="text-xs text-gray-400 dark:text-gray-500">
                        v{artifact.version}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {artifact.definitionKey}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-xs text-gray-500 dark:text-gray-400">
                No artifacts yet
              </div>
            )}
          </div>
        )}

        {showBreakpointControls && (
          <div className="p-4 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
              Breakpoints
            </h3>
            <button className="w-full px-3 py-2 text-xs rounded bg-blue-100 dark:bg-blue-500/20 hover:bg-blue-200 dark:hover:bg-blue-500/30 text-blue-700 dark:text-blue-400 transition-colors">
              Add Breakpoint
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
