import { Link } from 'react-router-dom';
import { CoordinatorAgent } from '../types';
import { VersionBadge } from './VersionBadge';

export interface CoordinatorCardProps {
  coordinator: CoordinatorAgent;
  versionsCount?: number;
}

export function CoordinatorCard({
  coordinator,
  versionsCount = 1,
}: CoordinatorCardProps) {
  return (
    <div
      data-testid={`coordinator-card-${coordinator.id}`}
      className="bg-card rounded-lg shadow hover:shadow-md transition-shadow border border-border overflow-hidden"
    >
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold text-fg">{coordinator.name}</h3>
              {coordinator.version && (
                <VersionBadge
                  version={coordinator.version}
                  status="current"
                  size="sm"
                  data-testid="coordinator-version"
                />
              )}
            </div>
            {coordinator.description && (
              <p className="mt-1 text-sm text-fg line-clamp-2">{coordinator.description}</p>
            )}
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="p-4 space-y-3">
        {/* Info */}
        <div className="text-sm text-fg">
          <span className="font-medium">Domain:</span> {coordinator.domain}
        </div>
        <div className="text-sm text-fg">
          <span className="font-medium">Strategy:</span>{' '}
          <span className="capitalize">{coordinator.decisionStrategy}</span>
        </div>

        {/* Tools count */}
        <div className="text-sm text-fg">
          <span className="font-medium">Tools:</span>{' '}
          {coordinator.tools.length > 0 ? coordinator.tools.length : 'None'}
        </div>

        {/* Usage Stats */}
        {coordinator.usageStats && (
          <div className="pt-2 border-t border-gray-100">
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <div className="text-fg">Total Runs</div>
                <div className="font-semibold text-fg">{coordinator.usageStats.totalRuns}</div>
              </div>
              <div>
                <div className="text-fg">Success Rate</div>
                <div className="font-semibold text-fg">
                  {coordinator.usageStats.successRate.toFixed(1)}%
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
          to={`/coordinators/${coordinator.id}`}
          className="text-sm text-accent hover:text-blue-800 hover:underline font-medium"
        >
          View Details
        </Link>
      </div>
    </div>
  );
}
