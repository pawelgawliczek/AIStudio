/**
 * Unit Tests for ToolCallCard Component (ST-173 Phase 7)
 *
 * Tests tool invocation display with collapsible JSON:
 * - Tool name and icon display
 * - Collapsible input/output
 * - JSON syntax highlighting CSS classes
 * - Execution time display
 * - Input/output rendering
 * - Empty state handling
 *
 * Coverage: 6 test cases
 * - Tool Display: 2 tests
 * - Collapsible Behavior: 2 tests
 * - JSON Syntax Highlighting: 1 test
 * - Edge Cases: 1 test
 *
 * TDD STATUS: 🔴 ALL TESTS FAILING - Component not yet implemented
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import type { ToolCall } from '../../../utils/transcript-parser';
import { ToolCallCard } from '../ToolCallCard';

describe('ToolCallCard', () => {
  const mockReadToolCall: ToolCall = {
    name: 'Read',
    input: {
      file_path: '/Users/dev/projects/AIStudio/frontend/src/components/StateBlock.tsx',
    },
  };

  const mockGrepToolCall: ToolCall = {
    name: 'Grep',
    input: {
      pattern: 'TranscriptViewer',
      path: 'frontend/src',
      output_mode: 'files_with_matches',
    },
  };

  const mockToolResult = {
    name: 'Read',
    output: {
      content: 'File contents here...\n// 456 lines total',
      lines: 456,
    },
  };

  // ============================================================================
  // TOOL DISPLAY TESTS
  // ============================================================================

  describe('TC-TOOL-CARD-001: Tool Display', () => {
    it('should render tool name and icon', () => {
      render(<ToolCallCard toolCall={mockReadToolCall} />);

      expect(screen.getByText('Read')).toBeInTheDocument();
      expect(screen.getByTestId('tool-icon')).toBeInTheDocument();
    });

    it('should display tool input as preview text', () => {
      render(<ToolCallCard toolCall={mockReadToolCall} />);

      expect(screen.getByText(/file_path/i)).toBeInTheDocument();
      expect(screen.getByText(/StateBlock.tsx/i)).toBeInTheDocument();
    });
  });

  // ============================================================================
  // COLLAPSIBLE BEHAVIOR TESTS
  // ============================================================================

  describe('TC-TOOL-CARD-002: Collapsible Input/Output', () => {
    it('should collapse input section by default', () => {
      render(<ToolCallCard toolCall={mockReadToolCall} />);

      const inputSection = screen.getByTestId('tool-input-section');
      expect(inputSection).toHaveAttribute('aria-expanded', 'false');
    });

    it('should expand input section when clicked', () => {
      render(<ToolCallCard toolCall={mockReadToolCall} />);

      const inputHeader = screen.getByText(/Input/i);
      fireEvent.click(inputHeader);

      const inputSection = screen.getByTestId('tool-input-section');
      expect(inputSection).toHaveAttribute('aria-expanded', 'true');
    });

    it('should collapse output section by default', () => {
      render(<ToolCallCard toolCall={mockReadToolCall} result={mockToolResult} />);

      const outputSection = screen.getByTestId('tool-output-section');
      expect(outputSection).toHaveAttribute('aria-expanded', 'false');
    });

    it('should expand output section when clicked', () => {
      render(<ToolCallCard toolCall={mockReadToolCall} result={mockToolResult} />);

      const outputHeader = screen.getByText(/Output/i);
      fireEvent.click(outputHeader);

      const outputSection = screen.getByTestId('tool-output-section');
      expect(outputSection).toHaveAttribute('aria-expanded', 'true');
    });
  });

  // ============================================================================
  // JSON SYNTAX HIGHLIGHTING TESTS
  // ============================================================================

  describe('TC-TOOL-CARD-003: JSON Syntax Highlighting', () => {
    it('should display JSON syntax highlighting safely', () => {
      render(<ToolCallCard toolCall={mockGrepToolCall} />);

      const inputHeader = screen.getByText(/Input/i);
      fireEvent.click(inputHeader);

      // Verify JSON content is rendered safely
      const jsonContent = screen.getByTestId('tool-input-json');
      expect(jsonContent).toBeInTheDocument();

      // Verify JSON values are present (not checking implementation)
      expect(jsonContent.textContent).toContain('"pattern"');
      expect(jsonContent.textContent).toContain('"TranscriptViewer"');
    });
  });

  // ============================================================================
  // EXECUTION TIME DISPLAY TESTS
  // ============================================================================

  describe('TC-TOOL-CARD-004: Execution Time Display', () => {
    it('should display execution time when available', () => {
      render(
        <ToolCallCard
          toolCall={mockReadToolCall}
          result={mockToolResult}
          executionTime={0.3}
        />
      );

      expect(screen.getByText(/0.3s/i)).toBeInTheDocument();
    });

    it('should not display execution time when unavailable', () => {
      render(<ToolCallCard toolCall={mockReadToolCall} result={mockToolResult} />);

      expect(screen.queryByTestId('execution-time')).not.toBeInTheDocument();
    });
  });

  // ============================================================================
  // RESULT DISPLAY TESTS
  // ============================================================================

  describe('TC-TOOL-CARD-005: Result Display', () => {
    it('should display result preview when collapsed', () => {
      render(<ToolCallCard toolCall={mockReadToolCall} result={mockToolResult} />);

      expect(screen.getByText(/File contents: 456 lines/i)).toBeInTheDocument();
    });

    it('should display full JSON output when expanded', () => {
      render(<ToolCallCard toolCall={mockReadToolCall} result={mockToolResult} />);

      const outputHeader = screen.getByText(/Output/i);
      fireEvent.click(outputHeader);

      expect(screen.getByText(/content/i)).toBeInTheDocument();
      expect(screen.getByText(/456 lines total/i)).toBeInTheDocument();
    });
  });

  // ============================================================================
  // EDGE CASES TESTS
  // ============================================================================

  describe('TC-TOOL-CARD-006: Edge Cases', () => {
    it('should handle empty input gracefully', () => {
      const emptyToolCall: ToolCall = {
        name: 'EmptyTool',
        input: {},
      };

      render(<ToolCallCard toolCall={emptyToolCall} />);

      expect(screen.getByText('EmptyTool')).toBeInTheDocument();
      expect(screen.getByTestId('tool-input-section')).toBeInTheDocument();
    });

    it('should handle missing result gracefully', () => {
      render(<ToolCallCard toolCall={mockReadToolCall} />);

      expect(screen.getByText('Read')).toBeInTheDocument();
      expect(screen.queryByTestId('tool-output-section')).not.toBeInTheDocument();
    });

    it('should handle large JSON input with truncation', () => {
      const largeToolCall: ToolCall = {
        name: 'LargeTool',
        input: {
          data: 'x'.repeat(10000), // 10KB of data
        },
      };

      render(<ToolCallCard toolCall={largeToolCall} />);

      // Preview should be truncated
      const preview = screen.getByTestId('tool-input-preview');
      expect(preview.textContent?.length).toBeLessThan(5000);
    });
  });

  // ============================================================================
  // ACCESSIBILITY TESTS
  // ============================================================================

  describe('TC-TOOL-CARD-007: Accessibility', () => {
    it('should have proper ARIA attributes for collapsible sections', () => {
      render(<ToolCallCard toolCall={mockReadToolCall} result={mockToolResult} />);

      const inputSection = screen.getByTestId('tool-input-section');
      expect(inputSection).toHaveAttribute('aria-expanded', 'false');
      expect(inputSection).toHaveAttribute('role', 'button');

      const outputSection = screen.getByTestId('tool-output-section');
      expect(outputSection).toHaveAttribute('aria-expanded', 'false');
      expect(outputSection).toHaveAttribute('role', 'button');
    });

    it('should be keyboard navigable', () => {
      render(<ToolCallCard toolCall={mockReadToolCall} result={mockToolResult} />);

      const inputSection = screen.getByTestId('tool-input-section');
      inputSection.focus();
      expect(document.activeElement).toBe(inputSection);

      // Press Enter to expand
      fireEvent.keyDown(inputSection, { key: 'Enter' });
      expect(inputSection).toHaveAttribute('aria-expanded', 'true');
    });
  });
});
