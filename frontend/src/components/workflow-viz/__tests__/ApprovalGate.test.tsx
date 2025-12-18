/**
 * Unit tests for ApprovalGate component
 * ST-168: Human-in-the-loop approval UI
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ApprovalGate } from '../ApprovalGate';
import { ApprovalRequest } from '../types';

describe('ApprovalGate', () => {
  const mockApproval: ApprovalRequest = {
    id: 'ap-1',
    workflowRunId: 'run-123',
    stateId: 's1',
    status: 'pending',
    requestedAt: new Date(Date.now() - 5 * 60000).toISOString(), // 5 min ago
    decidedBy: null,
    decidedAt: null,
    feedback: null,
  };

  const mockArtifacts = [
    { id: 'a1', key: 'IMPL_CODE', name: 'Implementation Code', type: 'code' },
    { id: 'a2', key: 'TEST_SUITE', name: 'Test Results', type: 'report' },
  ];

  describe('TC-APPROVAL-001: Basic rendering', () => {
    it('should render approval gate with pending status', () => {
      const onApprove = vi.fn();
      const onRerun = vi.fn();
      const onReject = vi.fn();

      render(
        <ApprovalGate
          approval={mockApproval}
          stateName="Implementation"
          onApprove={onApprove}
          onRerun={onRerun}
          onReject={onReject}
        />
      );

      expect(screen.getByTestId('approval-gate')).toBeInTheDocument();
      expect(screen.getByTestId('approval-status')).toHaveTextContent('PENDING');
      expect(screen.getByText(/Implementation/)).toBeInTheDocument();
      expect(screen.getByText(/5 min/)).toBeInTheDocument();
    });

    it('should display context summary when provided', () => {
      const onApprove = vi.fn();
      const onRerun = vi.fn();
      const onReject = vi.fn();

      render(
        <ApprovalGate
          approval={mockApproval}
          stateName="Implementation"
          contextSummary="Added JWT authentication with 342 lines of code"
          onApprove={onApprove}
          onRerun={onRerun}
          onReject={onReject}
        />
      );

      expect(screen.getByTestId('context-summary')).toBeInTheDocument();
      expect(screen.getByText(/Added JWT authentication/)).toBeInTheDocument();
    });

    it('should display artifacts when provided', () => {
      const onApprove = vi.fn();
      const onRerun = vi.fn();
      const onReject = vi.fn();

      render(
        <ApprovalGate
          approval={mockApproval}
          stateName="Implementation"
          artifacts={mockArtifacts}
          onApprove={onApprove}
          onRerun={onRerun}
          onReject={onReject}
        />
      );

      expect(screen.getByTestId('artifacts-section')).toBeInTheDocument();
      expect(screen.getByText('Implementation Code')).toBeInTheDocument();
      expect(screen.getByText('Test Results')).toBeInTheDocument();
    });
  });

  describe('TC-APPROVAL-002: Approval action', () => {
    it('should call onApprove when approve button clicked', async () => {
      const onApprove = vi.fn().mockResolvedValue(undefined);
      const onRerun = vi.fn();
      const onReject = vi.fn();

      render(
        <ApprovalGate
          approval={mockApproval}
          stateName="Implementation"
          onApprove={onApprove}
          onRerun={onRerun}
          onReject={onReject}
        />
      );

      fireEvent.click(screen.getByTestId('approve-button'));

      await waitFor(() => {
        expect(onApprove).toHaveBeenCalled();
      });
    });
  });

  describe('TC-APPROVAL-003: Rerun with feedback', () => {
    it('should disable rerun button when no feedback entered', () => {
      const onApprove = vi.fn();
      const onRerun = vi.fn();
      const onReject = vi.fn();

      render(
        <ApprovalGate
          approval={mockApproval}
          stateName="Implementation"
          onApprove={onApprove}
          onRerun={onRerun}
          onReject={onReject}
        />
      );

      expect(screen.getByTestId('rerun-button')).toBeDisabled();
    });

    it('should enable rerun button when feedback entered', () => {
      const onApprove = vi.fn();
      const onRerun = vi.fn();
      const onReject = vi.fn();

      render(
        <ApprovalGate
          approval={mockApproval}
          stateName="Implementation"
          onApprove={onApprove}
          onRerun={onRerun}
          onReject={onReject}
        />
      );

      fireEvent.change(screen.getByTestId('feedback-textarea'), {
        target: { value: 'Fix the failing tests' },
      });

      expect(screen.getByTestId('rerun-button')).not.toBeDisabled();
    });

    it('should call onRerun with feedback', async () => {
      const onApprove = vi.fn();
      const onRerun = vi.fn().mockResolvedValue(undefined);
      const onReject = vi.fn();

      render(
        <ApprovalGate
          approval={mockApproval}
          stateName="Implementation"
          onApprove={onApprove}
          onRerun={onRerun}
          onReject={onReject}
        />
      );

      fireEvent.change(screen.getByTestId('feedback-textarea'), {
        target: { value: 'Fix the failing tests' },
      });
      fireEvent.click(screen.getByTestId('rerun-button'));

      await waitFor(() => {
        expect(onRerun).toHaveBeenCalledWith('Fix the failing tests');
      });
    });
  });

  describe('TC-APPROVAL-004: Reject action', () => {
    it('should show reject options when reject toggle clicked', () => {
      const onApprove = vi.fn();
      const onRerun = vi.fn();
      const onReject = vi.fn();

      render(
        <ApprovalGate
          approval={mockApproval}
          stateName="Implementation"
          onApprove={onApprove}
          onRerun={onRerun}
          onReject={onReject}
        />
      );

      expect(screen.queryByTestId('reject-options')).not.toBeInTheDocument();

      fireEvent.click(screen.getByTestId('reject-toggle'));

      expect(screen.getByTestId('reject-options')).toBeInTheDocument();
      expect(screen.getByTestId('reject-cancel')).toBeInTheDocument();
      expect(screen.getByTestId('reject-pause')).toBeInTheDocument();
    });

    it('should call onReject with cancel mode', async () => {
      const onApprove = vi.fn();
      const onRerun = vi.fn();
      const onReject = vi.fn().mockResolvedValue(undefined);

      render(
        <ApprovalGate
          approval={mockApproval}
          stateName="Implementation"
          onApprove={onApprove}
          onRerun={onRerun}
          onReject={onReject}
        />
      );

      fireEvent.click(screen.getByTestId('reject-toggle'));
      fireEvent.click(screen.getByTestId('reject-cancel'));

      await waitFor(() => {
        expect(onReject).toHaveBeenCalledWith('', 'cancel');
      });
    });

    it('should call onReject with pause mode and reason', async () => {
      const onApprove = vi.fn();
      const onRerun = vi.fn();
      const onReject = vi.fn().mockResolvedValue(undefined);

      render(
        <ApprovalGate
          approval={mockApproval}
          stateName="Implementation"
          onApprove={onApprove}
          onRerun={onRerun}
          onReject={onReject}
        />
      );

      fireEvent.click(screen.getByTestId('reject-toggle'));
      fireEvent.change(screen.getByTestId('reject-reason'), {
        target: { value: 'Needs more work' },
      });
      fireEvent.click(screen.getByTestId('reject-pause'));

      await waitFor(() => {
        expect(onReject).toHaveBeenCalledWith('Needs more work', 'pause');
      });
    });
  });

  describe('TC-APPROVAL-005: Accessibility', () => {
    it('should have proper ARIA attributes', () => {
      const onApprove = vi.fn();
      const onRerun = vi.fn();
      const onReject = vi.fn();

      render(
        <ApprovalGate
          approval={mockApproval}
          stateName="Implementation"
          onApprove={onApprove}
          onRerun={onRerun}
          onReject={onReject}
        />
      );

      expect(screen.getByRole('region')).toHaveAttribute(
        'aria-label',
        'Approval request for Implementation'
      );
    });
  });
});
