/**
 * ST-203: Structured Summary Display Component
 *
 * Single source of truth for displaying componentSummary across all views.
 * Supports both 'compact' and 'full' variants for different UI contexts.
 */

import React from 'react';
import { ComponentSummaryStructured } from './types';

interface StructuredSummaryDisplayProps {
  summary: ComponentSummaryStructured | null;
  variant: 'compact' | 'full';
  className?: string;
}

/**
 * Get status badge color based on summary status
 */
function getStatusBadgeColor(status: string): string {
  switch (status) {
    case 'success':
      return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
    case 'partial':
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
    case 'blocked':
      return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
    case 'failed':
      return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
  }
}

/**
 * Get status icon based on summary status
 */
function getStatusIcon(status: string): string {
  switch (status) {
    case 'success':
      return '✓';
    case 'partial':
      return '⚠';
    case 'blocked':
      return '⛔';
    case 'failed':
      return '✗';
    default:
      return '?';
  }
}

export const StructuredSummaryDisplay: React.FC<StructuredSummaryDisplayProps> = ({
  summary,
  variant,
  className = '',
}) => {
  if (!summary) {
    return null;
  }

  const statusBadgeColor = getStatusBadgeColor(summary.status);
  const statusIcon = getStatusIcon(summary.status);

  if (variant === 'compact') {
    return (
      <div data-testid="summary-display-compact" className={`flex items-center gap-2 ${className}`}>
        {/* Status badge */}
        <span
          data-testid={`status-badge-${summary.status}`}
          aria-label={`Status: ${summary.status.charAt(0).toUpperCase() + summary.status.slice(1)}`}
          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${statusBadgeColor} flex-shrink-0`}
          title={`Status: ${summary.status}`}
        >
          <span className="mr-1">{statusIcon}</span>
          {summary.status}
        </span>

        {/* Summary text */}
        <span data-testid="summary-text" className="text-sm text-gray-700 dark:text-gray-300 flex-1 truncate">
          {summary.summary}
        </span>
      </div>
    );
  }

  // Full variant
  return (
    <div data-testid="summary-display-full" className={`space-y-3 ${className}`}>
      {/* Header with status badge */}
      <div className="flex items-center gap-2">
        <span
          data-testid={`status-badge-${summary.status}`}
          aria-label={`Status: ${summary.status.charAt(0).toUpperCase() + summary.status.slice(1)}`}
          className={`inline-flex items-center px-2.5 py-1 rounded text-xs font-semibold ${statusBadgeColor}`}
          title={`Status: ${summary.status}`}
        >
          <span className="mr-1.5">{statusIcon}</span>
          {summary.status.toUpperCase()}
        </span>
      </div>

      {/* Summary text */}
      <p data-testid="summary-text" className="text-sm text-gray-800 dark:text-gray-200 leading-relaxed">
        {summary.summary}
      </p>

      {/* Key Outputs */}
      {summary.keyOutputs && summary.keyOutputs.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5 uppercase tracking-wide">
            Key Outputs
          </h4>
          <ul data-testid="key-outputs-list" className="list-disc list-inside space-y-1 text-sm text-gray-700 dark:text-gray-300">
            {summary.keyOutputs.map((output, index) => (
              <li key={index}>{output}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Artifacts Produced */}
      {summary.artifactsProduced && summary.artifactsProduced.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5 uppercase tracking-wide">
            Artifacts Produced
          </h4>
          <ul data-testid="artifacts-produced-list" className="flex flex-wrap gap-2 list-none">
            {summary.artifactsProduced.map((artifact, index) => (
              <li
                key={index}
                className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
              >
                {artifact}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Next Agent Hints */}
      {summary.nextAgentHints && summary.nextAgentHints.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5 uppercase tracking-wide">
            Next Agent Hints
          </h4>
          <ul data-testid="next-agent-hints-list" className="list-disc list-inside space-y-1 text-sm text-gray-700 dark:text-gray-300 italic">
            {summary.nextAgentHints.map((hint, index) => (
              <li key={index}>{hint}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Errors */}
      {summary.errors && summary.errors.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-red-600 dark:text-red-400 mb-1.5 uppercase tracking-wide">
            Errors
          </h4>
          <ul data-testid="errors-list" className="list-disc list-inside space-y-1 text-sm text-red-600 dark:text-red-300">
            {summary.errors.map((error, index) => (
              <li key={index}>{error}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
