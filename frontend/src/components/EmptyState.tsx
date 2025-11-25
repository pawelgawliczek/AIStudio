import React from 'react';

export interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  testId?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  testId,
}: EmptyStateProps) {
  return (
    <div className="text-center py-12">
      {icon}
      <h3 className="mt-2 text-sm font-medium text-fg">{title}</h3>
      <p className="mt-1 text-sm text-muted">{description}</p>
      {actionLabel && onAction && (
        <div className="mt-6">
          <button
            data-testid={testId}
            onClick={onAction}
            className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-accent-fg bg-accent hover:bg-accent-dark"
          >
            {actionLabel}
          </button>
        </div>
      )}
    </div>
  );
}
