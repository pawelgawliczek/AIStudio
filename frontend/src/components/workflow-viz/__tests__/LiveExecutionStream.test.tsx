/**
 * Unit tests for LiveExecutionStream component
 * ST-168: Real-time agent execution visualization
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { LiveExecutionStream, StreamEntry } from '../LiveExecutionStream';

describe('LiveExecutionStream', () => {
  const mockEntries: StreamEntry[] = [
    {
      id: 'e1',
      type: 'tool_call',
      timestamp: new Date(Date.now() - 5000).toISOString(),
      content: {
        toolName: 'Read',
        toolInput: { path: 'src/index.ts' },
      },
    },
    {
      id: 'e2',
      type: 'tool_result',
      timestamp: new Date(Date.now() - 4000).toISOString(),
      content: {
        toolName: 'Read',
        result: 'File content here...',
      },
    },
    {
      id: 'e3',
      type: 'response',
      timestamp: new Date(Date.now() - 3000).toISOString(),
      content: {
        text: 'I analyzed the file and found the main entry point.',
      },
    },
    {
      id: 'e4',
      type: 'error',
      timestamp: new Date(Date.now() - 2000).toISOString(),
      content: {
        error: 'Failed to read file: permission denied',
      },
    },
  ];

  describe('TC-STREAM-001: Basic rendering', () => {
    it('should render stream with connected status', () => {
      render(
        <LiveExecutionStream
          runId="run-123"
          entries={mockEntries}
          agentName="Software Architect"
          stateName="Architecture"
          isConnected={true}
        />
      );

      expect(screen.getByTestId('live-execution-stream')).toBeInTheDocument();
      expect(screen.getByTestId('connection-status')).toHaveTextContent('CONNECTED');
      expect(screen.getByText(/Agent: Software Architect/)).toBeInTheDocument();
      expect(screen.getByText(/State: Architecture/)).toBeInTheDocument();
    });

    it('should show disconnected status when not connected', () => {
      render(
        <LiveExecutionStream
          runId="run-123"
          entries={[]}
          agentName="Software Architect"
          stateName="Architecture"
          isConnected={false}
        />
      );

      expect(screen.getByTestId('connection-status')).toHaveTextContent('DISCONNECTED');
    });
  });

  describe('TC-STREAM-002: Entry rendering', () => {
    it('should render tool call entries', () => {
      render(
        <LiveExecutionStream
          runId="run-123"
          entries={mockEntries}
          agentName="Test Agent"
          stateName="Test"
          isConnected={true}
        />
      );

      expect(screen.getByText(/Tool:/)).toBeInTheDocument();
      expect(screen.getByText('Read')).toBeInTheDocument();
    });

    it('should render tool result entries', () => {
      render(
        <LiveExecutionStream
          runId="run-123"
          entries={mockEntries}
          agentName="Test Agent"
          stateName="Test"
          isConnected={true}
        />
      );

      expect(screen.getByText(/File content here/)).toBeInTheDocument();
    });

    it('should render response entries', () => {
      render(
        <LiveExecutionStream
          runId="run-123"
          entries={mockEntries}
          agentName="Test Agent"
          stateName="Test"
          isConnected={true}
        />
      );

      expect(screen.getByText(/I analyzed the file/)).toBeInTheDocument();
    });

    it('should render error entries', () => {
      render(
        <LiveExecutionStream
          runId="run-123"
          entries={mockEntries}
          agentName="Test Agent"
          stateName="Test"
          isConnected={true}
        />
      );

      expect(screen.getByText(/permission denied/)).toBeInTheDocument();
    });
  });

  describe('TC-STREAM-003: Pause toggle', () => {
    it('should toggle pause state when button clicked', () => {
      const onPauseToggle = vi.fn();

      render(
        <LiveExecutionStream
          runId="run-123"
          entries={mockEntries}
          agentName="Test Agent"
          stateName="Test"
          isConnected={true}
          onPauseToggle={onPauseToggle}
        />
      );

      const pauseButton = screen.getByTestId('pause-button');
      expect(pauseButton).toHaveTextContent('Pause');

      fireEvent.click(pauseButton);

      expect(pauseButton).toHaveTextContent('Resume');
      expect(onPauseToggle).toHaveBeenCalled();
    });
  });

  describe('TC-STREAM-004: Actions', () => {
    it('should call onViewTranscript when button clicked', () => {
      const onViewTranscript = vi.fn();

      render(
        <LiveExecutionStream
          runId="run-123"
          entries={mockEntries}
          agentName="Test Agent"
          stateName="Test"
          isConnected={true}
          onViewTranscript={onViewTranscript}
        />
      );

      fireEvent.click(screen.getByTestId('view-transcript'));

      expect(onViewTranscript).toHaveBeenCalled();
    });

    it('should call onDownload when button clicked', () => {
      const onDownload = vi.fn();

      render(
        <LiveExecutionStream
          runId="run-123"
          entries={mockEntries}
          agentName="Test Agent"
          stateName="Test"
          isConnected={true}
          onDownload={onDownload}
        />
      );

      fireEvent.click(screen.getByTestId('download-button'));

      expect(onDownload).toHaveBeenCalled();
    });
  });

  describe('TC-STREAM-005: Empty state', () => {
    it('should show waiting message when no entries', () => {
      render(
        <LiveExecutionStream
          runId="run-123"
          entries={[]}
          agentName="Test Agent"
          stateName="Test"
          isConnected={true}
        />
      );

      expect(screen.getByText(/Waiting for agent output/)).toBeInTheDocument();
    });
  });

  describe('TC-STREAM-006: Metrics display', () => {
    it('should display live metrics', () => {
      render(
        <LiveExecutionStream
          runId="run-123"
          entries={mockEntries}
          agentName="Test Agent"
          stateName="Test"
          isConnected={true}
        />
      );

      // Check for tokens label
      expect(screen.getByText(/Tokens:/)).toBeInTheDocument();
      // Check for turns label
      expect(screen.getByText(/Turns:/)).toBeInTheDocument();
      // Check for duration label
      expect(screen.getByText(/Duration:/)).toBeInTheDocument();
    });
  });
});
