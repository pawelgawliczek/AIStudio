/**
 * MetricsPanel Component
 * ST-168: Detailed metrics breakdown panel
 */

import React, { useState } from 'react';

export interface MetricsPanelProps {
  tokenMetrics?: TokenMetrics;
  turnMetrics?: TurnMetrics;
  codeImpact?: CodeImpact;
  toolUsage?: Record<string, number>;
  variant?: 'compact' | 'full';
  onExpand?: () => void;
}

export interface TokenMetrics {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  maxTokens?: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
  costBreakdown?: CostBreakdown;
}

export interface CostBreakdown {
  systemPrompt?: number;
  toolsSchema?: number;
  mcpTools?: number;
  conversation?: number;
  total: number;
}

export interface TurnMetrics {
  totalTurns: number;
  manualPrompts: number;
  autoContinues: number;
  questionsAsked?: number;
  approvalsRequired?: number;
}

export interface CodeImpact {
  filesModified: number;
  linesAdded: number;
  linesDeleted: number;
  complexityBefore?: number;
  complexityAfter?: number;
  coverageBefore?: number;
  coverageAfter?: number;
}

const formatNumber = (num: number): string => {
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}M`;
  }
  if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}K`;
  }
  return num.toString();
};

const formatCurrency = (amount: number): string => {
  return `$${amount.toFixed(4)}`;
};

const formatPercentage = (value: number, max: number): number => {
  return Math.min(100, Math.round((value / max) * 100));
};

