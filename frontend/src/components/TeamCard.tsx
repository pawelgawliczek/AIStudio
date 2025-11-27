import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Workflow } from '../types';
import { VersionBadge } from './VersionBadge';

export interface TeamCardProps {
  workflow: Workflow;
  projectId: string;
  onClick: () => void;
  onToggleActive: () => void;
  onDelete: () => void;
}

export function TeamCard({
  workflow,
  projectId,
  onClick,
  onToggleActive,
  onDelete,
}: TeamCardProps) {
  const navigate = useNavigate();

  // Stop propagation for nested navigation links
  const handlePMClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (workflow.coordinatorId) {
      navigate(`/project-managers/${workflow.coordinatorId}`);
    }
  };

  const handleAgentClick = (e: React.MouseEvent, componentId: string) => {
    e.stopPropagation();
    navigate(`/agents/${componentId}`);
  };

  const handleViewDetails = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigate(`/teams/${workflow.id}`);
  };

  return (
    <div
      key={workflow.id}
      data-testid={`workflow-card-${workflow.name}`}
      className="bg-card rounded-lg shadow hover:shadow-md transition-shadow border border-border p-4"
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold text-fg">{workflow.name}</h3>
          <VersionBadge version={workflow.version} status="current" size="sm" />
        </div>
      </div>

      {/* Description */}
      {workflow.description && (
        <p className="text-sm text-muted mb-3 line-clamp-2">{workflow.description}</p>
      )}

      {/* PM Info */}
      {workflow.coordinator && (
        <div className="mb-2">
          <span className="text-xs font-medium text-fg">PM: </span>
          <button
            onClick={handlePMClick}
            className="text-sm text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1"
          >
            {workflow.coordinator.name}
            {workflow.coordinator.version && (
              <span className="text-xs px-1.5 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded">
                v{workflow.coordinator.version}
              </span>
            )}
            <span aria-hidden="true">→</span>
          </button>
        </div>
      )}

      {/* Agents Info */}
      {workflow.componentAssignments && workflow.componentAssignments.length > 0 && (
        <div className="mb-3">
          <div className="text-xs font-medium text-fg mb-1">Agents:</div>
          <div className="flex flex-wrap gap-1.5">
            {workflow.componentAssignments.map((assignment) => (
              <button
                key={assignment.versionId}
                onClick={(e) => handleAgentClick(e, assignment.componentId)}
                className="px-2 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs rounded font-medium hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors inline-flex items-center gap-1"
              >
                {assignment.componentName}
                <span className="text-[10px] px-1 py-0 bg-blue-200 dark:bg-blue-800/50 rounded">
                  v{assignment.version}
                </span>
                <span className="text-[10px]" aria-hidden="true">
                  →
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Usage Stats */}
      {workflow.usageStats && (
        <div className="mb-3 pb-3 border-b border-border text-xs text-muted">
          <div className="flex items-center gap-3">
            <span>
              <span className="font-semibold text-fg">{workflow.usageStats.totalRuns}</span> runs
            </span>
            <span>|</span>
            <span>
              Avg{' '}
              <span className="font-semibold text-fg">
                {(workflow.usageStats.avgRuntime / 60000).toFixed(1)}min
              </span>
            </span>
            <span>|</span>
            <span>
              <span className="font-semibold text-fg">${workflow.usageStats.avgCost.toFixed(2)}</span>{' '}
              avg cost
            </span>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="mt-3 space-y-2">
        <div className="flex items-center justify-between gap-2 text-sm">
          <button
            onClick={handleViewDetails}
            className="px-3 py-1.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-900/50 rounded transition-colors font-medium"
          >
            View Details
          </button>
          <div className="flex gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleActive();
              }}
              className="text-muted hover:text-fg transition-colors"
            >
              {workflow.active ? 'Deactivate' : 'Activate'}
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 transition-colors"
            >
              Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
