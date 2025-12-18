/**
 * Unit Tests for TranscriptTurn Component (ST-173 Phase 7)
 *
 * Tests individual conversation turn rendering:
 * - User turn rendering (blue background, user icon)
 * - Assistant turn rendering (gray background, robot icon)
 * - System message rendering (yellow background, gear icon)
 * - Tool call display
 * - Token metrics per turn
 * - Collapsible tool call expansion
 *
 * Coverage: 8 test cases
 * - User Turn Rendering: 2 tests
 * - Assistant Turn Rendering: 2 tests
 * - System Message Rendering: 1 test
 * - Tool Call Display: 2 tests
 * - Token Metrics: 1 test
 *
 * TDD STATUS: 🔴 ALL TESTS FAILING - Component not yet implemented
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import type { ConversationTurn } from '../../../utils/transcript-parser';
import { TranscriptTurn } from '../TranscriptTurn';

describe('TranscriptTurn', () => {
  const mockUserTurn: ConversationTurn = {
    type: 'user',
    timestamp: '2025-12-05T10:30:00.000Z',
    content: 'Please implement the transcript viewer component',
    usage: {
      inputTokens: 0,
      outputTokens: 0,
    },
  };

  const mockAssistantTurn: ConversationTurn = {
    type: 'assistant',
    timestamp: '2025-12-05T10:30:15.000Z',
    content: 'I will help implement that. Let me start by reading the existing components.',
    toolCalls: [
      {
        name: 'Read',
        input: { file_path: 'StateBlock.tsx' },
      },
      {
        name: 'Grep',
        input: { pattern: 'TranscriptViewer', path: 'frontend/src' },
      },
    ],
    usage: {
      inputTokens: 8200,
      outputTokens: 4250,
    },
  };

  const mockSystemTurn: ConversationTurn = {
    type: 'system',
    timestamp: '2025-12-05T10:30:00.000Z',
    content: 'Session started with model claude-sonnet-4',
    usage: {
      inputTokens: 0,
      outputTokens: 0,
    },
  };

  // ============================================================================
  // USER TURN RENDERING TESTS
  // ============================================================================

  describe('TC-TRANSCRIPT-TURN-001: User Turn Rendering', () => {
    it('should render user turn with correct styling', () => {
      render(<TranscriptTurn turn={mockUserTurn} />);

      const turnContainer = screen.getByTestId('transcript-turn');
      expect(turnContainer).toHaveClass('bg-blue-500/10'); // Light blue background
      expect(screen.getByText(/Please implement the transcript viewer/i)).toBeInTheDocument();
    });

    it('should display user icon for user turns', () => {
      render(<TranscriptTurn turn={mockUserTurn} />);

      const userIcon = screen.getByTestId('turn-icon-user');
      expect(userIcon).toBeInTheDocument();
    });
  });

  // ============================================================================
  // ASSISTANT TURN RENDERING TESTS
  // ============================================================================

  describe('TC-TRANSCRIPT-TURN-002: Assistant Turn Rendering', () => {
    it('should render assistant turn with correct styling', () => {
      render(<TranscriptTurn turn={mockAssistantTurn} />);

      const turnContainer = screen.getByTestId('transcript-turn');
      expect(turnContainer).toHaveClass('bg-gray-500/10'); // Light gray background
      expect(screen.getByText(/I will help implement that/i)).toBeInTheDocument();
    });

    it('should display robot icon for assistant turns', () => {
      render(<TranscriptTurn turn={mockAssistantTurn} />);

      const robotIcon = screen.getByTestId('turn-icon-assistant');
      expect(robotIcon).toBeInTheDocument();
    });
  });

  // ============================================================================
  // SYSTEM MESSAGE RENDERING TESTS
  // ============================================================================

  describe('TC-TRANSCRIPT-TURN-003: System Message Rendering', () => {
    it('should render system message with correct styling', () => {
      render(<TranscriptTurn turn={mockSystemTurn} />);

      const turnContainer = screen.getByTestId('transcript-turn');
      expect(turnContainer).toHaveClass('bg-yellow-500/10'); // Light yellow background
      expect(screen.getByText(/Session started with model/i)).toBeInTheDocument();
    });

    it('should display gear icon for system messages', () => {
      render(<TranscriptTurn turn={mockSystemTurn} />);

      const gearIcon = screen.getByTestId('turn-icon-system');
      expect(gearIcon).toBeInTheDocument();
    });
  });

  // ============================================================================
  // TOOL CALL DISPLAY TESTS
  // ============================================================================

  describe('TC-TRANSCRIPT-TURN-004: Tool Call Display', () => {
    it('should display tool calls when present', () => {
      render(<TranscriptTurn turn={mockAssistantTurn} />);

      expect(screen.getByText(/Tool Calls \(2\)/i)).toBeInTheDocument();
      expect(screen.getByText(/Read/i)).toBeInTheDocument();
      expect(screen.getByText(/Grep/i)).toBeInTheDocument();
    });

    it('should make tool calls collapsible', () => {
      render(<TranscriptTurn turn={mockAssistantTurn} />);

      const toolCallsHeader = screen.getByText(/Tool Calls \(2\)/i);
      expect(toolCallsHeader).toBeInTheDocument();

      // Click to expand
      fireEvent.click(toolCallsHeader);

      // Tool call cards should be visible
      const toolCards = screen.getAllByTestId('tool-call-card');
      expect(toolCards).toHaveLength(2);
    });

    it('should not display tool calls section when none present', () => {
      render(<TranscriptTurn turn={mockUserTurn} />);

      expect(screen.queryByText(/Tool Calls/i)).not.toBeInTheDocument();
    });
  });

  // ============================================================================
  // TOKEN METRICS TESTS
  // ============================================================================

  describe('TC-TRANSCRIPT-TURN-005: Token Metrics Display', () => {
    it('should display per-turn token metrics', () => {
      render(<TranscriptTurn turn={mockAssistantTurn} />);

      expect(screen.getByText(/12,450 tokens/i)).toBeInTheDocument();
      expect(screen.getByText(/8.2K in/i)).toBeInTheDocument();
      expect(screen.getByText(/4.2K out/i)).toBeInTheDocument();
    });

    it('should format token counts with proper separators', () => {
      render(<TranscriptTurn turn={mockAssistantTurn} />);

      // Verify comma-separated thousands
      expect(screen.getByText(/12,450/i)).toBeInTheDocument();
    });
  });

  // ============================================================================
  // TIMESTAMP DISPLAY TESTS
  // ============================================================================

  describe('TC-TRANSCRIPT-TURN-006: Timestamp Display', () => {
    it('should display formatted timestamp', () => {
      render(<TranscriptTurn turn={mockUserTurn} />);

      // Timestamp should be formatted (e.g., "10:30:00 AM")
      expect(screen.getByTestId('turn-timestamp')).toBeInTheDocument();
    });
  });

  // ============================================================================
  // CONTENT RENDERING TESTS
  // ============================================================================

  describe('TC-TRANSCRIPT-TURN-007: Content Rendering', () => {
    it('should preserve whitespace in content', () => {
      const turnWithWhitespace: ConversationTurn = {
        ...mockUserTurn,
        content: 'Line 1\n\nLine 3 with  spaces',
      };

      render(<TranscriptTurn turn={turnWithWhitespace} />);

      const contentElement = screen.getByTestId('turn-content');
      expect(contentElement).toHaveStyle({ whiteSpace: 'pre-wrap' });
    });

    it('should handle empty content gracefully', () => {
      const emptyTurn: ConversationTurn = {
        ...mockUserTurn,
        content: '',
      };

      render(<TranscriptTurn turn={emptyTurn} />);

      const turnContainer = screen.getByTestId('transcript-turn');
      expect(turnContainer).toBeInTheDocument();
    });
  });
});
