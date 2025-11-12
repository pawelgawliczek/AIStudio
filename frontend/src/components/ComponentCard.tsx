import { Component } from '../types';

interface ComponentCardProps {
  component: Component;
  onClick: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onToggleActive: () => void;
}

export function ComponentCard({ component, onClick, onEdit, onDelete, onToggleActive }: ComponentCardProps) {
  return (
    <div
      className="bg-white rounded-lg shadow hover:shadow-md transition-shadow border border-gray-200 overflow-hidden cursor-pointer"
      onClick={onClick}
    >
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900">{component.name}</h3>
            {component.description && (
              <p className="mt-1 text-sm text-gray-600 line-clamp-2">{component.description}</p>
            )}
          </div>
          <div className="flex items-center gap-1 ml-2">
            <span
              className={`px-2 py-1 text-xs font-medium rounded-full ${
                component.active
                  ? 'bg-green-100 text-green-800'
                  : 'bg-gray-100 text-gray-800'
              }`}
            >
              {component.active ? 'Active' : 'Inactive'}
            </span>
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
                className="px-2 py-0.5 text-xs bg-blue-50 text-blue-700 rounded"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Tools */}
        <div className="text-sm text-gray-600">
          <span className="font-medium">Tools:</span> {component.tools.length > 0 ? component.tools.length : 'None'}
        </div>

        {/* Failure Handling */}
        <div className="text-sm text-gray-600">
          <span className="font-medium">On Failure:</span> {component.onFailure}
        </div>

        {/* Usage Stats */}
        {component.usageStats && (
          <div className="pt-2 border-t border-gray-100">
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <div className="text-gray-500">Total Runs</div>
                <div className="font-semibold text-gray-900">{component.usageStats.totalRuns}</div>
              </div>
              <div>
                <div className="text-gray-500">Success Rate</div>
                <div className="font-semibold text-gray-900">
                  {component.usageStats.successRate.toFixed(1)}%
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer Actions */}
      <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 flex items-center justify-end gap-2">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleActive();
          }}
          className="text-sm text-gray-600 hover:text-gray-900"
        >
          {component.active ? 'Deactivate' : 'Activate'}
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onEdit();
          }}
          className="text-sm text-blue-600 hover:text-blue-800"
        >
          Edit
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="text-sm text-red-600 hover:text-red-800"
        >
          Delete
        </button>
      </div>
    </div>
  );
}
