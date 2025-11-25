import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { WorkflowRunItem } from '../WorkflowRunItem';
import { WorkflowRun } from '../../../types/workflow-tracking';

const mockRun: WorkflowRun = {
  id: 'run-1',
  workflowId: 'wf-1',
  storyId: 'story-1',
  storyKey: 'ST-53',
  storyTitle: 'Multi-Run Progress Tracker',
  status: 'running',
  progress: 45,
  currentComponent: 'Implementer',
  branchName: 'st-53-multi-run-tracker',
  worktreePath: '/opt/stack/worktrees/st-53-multi-run-tracker',
  queueStatus: 'running',
  queuePosition: 1,
  queuePriority: 5,
  queueWaitTimeMs: 0,
  queueLocked: false,
  startedAt: new Date().toISOString(),
  completedAt: null,
  elapsedTimeMs: 120000,
  estimatedTimeRemainingMs: 180000,
  componentRuns: [],
  recentOutputs: ['Starting implementation...', 'Creating files...'],
  transcriptPath: '/transcripts/run-1.jsonl',
  commitsAhead: 3,
  commitsBehind: 0,
};

describe('WorkflowRunItem', () => {
  const mockHandlers = {
    onToggleExpand: vi.fn(),
    onCopyWorktreePath: vi.fn(),
    onNavigateToStory: vi.fn(),
    onPauseRun: vi.fn(),
    onCancelRun: vi.fn(),
    onViewDetails: vi.fn(),
  };

  it('renders story key and title', () => {
    render(
      <WorkflowRunItem
        run={mockRun}
        isExpanded={false}
        viewMode="compact"
        animationsEnabled={true}
        {...mockHandlers}
      />
    );

    expect(screen.getByText('ST-53')).toBeInTheDocument();
    expect(screen.getByText('Multi-Run Progress Tracker')).toBeInTheDocument();
  });

  it('renders current component', () => {
    render(
      <WorkflowRunItem
        run={mockRun}
        isExpanded={false}
        viewMode="compact"
        animationsEnabled={true}
        {...mockHandlers}
      />
    );

    expect(screen.getByText('Implementer')).toBeInTheDocument();
  });

  it('renders progress bar with correct percentage', () => {
    render(
      <WorkflowRunItem
        run={mockRun}
        isExpanded={false}
        viewMode="compact"
        animationsEnabled={true}
        {...mockHandlers}
      />
    );

    const progressBar = screen.getByRole('progressbar');
    expect(progressBar).toHaveAttribute('aria-valuenow', '45');
  });

  it('renders branch name', () => {
    render(
      <WorkflowRunItem
        run={mockRun}
        isExpanded={false}
        viewMode="compact"
        animationsEnabled={true}
        {...mockHandlers}
      />
    );

    expect(screen.getByText('st-53-multi-run-tracker')).toBeInTheDocument();
  });

  it('renders abbreviated worktree path', () => {
    render(
      <WorkflowRunItem
        run={mockRun}
        isExpanded={false}
        viewMode="compact"
        animationsEnabled={true}
        {...mockHandlers}
      />
    );

    expect(screen.getByText(/\.\.\.\/st-53-multi-run-tracker/)).toBeInTheDocument();
  });

  it('renders status icon for running status', () => {
    render(
      <WorkflowRunItem
        run={mockRun}
        isExpanded={false}
        viewMode="compact"
        animationsEnabled={true}
        {...mockHandlers}
      />
    );

    const statusIcon = screen.getByTestId('status-icon');
    expect(statusIcon).toHaveClass('text-green-500');
  });

  it('renders elapsed time', () => {
    render(
      <WorkflowRunItem
        run={mockRun}
        isExpanded={false}
        viewMode="compact"
        animationsEnabled={true}
        {...mockHandlers}
      />
    );

    expect(screen.getByText('2m 0s')).toBeInTheDocument();
  });

  it('renders estimated time remaining', () => {
    render(
      <WorkflowRunItem
        run={mockRun}
        isExpanded={false}
        viewMode="compact"
        animationsEnabled={true}
        {...mockHandlers}
      />
    );

    expect(screen.getByText('~3m 0s')).toBeInTheDocument();
  });

  it('handles toggle expand', () => {
    render(
      <WorkflowRunItem
        run={mockRun}
        isExpanded={false}
        viewMode="compact"
        animationsEnabled={true}
        {...mockHandlers}
      />
    );

    const expandButton = screen.getByLabelText(/expand/i);
    fireEvent.click(expandButton);

    expect(mockHandlers.onToggleExpand).toHaveBeenCalledWith('run-1');
  });

  it('shows details panel when expanded', () => {
    render(
      <WorkflowRunItem
        run={mockRun}
        isExpanded={true}
        viewMode="compact"
        animationsEnabled={true}
        {...mockHandlers}
      />
    );

    expect(screen.getByTestId('workflow-run-details')).toBeInTheDocument();
  });

  it('handles story key click', () => {
    render(
      <WorkflowRunItem
        run={mockRun}
        isExpanded={false}
        viewMode="compact"
        animationsEnabled={true}
        {...mockHandlers}
      />
    );

    const storyKeyLink = screen.getByText('ST-53');
    fireEvent.click(storyKeyLink);

    expect(mockHandlers.onNavigateToStory).toHaveBeenCalledWith('ST-53');
  });

  it('handles worktree path click to copy', () => {
    render(
      <WorkflowRunItem
        run={mockRun}
        isExpanded={false}
        viewMode="compact"
        animationsEnabled={true}
        {...mockHandlers}
      />
    );

    const worktreePath = screen.getByTitle('/opt/stack/worktrees/st-53-multi-run-tracker');
    fireEvent.click(worktreePath);

    expect(mockHandlers.onCopyWorktreePath).toHaveBeenCalledWith(
      '/opt/stack/worktrees/st-53-multi-run-tracker'
    );
  });

  it('renders queue status badge', () => {
    render(
      <WorkflowRunItem
        run={mockRun}
        isExpanded={false}
        viewMode="compact"
        animationsEnabled={true}
        {...mockHandlers}
      />
    );

    expect(screen.getByText('Running')).toBeInTheDocument();
  });

  it('shows pulsing animation when running and animations enabled', () => {
    render(
      <WorkflowRunItem
        run={mockRun}
        isExpanded={false}
        viewMode="compact"
        animationsEnabled={true}
        {...mockHandlers}
      />
    );

    const container = screen.getByTestId('workflow-run-item');
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('does not show animations when disabled', () => {
    render(
      <WorkflowRunItem
        run={mockRun}
        isExpanded={false}
        viewMode="compact"
        animationsEnabled={false}
        {...mockHandlers}
      />
    );

    const container = screen.getByTestId('workflow-run-item');
    expect(container.querySelector('.animate-pulse')).not.toBeInTheDocument();
  });

  it('renders different colors for different statuses', () => {
    const statuses: Array<{ status: WorkflowRun['status']; color: string }> = [
      { status: 'running', color: 'green' },
      { status: 'completed', color: 'green' },
      { status: 'failed', color: 'red' },
      { status: 'paused', color: 'gray' },
      { status: 'pending', color: 'yellow' },
    ];

    statuses.forEach(({ status, color }) => {
      const { container, unmount } = render(
        <WorkflowRunItem
          run={{ ...mockRun, status }}
          isExpanded={false}
          viewMode="compact"
          animationsEnabled={true}
          {...mockHandlers}
        />
      );

      const statusIcon = screen.getByTestId('status-icon');
      expect(statusIcon).toHaveClass(`text-${color}-500`);
      unmount();
    });
  });

  it('renders compact view correctly', () => {
    render(
      <WorkflowRunItem
        run={mockRun}
        isExpanded={false}
        viewMode="compact"
        animationsEnabled={true}
        {...mockHandlers}
      />
    );

    const container = screen.getByTestId('workflow-run-item');
    expect(container).toHaveClass('h-14'); // Compact height
  });

  it('renders detailed view correctly', () => {
    render(
      <WorkflowRunItem
        run={mockRun}
        isExpanded={false}
        viewMode="detailed"
        animationsEnabled={true}
        {...mockHandlers}
      />
    );

    const container = screen.getByTestId('workflow-run-item');
    expect(container).toHaveClass('h-18'); // Detailed height
  });

  it('shows tooltips on hover', () => {
    render(
      <WorkflowRunItem
        run={mockRun}
        isExpanded={false}
        viewMode="compact"
        animationsEnabled={true}
        {...mockHandlers}
      />
    );

    const statusIcon = screen.getByTestId('status-icon');
    expect(statusIcon).toHaveAttribute('title', 'Running');
  });

  it('handles right-click context menu', () => {
    render(
      <WorkflowRunItem
        run={mockRun}
        isExpanded={false}
        viewMode="compact"
        animationsEnabled={true}
        {...mockHandlers}
      />
    );

    const container = screen.getByTestId('workflow-run-item');
    fireEvent.contextMenu(container);

    expect(screen.getByText('Pause')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
    expect(screen.getByText('View Details')).toBeInTheDocument();
  });

  it('shows queue lock indicator when locked', () => {
    render(
      <WorkflowRunItem
        run={{ ...mockRun, queueLocked: true }}
        isExpanded={false}
        viewMode="compact"
        animationsEnabled={true}
        {...mockHandlers}
      />
    );

    expect(screen.getByLabelText(/locked/i)).toBeInTheDocument();
  });
});
