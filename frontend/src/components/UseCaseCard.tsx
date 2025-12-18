import { formatDistanceToNow } from 'date-fns';
import { UseCase } from '../types';

interface UseCaseCardProps {
  useCase: UseCase;
  onClick: () => void;
  onDelete: () => void;
}

export function UseCaseCard({ useCase, onClick, onDelete }: UseCaseCardProps) {
  const latestVersion = useCase.latestVersion;
  const storyCount = useCase.storyLinks?.length || 0;

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete();
  };

  return (
    <div
      onClick={onClick}
      className="bg-card border border-border rounded-lg p-4 hover:shadow-lg transition-shadow cursor-pointer group"
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-muted">{useCase.key}</span>
            {useCase.similarity !== undefined && (
              <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded">
                {Math.round(useCase.similarity * 100)}% match
              </span>
            )}
          </div>
          <h3 className="text-lg font-semibold text-fg mt-1 line-clamp-2">
            {useCase.title}
          </h3>
        </div>

        {/* Actions (show on hover) */}
        <div className="opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={handleDeleteClick}
            className="p-1 text-muted hover:text-red-600 transition-colors"
            title="Delete use case"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Area Tag */}
      {useCase.area && (
        <div className="mb-2">
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
            🏷️ {useCase.area}
          </span>
        </div>
      )}

      {/* Summary */}
      {latestVersion?.summary && (
        <p className="text-sm text-muted mb-3 line-clamp-2">
          {latestVersion.summary}
        </p>
      )}

      {/* Metadata */}
      <div className="flex items-center justify-between text-xs text-muted pt-3 border-t border-gray-100">
        <div className="flex items-center gap-3">
          {/* Version */}
          {latestVersion && (
            <span className="flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              v{latestVersion.version}
            </span>
          )}

          {/* Linked Stories */}
          <span className="flex items-center gap-1">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
              />
            </svg>
            {storyCount} {storyCount === 1 ? 'story' : 'stories'}
          </span>
        </div>

        {/* Last Updated */}
        <span className="text-muted">
          {formatDistanceToNow(new Date(useCase.updatedAt), { addSuffix: true })}
        </span>
      </div>
    </div>
  );
}
