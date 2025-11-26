import React from 'react';
import { CoordinatorAgent } from '../types';
import { VersionBadge } from './VersionBadge';

export interface CoordinatorCardProps {
  coordinator: CoordinatorAgent;
  onClick: () => void;
  onToggleActive: () => void;
  onDelete: () => void;
}

export function CoordinatorCard({
  coordinator,
  onClick,
  onToggleActive,
  onDelete,
}: CoordinatorCardProps) {
  return (
    <div
      key={coordinator.id}
      data-testid={`coordinator-card-${coordinator.name}`}
      className="bg-card rounded-lg shadow hover:shadow-md transition-shadow border border-border p-4"
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold text-fg">{coordinator.name}</h3>
            {coordinator.version && (
              <VersionBadge
                version={coordinator.version}
                status={coordinator.active ? 'active' : 'inactive'}
                size="sm"
                data-testid="coordinator-version"
              />
            )}
          </div>
        </div>
        <span
          className={`px-2 py-1 text-xs font-medium rounded-full ${
            coordinator.active
              ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-300'
          }`}
        >
          {coordinator.active ? 'Active' : 'Inactive'}
        </span>
      </div>

      {/* Description */}
      <p className="text-sm text-muted mb-3 line-clamp-2">{coordinator.description}</p>

      {/* Info */}
      <div className="space-y-2 text-sm text-muted">
        <div>
          <span className="font-medium text-fg">Domain:</span> {coordinator.domain}
        </div>
        <div>
          <span className="font-medium text-fg">Strategy:</span> {coordinator.decisionStrategy}
        </div>
        <div>
          <span className="font-medium text-fg">Components:</span>{' '}
          {coordinator.componentIds.length}
        </div>
      </div>

      {/* Usage Stats */}
      {coordinator.usageStats && (
        <div className="mt-3 pt-3 border-t border-border grid grid-cols-2 gap-2 text-xs">
          <div>
            <div className="text-muted">Total Runs</div>
            <div className="font-semibold text-fg">{coordinator.usageStats.totalRuns}</div>
          </div>
          <div>
            <div className="text-muted">Success Rate</div>
            <div className="font-semibold text-fg">
              {coordinator.usageStats.successRate.toFixed(1)}%
            </div>
          </div>
        </div>
      )}

      {/* Flow Diagram */}
      {coordinator.flowDiagram && (
        <div className="mt-3 pt-3 border-t border-border">
          <div className="text-xs font-semibold text-fg mb-2">Workflow Flow</div>
          <pre className="text-xs font-mono leading-relaxed text-fg bg-gray-50 dark:bg-gray-900 overflow-x-auto rounded p-3 whitespace-pre border border-border">
            {coordinator.flowDiagram}
          </pre>
        </div>
      )}

      {/* Actions */}
      <div className="mt-3 flex items-center justify-between gap-2 text-sm">
        <button
          onClick={onClick}
          className="px-3 py-1.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-900/50 rounded transition-colors font-medium"
        >
          View Details
        </button>
        <div className="flex gap-2">
          <button
            onClick={onToggleActive}
            className="text-muted hover:text-fg transition-colors"
          >
            {coordinator.active ? 'Deactivate' : 'Activate'}
          </button>
          <button
            onClick={onDelete}
            className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 transition-colors"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
