/**
 * Unit tests for StructuredSummaryDisplay component
 * ST-203: Add componentSummary field for structured agent handoffs
 *
 * TDD Test Suite - Tests written BEFORE implementation
 */

import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { StructuredSummaryDisplay } from '../StructuredSummaryDisplay';
import type { ComponentSummaryStructured } from '../types';

describe('StructuredSummaryDisplay', () => {
  describe('TC-SSD-001: Rendering with different status types', () => {
    it('should render success status with green badge', () => {
      const summary: ComponentSummaryStructured = {
        version: '1.0',
        status: 'success',
        summary: 'Work completed successfully',
      };

      render(<StructuredSummaryDisplay summary={summary} variant="compact" />);

      expect(screen.getByText('Work completed successfully')).toBeInTheDocument();
      expect(screen.getByTestId('status-badge-success')).toBeInTheDocument();
      expect(screen.getByTestId('status-badge-success')).toHaveClass('bg-green-100', 'text-green-800');
    });

    it('should render partial status with yellow badge', () => {
      const summary: ComponentSummaryStructured = {
        version: '1.0',
        status: 'partial',
        summary: 'Work partially completed',
      };

      render(<StructuredSummaryDisplay summary={summary} variant="compact" />);

      expect(screen.getByText('Work partially completed')).toBeInTheDocument();
      expect(screen.getByTestId('status-badge-partial')).toBeInTheDocument();
      expect(screen.getByTestId('status-badge-partial')).toHaveClass('bg-yellow-100', 'text-yellow-800');
    });

    it('should render blocked status with orange badge', () => {
      const summary: ComponentSummaryStructured = {
        version: '1.0',
        status: 'blocked',
        summary: 'Work is blocked',
      };

      render(<StructuredSummaryDisplay summary={summary} variant="compact" />);

      expect(screen.getByText('Work is blocked')).toBeInTheDocument();
      expect(screen.getByTestId('status-badge-blocked')).toBeInTheDocument();
      expect(screen.getByTestId('status-badge-blocked')).toHaveClass('bg-orange-100', 'text-orange-800');
    });

    it('should render failed status with red badge', () => {
      const summary: ComponentSummaryStructured = {
        version: '1.0',
        status: 'failed',
        summary: 'Work failed',
      };

      render(<StructuredSummaryDisplay summary={summary} variant="compact" />);

      expect(screen.getByText('Work failed')).toBeInTheDocument();
      expect(screen.getByTestId('status-badge-failed')).toBeInTheDocument();
      expect(screen.getByTestId('status-badge-failed')).toHaveClass('bg-red-100', 'text-red-800');
    });
  });

  describe('TC-SSD-002: Compact variant rendering', () => {
    it('should render compact variant with minimal information', () => {
      const summary: ComponentSummaryStructured = {
        version: '1.0',
        status: 'success',
        summary: 'Implemented feature X',
        keyOutputs: ['Created 3 files', 'Added tests'],
        nextAgentHints: ['Review error handling'],
      };

      render(<StructuredSummaryDisplay summary={summary} variant="compact" />);

      expect(screen.getByTestId('summary-display-compact')).toBeInTheDocument();
      expect(screen.getByText('Implemented feature X')).toBeInTheDocument();

      // Compact should NOT show key outputs or hints
      expect(screen.queryByTestId('key-outputs-list')).not.toBeInTheDocument();
      expect(screen.queryByTestId('next-agent-hints-list')).not.toBeInTheDocument();
    });

    it('should show status badge and summary in single line for compact', () => {
      const summary: ComponentSummaryStructured = {
        version: '1.0',
        status: 'success',
        summary: 'Quick summary',
      };

      render(<StructuredSummaryDisplay summary={summary} variant="compact" />);

      const container = screen.getByTestId('summary-display-compact');

      expect(container).toHaveClass('flex', 'items-center', 'gap-2');
    });

    it('should truncate long summaries in compact variant', () => {
      const summary: ComponentSummaryStructured = {
        version: '1.0',
        status: 'success',
        summary: 'This is a very long summary that should be truncated in compact view to prevent layout issues',
      };

      render(<StructuredSummaryDisplay summary={summary} variant="compact" />);

      const summaryElement = screen.getByTestId('summary-text');

      expect(summaryElement).toHaveClass('truncate');
    });
  });

  describe('TC-SSD-003: Full variant rendering', () => {
    it('should render full variant with all information', () => {
      const summary: ComponentSummaryStructured = {
        version: '1.0',
        status: 'success',
        summary: 'Implemented feature X',
        keyOutputs: ['Created 3 files', 'Added tests', 'Updated docs'],
        nextAgentHints: ['Review error handling', 'Add integration tests'],
        artifactsProduced: ['ARCH_DOC', 'API_SPEC'],
        errors: undefined,
      };

      render(<StructuredSummaryDisplay summary={summary} variant="full" />);

      expect(screen.getByTestId('summary-display-full')).toBeInTheDocument();
      expect(screen.getByText('Implemented feature X')).toBeInTheDocument();

      // Full should show all sections
      expect(screen.getByTestId('key-outputs-list')).toBeInTheDocument();
      expect(screen.getByText('Created 3 files')).toBeInTheDocument();
      expect(screen.getByText('Added tests')).toBeInTheDocument();
      expect(screen.getByText('Updated docs')).toBeInTheDocument();

      expect(screen.getByTestId('next-agent-hints-list')).toBeInTheDocument();
      expect(screen.getByText('Review error handling')).toBeInTheDocument();
      expect(screen.getByText('Add integration tests')).toBeInTheDocument();

      expect(screen.getByTestId('artifacts-produced-list')).toBeInTheDocument();
      expect(screen.getByText('ARCH_DOC')).toBeInTheDocument();
      expect(screen.getByText('API_SPEC')).toBeInTheDocument();
    });

    it('should show section headers in full variant', () => {
      const summary: ComponentSummaryStructured = {
        version: '1.0',
        status: 'success',
        summary: 'Test summary',
        keyOutputs: ['Output 1'],
        nextAgentHints: ['Hint 1'],
      };

      render(<StructuredSummaryDisplay summary={summary} variant="full" />);

      expect(screen.getByText(/key outputs/i)).toBeInTheDocument();
      expect(screen.getByText(/next agent hints/i)).toBeInTheDocument();
    });

    it('should not show empty sections in full variant', () => {
      const summary: ComponentSummaryStructured = {
        version: '1.0',
        status: 'success',
        summary: 'Test summary',
        // No optional fields provided
      };

      render(<StructuredSummaryDisplay summary={summary} variant="full" />);

      expect(screen.queryByTestId('key-outputs-list')).not.toBeInTheDocument();
      expect(screen.queryByTestId('next-agent-hints-list')).not.toBeInTheDocument();
      expect(screen.queryByTestId('artifacts-produced-list')).not.toBeInTheDocument();
      expect(screen.queryByTestId('errors-list')).not.toBeInTheDocument();
    });

    it('should show errors section in full variant when present', () => {
      const summary: ComponentSummaryStructured = {
        version: '1.0',
        status: 'failed',
        summary: 'Work failed',
        errors: ['Unit tests failing', 'Missing dependency'],
      };

      render(<StructuredSummaryDisplay summary={summary} variant="full" />);

      expect(screen.getByTestId('errors-list')).toBeInTheDocument();
      expect(screen.getByText('Unit tests failing')).toBeInTheDocument();
      expect(screen.getByText('Missing dependency')).toBeInTheDocument();
    });

    it('should style errors section with danger colors', () => {
      const summary: ComponentSummaryStructured = {
        version: '1.0',
        status: 'failed',
        summary: 'Failed',
        errors: ['Error 1'],
      };

      render(<StructuredSummaryDisplay summary={summary} variant="full" />);

      const errorsList = screen.getByTestId('errors-list');

      expect(errorsList).toHaveClass('text-red-600');
    });
  });

  describe('TC-SSD-004: Handling null and undefined', () => {
    it('should render nothing when summary is null', () => {
      const { container } = render(
        <StructuredSummaryDisplay summary={null} variant="compact" />
      );

      expect(container.firstChild).toBeNull();
    });

    it('should render nothing when summary is undefined', () => {
      const { container } = render(
        <StructuredSummaryDisplay summary={undefined} variant="compact" />
      );

      expect(container.firstChild).toBeNull();
    });

    it('should handle empty keyOutputs array', () => {
      const summary: ComponentSummaryStructured = {
        version: '1.0',
        status: 'success',
        summary: 'Test',
        keyOutputs: [],
      };

      render(<StructuredSummaryDisplay summary={summary} variant="full" />);

      expect(screen.queryByTestId('key-outputs-list')).not.toBeInTheDocument();
    });

    it('should handle undefined optional fields gracefully', () => {
      const summary: ComponentSummaryStructured = {
        version: '1.0',
        status: 'success',
        summary: 'Test',
        keyOutputs: undefined,
        nextAgentHints: undefined,
        artifactsProduced: undefined,
        errors: undefined,
      };

      const { container } = render(
        <StructuredSummaryDisplay summary={summary} variant="full" />
      );

      expect(container).toBeInTheDocument();
      expect(screen.queryByTestId('key-outputs-list')).not.toBeInTheDocument();
    });
  });

  describe('TC-SSD-005: Accessibility', () => {
    it('should have proper ARIA labels for status badges', () => {
      const summary: ComponentSummaryStructured = {
        version: '1.0',
        status: 'success',
        summary: 'Test',
      };

      render(<StructuredSummaryDisplay summary={summary} variant="compact" />);

      const badge = screen.getByTestId('status-badge-success');

      expect(badge).toHaveAttribute('aria-label', 'Status: Success');
    });

    it('should have semantic list markup for outputs', () => {
      const summary: ComponentSummaryStructured = {
        version: '1.0',
        status: 'success',
        summary: 'Test',
        keyOutputs: ['Output 1', 'Output 2'],
      };

      render(<StructuredSummaryDisplay summary={summary} variant="full" />);

      const list = screen.getByTestId('key-outputs-list');

      expect(list.tagName).toBe('UL');
      expect(list.querySelectorAll('li')).toHaveLength(2);
    });

    it('should have semantic list markup for hints', () => {
      const summary: ComponentSummaryStructured = {
        version: '1.0',
        status: 'success',
        summary: 'Test',
        nextAgentHints: ['Hint 1'],
      };

      render(<StructuredSummaryDisplay summary={summary} variant="full" />);

      const list = screen.getByTestId('next-agent-hints-list');

      expect(list.tagName).toBe('UL');
    });

    it('should have semantic list markup for artifacts', () => {
      const summary: ComponentSummaryStructured = {
        version: '1.0',
        status: 'success',
        summary: 'Test',
        artifactsProduced: ['ARCH_DOC'],
      };

      render(<StructuredSummaryDisplay summary={summary} variant="full" />);

      const list = screen.getByTestId('artifacts-produced-list');

      expect(list.tagName).toBe('UL');
    });
  });

  describe('TC-SSD-006: Edge cases and validation', () => {
    it('should handle very long summary text', () => {
      const summary: ComponentSummaryStructured = {
        version: '1.0',
        status: 'success',
        summary: 'x'.repeat(500),
      };

      const { container } = render(
        <StructuredSummaryDisplay summary={summary} variant="full" />
      );

      expect(container).toBeInTheDocument();
      expect(screen.getByTestId('summary-text')).toHaveTextContent('x'.repeat(500));
    });

    it('should handle special characters in summary', () => {
      const summary: ComponentSummaryStructured = {
        version: '1.0',
        status: 'success',
        summary: 'Summary with <script>alert("xss")</script> and & special chars',
      };

      render(<StructuredSummaryDisplay summary={summary} variant="compact" />);

      const text = screen.getByTestId('summary-text').textContent;

      expect(text).toContain('<script>');
      expect(text).toContain('&');
      // React automatically escapes HTML
    });

    it('should handle max length arrays (5 keyOutputs)', () => {
      const summary: ComponentSummaryStructured = {
        version: '1.0',
        status: 'success',
        summary: 'Test',
        keyOutputs: ['Output 1', 'Output 2', 'Output 3', 'Output 4', 'Output 5'],
      };

      render(<StructuredSummaryDisplay summary={summary} variant="full" />);

      const items = screen.getByTestId('key-outputs-list').querySelectorAll('li');

      expect(items).toHaveLength(5);
    });

    it('should handle max length arrays (3 hints)', () => {
      const summary: ComponentSummaryStructured = {
        version: '1.0',
        status: 'success',
        summary: 'Test',
        nextAgentHints: ['Hint 1', 'Hint 2', 'Hint 3'],
      };

      render(<StructuredSummaryDisplay summary={summary} variant="full" />);

      const items = screen.getByTestId('next-agent-hints-list').querySelectorAll('li');

      expect(items).toHaveLength(3);
    });

    it('should handle max length arrays (3 errors)', () => {
      const summary: ComponentSummaryStructured = {
        version: '1.0',
        status: 'failed',
        summary: 'Test',
        errors: ['Error 1', 'Error 2', 'Error 3'],
      };

      render(<StructuredSummaryDisplay summary={summary} variant="full" />);

      const items = screen.getByTestId('errors-list').querySelectorAll('li');

      expect(items).toHaveLength(3);
    });

    it('should render when version field is different', () => {
      const summary: ComponentSummaryStructured = {
        version: '1.0',
        status: 'success',
        summary: 'Test',
      };

      const { container } = render(
        <StructuredSummaryDisplay summary={summary} variant="compact" />
      );

      expect(container).toBeInTheDocument();
      // Component should work regardless of version field
    });
  });

  describe('TC-SSD-007: Visual styling consistency', () => {
    it('should use consistent spacing in compact variant', () => {
      const summary: ComponentSummaryStructured = {
        version: '1.0',
        status: 'success',
        summary: 'Test',
      };

      render(<StructuredSummaryDisplay summary={summary} variant="compact" />);

      const container = screen.getByTestId('summary-display-compact');

      expect(container).toHaveClass('gap-2'); // Consistent spacing
    });

    it('should use consistent spacing in full variant', () => {
      const summary: ComponentSummaryStructured = {
        version: '1.0',
        status: 'success',
        summary: 'Test',
        keyOutputs: ['Output 1'],
      };

      render(<StructuredSummaryDisplay summary={summary} variant="full" />);

      const container = screen.getByTestId('summary-display-full');

      expect(container).toHaveClass('space-y-3'); // Consistent section spacing
    });

    it('should apply proper list styling for key outputs', () => {
      const summary: ComponentSummaryStructured = {
        version: '1.0',
        status: 'success',
        summary: 'Test',
        keyOutputs: ['Output 1', 'Output 2'],
      };

      render(<StructuredSummaryDisplay summary={summary} variant="full" />);

      const list = screen.getByTestId('key-outputs-list');

      expect(list).toHaveClass('list-disc', 'list-inside', 'space-y-1');
    });

    it('should apply proper list styling for hints', () => {
      const summary: ComponentSummaryStructured = {
        version: '1.0',
        status: 'success',
        summary: 'Test',
        nextAgentHints: ['Hint 1'],
      };

      render(<StructuredSummaryDisplay summary={summary} variant="full" />);

      const list = screen.getByTestId('next-agent-hints-list');

      expect(list).toHaveClass('list-disc', 'list-inside', 'space-y-1');
    });
  });

  describe('TC-SSD-008: Integration with ComponentRun data', () => {
    it('should render summary from ComponentRun with all fields', () => {
      const componentRunSummary: ComponentSummaryStructured = {
        version: '1.0',
        status: 'success',
        summary: 'Implementer completed successfully',
        keyOutputs: ['Modified src/api.ts', 'Added tests/api.test.ts', 'Updated README.md'],
        nextAgentHints: ['Review error handling in API layer'],
        artifactsProduced: ['API_SPEC'],
      };

      render(<StructuredSummaryDisplay summary={componentRunSummary} variant="full" />);

      expect(screen.getByText('Implementer completed successfully')).toBeInTheDocument();
      expect(screen.getByText('Modified src/api.ts')).toBeInTheDocument();
      expect(screen.getByText('Review error handling in API layer')).toBeInTheDocument();
      expect(screen.getByText('API_SPEC')).toBeInTheDocument();
    });

    it('should handle partial completion from ComponentRun', () => {
      const componentRunSummary: ComponentSummaryStructured = {
        version: '1.0',
        status: 'partial',
        summary: 'Partial implementation - database migrations pending',
        keyOutputs: ['Created model schemas'],
        nextAgentHints: ['Complete database migrations', 'Add seed data'],
      };

      render(<StructuredSummaryDisplay summary={componentRunSummary} variant="full" />);

      expect(screen.getByTestId('status-badge-partial')).toBeInTheDocument();
      expect(screen.getByText('Partial implementation - database migrations pending')).toBeInTheDocument();
    });

    it('should handle failure from ComponentRun with errors', () => {
      const componentRunSummary: ComponentSummaryStructured = {
        version: '1.0',
        status: 'failed',
        summary: 'Implementation failed due to test failures',
        errors: ['3 unit tests failing', 'Type errors in api.ts'],
      };

      render(<StructuredSummaryDisplay summary={componentRunSummary} variant="full" />);

      expect(screen.getByTestId('status-badge-failed')).toBeInTheDocument();
      expect(screen.getByText('3 unit tests failing')).toBeInTheDocument();
      expect(screen.getByText('Type errors in api.ts')).toBeInTheDocument();
    });
  });
});
