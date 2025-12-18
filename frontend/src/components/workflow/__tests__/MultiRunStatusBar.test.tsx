import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useWorkflowRuns } from '../../../hooks/useWorkflowRuns';
import { useWorkflowSettings } from '../../../hooks/useWorkflowSettings';
import { useWorkflowWebSocket } from '../../../hooks/useWorkflowWebSocket';
import { WorkflowRun } from '../../../types/workflow-tracking';
import { MultiRunStatusBar } from '../MultiRunStatusBar';
// Mock hooks
vi.mock('../../../hooks/useWorkflowRuns', () => ({
  useWorkflowRuns: vi.fn(),
}));
vi.mock('../../../hooks/useWorkflowWebSocket', () => ({
  useWorkflowWebSocket: vi.fn(),
}));
vi.mock('../../../hooks/useWorkflowSettings', () => ({
  useWorkflowSettings: vi.fn(),
}));

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

describe('MultiRunStatusBar', () => {
  const mockSettings = {
    autoHide: false,
    maxVisibleRuns: 5,
    viewMode: 'compact' as const,
    animationsEnabled: true,
    expandedRuns: [],
  };

  const mockUpdateSettings = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (useWorkflowSettings as any).mockReturnValue({
      settings: mockSettings,
      updateSettings: mockUpdateSettings,
    });
    (useWorkflowWebSocket as any).mockReturnValue({
      connected: true,
    });
  });

  it('renders empty state when no runs', () => {
    (useWorkflowRuns as any).mockReturnValue({
      runs: [],
      isLoading: false,
      error: null,
    });

    render(<MultiRunStatusBar />);
    expect(screen.queryByTestId('workflow-run-item')).not.toBeInTheDocument();
  });

  it('renders single run correctly', () => {
    (useWorkflowRuns as any).mockReturnValue({
      runs: [mockRun],
      isLoading: false,
      error: null,
    });

    render(<MultiRunStatusBar />);
    expect(screen.getByText('ST-53')).toBeInTheDocument();
    expect(screen.getByText('Multi-Run Progress Tracker')).toBeInTheDocument();
    expect(screen.getByText('Implementer')).toBeInTheDocument();
  });

  it('renders multiple runs up to maxVisibleRuns', () => {
    const runs = Array.from({ length: 7 }, (_, i) => ({
      ...mockRun,
      id: `run-${i}`,
      storyKey: `ST-${50 + i}`,
    }));

    (useWorkflowRuns as any).mockReturnValue({
      runs,
      isLoading: false,
      error: null,
    });

    render(<MultiRunStatusBar />);

    // Should show 5 runs (maxVisibleRuns) + overflow indicator
    const runItems = screen.getAllByTestId('workflow-run-item');
    expect(runItems).toHaveLength(5);
    expect(screen.getByText('+2 more')).toBeInTheDocument();
  });

  it('shows overflow indicator when runs exceed maxVisibleRuns', () => {
    const runs = Array.from({ length: 8 }, (_, i) => ({
      ...mockRun,
      id: `run-${i}`,
    }));

    (useWorkflowRuns as any).mockReturnValue({
      runs,
      isLoading: false,
      error: null,
    });

    render(<MultiRunStatusBar />);
    expect(screen.getByText('+3 more')).toBeInTheDocument();
  });

  it('handles expand/collapse run', () => {
    (useWorkflowRuns as any).mockReturnValue({
      runs: [mockRun],
      isLoading: false,
      error: null,
    });

    render(<MultiRunStatusBar />);

    const expandButton = screen.getByLabelText(/expand/i);
    fireEvent.click(expandButton);

    expect(mockUpdateSettings).toHaveBeenCalledWith({
      expandedRuns: ['run-1'],
    });
  });

  it('hides when autoHide is enabled and no active runs', () => {
    (useWorkflowSettings as any).mockReturnValue({
      settings: { ...mockSettings, autoHide: true },
      updateSettings: mockUpdateSettings,
    });

    (useWorkflowRuns as any).mockReturnValue({
      runs: [{ ...mockRun, status: 'completed' }],
      isLoading: false,
      error: null,
    });

    render(<MultiRunStatusBar />);
    expect(screen.queryByTestId('status-bar-container')).toHaveClass('hidden');
  });

  it('shows compact view mode correctly', () => {
    (useWorkflowRuns as any).mockReturnValue({
      runs: [mockRun],
      isLoading: false,
      error: null,
    });

    render(<MultiRunStatusBar />);
    const container = screen.getByTestId('status-bar-container');
    expect(container).toHaveClass('h-16'); // 64px compact mode
  });

  it('shows detailed view mode correctly', () => {
    (useWorkflowSettings as any).mockReturnValue({
      settings: { ...mockSettings, viewMode: 'detailed' },
      updateSettings: mockUpdateSettings,
    });

    (useWorkflowRuns as any).mockReturnValue({
      runs: [mockRun],
      isLoading: false,
      error: null,
    });

    render(<MultiRunStatusBar />);
    const container = screen.getByTestId('status-bar-container');
    expect(container).toHaveClass('h-20'); // 80px detailed mode
  });

  it('displays loading state', () => {
    (useWorkflowRuns as any).mockReturnValue({
      runs: [],
      isLoading: true,
      error: null,
    });

    render(<MultiRunStatusBar />);
    expect(screen.getByTestId('loading-indicator')).toBeInTheDocument();
  });

  it('displays error state', () => {
    (useWorkflowRuns as any).mockReturnValue({
      runs: [],
      isLoading: false,
      error: new Error('Failed to load runs'),
    });

    render(<MultiRunStatusBar />);
    expect(screen.getByText(/failed to load/i)).toBeInTheDocument();
  });

  it('handles overflow click to show all runs', async () => {
    const runs = Array.from({ length: 8 }, (_, i) => ({
      ...mockRun,
      id: `run-${i}`,
    }));

    (useWorkflowRuns as any).mockReturnValue({
      runs,
      isLoading: false,
      error: null,
    });

    render(<MultiRunStatusBar />);

    const overflowButton = screen.getByText('+3 more');
    fireEvent.click(overflowButton);

    await waitFor(() => {
      const runItems = screen.getAllByTestId('workflow-run-item');
      expect(runItems).toHaveLength(8); // All runs visible
    });
  });

  it('respects animationsEnabled setting', () => {
    (useWorkflowSettings as any).mockReturnValue({
      settings: { ...mockSettings, animationsEnabled: false },
      updateSettings: mockUpdateSettings,
    });

    (useWorkflowRuns as any).mockReturnValue({
      runs: [mockRun],
      isLoading: false,
      error: null,
    });

    render(<MultiRunStatusBar />);
    const item = screen.getByTestId('workflow-run-item');
    expect(item).not.toHaveClass('animate-pulse');
  });

  it('shows WebSocket disconnected indicator', () => {
    (useWorkflowWebSocket as any).mockReturnValue({
      connected: false,
    });

    (useWorkflowRuns as any).mockReturnValue({
      runs: [mockRun],
      isLoading: false,
      error: null,
    });

    render(<MultiRunStatusBar />);
    expect(screen.getByLabelText(/disconnected/i)).toBeInTheDocument();
  });

  it('handles maxVisibleRuns change', () => {
    const runs = Array.from({ length: 10 }, (_, i) => ({
      ...mockRun,
      id: `run-${i}`,
    }));

    (useWorkflowRuns as any).mockReturnValue({
      runs,
      isLoading: false,
      error: null,
    });

    const { rerender } = render(<MultiRunStatusBar />);
    expect(screen.getAllByTestId('workflow-run-item')).toHaveLength(5);

    // Change maxVisibleRuns to 3
    (useWorkflowSettings as any).mockReturnValue({
      settings: { ...mockSettings, maxVisibleRuns: 3 },
      updateSettings: mockUpdateSettings,
    });

    rerender(<MultiRunStatusBar />);
    expect(screen.getAllByTestId('workflow-run-item')).toHaveLength(3);
    expect(screen.getByText('+7 more')).toBeInTheDocument();
  });
});
