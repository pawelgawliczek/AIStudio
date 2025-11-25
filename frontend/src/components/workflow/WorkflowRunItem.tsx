import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { WorkflowRunItemProps } from '../../types/workflow-tracking';
import { WorkflowStatusIcon } from './WorkflowStatusIcon';
import { WorkflowRunProgress } from './WorkflowRunProgress';
import { WorkflowRunDetails } from './WorkflowRunDetails';

/**
 * Individual workflow run item with expand/collapse and interactions
 */
export const WorkflowRunItem: React.FC<WorkflowRunItemProps> = ({
  run,
  isExpanded,
  viewMode,
  animationsEnabled,
  onToggleExpand,
  onCopyWorktreePath,
  onNavigateToStory,
  onPauseRun,
  onCancelRun,
  onViewDetails,
}) => {
  const [showContextMenu, setShowContextMenu] = useState(false);

  const heightClass = viewMode === 'compact' ? 'h-14' : 'h-18';

  // Abbreviate worktree path
  const abbreviatedPath = run.worktreePath
    ? `.../${run.worktreePath.split('/').slice(-1)[0]}`
    : null;

  // Format elapsed time
  const elapsedTime = formatDuration(run.elapsedTimeMs);
  const remainingTime = run.estimatedTimeRemainingMs
    ? `~${formatDuration(run.estimatedTimeRemainingMs)}`
    : null;

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setShowContextMenu(true);
  };

  return (
    <div
      data-testid="workflow-run-item"
      className={`${heightClass} border-b border-gray-200 bg-white relative`}
      onContextMenu={handleContextMenu}
    >
      {/* Main content */}
      <div className="h-full flex items-center px-4 gap-3">
        {/* Status Icon */}
        <div
          className={
            animationsEnabled && run.status === 'running' ? 'animate-pulse' : ''
          }
        >
          <WorkflowStatusIcon status={run.status} size="md" />
        </div>

        {/* Story Key (clickable) */}
        <button
          onClick={() => onNavigateToStory(run.storyKey)}
          className="text-sm font-semibold text-blue-600 hover:text-blue-800 hover:underline"
        >
          {run.storyKey}
        </button>

        {/* Story Title */}
        <div className="flex-1 min-w-0">
          <p className="text-sm text-gray-800 truncate">{run.storyTitle}</p>
          {viewMode === 'detailed' && run.currentComponent && (
            <p className="text-xs text-gray-500">
              <span className="font-medium">Current:</span> {run.currentComponent}
            </p>
          )}
        </div>

        {/* Current Component (compact mode) */}
        {viewMode === 'compact' && run.currentComponent && (
          <div className="text-xs text-gray-600 px-2 py-1 bg-gray-100 rounded">
            {run.currentComponent}
          </div>
        )}

        {/* Progress Bar */}
        <div className="w-32">
          <WorkflowRunProgress
            progress={run.progress}
            status={run.status}
            animated={animationsEnabled}
            height="h-2"
          />
          <p className="text-xs text-gray-500 text-center mt-0.5">
            {run.progress}%
          </p>
        </div>

        {/* Branch Name */}
        {run.branchName && (
          <div className="text-xs text-gray-600 font-mono max-w-40 truncate">
            {run.branchName}
          </div>
        )}

        {/* Worktree Path (clickable to copy) */}
        {abbreviatedPath && (
          <button
            onClick={() => onCopyWorktreePath(run.worktreePath!)}
            className="text-xs text-gray-500 font-mono hover:text-gray-700 hover:underline"
            title={run.worktreePath || ''}
          >
            {abbreviatedPath}
          </button>
        )}

        {/* Queue Status Badge */}
        {run.queueStatus && (
          <div
            className={`text-xs px-2 py-1 rounded ${
              run.queueStatus === 'running'
                ? 'bg-green-100 text-green-700'
                : run.queueStatus === 'pending'
                ? 'bg-yellow-100 text-yellow-700'
                : run.queueStatus === 'failed'
                ? 'bg-red-100 text-red-700'
                : 'bg-gray-100 text-gray-600'
            }`}
          >
            {run.queueStatus === 'running' ? 'Running' : run.queueStatus}
          </div>
        )}

        {/* Queue Lock Indicator */}
        {run.queueLocked && (
          <span
            className="text-yellow-500 text-sm"
            aria-label="Queue locked"
            title="Queue is locked"
          >
            🔒
          </span>
        )}

        {/* Time Info */}
        <div className="text-xs text-gray-600 text-right min-w-20">
          <div>{elapsedTime}</div>
          {remainingTime && <div className="text-gray-500">{remainingTime}</div>}
        </div>

        {/* Expand/Collapse Button */}
        <button
          onClick={() => onToggleExpand(run.id)}
          className="text-gray-500 hover:text-gray-700 p-1"
          aria-label={isExpanded ? 'Collapse details' : 'Expand details'}
        >
          {isExpanded ? '▲' : '▼'}
        </button>
      </div>

      {/* Expandable Details Panel */}
      <AnimatePresence>
        {isExpanded && (
          <WorkflowRunDetails
            run={run}
            onClose={() => onToggleExpand(run.id)}
          />
        )}
      </AnimatePresence>

      {/* Context Menu */}
      {showContextMenu && (
        <div
          className="absolute top-full right-4 mt-1 bg-white border border-gray-300 rounded shadow-lg z-10"
          onMouseLeave={() => setShowContextMenu(false)}
        >
          <button
            onClick={() => {
              onPauseRun(run.id);
              setShowContextMenu(false);
            }}
            className="block w-full text-left px-4 py-2 text-sm hover:bg-gray-100"
            disabled={run.status !== 'running'}
          >
            Pause
          </button>
          <button
            onClick={() => {
              onCancelRun(run.id);
              setShowContextMenu(false);
            }}
            className="block w-full text-left px-4 py-2 text-sm hover:bg-gray-100"
            disabled={run.status === 'completed' || run.status === 'cancelled'}
          >
            Cancel
          </button>
          <button
            onClick={() => {
              onViewDetails(run.id);
              setShowContextMenu(false);
            }}
            className="block w-full text-left px-4 py-2 text-sm hover:bg-gray-100"
          >
            View Details
          </button>
        </div>
      )}
    </div>
  );
};

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${minutes}m ${seconds}s`;
}
