import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Workflow } from '../types';
import { VersionBadge } from './VersionBadge';

export interface TeamCardProps {
  workflow: Workflow;
  projectId: string;
  onClick: () => void;
}

export function TeamCard({
  workflow,
  projectId,
  onClick,
}: TeamCardProps) {
  const navigate = useNavigate();

  // Stop propagation for nested navigation links
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
                  {assignment.version}
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
      <div className="mt-3">
        <button
          onClick={handleViewDetails}
          className="w-full px-3 py-1.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-900/50 rounded transition-colors font-medium text-sm"
        >
          View Details
        </button>
      </div>
    </div>
  );
}
