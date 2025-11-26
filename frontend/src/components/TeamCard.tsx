import React from 'react';
import { Workflow } from '../types';
import { WorkflowActivationButton } from './WorkflowActivationButton';
import { WorkflowRunsHistory } from './WorkflowRunsHistory';

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
  return (
    <div
      key={workflow.id}
      data-testid={`workflow-card-${workflow.name}`}
      className="bg-card rounded-lg shadow hover:shadow-md transition-shadow border border-border p-4"
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-2">
        <h3 className="text-lg font-semibold text-fg">{workflow.name}</h3>
        <span
          data-testid="workflow-status"
          className={`px-2 py-1 text-xs font-medium rounded-full ${
            workflow.active
              ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-300'
          }`}
        >
          {workflow.active ? 'Active' : 'Inactive'}
        </span>
      </div>

      {/* Description */}
      {workflow.description && (
        <p className="text-sm text-muted mb-3 line-clamp-2">{workflow.description}</p>
      )}

      {/* Basic Info */}
      <div className="space-y-2 text-sm text-muted mb-3">
        {workflow.coordinator && (
          <div>
            <span className="font-medium text-fg">Coordinator:</span>{' '}
            <a
              href={`/components/${workflow.coordinatorId}`}
              className="text-blue-600 dark:text-blue-400 hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              {workflow.coordinator.name}
            </a>
            {workflow.coordinator.version && (
              <span className="ml-1 text-xs px-1.5 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded">
                v{workflow.coordinator.version}
              </span>
            )}
          </div>
        )}
        <div>
          <span className="font-medium text-fg">Trigger:</span> {workflow.triggerConfig.type}
        </div>
        <div>
          <span className="font-medium text-fg">Version:</span> {workflow.version}
        </div>
      </div>

      {/* Flow Diagram */}
      {workflow.coordinator?.flowDiagram && (
        <div className="mb-3 pb-3 border-b border-border">
          <div className="text-xs font-semibold text-fg mb-2">Execution Flow</div>
          <pre className="text-xs font-mono leading-relaxed text-fg bg-bg-secondary overflow-x-auto rounded p-3 whitespace-pre border border-border">
            {workflow.coordinator.flowDiagram}
          </pre>
        </div>
      )}

      {/* Components */}
      {workflow.componentAssignments && workflow.componentAssignments.length > 0 ? (
        <div className="mb-3 pb-3 border-b border-border">
          <div className="text-xs font-semibold text-fg mb-2">
            Components ({workflow.componentAssignments.length})
          </div>
          <div className="flex flex-wrap gap-1.5">
            {workflow.componentAssignments.map((assignment) => (
              <a
                key={assignment.versionId}
                href={`/components/${assignment.componentId}?version=${assignment.versionId}`}
                className="px-2 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs rounded font-medium hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors inline-flex items-center gap-1"
                onClick={(e) => e.stopPropagation()}
              >
                {assignment.componentName}
                <span className="text-[10px] px-1 py-0 bg-blue-200 dark:bg-blue-800/50 rounded">
                  v{assignment.version}
                </span>
              </a>
            ))}
          </div>
        </div>
      ) : workflow.coordinator?.componentIds && workflow.coordinator.componentIds.length > 0 ? (
        <div className="mb-3 pb-3 border-b border-border">
          <div className="text-xs font-semibold text-fg mb-2">
            Connected Agents ({workflow.coordinator.componentIds.length})
          </div>
          <div className="flex flex-wrap gap-1.5">
            {workflow.coordinator.components && workflow.coordinator.components.length > 0 ? (
              workflow.coordinator.components.map((comp) => (
                <span
                  key={comp.id}
                  className="px-2 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs rounded font-medium"
                >
                  {comp.name}
                </span>
              ))
            ) : (
              workflow.coordinator.componentIds.map((id, idx) => (
                <span
                  key={id}
                  className="px-2 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs rounded font-medium"
                >
                  Agent {idx + 1}
                </span>
              ))
            )}
          </div>
        </div>
      ) : null}

      {/* Activation Status */}
      {workflow.activationStatus?.isActivated && (
        <div className="mb-3 pb-3 border-b border-border">
          <div className="flex items-center gap-2 text-xs">
            <span className="px-2 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300 rounded-full font-medium">
              Deployed to Claude Code
            </span>
          </div>
        </div>
      )}

      {/* Usage Stats */}
      {workflow.usageStats && (
        <div className="mb-3 pb-3 border-b border-border grid grid-cols-2 gap-2 text-xs">
          <div>
            <div className="text-muted">Total Runs</div>
            <div className="font-semibold text-fg">{workflow.usageStats.totalRuns}</div>
          </div>
          <div>
            <div className="text-muted">Success Rate</div>
            <div className="font-semibold text-fg">
              {workflow.usageStats.successRate.toFixed(1)}%
            </div>
          </div>
        </div>
      )}

      {/* Workflow Run History */}
      <div className="mb-3">
        <WorkflowRunsHistory workflowId={workflow.id} projectId={projectId} />
      </div>

      {/* Actions */}
      <div className="mt-3 space-y-2">
        <WorkflowActivationButton
          workflowId={workflow.id}
          workflowName={workflow.name}
          disabled={!workflow.active}
        />
        <div className="flex items-center justify-between gap-2 text-sm">
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
              {workflow.active ? 'Deactivate' : 'Activate'}
            </button>
            <button onClick={onDelete} className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 transition-colors">
              Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
