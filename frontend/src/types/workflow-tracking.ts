/**
 * Types for Multi-Run Progress Tracker (ST-53)
 */

export type WorkflowRunStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'paused'
  | 'cancelled';

export type ComponentRunStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'skipped';

export type QueueStatus =
  | 'pending'
  | 'running'
  | 'passed'
  | 'failed'
  | 'cancelled'
  | 'skipped';

export interface ComponentRun {
  id: string;
  componentId: string;
  componentName: string;
  status: ComponentRunStatus;
  startedAt: string | null;
  completedAt: string | null;
  output: any;
  errorMessage: string | null;
}

export interface WorkflowRun {
  id: string;
  workflowId: string;
  storyId: string;
  storyKey: string;
  storyTitle: string;
  status: WorkflowRunStatus;
  progress: number; // 0-100
  currentComponent: string | null;
  branchName: string | null;
  worktreePath: string | null;
  queueStatus: QueueStatus | null;
  queuePosition: number | null;
  queuePriority: number | null;
  queueWaitTimeMs: number | null;
  queueLocked: boolean;
  startedAt: string | null;
  completedAt: string | null;
  elapsedTimeMs: number;
  estimatedTimeRemainingMs: number | null;
  componentRuns: ComponentRun[];
  recentOutputs: string[];
  transcriptPath: string | null;
  commitsAhead: number | null;
  commitsBehind: number | null;
}

export interface WorkflowRunUpdate {
  runId: string;
  type: 'status' | 'progress' | 'component' | 'queue';
  data: Partial<WorkflowRun>;
}

export type StatusBarViewMode = 'compact' | 'detailed';

export interface StatusBarSettings {
  autoHide: boolean;
  maxVisibleRuns: number; // 3-10
  viewMode: StatusBarViewMode;
  animationsEnabled: boolean;
  expandedRuns: string[]; // runIds that are expanded
}

export const DEFAULT_SETTINGS: StatusBarSettings = {
  autoHide: false,
  maxVisibleRuns: 5,
  viewMode: 'compact',
  animationsEnabled: true,
  expandedRuns: [],
};

export interface WorkflowRunItemProps {
  run: WorkflowRun;
  isExpanded: boolean;
  viewMode: StatusBarViewMode;
  animationsEnabled: boolean;
  onToggleExpand: (runId: string) => void;
  onCopyWorktreePath: (path: string) => void;
  onNavigateToStory: (storyKey: string) => void;
  onPauseRun: (runId: string) => void;
  onCancelRun: (runId: string) => void;
  onViewDetails: (runId: string) => void;
}

export interface StatusIconProps {
  status: WorkflowRunStatus;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export interface ProgressBarProps {
  progress: number; // 0-100
  status: WorkflowRunStatus;
  animated?: boolean;
  height?: string;
}

export interface OverflowIndicatorProps {
  count: number;
  onClick: () => void;
}

export interface WorkflowRunDetailsProps {
  run: WorkflowRun;
  onClose: () => void;
}
