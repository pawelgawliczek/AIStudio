import React, { useState, useEffect, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useWorkflowRuns } from '../../hooks/useWorkflowRuns';
import { useWorkflowWebSocket } from '../../hooks/useWorkflowWebSocket';
import { useWorkflowSettings } from '../../hooks/useWorkflowSettings';
import { WorkflowRunItem } from './WorkflowRunItem';
import { WorkflowRunOverflow } from './WorkflowRunOverflow';
import { WorkflowRunUpdate } from '../../types/workflow-tracking';

/**
 * Multi-run progress tracker in status bar
 * Shows up to maxVisibleRuns concurrent workflow runs with real-time updates
 */
export const MultiRunStatusBar: React.FC = () => {
  const { runs, isLoading, error, refetch } = useWorkflowRuns({
    includeCancelled: false,
  });

  const { settings, toggleRunExpansion, cleanupExpandedRuns } =
    useWorkflowSettings();

  const [showAll, setShowAll] = useState(false);

  // Handle WebSocket updates
  const handleWorkflowUpdate = useCallback(
    (update: WorkflowRunUpdate) => {
      // Refetch data on any update
      refetch();
    },
    [refetch]
  );

  const { connected, pauseRun, cancelRun } = useWorkflowWebSocket({
    onUpdate: handleWorkflowUpdate,
    throttleMs: 1000,
  });

  // Cleanup expanded runs when runs change
  useEffect(() => {
    const activeRunIds = runs.map((r) => r.id);
    cleanupExpandedRuns(activeRunIds);
  }, [runs, cleanupExpandedRuns]);

  // Determine visible runs
  const visibleRuns = showAll
    ? runs
    : runs.slice(0, settings.maxVisibleRuns);
  const overflowCount = Math.max(0, runs.length - settings.maxVisibleRuns);

  // Auto-hide logic
  const shouldHide =
    settings.autoHide && runs.every((r) => r.status === 'completed' || r.status === 'cancelled');

  // Always use vertical layout, dynamic height
  const heightClass = 'min-h-16 max-h-80';

  // Handlers
  const handleCopyWorktreePath = (path: string) => {
    navigator.clipboard.writeText(path);
    // TODO: Show toast notification
  };

  const handleNavigateToStory = (storyKey: string) => {
    window.location.href = `/stories/${storyKey}`;
  };

  const handleViewDetails = (runId: string) => {
    window.location.href = `/workflow-runs/${runId}/monitor`;
  };

  if (shouldHide) {
    return (
      <div
        data-testid="status-bar-container"
        className="hidden"
      />
    );
  }

  if (isLoading) {
    return (
      <div
        data-testid="status-bar-container"
        className={`${heightClass} bg-card border-b border-border flex items-center justify-center`}
      >
        <div data-testid="loading-indicator" className="flex items-center gap-2">
          <div className="animate-spin h-4 w-4 border-2 border-accent border-t-transparent rounded-full" />
          <span className="text-sm text-muted">Loading workflow runs...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        data-testid="status-bar-container"
        className={`${heightClass} bg-card border-b border-border flex items-center justify-center`}
      >
        <div className="flex items-center gap-2 text-red-500">
          <span className="text-sm">Failed to load workflow runs</span>
          <button
            onClick={() => refetch()}
            className="text-xs underline hover:no-underline"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (runs.length === 0) {
    return null; // Hide when no runs
  }

  return (
    <div
      data-testid="status-bar-container"
      className={`${heightClass} bg-card border-b border-border relative py-2`}
    >
      {/* WebSocket connection indicator - hidden since real-time is optional, polling works */}
      {/* Real-time updates via WebSocket are a future enhancement */}

      <div className="flex flex-col gap-2 px-4 overflow-y-auto">
        <AnimatePresence>
          {visibleRuns.map((run) => (
            <motion.div
              key={run.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: settings.animationsEnabled ? 0.3 : 0 }}
              className="flex-shrink-0"
            >
              <WorkflowRunItem
                run={run}
                isExpanded={settings.expandedRuns.includes(run.id)}
                viewMode={settings.viewMode}
                animationsEnabled={settings.animationsEnabled}
                onToggleExpand={toggleRunExpansion}
                onCopyWorktreePath={handleCopyWorktreePath}
                onNavigateToStory={handleNavigateToStory}
                onPauseRun={pauseRun}
                onCancelRun={cancelRun}
                onViewDetails={handleViewDetails}
              />
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Overflow indicator */}
        {!showAll && overflowCount > 0 && (
          <WorkflowRunOverflow
            count={overflowCount}
            onClick={() => setShowAll(true)}
          />
        )}

        {/* Show less button */}
        {showAll && runs.length > settings.maxVisibleRuns && (
          <button
            onClick={() => setShowAll(false)}
            className="flex items-center justify-center px-4 py-2 bg-muted/20 hover:bg-muted/30 rounded-md transition-colors text-sm font-medium text-fg"
          >
            Show less
          </button>
        )}
      </div>
    </div>
  );
};
