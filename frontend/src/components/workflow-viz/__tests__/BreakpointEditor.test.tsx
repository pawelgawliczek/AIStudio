/**
 * Unit tests for BreakpointEditor component
 * ST-168: Breakpoint CRUD modal
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BreakpointEditor } from '../BreakpointEditor';
import { WorkflowState, Breakpoint } from '../types';

describe('BreakpointEditor', () => {
  const mockStates: WorkflowState[] = [
    {
      id: 's1',
      name: 'Analysis',
      order: 1,
      componentId: 'c1',
      preExecutionInstructions: null,
      postExecutionInstructions: null,
      mandatory: true,
      requiresApproval: false,
      runLocation: 'local',
      offlineFallback: 'pause',
    },
    {
      id: 's2',
      name: 'Implementation',
      order: 2,
      componentId: 'c2',
      preExecutionInstructions: null,
      postExecutionInstructions: null,
      mandatory: true,
      requiresApproval: false,
      runLocation: 'local',
      offlineFallback: 'pause',
    },
  ];

  const mockBreakpoint: Breakpoint = {
    id: 'bp-1',
    runId: 'run-123',
    stateId: 's1',
    position: 'before',
    condition: null,
    active: true,
    hitAt: null,
  };

  describe('TC-BP-EDIT-001: Add mode rendering', () => {
    it('should render add mode with empty form', () => {
      const onSave = vi.fn();
      const onClose = vi.fn();

      render(
        <BreakpointEditor
          mode="add"
          states={mockStates}
          onSave={onSave}
          onClose={onClose}
        />
      );

      expect(screen.getByRole('heading', { name: 'Add Breakpoint' })).toBeInTheDocument();
      expect(screen.getByTestId('state-select')).toBeInTheDocument();
      expect(screen.getByTestId('position-before')).toBeChecked();
    });

    it('should pre-select state when stateId provided', () => {
      const onSave = vi.fn();
      const onClose = vi.fn();

      render(
        <BreakpointEditor
          mode="add"
          stateId="s2"
          states={mockStates}
          onSave={onSave}
          onClose={onClose}
        />
      );

      expect(screen.getByTestId('state-select')).toHaveValue('s2');
    });
  });

  describe('TC-BP-EDIT-002: Edit mode rendering', () => {
    it('should render edit mode with existing values', () => {
      const onSave = vi.fn();
      const onClose = vi.fn();

      render(
        <BreakpointEditor
          mode="edit"
          breakpoint={mockBreakpoint}
          states={mockStates}
          onSave={onSave}
          onClose={onClose}
        />
      );

      expect(screen.getByRole('heading', { name: 'Edit Breakpoint' })).toBeInTheDocument();
      expect(screen.getByTestId('state-select')).toHaveValue('s1');
      expect(screen.getByTestId('state-select')).toBeDisabled();
    });

    it('should display existing condition', () => {
      const conditionalBreakpoint = {
        ...mockBreakpoint,
        condition: { tokensUsed: { $gt: 10000 } },
      };

      const onSave = vi.fn();
      const onClose = vi.fn();

      render(
        <BreakpointEditor
          mode="edit"
          breakpoint={conditionalBreakpoint}
          states={mockStates}
          onSave={onSave}
          onClose={onClose}
        />
      );

      expect(screen.getByTestId('condition-toggle')).toBeChecked();
      expect(screen.getByTestId('condition-builder')).toBeInTheDocument();
    });
  });

  describe('TC-BP-EDIT-003: Position selection', () => {
    it('should allow changing position to after', () => {
      const onSave = vi.fn();
      const onClose = vi.fn();

      render(
        <BreakpointEditor
          mode="add"
          states={mockStates}
          onSave={onSave}
          onClose={onClose}
        />
      );

      const afterRadio = screen.getByTestId('position-after');
      fireEvent.click(afterRadio);

      expect(afterRadio).toBeChecked();
    });
  });

  describe('TC-BP-EDIT-004: Conditional breakpoint', () => {
    it('should show condition builder when toggled', () => {
      const onSave = vi.fn();
      const onClose = vi.fn();

      render(
        <BreakpointEditor
          mode="add"
          states={mockStates}
          onSave={onSave}
          onClose={onClose}
        />
      );

      expect(screen.queryByTestId('condition-builder')).not.toBeInTheDocument();

      fireEvent.click(screen.getByTestId('condition-toggle'));

      expect(screen.getByTestId('condition-builder')).toBeInTheDocument();
      expect(screen.getByTestId('condition-field')).toBeInTheDocument();
      expect(screen.getByTestId('condition-operator')).toBeInTheDocument();
      expect(screen.getByTestId('condition-value')).toBeInTheDocument();
    });

    it('should allow selecting different condition fields', () => {
      const onSave = vi.fn();
      const onClose = vi.fn();

      render(
        <BreakpointEditor
          mode="add"
          states={mockStates}
          onSave={onSave}
          onClose={onClose}
        />
      );

      fireEvent.click(screen.getByTestId('condition-toggle'));

      const fieldSelect = screen.getByTestId('condition-field');
      fireEvent.change(fieldSelect, { target: { value: 'agentSpawns' } });

      expect(fieldSelect).toHaveValue('agentSpawns');
    });
  });

  describe('TC-BP-EDIT-005: Form submission', () => {
    it('should call onSave with correct data', () => {
      const onSave = vi.fn();
      const onClose = vi.fn();

      render(
        <BreakpointEditor
          mode="add"
          stateId="s1"
          states={mockStates}
          onSave={onSave}
          onClose={onClose}
        />
      );

      fireEvent.click(screen.getByTestId('save-breakpoint'));

      expect(onSave).toHaveBeenCalledWith({
        stateId: 's1',
        position: 'before',
        condition: null,
        temporary: false,
      });
    });

    it('should include condition when enabled', () => {
      const onSave = vi.fn();
      const onClose = vi.fn();

      render(
        <BreakpointEditor
          mode="add"
          stateId="s1"
          states={mockStates}
          onSave={onSave}
          onClose={onClose}
        />
      );

      fireEvent.click(screen.getByTestId('condition-toggle'));
      fireEvent.click(screen.getByTestId('save-breakpoint'));

      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          condition: {
            field: 'tokensUsed',
            operator: '$gt',
            value: 10000,
          },
        })
      );
    });
  });

  describe('TC-BP-EDIT-006: Modal interactions', () => {
    it('should call onClose when cancel clicked', () => {
      const onSave = vi.fn();
      const onClose = vi.fn();

      render(
        <BreakpointEditor
          mode="add"
          states={mockStates}
          onSave={onSave}
          onClose={onClose}
        />
      );

      fireEvent.click(screen.getByText('Cancel'));

      expect(onClose).toHaveBeenCalled();
    });

    it('should call onClose when X button clicked', () => {
      const onSave = vi.fn();
      const onClose = vi.fn();

      render(
        <BreakpointEditor
          mode="add"
          states={mockStates}
          onSave={onSave}
          onClose={onClose}
        />
      );

      fireEvent.click(screen.getByLabelText('Close'));

      expect(onClose).toHaveBeenCalled();
    });

    it('should disable save button when no state selected', () => {
      const onSave = vi.fn();
      const onClose = vi.fn();

      render(
        <BreakpointEditor
          mode="add"
          states={mockStates}
          onSave={onSave}
          onClose={onClose}
        />
      );

      expect(screen.getByTestId('save-breakpoint')).toBeDisabled();
    });
  });
});
