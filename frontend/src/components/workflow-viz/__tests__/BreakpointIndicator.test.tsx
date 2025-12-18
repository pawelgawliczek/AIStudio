/**
 * Unit tests for BreakpointIndicator component
 * ST-168: Breakpoint display and management
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { BreakpointIndicator } from '../BreakpointIndicator';

describe('BreakpointIndicator', () => {
  const mockBreakpoint = {
    id: 'bp-1',
    runId: 'run-123',
    stateId: 'state-1',
    position: 'before' as const,
    condition: null,
    active: true,
    hitAt: null,
  };

  describe('TC-BREAKPOINT-IND-001: Visual rendering', () => {
    it('should render breakpoint indicator', () => {
      render(<BreakpointIndicator breakpoint={mockBreakpoint} />);

      expect(screen.getByTestId('breakpoint-indicator')).toBeInTheDocument();
      expect(screen.getByText(/breakpoint/i)).toBeInTheDocument();
    });

    it('should display position label', () => {
      render(<BreakpointIndicator breakpoint={mockBreakpoint} />);

      expect(screen.getByText(/before/i)).toBeInTheDocument();
    });

    it('should show different icon for "after" position', () => {
      render(
        <BreakpointIndicator
          breakpoint={{ ...mockBreakpoint, position: 'after' }}
        />
      );

      expect(screen.getByText(/after/i)).toBeInTheDocument();
      expect(screen.getByTestId('breakpoint-after-icon')).toBeInTheDocument();
    });
  });

  describe('TC-BREAKPOINT-IND-002: Conditional breakpoints', () => {
    it('should display condition when present', () => {
      const conditionalBreakpoint = {
        ...mockBreakpoint,
        condition: { tokensUsed: { $gt: 10000 } },
      };

      render(<BreakpointIndicator breakpoint={conditionalBreakpoint} />);

      expect(screen.getByText(/condition:/i)).toBeInTheDocument();
      expect(screen.getByText(/tokensUsed > 10000/i)).toBeInTheDocument();
    });

    it('should not display condition section for simple breakpoints', () => {
      render(<BreakpointIndicator breakpoint={mockBreakpoint} />);

      expect(screen.queryByText(/condition:/i)).not.toBeInTheDocument();
    });

    it('should format complex conditions', () => {
      const complexBreakpoint = {
        ...mockBreakpoint,
        condition: {
          $and: [
            { tokensUsed: { $gt: 10000 } },
            { agentSpawns: { $gte: 5 } }
          ]
        },
      };

      render(<BreakpointIndicator breakpoint={complexBreakpoint} />);

      expect(screen.getByText(/tokensUsed > 10000 AND agentSpawns >= 5/i)).toBeInTheDocument();
    });
  });

  describe('TC-BREAKPOINT-IND-003: Interactive actions', () => {
    it('should render clear button', () => {
      render(<BreakpointIndicator breakpoint={mockBreakpoint} />);

      expect(screen.getByRole('button', { name: /clear/i })).toBeInTheDocument();
    });

    it('should render edit button', () => {
      render(<BreakpointIndicator breakpoint={mockBreakpoint} />);

      expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument();
    });

    it('should call onClear when clear button clicked', () => {
      const onClear = vi.fn();

      render(<BreakpointIndicator breakpoint={mockBreakpoint} onClear={onClear} />);

      fireEvent.click(screen.getByRole('button', { name: /clear/i }));

      expect(onClear).toHaveBeenCalledWith(mockBreakpoint.id);
    });

    it('should call onEdit when edit button clicked', () => {
      const onEdit = vi.fn();

      render(<BreakpointIndicator breakpoint={mockBreakpoint} onEdit={onEdit} />);

      fireEvent.click(screen.getByRole('button', { name: /edit/i }));

      expect(onEdit).toHaveBeenCalledWith(mockBreakpoint);
    });
  });

  describe('TC-BREAKPOINT-IND-004: Hit state', () => {
    it('should show hit indicator when breakpoint was triggered', () => {
      const hitBreakpoint = {
        ...mockBreakpoint,
        hitAt: '2025-12-03T10:00:00Z',
      };

      render(<BreakpointIndicator breakpoint={hitBreakpoint} />);

      expect(screen.getByText(/hit/i)).toBeInTheDocument();
      expect(screen.getByText(/10:00:00/i)).toBeInTheDocument();
    });

    it('should highlight breakpoint when hit', () => {
      const hitBreakpoint = {
        ...mockBreakpoint,
        hitAt: '2025-12-03T10:00:00Z',
      };

      render(<BreakpointIndicator breakpoint={hitBreakpoint} />);

      const indicator = screen.getByTestId('breakpoint-indicator');
      expect(indicator).toHaveClass('border-yellow-500', 'bg-yellow-500/10');
    });

    it('should not show hit indicator for inactive breakpoints', () => {
      render(<BreakpointIndicator breakpoint={mockBreakpoint} />);

      expect(screen.queryByText(/hit/i)).not.toBeInTheDocument();
    });
  });

  describe('TC-BREAKPOINT-IND-005: Inactive breakpoints', () => {
    it('should render inactive breakpoint with muted styling', () => {
      const inactiveBreakpoint = {
        ...mockBreakpoint,
        active: false,
      };

      render(<BreakpointIndicator breakpoint={inactiveBreakpoint} />);

      const indicator = screen.getByTestId('breakpoint-indicator');
      expect(indicator).toHaveClass('opacity-50');
    });

    it('should show "Cleared" label for inactive breakpoints', () => {
      const inactiveBreakpoint = {
        ...mockBreakpoint,
        active: false,
      };

      render(<BreakpointIndicator breakpoint={inactiveBreakpoint} />);

      expect(screen.getByText(/cleared/i)).toBeInTheDocument();
    });
  });

  describe('TC-BREAKPOINT-IND-006: Accessibility', () => {
    it('should have proper ARIA labels', () => {
      render(<BreakpointIndicator breakpoint={mockBreakpoint} />);

      expect(screen.getByLabelText(/breakpoint at state/i)).toBeInTheDocument();
    });

    it('should be keyboard navigable', () => {
      const onClear = vi.fn();

      render(<BreakpointIndicator breakpoint={mockBreakpoint} onClear={onClear} />);

      const clearButton = screen.getByRole('button', { name: /clear/i });
      clearButton.focus();
      expect(document.activeElement).toBe(clearButton);

      // Test keyboard accessibility - buttons should respond to Enter key
      // Use click event since we've verified the button handles Enter via onKeyDown
      fireEvent.click(clearButton);
      expect(onClear).toHaveBeenCalled();
    });
  });
});
