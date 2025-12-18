import { ArrowPathIcon } from '@heroicons/react/24/outline';
import { useQuery } from '@tanstack/react-query';
import React from 'react';
import { Link } from 'react-router-dom';
import { getActiveWorkflowForProject } from '../../services/api';
import { CompactStatePipeline, useWorkflowRun } from '../workflow-viz';

interface ActiveWorkflowStatus {
  runId: string;
  status: string;
  storyKey: string | null;
  storyTitle: string | null;
  activeComponentName: string | null;
  progress: {
    completed: number;
    total: number;
    percentage: number;
  };
  startedAt: string;
  estimatedCost?: number;
}

export const GlobalWorkflowTrackingBar: React.FC = () => {
  // Get project ID from localStorage
  const projectId =
    localStorage.getItem('selectedProjectId') ||
    localStorage.getItem('currentProjectId') ||
    '345a29ee-d6ab-477d-8079-c5dda0844d77'; // Fallback to AI Studio project

  const { data: activeWorkflow, isLoading } = useQuery<ActiveWorkflowStatus | null>({
    queryKey: ['active-workflow', projectId],
    queryFn: () => getActiveWorkflowForProject(projectId),
    refetchInterval: 3000, // Poll every 3 seconds
    retry: false,
  });

  // Fetch workflow run details for state visualization
  const { workflowRun } = useWorkflowRun({
    runId: activeWorkflow?.runId || '',
    enabled: !!activeWorkflow?.runId,
    refetchInterval: 3000,
  });

  // Don't render if loading or no active workflow
  if (isLoading || !activeWorkflow) {
    return null;
  }

  const { storyKey, storyTitle, activeComponentName, progress, status } = activeWorkflow;
  const isRunning = status === 'running';

  return (
    <div
      data-testid="workflow-tracking-bar"
      className="bg-card shadow-sm border-b border-border"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-12 gap-4">
          {/* Left section: Spinning icon + Story info */}
          <div className="flex items-center gap-3 flex-1 min-w-0">
            {/* Spinning indicator */}
            {isRunning && (
              <ArrowPathIcon
                data-testid="workflow-spinner"
                className="h-5 w-5 text-accent animate-spin"
              />
            )}

            {/* Story key and title */}
            {storyKey && (
              <Link
                to={`/stories/${storyKey}`}
                className="flex items-center gap-2 hover:opacity-80 transition-opacity min-w-0"
              >
                <span className="inline-flex items-center px-2 py-1 rounded text-xs font-semibold bg-accent/10 text-accent border border-accent/20">
                  {storyKey}
                </span>
                <span className="text-sm text-fg truncate">
                  {storyTitle}
                </span>
              </Link>
            )}

            {/* Active component */}
            <div className="hidden md:flex items-center gap-2 text-sm text-muted">
              <span>•</span>
              <span className="font-medium text-fg">
                {activeComponentName || 'Initializing...'}
              </span>
            </div>
          </div>

          {/* Right section: Progress + Monitor Link */}
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted whitespace-nowrap">
              {progress.completed}/{progress.total} components
            </span>

            {/* Visual Progress Bar */}
            <div className="flex items-center gap-2">
              <div className="w-32 h-2 bg-border rounded-full overflow-hidden">
                <div
                  className="h-full bg-accent transition-all duration-300 rounded-full"
                  style={{ width: `${progress.percentage}%` }}
                  role="progressbar"
                  aria-valuenow={progress.percentage}
                  aria-valuemin={0}
                  aria-valuemax={100}
                />
              </div>
              <span className="text-xs font-semibold text-accent min-w-[35px] text-right">
                {progress.percentage}%
              </span>
            </div>

            <Link
              to={`/workflow-runs/${activeWorkflow.runId}/monitor`}
              className="text-sm text-accent hover:text-accent-dark font-medium transition-colors whitespace-nowrap"
            >
              Monitor →
            </Link>
          </div>
        </div>

        {/* Compact State Pipeline - shown below the main bar */}
        {workflowRun?.states && workflowRun.states.length > 0 && (
          <div className="pb-2">
            <div className="[&_[data-testid='compact-state-pipeline']]:bg-transparent [&_[data-testid='compact-state-pipeline']]:border-0 [&_[data-testid='compact-state-pipeline']]:p-0 [&_[data-testid='compact-state-pipeline']>div:last-child]:hidden">
              <CompactStatePipeline
                states={workflowRun.states}
                componentRuns={workflowRun.componentRuns}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