export const MetricsPanel: React.FC<MetricsPanelProps> = ({
  tokenMetrics,
  turnMetrics,
  codeImpact,
  toolUsage,
  variant = 'full',
  onExpand,
}) => {
  const [isExpanded, setIsExpanded] = useState(variant === 'full');

  // Compact variant - single line summary
  if (variant === 'compact' && !isExpanded) {
    const totalTokens = tokenMetrics?.totalTokens || 0;
    const totalCost = tokenMetrics?.costBreakdown?.total || 0;
    const turns = turnMetrics?.totalTurns || 0;
    const manualTurns = turnMetrics?.manualPrompts || 0;
    const questions = turnMetrics?.questionsAsked || 0;
    const approvals = turnMetrics?.approvalsRequired || 0;

    return (
      <div
        className="flex items-center gap-4 text-xs text-gray-400 p-2 bg-gray-800/50 rounded"
        data-testid="metrics-compact"
      >
        <span>
          📊 {formatNumber(totalTokens)} tokens
        </span>
        {totalCost > 0 && <span>{formatCurrency(totalCost)}</span>}
        <span>
          {turns} turns ({manualTurns} manual)
        </span>
        {questions > 0 && <span>❓ {questions} questions</span>}
        {approvals > 0 && <span>👤 {approvals} approval</span>}
        <button
          onClick={() => {
            setIsExpanded(true);
            onExpand?.();
          }}
          className="text-blue-400 hover:text-blue-300"
          data-testid="expand-metrics"
        >
          Expand ▼
        </button>
      </div>
    );
  }

  // Full variant
  return (
    <div
      className="border border-gray-700 rounded-lg bg-gray-900 p-4"
      data-testid="metrics-panel"
      role="region"
      aria-label="Execution metrics"
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-200">State Metrics</h3>
        {variant === 'compact' && isExpanded && (
          <button
            onClick={() => setIsExpanded(false)}
            className="text-xs text-gray-400 hover:text-gray-200"
          >
            Collapse ▲
          </button>
        )}
      </div>

      {/* Token Usage Breakdown */}
      {tokenMetrics && (
        <div className="mb-4" data-testid="token-breakdown">
          <h4 className="text-sm font-medium text-gray-300 mb-2">
            Token Usage Breakdown
          </h4>
          <div className="bg-gray-800 rounded p-3 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-400">Input Tokens</span>
              <span className="text-gray-200">{formatNumber(tokenMetrics.inputTokens)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Output Tokens</span>
              <span className="text-gray-200">{formatNumber(tokenMetrics.outputTokens)}</span>
            </div>
            {tokenMetrics.cacheReadTokens !== undefined && (
              <div className="flex justify-between">
                <span className="text-gray-400">Cache Read</span>
                <span className="text-green-400">{formatNumber(tokenMetrics.cacheReadTokens)}</span>
              </div>
            )}
            {tokenMetrics.cacheWriteTokens !== undefined && (
              <div className="flex justify-between">
                <span className="text-gray-400">Cache Write</span>
                <span className="text-blue-400">{formatNumber(tokenMetrics.cacheWriteTokens)}</span>
              </div>
            )}
            <div className="flex justify-between border-t border-gray-700 pt-2">
              <span className="text-gray-300 font-medium">Total</span>
              <span className="text-gray-100 font-medium">
                {formatNumber(tokenMetrics.totalTokens)}
              </span>
            </div>

            {/* Progress bar */}
            {tokenMetrics.maxTokens && (
              <div className="mt-2">
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>Usage</span>
                  <span>
                    {formatPercentage(tokenMetrics.totalTokens, tokenMetrics.maxTokens)}% of max
                  </span>
                </div>
                <div className="h-2 bg-gray-700 rounded overflow-hidden">
                  <div
                    className="h-full bg-blue-500"
                    style={{
                      width: `${formatPercentage(tokenMetrics.totalTokens, tokenMetrics.maxTokens)}%`,
                    }}
                  />
                </div>
              </div>
            )}

            {/* Cost Breakdown */}
            {tokenMetrics.costBreakdown && (
              <div className="mt-3 pt-3 border-t border-gray-700">
                <div className="flex justify-between">
                  <span className="text-gray-400">Estimated Cost</span>
                  <span className="text-green-400 font-medium">
                    {formatCurrency(tokenMetrics.costBreakdown.total)}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Turn Tracking */}
      {turnMetrics && (
        <div className="mb-4" data-testid="turn-metrics">
          <h4 className="text-sm font-medium text-gray-300 mb-2">
            Turn Tracking
          </h4>
          <div className="bg-gray-800 rounded p-3 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-400">Total Turns</span>
              <span className="text-gray-200">{turnMetrics.totalTurns}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Manual Prompts</span>
              <span className="text-gray-200">{turnMetrics.manualPrompts}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Auto-Continues</span>
              <span className="text-gray-200">{turnMetrics.autoContinues}</span>
            </div>
            {turnMetrics.questionsAsked !== undefined && turnMetrics.questionsAsked > 0 && (
              <div className="flex justify-between">
                <span className="text-gray-400">Questions Asked</span>
                <span className="text-orange-400">{turnMetrics.questionsAsked}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Code Impact */}
      {codeImpact && (
        <div className="mb-4" data-testid="code-impact">
          <h4 className="text-sm font-medium text-gray-300 mb-2">Code Impact</h4>
          <div className="bg-gray-800 rounded p-3 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-400">Files Modified</span>
              <span className="text-gray-200">{codeImpact.filesModified}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Lines Added</span>
              <span className="text-green-400">+{codeImpact.linesAdded}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Lines Deleted</span>
              <span className="text-red-400">-{codeImpact.linesDeleted}</span>
            </div>
            {codeImpact.complexityBefore !== undefined &&
              codeImpact.complexityAfter !== undefined && (
                <div className="flex justify-between">
                  <span className="text-gray-400">Complexity</span>
                  <span className="text-gray-200">
                    {codeImpact.complexityBefore} → {codeImpact.complexityAfter}
                    <span
                      className={
                        codeImpact.complexityAfter > codeImpact.complexityBefore
                          ? 'text-red-400 ml-1'
                          : 'text-green-400 ml-1'
                      }
                    >
                      ({codeImpact.complexityAfter - codeImpact.complexityBefore > 0 ? '+' : ''}
                      {codeImpact.complexityAfter - codeImpact.complexityBefore})
                    </span>
                  </span>
                </div>
              )}
            {codeImpact.coverageBefore !== undefined &&
              codeImpact.coverageAfter !== undefined && (
                <div className="flex justify-between">
                  <span className="text-gray-400">Coverage</span>
                  <span className="text-gray-200">
                    {codeImpact.coverageBefore}% → {codeImpact.coverageAfter}%
                    <span
                      className={
                        codeImpact.coverageAfter >= codeImpact.coverageBefore
                          ? 'text-green-400 ml-1'
                          : 'text-red-400 ml-1'
                      }
                    >
                      ({codeImpact.coverageAfter - codeImpact.coverageBefore > 0 ? '+' : ''}
                      {codeImpact.coverageAfter - codeImpact.coverageBefore}%)
                    </span>
                  </span>
                </div>
              )}
          </div>
        </div>
      )}

      {/* Tool Usage */}
      {toolUsage && Object.keys(toolUsage).length > 0 && (
        <div data-testid="tool-usage">
          <h4 className="text-sm font-medium text-gray-300 mb-2">Tool Usage</h4>
          <div className="bg-gray-800 rounded p-3">
            <div className="flex flex-wrap gap-2">
              {Object.entries(toolUsage).map(([tool, count]) => (
                <span
                  key={tool}
                  className="px-2 py-1 text-xs bg-gray-700 rounded text-gray-300"
                >
                  {tool}: <span className="text-gray-100">{count}</span>
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
