/**
 * Unit Tests for LiveTranscriptViewer Component (ST-176)
 *
 * Tests live transcript viewer component with:
 * - Rendering with transcript lines
 * - Auto-scroll behavior
 * - Filtering by event type
 * - Download functionality
 * - Syntax highlighting
 * - Virtualization (performance)
 * - Error states
 *
 * @see ST-176: Real-Time Agent Transcript Streaming in Web GUI
 */

import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import LiveTranscriptViewer from '../LiveTranscriptViewer';
const mockUseTranscriptStream = vi.fn();
vi.mock('../../../hooks/useTranscriptStream', () => ({
  useTranscriptStream: () => mockUseTranscriptStream(),
}));
// Mock react-window for virtualization
vi.mock('react-window', () => ({
  FixedSizeList: ({ children, itemCount }: any) => (
    <div data-testid="virtualized-list">
      {Array.from({ length: itemCount }).map((_, index) =>
        children({ index, style: {} })
      )}
    </div>
  ),
}));
// Mock syntax highlighter
vi.mock('react-syntax-highlighter', () => ({
  Prism: ({ children }: any) => <pre data-testid="syntax-highlighter">{children}</pre>,
}));

describe('LiveTranscriptViewer', () => {
  const defaultProps = {
    componentRunId: 'run-123',
    maxLines: 500,
    height: '600px',
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock implementation
    mockUseTranscriptStream.mockReturnValue({
      lines: [],
      isStreaming: false,
      connectionState: 'connected',
      error: null,
      subscribe: vi.fn(),
      unsubscribe: vi.fn(),
      clear: vi.fn(),
      retry: vi.fn(),
    });
  });

  describe('Rendering', () => {
    it('should render component with header', () => {
      render(<LiveTranscriptViewer {...defaultProps} />);

      expect(screen.getByText(/Live Transcript/i)).toBeInTheDocument();
    });

    it('should render transcript lines', () => {
      const mockLines = [
        {
          sequenceNumber: 1,
          line: '{"content": "line 1"}',
          timestamp: new Date(),
        },
        {
          sequenceNumber: 2,
          line: '{"content": "line 2"}',
          timestamp: new Date(),
        },
      ];

      mockUseTranscriptStream.mockReturnValue({
        ...mockUseTranscriptStream(),
        lines: mockLines,
        isStreaming: true,
      });

      render(<LiveTranscriptViewer {...defaultProps} />);

      expect(screen.getByText(/line 1/)).toBeInTheDocument();
      expect(screen.getByText(/line 2/)).toBeInTheDocument();
    });

    it('should display line count', () => {
      const mockLines = Array.from({ length: 143 }, (_, i) => ({
        sequenceNumber: i + 1,
        line: `line ${i + 1}`,
        timestamp: new Date(),
      }));

      mockUseTranscriptStream.mockReturnValue({
        ...mockUseTranscriptStream(),
        lines: mockLines,
      });

      render(<LiveTranscriptViewer {...defaultProps} />);

      expect(screen.getByText(/143 lines/i)).toBeInTheDocument();
    });

    it('should show streaming indicator when isStreaming=true', () => {
      mockUseTranscriptStream.mockReturnValue({
        ...mockUseTranscriptStream(),
        isStreaming: true,
      });

      render(<LiveTranscriptViewer {...defaultProps} />);

      expect(screen.getByTestId('streaming-indicator')).toBeInTheDocument();
    });

    it('should show elapsed time badge', () => {
      mockUseTranscriptStream.mockReturnValue({
        ...mockUseTranscriptStream(),
        isStreaming: true,
      });

      render(<LiveTranscriptViewer {...defaultProps} />);

      expect(screen.getByText(/elapsed/i)).toBeInTheDocument();
    });
  });

  describe('Auto-scroll', () => {
    it('should have auto-scroll toggle button', () => {
      render(<LiveTranscriptViewer {...defaultProps} />);

      expect(screen.getByLabelText(/auto-scroll/i)).toBeInTheDocument();
    });

    it('should enable auto-scroll by default', () => {
      render(<LiveTranscriptViewer {...defaultProps} />);

      const toggle = screen.getByLabelText(/auto-scroll/i);
      expect(toggle).toBeChecked();
    });

    it('should disable auto-scroll when toggle clicked', () => {
      render(<LiveTranscriptViewer {...defaultProps} />);

      const toggle = screen.getByLabelText(/auto-scroll/i);
      fireEvent.click(toggle);

      expect(toggle).not.toBeChecked();
    });

    it('should pause auto-scroll when user scrolls up', () => {
      const mockLines = Array.from({ length: 100 }, (_, i) => ({
        sequenceNumber: i + 1,
        line: `line ${i + 1}`,
        timestamp: new Date(),
      }));

      mockUseTranscriptStream.mockReturnValue({
        ...mockUseTranscriptStream(),
        lines: mockLines,
      });

      render(<LiveTranscriptViewer {...defaultProps} />);

      const scrollContainer = screen.getByTestId('transcript-container');

      // Simulate scroll up
      fireEvent.scroll(scrollContainer, { target: { scrollTop: 100 } });

      const toggle = screen.getByLabelText(/auto-scroll/i);
      expect(toggle).not.toBeChecked();
    });
  });

  describe('Filtering', () => {
    it('should have filter dropdown', () => {
      render(<LiveTranscriptViewer {...defaultProps} />);

      expect(screen.getByLabelText(/filter/i)).toBeInTheDocument();
    });

    it('should show all lines by default', () => {
      const mockLines = [
        {
          sequenceNumber: 1,
          line: '{"type": "text_delta", "content": "text"}',
          parsed: { type: 'text_delta', content: 'text' },
          timestamp: new Date(),
        },
        {
          sequenceNumber: 2,
          line: '{"type": "tool_call", "name": "test"}',
          parsed: { type: 'tool_call', name: 'test' },
          timestamp: new Date(),
        },
      ];

      mockUseTranscriptStream.mockReturnValue({
        ...mockUseTranscriptStream(),
        lines: mockLines,
      });

      render(<LiveTranscriptViewer {...defaultProps} />);

      expect(screen.getByText(/text_delta/)).toBeInTheDocument();
      expect(screen.getByText(/tool_call/)).toBeInTheDocument();
    });

    it('should filter by event type', () => {
      const mockLines = [
        {
          sequenceNumber: 1,
          line: '{"type": "text_delta"}',
          parsed: { type: 'text_delta' },
          timestamp: new Date(),
        },
        {
          sequenceNumber: 2,
          line: '{"type": "tool_call"}',
          parsed: { type: 'tool_call' },
          timestamp: new Date(),
        },
      ];

      mockUseTranscriptStream.mockReturnValue({
        ...mockUseTranscriptStream(),
        lines: mockLines,
      });

      const { rerender } = render(<LiveTranscriptViewer {...defaultProps} />);

      // Select filter
      const filter = screen.getByLabelText(/filter/i);
      fireEvent.change(filter, { target: { value: 'tool_call' } });

      rerender(<LiveTranscriptViewer {...defaultProps} />);

      // Should only show tool_call lines
      expect(screen.queryByText(/text_delta/)).not.toBeInTheDocument();
      expect(screen.getByText(/tool_call/)).toBeInTheDocument();
    });
  });

  describe('Download Functionality', () => {
    it('should have download button', () => {
      render(<LiveTranscriptViewer {...defaultProps} />);

      expect(screen.getByLabelText(/download/i)).toBeInTheDocument();
    });

    it('should download transcript as JSONL file', async () => {
      const mockLines = [
        { sequenceNumber: 1, line: '{"content": "line1"}', timestamp: new Date() },
        { sequenceNumber: 2, line: '{"content": "line2"}', timestamp: new Date() },
      ];

      mockUseTranscriptStream.mockReturnValue({
        ...mockUseTranscriptStream(),
        lines: mockLines,
      });

      const createObjectURLSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:url');
      const revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL');

      render(<LiveTranscriptViewer {...defaultProps} />);

      const downloadButton = screen.getByLabelText(/download/i);
      fireEvent.click(downloadButton);

      await waitFor(() => {
        expect(createObjectURLSpy).toHaveBeenCalled();
      });

      createObjectURLSpy.mockRestore();
      revokeObjectURLSpy.mockRestore();
    });
  });

  describe('Clear Buffer', () => {
    it('should have clear button', () => {
      render(<LiveTranscriptViewer {...defaultProps} />);

      expect(screen.getByLabelText(/clear/i)).toBeInTheDocument();
    });

    it('should call clear function when button clicked', () => {
      const mockClear = vi.fn();

      mockUseTranscriptStream.mockReturnValue({
        ...mockUseTranscriptStream(),
        clear: mockClear,
      });

      render(<LiveTranscriptViewer {...defaultProps} />);

      const clearButton = screen.getByLabelText(/clear/i);
      fireEvent.click(clearButton);

      expect(mockClear).toHaveBeenCalled();
    });
  });

  describe('Error States', () => {
    it('should display error message when error present', () => {
      mockUseTranscriptStream.mockReturnValue({
        ...mockUseTranscriptStream(),
        connectionState: 'error',
        error: { message: 'Connection lost', code: 'CONNECTION_ERROR' },
      });

      render(<LiveTranscriptViewer {...defaultProps} />);

      expect(screen.getByText(/connection lost/i)).toBeInTheDocument();
    });

    it('should show retry button on error', () => {
      mockUseTranscriptStream.mockReturnValue({
        ...mockUseTranscriptStream(),
        connectionState: 'error',
        error: { message: 'Error', code: 'ERROR' },
      });

      render(<LiveTranscriptViewer {...defaultProps} />);

      expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    });

    it('should call retry function when retry button clicked', () => {
      const mockRetry = vi.fn();

      mockUseTranscriptStream.mockReturnValue({
        ...mockUseTranscriptStream(),
        connectionState: 'error',
        error: { message: 'Error', code: 'ERROR' },
        retry: mockRetry,
      });

      render(<LiveTranscriptViewer {...defaultProps} />);

      const retryButton = screen.getByRole('button', { name: /retry/i });
      fireEvent.click(retryButton);

      expect(mockRetry).toHaveBeenCalled();
    });

    it('should show connecting indicator', () => {
      mockUseTranscriptStream.mockReturnValue({
        ...mockUseTranscriptStream(),
        connectionState: 'connecting',
      });

      render(<LiveTranscriptViewer {...defaultProps} />);

      expect(screen.getByTestId('connecting-indicator')).toBeInTheDocument();
    });
  });

  describe('Syntax Highlighting', () => {
    it('should use syntax highlighter for JSONL lines', () => {
      const mockLines = [
        {
          sequenceNumber: 1,
          line: '{"type": "test"}',
          timestamp: new Date(),
        },
      ];

      mockUseTranscriptStream.mockReturnValue({
        ...mockUseTranscriptStream(),
        lines: mockLines,
      });

      render(<LiveTranscriptViewer {...defaultProps} />);

      expect(screen.getByTestId('syntax-highlighter')).toBeInTheDocument();
    });

    it('should display line numbers', () => {
      const mockLines = [
        { sequenceNumber: 1, line: 'line1', timestamp: new Date() },
        { sequenceNumber: 2, line: 'line2', timestamp: new Date() },
      ];

      mockUseTranscriptStream.mockReturnValue({
        ...mockUseTranscriptStream(),
        lines: mockLines,
      });

      render(<LiveTranscriptViewer {...defaultProps} />);

      expect(screen.getByText('1')).toBeInTheDocument();
      expect(screen.getByText('2')).toBeInTheDocument();
    });
  });

  describe('Performance (Virtualization)', () => {
    it('should use virtualized list for large datasets', () => {
      const mockLines = Array.from({ length: 1000 }, (_, i) => ({
        sequenceNumber: i + 1,
        line: `line ${i + 1}`,
        timestamp: new Date(),
      }));

      mockUseTranscriptStream.mockReturnValue({
        ...mockUseTranscriptStream(),
        lines: mockLines,
      });

      render(<LiveTranscriptViewer {...defaultProps} />);

      expect(screen.getByTestId('virtualized-list')).toBeInTheDocument();
    });

    it('should render only visible lines', () => {
      const mockLines = Array.from({ length: 1000 }, (_, i) => ({
        sequenceNumber: i + 1,
        line: `line ${i + 1}`,
        timestamp: new Date(),
      }));

      mockUseTranscriptStream.mockReturnValue({
        ...mockUseTranscriptStream(),
        lines: mockLines,
      });

      const { container } = render(<LiveTranscriptViewer {...defaultProps} />);

      // Virtualization should prevent rendering all 1000 DOM nodes
      const renderedLines = container.querySelectorAll('[data-line-number]');
      expect(renderedLines.length).toBeLessThan(1000);
    });
  });

  describe('Cleanup', () => {
    it('should unsubscribe when onClose called', () => {
      const mockOnClose = vi.fn();
      const mockUnsubscribe = vi.fn();

      mockUseTranscriptStream.mockReturnValue({
        ...mockUseTranscriptStream(),
        unsubscribe: mockUnsubscribe,
      });

      render(<LiveTranscriptViewer {...defaultProps} onClose={mockOnClose} />);

      const closeButton = screen.getByLabelText(/close/i);
      fireEvent.click(closeButton);

      expect(mockUnsubscribe).toHaveBeenCalled();
      expect(mockOnClose).toHaveBeenCalled();
    });
  });
});
