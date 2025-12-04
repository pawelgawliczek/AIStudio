/**
 * FullStatePanel Component
 * ST-168: Full-featured panel for Workflow Monitor Page
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
}) => {
  const sortedStates = [...states].sort((a, b) => a.order - b.order);

  return (
    <div data-testid="full-state-panel" className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Main state list */}
      <div className="lg:col-span-2 space-y-2">
        {sortedStates.map((state) => {
          const componentRun = componentRuns?.find(
            (run) => run.id === state.id || run.componentId === state.componentId
          );

          return (
            <StateBlock
              key={state.id}
              state={state}
              componentRun={componentRun}
              isExpanded={expandedStates.has(state.id)}
              onToggle={() => onToggle(state.id)}
              variant="full"
            />
          );
        })}
      </div>

      {/* Side panels */}
      <div className="space-y-4">
        {showLiveStream && (
          <div
            data-testid="live-execution-stream"
            className="p-4 bg-gray-900 rounded-lg border border-gray-700"
          >
            <h3 className="text-sm font-semibold mb-2">Live Execution Stream</h3>
            <div className="text-xs text-gray-400">
              <div className="flex items-center gap-2 mb-2">
                <span data-testid="ws-status-connected" className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                <span>Connected</span>
              </div>
              <div className="text-gray-500">No active execution</div>
            </div>
          </div>
        )}

        {showArtifacts && (
          <div
            data-testid="artifact-panel"
            className="p-4 bg-gray-900 rounded-lg border border-gray-700"
          >
            <h3 className="text-sm font-semibold mb-2">Artifacts</h3>
            <div className="text-xs text-gray-400">No artifacts yet</div>
          </div>
        )}

        {showBreakpointControls && (
          <div className="p-4 bg-gray-900 rounded-lg border border-gray-700">
            <h3 className="text-sm font-semibold mb-2">Breakpoints</h3>
            <button className="w-full px-3 py-2 text-xs rounded bg-blue-500/20 hover:bg-blue-500/30 text-blue-400">
              Add Breakpoint
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
