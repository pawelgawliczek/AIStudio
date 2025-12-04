/**
 * Unit tests for StateBlock component
 * ST-168: Individual state visualization with phases
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { StateBlock } from '../StateBlock';

describe('StateBlock', () => {
  const mockState = {
    id: 'state-1',
    name: 'Implementation',
    order: 2,
    componentId: 'component-1',
    preExecutionInstructions: 'Read the architecture document',
    postExecutionInstructions: 'Update story status',
    mandatory: true,
    requiresApproval: false,
    runLocation: 'local' as const,
    offlineFallback: 'pause' as const,
  };

  const mockComponentRun = {
    id: 'run-1',
    componentId: 'component-1',
    componentName: 'Developer',
    status: 'running',
    startedAt: '2025-12-03T10:00:00Z',
    completedAt: null,
    output: null,
    errorMessage: null,
    tokenMetrics: {
      inputTokens: 1200,
      outputTokens: 890,
      totalTokens: 2090,
    },
  };

  describe('TC-STATE-BLOCK-001: Rendering states', () => {
    it('should render collapsed state block', () => {
      render(
        <StateBlock
          state={mockState}
          componentRun={undefined}
          isExpanded={false}
          onToggle={vi.fn()}
          variant="standard"
        />
      );

      expect(screen.getByText('Implementation')).toBeInTheDocument();
      expect(screen.queryByText('PRE-EXECUTION')).not.toBeInTheDocument();
    });

    it('should render expanded state block with all phases', () => {
      render(
        <StateBlock
          state={mockState}
          componentRun={mockComponentRun}
          isExpanded={true}
          onToggle={vi.fn()}
          variant="full"
        />
      );

      expect(screen.getByText('PRE-EXECUTION')).toBeInTheDocument();
      expect(screen.getByText('AGENT EXECUTION')).toBeInTheDocument();
      expect(screen.getByText('POST-EXECUTION')).toBeInTheDocument();
    });

    it('should render compact state block with minimal info', () => {
      render(
        <StateBlock
          state={mockState}
          componentRun={undefined}
          isExpanded={false}
          onToggle={vi.fn()}
          variant="compact"
        />
      );

      expect(screen.getByText('Impl')).toBeInTheDocument(); // Truncated name
      expect(screen.queryByText('Implementation')).not.toBeInTheDocument();
    });
  });

  describe('TC-STATE-BLOCK-002: Status indicators', () => {
    it('should show completed status with green color', () => {
      render(
        <StateBlock
          state={{ ...mockState }}
          componentRun={{ ...mockComponentRun, status: 'completed' }}
          isExpanded={false}
          onToggle={vi.fn()}
          variant="standard"
        />
      );

      const statusBadge = screen.getByTestId('state-status');
      expect(statusBadge).toHaveClass('bg-green-500/20', 'text-green-400');
      expect(screen.getByText('COMPLETED')).toBeInTheDocument();
    });

    it('should show running status with blue pulsing color', () => {
      render(
        <StateBlock
          state={mockState}
          componentRun={mockComponentRun}
          isExpanded={false}
          onToggle={vi.fn()}
          variant="standard"
        />
      );

      const statusBadge = screen.getByTestId('state-status');
      expect(statusBadge).toHaveClass('bg-blue-500/20', 'text-blue-400', 'animate-pulse');
      expect(screen.getByText('RUNNING')).toBeInTheDocument();
    });

    it('should show failed status with red color', () => {
      render(
        <StateBlock
          state={mockState}
          componentRun={{ ...mockComponentRun, status: 'failed' }}
          isExpanded={false}
          onToggle={vi.fn()}
          variant="standard"
        />
      );

      const statusBadge = screen.getByTestId('state-status');
      expect(statusBadge).toHaveClass('bg-red-500/20', 'text-red-400');
      expect(screen.getByText('FAILED')).toBeInTheDocument();
    });

    it('should show pending status with muted color', () => {
      render(
        <StateBlock
          state={mockState}
          componentRun={undefined}
          isExpanded={false}
          onToggle={vi.fn()}
          variant="standard"
        />
      );

      const statusBadge = screen.getByTestId('state-status');
      expect(statusBadge).toHaveClass('bg-muted/20', 'text-muted');
      expect(screen.getByText('PENDING')).toBeInTheDocument();
    });

    it('should show paused status with yellow color', () => {
      render(
        <StateBlock
          state={mockState}
          componentRun={{ ...mockComponentRun, status: 'paused' }}
          isExpanded={false}
          onToggle={vi.fn()}
          variant="standard"
        />
      );

      const statusBadge = screen.getByTestId('state-status');
      expect(statusBadge).toHaveClass('bg-yellow-500/20', 'text-yellow-400');
      expect(screen.getByText('PAUSED')).toBeInTheDocument();
    });
  });

  describe('TC-STATE-BLOCK-003: Interactive toggling', () => {
    it('should call onToggle when clicked', () => {
      const onToggle = vi.fn();

      render(
        <StateBlock
          state={mockState}
          componentRun={undefined}
          isExpanded={false}
          onToggle={onToggle}
          variant="standard"
        />
      );

      fireEvent.click(screen.getByText('Implementation'));

      expect(onToggle).toHaveBeenCalledTimes(1);
    });

    it('should toggle between expanded and collapsed', () => {
      const { rerender } = render(
        <StateBlock
          state={mockState}
          componentRun={mockComponentRun}
          isExpanded={false}
          onToggle={vi.fn()}
          variant="standard"
        />
      );

      expect(screen.queryByText('PRE-EXECUTION')).not.toBeInTheDocument();

      rerender(
        <StateBlock
          state={mockState}
          componentRun={mockComponentRun}
          isExpanded={true}
          onToggle={vi.fn()}
          variant="standard"
        />
      );

      expect(screen.getByText('PRE-EXECUTION')).toBeInTheDocument();
    });
  });

  describe('TC-STATE-BLOCK-004: Metrics display', () => {
    it('should display token metrics when available', () => {
      render(
        <StateBlock
          state={mockState}
          componentRun={mockComponentRun}
          isExpanded={true}
          onToggle={vi.fn()}
          variant="full"
        />
      );

      expect(screen.getByText(/1,200/)).toBeInTheDocument(); // Input tokens
      expect(screen.getByText(/890/)).toBeInTheDocument(); // Output tokens
      expect(screen.getByText(/2,090/)).toBeInTheDocument(); // Total tokens
    });

    it('should display duration when available', () => {
      const runWithDuration = {
        ...mockComponentRun,
        startedAt: '2025-12-03T10:00:00Z',
        completedAt: '2025-12-03T10:02:30Z',
      };

      render(
        <StateBlock
          state={mockState}
          componentRun={runWithDuration}
          isExpanded={true}
          onToggle={vi.fn()}
          variant="full"
        />
      );

      expect(screen.getByText(/2m 30s/)).toBeInTheDocument();
    });

    it('should show live duration for running state', () => {
      render(
        <StateBlock
          state={mockState}
          componentRun={mockComponentRun}
          isExpanded={true}
          onToggle={vi.fn()}
          variant="full"
        />
      );

      expect(screen.getByTestId('live-duration')).toBeInTheDocument();
    });
  });

  describe('TC-STATE-BLOCK-005: Approval gate indicator', () => {
    it('should show approval gate badge when requiresApproval is true', () => {
      render(
        <StateBlock
          state={{ ...mockState, requiresApproval: true }}
          componentRun={undefined}
          isExpanded={false}
          onToggle={vi.fn()}
          variant="standard"
        />
      );

      expect(screen.getByText(/approval required/i)).toBeInTheDocument();
      expect(screen.getByTestId('approval-gate-icon')).toBeInTheDocument();
    });

    it('should not show approval badge when requiresApproval is false', () => {
      render(
        <StateBlock
          state={mockState}
          componentRun={undefined}
          isExpanded={false}
          onToggle={vi.fn()}
          variant="standard"
        />
      );

      expect(screen.queryByText(/approval required/i)).not.toBeInTheDocument();
    });
  });

  describe('TC-STATE-BLOCK-006: Run location indicator', () => {
    it('should show laptop icon for laptop execution', () => {
      render(
        <StateBlock
          state={{ ...mockState, runLocation: 'laptop' }}
          componentRun={undefined}
          isExpanded={true}
          onToggle={vi.fn()}
          variant="full"
        />
      );

      expect(screen.getByTestId('laptop-icon')).toBeInTheDocument();
      expect(screen.getByText(/laptop/i)).toBeInTheDocument();
    });

    it('should show local icon for local execution', () => {
      render(
        <StateBlock
          state={{ ...mockState, runLocation: 'local' }}
          componentRun={undefined}
          isExpanded={true}
          onToggle={vi.fn()}
          variant="full"
        />
      );

      expect(screen.getByTestId('local-icon')).toBeInTheDocument();
      expect(screen.getByText(/local/i)).toBeInTheDocument();
    });
  });

  describe('TC-STATE-BLOCK-007: Error handling', () => {
    it('should display error message when state fails', () => {
      const failedRun = {
        ...mockComponentRun,
        status: 'failed',
        errorMessage: 'Agent exceeded max turns without completing task',
      };

      render(
        <StateBlock
          state={mockState}
          componentRun={failedRun}
          isExpanded={true}
          onToggle={vi.fn()}
          variant="full"
        />
      );

      expect(screen.getByText(/Agent exceeded max turns/)).toBeInTheDocument();
      expect(screen.getByTestId('error-icon')).toBeInTheDocument();
    });

    it('should provide retry button for failed states', () => {
      const failedRun = {
        ...mockComponentRun,
        status: 'failed',
        errorMessage: 'Connection timeout',
      };

      render(
        <StateBlock
          state={mockState}
          componentRun={failedRun}
          isExpanded={true}
          onToggle={vi.fn()}
          variant="full"
        />
      );

      expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    });
  });

  describe('TC-STATE-BLOCK-008: Accessibility', () => {
    it('should have proper ARIA attributes', () => {
      render(
        <StateBlock
          state={mockState}
          componentRun={undefined}
          isExpanded={false}
          onToggle={vi.fn()}
          variant="standard"
        />
      );

      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-expanded', 'false');
      expect(button).toHaveAttribute('aria-controls', `state-${mockState.id}`);
    });

    it('should update aria-expanded when toggled', () => {
      const { rerender } = render(
        <StateBlock
          state={mockState}
          componentRun={undefined}
          isExpanded={false}
          onToggle={vi.fn()}
          variant="standard"
        />
      );

      let button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-expanded', 'false');

      rerender(
        <StateBlock
          state={mockState}
          componentRun={undefined}
          isExpanded={true}
          onToggle={vi.fn()}
          variant="standard"
        />
      );

      button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-expanded', 'true');
    });

    it('should be keyboard navigable', () => {
      const onToggle = vi.fn();

      render(
        <StateBlock
          state={mockState}
          componentRun={undefined}
          isExpanded={false}
          onToggle={onToggle}
          variant="standard"
        />
      );

      const button = screen.getByRole('button');
      button.focus();
      expect(document.activeElement).toBe(button);

      fireEvent.keyDown(button, { key: 'Enter' });
      expect(onToggle).toHaveBeenCalled();
    });
  });
});
