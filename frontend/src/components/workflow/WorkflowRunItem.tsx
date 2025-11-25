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
      className={`${heightClass} border border-border bg-card rounded-lg shadow-sm relative`}
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
          className="text-sm font-semibold text-accent hover:text-accent-dark hover:underline"
        >
          {run.storyKey}
        </button>

        {/* Story Title */}
        <div className="flex-1 min-w-0">
          <p className="text-sm text-fg truncate">{run.storyTitle}</p>
          {viewMode === 'detailed' && run.currentComponent && (
            <p className="text-xs text-muted">
              <span className="font-medium">Current:</span> {run.currentComponent}
            </p>
          )}
        </div>

        {/* Current Component (compact mode) */}
        {viewMode === 'compact' && run.currentComponent && (
          <div className="text-xs text-muted px-2 py-1 bg-muted/20 rounded">
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
          <p className="text-xs text-muted text-center mt-0.5">
            {run.progress}%
          </p>
        </div>

        {/* Branch Name */}
        {run.branchName && (
          <div className="text-xs text-muted font-mono max-w-40 truncate">
            {run.branchName}
          </div>
        )}

        {/* Worktree Path (clickable to copy) */}
        {abbreviatedPath && (
          <button
            onClick={() => onCopyWorktreePath(run.worktreePath!)}
            className="text-xs text-muted font-mono hover:text-fg hover:underline"
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
                ? 'bg-green-500/20 text-green-400'
                : run.queueStatus === 'pending'
                ? 'bg-yellow-500/20 text-yellow-400'
                : run.queueStatus === 'failed'
                ? 'bg-red-500/20 text-red-400'
                : 'bg-muted/20 text-muted'
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
        <div className="text-xs text-muted text-right min-w-20">
          <div>{elapsedTime}</div>
          {remainingTime && <div className="text-muted/70">{remainingTime}</div>}
        </div>

        {/* Expand/Collapse Button */}
        <button
          onClick={() => onToggleExpand(run.id)}
          className="text-muted hover:text-fg p-1"
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
          className="absolute top-full right-4 mt-1 bg-card border border-border rounded shadow-lg z-10"
          onMouseLeave={() => setShowContextMenu(false)}
        >
          <button
            onClick={() => {
              onPauseRun(run.id);
              setShowContextMenu(false);
            }}
            className="block w-full text-left px-4 py-2 text-sm text-fg hover:bg-muted/20 disabled:opacity-50"
            disabled={run.status !== 'running'}
          >
            Pause
          </button>
          <button
            onClick={() => {
              onCancelRun(run.id);
              setShowContextMenu(false);
            }}
            className="block w-full text-left px-4 py-2 text-sm text-fg hover:bg-muted/20 disabled:opacity-50"
            disabled={run.status === 'completed' || run.status === 'cancelled'}
          >
            Cancel
          </button>
          <button
            onClick={() => {
              onViewDetails(run.id);
              setShowContextMenu(false);
            }}
            className="block w-full text-left px-4 py-2 text-sm text-fg hover:bg-muted/20"
          >
            View Details
          </button>
        </div>
      )}
    </div>
  );
};

function formatDuration(ms: number): string {
  // Handle NaN, undefined, null, or negative values
  if (!ms || isNaN(ms) || ms < 0) {
    return '0s';
  }

  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
}
