/**
 * CompactStatePipeline Component
 * ST-168: Horizontal compact view for GlobalWorkflowTrackingBar
 */

import React from 'react';
import { CompactStatePipelineProps, StateStatus } from './types';
import { getStatusIcon } from './utils/status-colors';

export const CompactStatePipeline: React.FC<CompactStatePipelineProps> = ({
  states,
  componentRuns,
  onViewFullDetails,
}) => {
  const getStateStatus = (stateId: string): StateStatus => {
    const run = componentRuns?.find((r) => r.id === stateId);
    if (!run) return 'pending';
    return run.status as StateStatus;
  };

  return (
    <div
      data-testid="compact-state-pipeline"
      className="flex flex-col gap-2 p-4 bg-gray-900 rounded-lg border border-gray-700"
    >
      <div className="flex items-center gap-2 overflow-x-auto">
        {states.map((state, index) => {
          const status = getStateStatus(state.id);
          const icon = getStatusIcon(status);
          const truncatedName = state.name.substring(0, 4);

          return (
            <React.Fragment key={state.id}>
              <div className="flex flex-col items-center min-w-[60px]">
                <div
                  className={`
                    w-10 h-10 rounded-full flex items-center justify-center text-lg
                    ${status === 'completed' ? 'bg-green-500/20 text-green-400' : ''}
                    ${status === 'running' ? 'bg-blue-500/20 text-blue-400 animate-pulse' : ''}
                    ${status === 'failed' ? 'bg-red-500/20 text-red-400' : ''}
                    ${status === 'pending' ? 'bg-gray-500/20 text-gray-400' : ''}
                    ${status === 'paused' ? 'bg-yellow-500/20 text-yellow-400' : ''}
                  `}
                >
                  {icon}
                </div>
                <div className="text-xs text-gray-400 mt-1 text-center">
                  {truncatedName}
                </div>
                {state.requiresApproval && (
                  <div className="text-xs">👤</div>
                )}
              </div>
              {index < states.length - 1 && (
                <div className="text-gray-600">─</div>
              )}
            </React.Fragment>
          );
        })}
      </div>

      <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-700">
        <div className="text-xs text-gray-400">
          Legend: ✓ Complete · ▶▶ Running · 🛑 Breakpoint · ○ Pending · 👤 Approval
        </div>
        {onViewFullDetails && (
          <button
            onClick={onViewFullDetails}
            className="text-xs text-blue-400 hover:text-blue-300"
          >
            View Full Details →
          </button>
        )}
      </div>
    </div>
  );
};
