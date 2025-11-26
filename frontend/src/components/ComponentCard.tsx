import { Link } from 'react-router-dom';
import { Component } from '../types';
import { VersionBadge } from './VersionBadge';

interface ComponentCardProps {
  component: Component;
  versionsCount?: number;
}

export function ComponentCard({ component, versionsCount = 1 }: ComponentCardProps) {
  return (
    <div
      data-testid={`component-card-${component.id}`}
      className="bg-card rounded-lg shadow hover:shadow-md transition-shadow border border-border overflow-hidden"
    >
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold text-fg">{component.name}</h3>
              {component.version && (
                <VersionBadge
                  version={component.version}
                  status="current"
                  size="sm"
                  data-testid="component-version"
                />
              )}
            </div>
            {component.description && (
              <p className="mt-1 text-sm text-fg line-clamp-2">{component.description}</p>
            )}
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="p-4 space-y-3">
        {/* Tags */}
        {component.tags && component.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {component.tags.map(tag => (
              <span
                key={tag}
                className="px-2 py-0.5 text-xs bg-accent/10 text-accent rounded"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Tools */}
        <div className="text-sm text-fg">
          <span className="font-medium">Tools:</span> {component.tools.length > 0 ? component.tools.length : 'None'}
        </div>

        {/* Failure Handling */}
        <div className="text-sm text-fg">
          <span className="font-medium">On Failure:</span> {component.onFailure}
        </div>

        {/* Usage Stats */}
        {component.usageStats && (
          <div className="pt-2 border-t border-gray-100">
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <div className="text-fg">Total Runs</div>
                <div className="font-semibold text-fg">{component.usageStats.totalRuns}</div>
              </div>
              <div>
                <div className="text-fg">Success Rate</div>
                <div className="font-semibold text-fg">
                  {component.usageStats.successRate.toFixed(1)}%
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-3 bg-bg-secondary border-t border-border flex items-center justify-between">
        <span className="text-sm text-fg">
          {versionsCount} version{versionsCount !== 1 ? 's' : ''}
        </span>
        <Link
          to={`/components/${component.id}`}
          className="text-sm text-accent hover:text-blue-800 hover:underline font-medium"
        >
          View Details
        </Link>
      </div>
    </div>
  );
}
