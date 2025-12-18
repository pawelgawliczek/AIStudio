/**
 * Unit tests for MetricsPanel component
 * ST-168: Token metrics and cost visualization
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { MetricsPanel, TokenMetrics, TurnMetrics, CodeImpact } from '../MetricsPanel';

describe('MetricsPanel', () => {
  const mockTokenMetrics: TokenMetrics = {
    inputTokens: 7700,
    outputTokens: 2100,
    totalTokens: 9800,
    maxTokens: 50000,
    costBreakdown: {
      systemPrompt: 0.0036,
      toolsSchema: 0.0074,
      mcpTools: 0.0026,
      conversation: 0.0210,
      total: 0.0346,
    },
  };

  const mockTurnMetrics: TurnMetrics = {
    totalTurns: 12,
    manualPrompts: 3,
    autoContinues: 9,
    questionsAsked: 2,
  };

  const mockCodeImpact: CodeImpact = {
    filesModified: 5,
    linesAdded: 342,
    linesDeleted: 28,
    complexityBefore: 12,
    complexityAfter: 15,
    coverageBefore: 82,
    coverageAfter: 85,
  };

  const mockToolUsage = {
    Read: 15,
    Edit: 8,
    Write: 2,
    Bash: 5,
    Grep: 12,
    Glob: 7,
  };

  describe('TC-METRICS-001: Compact variant rendering', () => {
    it('should render compact metrics summary', () => {
      render(
        <MetricsPanel
          tokenMetrics={mockTokenMetrics}
          turnMetrics={mockTurnMetrics}
          variant="compact"
        />
      );

      expect(screen.getByTestId('metrics-compact')).toBeInTheDocument();
      expect(screen.getByText(/9.8K tokens/)).toBeInTheDocument();
    });

    it('should show turn count in compact view', () => {
      render(
        <MetricsPanel
          tokenMetrics={mockTokenMetrics}
          turnMetrics={mockTurnMetrics}
          variant="compact"
        />
      );

      expect(screen.getByText(/12 turns/)).toBeInTheDocument();
    });

    it('should show expand button in compact view', () => {
      render(
        <MetricsPanel
          tokenMetrics={mockTokenMetrics}
          turnMetrics={mockTurnMetrics}
          variant="compact"
        />
      );

      expect(screen.getByTestId('expand-metrics')).toBeInTheDocument();
    });
  });

  describe('TC-METRICS-002: Full variant rendering', () => {
    it('should render full metrics panel with all sections', () => {
      render(
        <MetricsPanel
          tokenMetrics={mockTokenMetrics}
          turnMetrics={mockTurnMetrics}
          codeImpact={mockCodeImpact}
          toolUsage={mockToolUsage}
          variant="full"
        />
      );

      expect(screen.getByTestId('metrics-panel')).toBeInTheDocument();
      expect(screen.getByTestId('token-breakdown')).toBeInTheDocument();
      expect(screen.getByTestId('turn-metrics')).toBeInTheDocument();
      expect(screen.getByTestId('code-impact')).toBeInTheDocument();
      expect(screen.getByTestId('tool-usage')).toBeInTheDocument();
    });

    it('should display token breakdown categories', () => {
      render(
        <MetricsPanel
          tokenMetrics={mockTokenMetrics}
          variant="full"
        />
      );

      expect(screen.getByText('Input Tokens')).toBeInTheDocument();
      expect(screen.getByText('Output Tokens')).toBeInTheDocument();
      expect(screen.getByText('Total')).toBeInTheDocument();
    });

    it('should display turn tracking metrics', () => {
      render(
        <MetricsPanel
          turnMetrics={mockTurnMetrics}
          variant="full"
        />
      );

      expect(screen.getByText('Total Turns')).toBeInTheDocument();
      expect(screen.getByText('Manual Prompts')).toBeInTheDocument();
      expect(screen.getByText('Auto-Continues')).toBeInTheDocument();
    });

    it('should display code impact metrics', () => {
      render(
        <MetricsPanel
          codeImpact={mockCodeImpact}
          variant="full"
        />
      );

      expect(screen.getByText('Files Modified')).toBeInTheDocument();
      expect(screen.getByText('Lines Added')).toBeInTheDocument();
      expect(screen.getByText('Lines Deleted')).toBeInTheDocument();
    });

    it('should display tool usage counts', () => {
      render(
        <MetricsPanel
          toolUsage={mockToolUsage}
          variant="full"
        />
      );

      expect(screen.getByText(/Read:/)).toBeInTheDocument();
      expect(screen.getByText('15')).toBeInTheDocument();
      expect(screen.getByText(/Edit:/)).toBeInTheDocument();
      expect(screen.getByText('8')).toBeInTheDocument();
    });
  });

  describe('TC-METRICS-003: Progress bar rendering', () => {
    it('should display token usage percentage', () => {
      render(
        <MetricsPanel
          tokenMetrics={mockTokenMetrics}
          variant="full"
        />
      );

      expect(screen.getByText(/20% of max/)).toBeInTheDocument();
    });
  });

  describe('TC-METRICS-004: Expandable behavior', () => {
    it('should expand from compact to full when clicked', () => {
      render(
        <MetricsPanel
          tokenMetrics={mockTokenMetrics}
          turnMetrics={mockTurnMetrics}
          codeImpact={mockCodeImpact}
          variant="compact"
        />
      );

      expect(screen.queryByTestId('token-breakdown')).not.toBeInTheDocument();

      fireEvent.click(screen.getByTestId('expand-metrics'));

      expect(screen.getByTestId('token-breakdown')).toBeInTheDocument();
    });
  });

  describe('TC-METRICS-005: Cost formatting', () => {
    it('should format cost with 4 decimal places', () => {
      render(
        <MetricsPanel
          tokenMetrics={mockTokenMetrics}
          variant="full"
        />
      );

      expect(screen.getByText(/\$0.0346/)).toBeInTheDocument();
    });
  });

  describe('TC-METRICS-006: Complexity delta', () => {
    it('should show complexity change', () => {
      render(
        <MetricsPanel
          codeImpact={mockCodeImpact}
          variant="full"
        />
      );

      // Shows "12 → 15 (+3)"
      expect(screen.getByText(/12 → 15/)).toBeInTheDocument();
    });
  });

  describe('TC-METRICS-007: Partial data handling', () => {
    it('should handle missing code impact gracefully', () => {
      render(
        <MetricsPanel
          tokenMetrics={mockTokenMetrics}
          variant="full"
        />
      );

      expect(screen.getByTestId('metrics-panel')).toBeInTheDocument();
      expect(screen.queryByTestId('code-impact')).not.toBeInTheDocument();
    });

    it('should handle missing tool usage gracefully', () => {
      render(
        <MetricsPanel
          tokenMetrics={mockTokenMetrics}
          variant="full"
        />
      );

      expect(screen.queryByTestId('tool-usage')).not.toBeInTheDocument();
    });

    it('should handle missing turn metrics gracefully', () => {
      render(
        <MetricsPanel
          tokenMetrics={mockTokenMetrics}
          variant="full"
        />
      );

      expect(screen.queryByTestId('turn-metrics')).not.toBeInTheDocument();
    });
  });
});
