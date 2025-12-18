/**
 * Unit tests for WorkflowControlPanel component
 * ST-195: Workflow Control & Results Dashboard
 *
 * Tests TDD - written BEFORE implementation
 * Expected: ALL TESTS WILL FAIL (implementation doesn't exist yet)
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WorkflowControlPanel } from '../WorkflowControlPanel';

describe('WorkflowControlPanel', () => {
  let queryClient: QueryClient;

  const mockStates = [
    { id: 'state-1', name: 'Analysis', order: 1 },
    { id: 'state-2', name: 'Implementation', order: 2 },
    { id: 'state-3', name: 'Testing', order: 3 },
  ];

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
  });

  const renderWithQueryClient = (component: React.ReactElement) => {
    return render(
      <QueryClientProvider client={queryClient}>
        {component}
      </QueryClientProvider>
    );
  };

  describe('TC-CONTROL-001: Header variant rendering', () => {
    it('should render compact button group in header variant', () => {
      renderWithQueryClient(
        <WorkflowControlPanel
          runId="run-123"
          workflowId="workflow-456"
          states={mockStates}
          variant="header"
        />
      );

      expect(screen.getByTestId('control-panel-header')).toBeInTheDocument();
      expect(screen.getByTestId('pause-button')).toBeInTheDocument();
      expect(screen.getByTestId('resume-button')).toBeInTheDocument();
      expect(screen.getByTestId('repeat-button')).toBeInTheDocument();
      expect(screen.getByTestId('skip-button')).toBeInTheDocument();
    });

    it('should not display status section in header variant', () => {
      renderWithQueryClient(
        <WorkflowControlPanel
          runId="run-123"
          workflowId="workflow-456"
          states={mockStates}
          variant="header"
        />
      );

      expect(screen.queryByTestId('status-section')).not.toBeInTheDocument();
    });
  });

  describe('TC-CONTROL-002: Panel variant rendering', () => {
    it('should render full panel with status in panel variant', () => {
      renderWithQueryClient(
        <WorkflowControlPanel
          runId="run-123"
          workflowId="workflow-456"
          states={mockStates}
          variant="panel"
        />
      );

      expect(screen.getByTestId('control-panel-full')).toBeInTheDocument();
      expect(screen.getByTestId('status-section')).toBeInTheDocument();
      expect(screen.getByTestId('actions-section')).toBeInTheDocument();
    });

    it('should display current state and resource usage', () => {
      renderWithQueryClient(
        <WorkflowControlPanel
          runId="run-123"
          workflowId="workflow-456"
          states={mockStates}
          variant="panel"
        />
      );

      // Status should be fetched from useRunnerControl hook
      expect(screen.getByTestId('status-section')).toBeInTheDocument();
    });
  });

  describe('TC-CONTROL-003: Button state management', () => {
    it('should enable Pause and disable Resume when workflow running', async () => {
      // Mock useRunnerControl to return running status
      vi.mock('../hooks/useRunnerControl', () => ({
        useRunnerControl: () => ({
          status: { data: { status: 'running', currentStateId: 'state-1' } },
          pauseMutation: { mutate: vi.fn(), isLoading: false },
          resumeMutation: { mutate: vi.fn(), isLoading: false },
          repeatMutation: { mutate: vi.fn(), isLoading: false },
          advanceMutation: { mutate: vi.fn(), isLoading: false },
        }),
      }));

      renderWithQueryClient(
        <WorkflowControlPanel
          runId="run-123"
          workflowId="workflow-456"
          states={mockStates}
          variant="header"
        />
      );

      expect(screen.getByTestId('pause-button')).not.toBeDisabled();
      expect(screen.getByTestId('resume-button')).toBeDisabled();
    });

    it('should enable Resume and disable Pause when workflow paused', async () => {
      vi.mock('../hooks/useRunnerControl', () => ({
        useRunnerControl: () => ({
          status: { data: { status: 'paused', currentStateId: 'state-2' } },
          pauseMutation: { mutate: vi.fn(), isLoading: false },
          resumeMutation: { mutate: vi.fn(), isLoading: false },
          repeatMutation: { mutate: vi.fn(), isLoading: false },
          advanceMutation: { mutate: vi.fn(), isLoading: false },
        }),
      }));

      renderWithQueryClient(
        <WorkflowControlPanel
          runId="run-123"
          workflowId="workflow-456"
          states={mockStates}
          variant="header"
        />
      );

      expect(screen.getByTestId('pause-button')).toBeDisabled();
      expect(screen.getByTestId('resume-button')).not.toBeDisabled();
    });

    it('should disable all buttons when workflow completed', async () => {
      vi.mock('../hooks/useRunnerControl', () => ({
        useRunnerControl: () => ({
          status: { data: { status: 'completed' } },
          pauseMutation: { mutate: vi.fn(), isLoading: false },
          resumeMutation: { mutate: vi.fn(), isLoading: false },
          repeatMutation: { mutate: vi.fn(), isLoading: false },
          advanceMutation: { mutate: vi.fn(), isLoading: false },
        }),
      }));

      renderWithQueryClient(
        <WorkflowControlPanel
          runId="run-123"
          workflowId="workflow-456"
          states={mockStates}
          variant="header"
        />
      );

      expect(screen.getByTestId('pause-button')).toBeDisabled();
      expect(screen.getByTestId('resume-button')).toBeDisabled();
      expect(screen.getByTestId('repeat-button')).toBeDisabled();
      expect(screen.getByTestId('skip-button')).toBeDisabled();
    });
  });

  describe('TC-CONTROL-004: Pause action', () => {
    it('should call pause mutation when pause button clicked', async () => {
      const mockPause = vi.fn();

      vi.mock('../hooks/useRunnerControl', () => ({
        useRunnerControl: () => ({
          status: { data: { status: 'running' } },
          pauseMutation: { mutate: mockPause, isLoading: false },
          resumeMutation: { mutate: vi.fn(), isLoading: false },
          repeatMutation: { mutate: vi.fn(), isLoading: false },
          advanceMutation: { mutate: vi.fn(), isLoading: false },
        }),
      }));

      renderWithQueryClient(
        <WorkflowControlPanel
          runId="run-123"
          workflowId="workflow-456"
          states={mockStates}
          variant="header"
        />
      );

      fireEvent.click(screen.getByTestId('pause-button'));

      await waitFor(() => {
        expect(mockPause).toHaveBeenCalled();
      });
    });

    it('should show loading state on pause button during mutation', () => {
      vi.mock('../hooks/useRunnerControl', () => ({
        useRunnerControl: () => ({
          status: { data: { status: 'running' } },
          pauseMutation: { mutate: vi.fn(), isLoading: true },
          resumeMutation: { mutate: vi.fn(), isLoading: false },
          repeatMutation: { mutate: vi.fn(), isLoading: false },
          advanceMutation: { mutate: vi.fn(), isLoading: false },
        }),
      }));

      renderWithQueryClient(
        <WorkflowControlPanel
          runId="run-123"
          workflowId="workflow-456"
          states={mockStates}
          variant="header"
        />
      );

      expect(screen.getByTestId('pause-button')).toHaveAttribute('aria-busy', 'true');
    });
  });

  describe('TC-CONTROL-005: Resume action', () => {
    it('should call resume mutation when resume button clicked', async () => {
      const mockResume = vi.fn();

      vi.mock('../hooks/useRunnerControl', () => ({
        useRunnerControl: () => ({
          status: { data: { status: 'paused' } },
          pauseMutation: { mutate: vi.fn(), isLoading: false },
          resumeMutation: { mutate: mockResume, isLoading: false },
          repeatMutation: { mutate: vi.fn(), isLoading: false },
          advanceMutation: { mutate: vi.fn(), isLoading: false },
        }),
      }));

      renderWithQueryClient(
        <WorkflowControlPanel
          runId="run-123"
          workflowId="workflow-456"
          states={mockStates}
          variant="header"
        />
      );

      fireEvent.click(screen.getByTestId('resume-button'));

      await waitFor(() => {
        expect(mockResume).toHaveBeenCalled();
      });
    });
  });

  describe('TC-CONTROL-006: Repeat Step modal', () => {
    it('should open modal when repeat button clicked', () => {
      renderWithQueryClient(
        <WorkflowControlPanel
          runId="run-123"
          workflowId="workflow-456"
          states={mockStates}
          variant="header"
        />
      );

      fireEvent.click(screen.getByTestId('repeat-button'));

      expect(screen.getByTestId('repeat-modal')).toBeInTheDocument();
      expect(screen.getByTestId('feedback-textarea')).toBeInTheDocument();
    });

    it('should disable submit button when no feedback entered', () => {
      renderWithQueryClient(
        <WorkflowControlPanel
          runId="run-123"
          workflowId="workflow-456"
          states={mockStates}
          variant="header"
        />
      );

      fireEvent.click(screen.getByTestId('repeat-button'));

      expect(screen.getByTestId('repeat-submit')).toBeDisabled();
    });

    it('should enable submit button when feedback entered', () => {
      renderWithQueryClient(
        <WorkflowControlPanel
          runId="run-123"
          workflowId="workflow-456"
          states={mockStates}
          variant="header"
        />
      );

      fireEvent.click(screen.getByTestId('repeat-button'));
      fireEvent.change(screen.getByTestId('feedback-textarea'), {
        target: { value: 'Fix the authentication tests' },
      });

      expect(screen.getByTestId('repeat-submit')).not.toBeDisabled();
    });

    it('should call repeat mutation with feedback', async () => {
      const mockRepeat = vi.fn();

      vi.mock('../hooks/useRunnerControl', () => ({
        useRunnerControl: () => ({
          status: { data: { status: 'running' } },
          pauseMutation: { mutate: vi.fn(), isLoading: false },
          resumeMutation: { mutate: vi.fn(), isLoading: false },
          repeatMutation: { mutate: mockRepeat, isLoading: false },
          advanceMutation: { mutate: vi.fn(), isLoading: false },
        }),
      }));

      renderWithQueryClient(
        <WorkflowControlPanel
          runId="run-123"
          workflowId="workflow-456"
          states={mockStates}
          variant="header"
        />
      );

      fireEvent.click(screen.getByTestId('repeat-button'));
      fireEvent.change(screen.getByTestId('feedback-textarea'), {
        target: { value: 'Fix the tests' },
      });
      fireEvent.click(screen.getByTestId('repeat-submit'));

      await waitFor(() => {
        expect(mockRepeat).toHaveBeenCalledWith({
          feedback: 'Fix the tests',
        });
      });
    });

    it('should close modal after successful repeat', async () => {
      const mockRepeat = vi.fn().mockResolvedValue(undefined);

      vi.mock('../hooks/useRunnerControl', () => ({
        useRunnerControl: () => ({
          status: { data: { status: 'running' } },
          pauseMutation: { mutate: vi.fn(), isLoading: false },
          resumeMutation: { mutate: vi.fn(), isLoading: false },
          repeatMutation: { mutate: mockRepeat, isLoading: false },
          advanceMutation: { mutate: vi.fn(), isLoading: false },
        }),
      }));

      renderWithQueryClient(
        <WorkflowControlPanel
          runId="run-123"
          workflowId="workflow-456"
          states={mockStates}
          variant="header"
        />
      );

      fireEvent.click(screen.getByTestId('repeat-button'));
      fireEvent.change(screen.getByTestId('feedback-textarea'), {
        target: { value: 'Fix the tests' },
      });
      fireEvent.click(screen.getByTestId('repeat-submit'));

      await waitFor(() => {
        expect(screen.queryByTestId('repeat-modal')).not.toBeInTheDocument();
      });
    });
  });

  describe('TC-CONTROL-007: Skip Phase modal', () => {
    it('should open modal when skip button clicked', () => {
      renderWithQueryClient(
        <WorkflowControlPanel
          runId="run-123"
          workflowId="workflow-456"
          states={mockStates}
          variant="header"
        />
      );

      fireEvent.click(screen.getByTestId('skip-button'));

      expect(screen.getByTestId('skip-modal')).toBeInTheDocument();
      expect(screen.getByTestId('state-selector')).toBeInTheDocument();
    });

    it('should display list of available states', () => {
      renderWithQueryClient(
        <WorkflowControlPanel
          runId="run-123"
          workflowId="workflow-456"
          states={mockStates}
          variant="header"
        />
      );

      fireEvent.click(screen.getByTestId('skip-button'));

      expect(screen.getByText('Analysis')).toBeInTheDocument();
      expect(screen.getByText('Implementation')).toBeInTheDocument();
      expect(screen.getByText('Testing')).toBeInTheDocument();
    });

    it('should call advance mutation with selected state', async () => {
      const mockAdvance = vi.fn();

      vi.mock('../hooks/useRunnerControl', () => ({
        useRunnerControl: () => ({
          status: { data: { status: 'running', currentStateId: 'state-1' } },
          pauseMutation: { mutate: vi.fn(), isLoading: false },
          resumeMutation: { mutate: vi.fn(), isLoading: false },
          repeatMutation: { mutate: vi.fn(), isLoading: false },
          advanceMutation: { mutate: mockAdvance, isLoading: false },
        }),
      }));

      renderWithQueryClient(
        <WorkflowControlPanel
          runId="run-123"
          workflowId="workflow-456"
          states={mockStates}
          variant="header"
        />
      );

      fireEvent.click(screen.getByTestId('skip-button'));
      fireEvent.click(screen.getByText('Testing'));
      fireEvent.click(screen.getByTestId('skip-submit'));

      await waitFor(() => {
        expect(mockAdvance).toHaveBeenCalledWith({
          skipToState: 'state-3',
        });
      });
    });

    it('should disable submit button when no state selected', () => {
      renderWithQueryClient(
        <WorkflowControlPanel
          runId="run-123"
          workflowId="workflow-456"
          states={mockStates}
          variant="header"
        />
      );

      fireEvent.click(screen.getByTestId('skip-button'));

      expect(screen.getByTestId('skip-submit')).toBeDisabled();
    });
  });

  describe('TC-CONTROL-008: Error handling', () => {
    it('should display error message when mutation fails', async () => {
      const mockPause = vi.fn().mockRejectedValue(new Error('Network error'));

      vi.mock('../hooks/useRunnerControl', () => ({
        useRunnerControl: () => ({
          status: { data: { status: 'running' } },
          pauseMutation: { mutate: mockPause, isLoading: false, error: new Error('Network error') },
          resumeMutation: { mutate: vi.fn(), isLoading: false },
          repeatMutation: { mutate: vi.fn(), isLoading: false },
          advanceMutation: { mutate: vi.fn(), isLoading: false },
        }),
      }));

      renderWithQueryClient(
        <WorkflowControlPanel
          runId="run-123"
          workflowId="workflow-456"
          states={mockStates}
          variant="panel"
        />
      );

      fireEvent.click(screen.getByTestId('pause-button'));

      await waitFor(() => {
        expect(screen.getByText(/Network error/i)).toBeInTheDocument();
      });
    });

    it('should show snackbar notification on error', async () => {
      const mockResume = vi.fn().mockRejectedValue(new Error('Access denied'));

      vi.mock('../hooks/useRunnerControl', () => ({
        useRunnerControl: () => ({
          status: { data: { status: 'paused' } },
          pauseMutation: { mutate: vi.fn(), isLoading: false },
          resumeMutation: { mutate: mockResume, isLoading: false, error: new Error('Access denied') },
          repeatMutation: { mutate: vi.fn(), isLoading: false },
          advanceMutation: { mutate: vi.fn(), isLoading: false },
        }),
      }));

      renderWithQueryClient(
        <WorkflowControlPanel
          runId="run-123"
          workflowId="workflow-456"
          states={mockStates}
          variant="header"
        />
      );

      fireEvent.click(screen.getByTestId('resume-button'));

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
        expect(screen.getByText(/Access denied/i)).toBeInTheDocument();
      });
    });
  });

  describe('TC-CONTROL-009: Accessibility', () => {
    it('should have proper ARIA attributes', () => {
      renderWithQueryClient(
        <WorkflowControlPanel
          runId="run-123"
          workflowId="workflow-456"
          states={mockStates}
          variant="panel"
        />
      );

      expect(screen.getByRole('region')).toHaveAttribute(
        'aria-label',
        'Workflow control panel'
      );
    });

    it('should have accessible button labels', () => {
      renderWithQueryClient(
        <WorkflowControlPanel
          runId="run-123"
          workflowId="workflow-456"
          states={mockStates}
          variant="header"
        />
      );

      expect(screen.getByLabelText('Pause workflow')).toBeInTheDocument();
      expect(screen.getByLabelText('Resume workflow')).toBeInTheDocument();
      expect(screen.getByLabelText('Repeat current step')).toBeInTheDocument();
      expect(screen.getByLabelText('Skip to next phase')).toBeInTheDocument();
    });

    it('should support keyboard navigation', () => {
      renderWithQueryClient(
        <WorkflowControlPanel
          runId="run-123"
          workflowId="workflow-456"
          states={mockStates}
          variant="header"
        />
      );

      const pauseButton = screen.getByTestId('pause-button');
      pauseButton.focus();
      expect(pauseButton).toHaveFocus();

      // Tab to next button
      fireEvent.keyDown(pauseButton, { key: 'Tab' });
      expect(screen.getByTestId('resume-button')).toHaveFocus();
    });
  });
});
