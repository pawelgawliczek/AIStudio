import { Component } from '../types';

interface ComponentDetailModalProps {
  component: Component;
  isOpen: boolean;
  onClose: () => void;
  onEdit: () => void;
  onUpdate: () => void;
}

export function ComponentDetailModal({ component, isOpen, onClose, onEdit }: ComponentDetailModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-start justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">{component.name}</h2>
              {component.description && (
                <p className="mt-1 text-gray-600">{component.description}</p>
              )}
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Status & Tags */}
          <div className="flex flex-wrap gap-2 mb-6">
            <span
              className={`px-3 py-1 text-sm font-medium rounded-full ${
                component.active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
              }`}
            >
              {component.active ? 'Active' : 'Inactive'}
            </span>
            <span className="px-3 py-1 text-sm bg-purple-100 text-purple-800 rounded-full">
              {component.version}
            </span>
            {component.tags.map(tag => (
              <span key={tag} className="px-3 py-1 text-sm bg-blue-100 text-blue-800 rounded-full">
                {tag}
              </span>
            ))}
          </div>

          {/* Instruction Sets */}
          <div className="space-y-4 mb-6">
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Input Instructions</h3>
              <p className="text-sm text-gray-600 whitespace-pre-wrap bg-gray-50 p-3 rounded border border-gray-200">
                {component.inputInstructions}
              </p>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Operation Instructions</h3>
              <p className="text-sm text-gray-600 whitespace-pre-wrap bg-gray-50 p-3 rounded border border-gray-200">
                {component.operationInstructions}
              </p>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Output Instructions</h3>
              <p className="text-sm text-gray-600 whitespace-pre-wrap bg-gray-50 p-3 rounded border border-gray-200">
                {component.outputInstructions}
              </p>
            </div>
          </div>

          {/* Configuration */}
          <div className="border-t pt-6 mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Configuration</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-gray-500">Model ID</div>
                <div className="font-medium text-gray-900">{component.config.modelId}</div>
              </div>
              <div>
                <div className="text-gray-500">Temperature</div>
                <div className="font-medium text-gray-900">{component.config.temperature}</div>
              </div>
              <div>
                <div className="text-gray-500">Max Tokens (In/Out)</div>
                <div className="font-medium text-gray-900">
                  {component.config.maxInputTokens} / {component.config.maxOutputTokens}
                </div>
              </div>
              <div>
                <div className="text-gray-500">Timeout</div>
                <div className="font-medium text-gray-900">{component.config.timeout}s</div>
              </div>
              <div>
                <div className="text-gray-500">On Failure</div>
                <div className="font-medium text-gray-900">{component.onFailure}</div>
              </div>
              <div>
                <div className="text-gray-500">Cost Limit</div>
                <div className="font-medium text-gray-900">${component.config.costLimit}</div>
              </div>
            </div>
          </div>

          {/* Tools */}
          {component.tools.length > 0 && (
            <div className="border-t pt-6 mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">MCP Tools</h3>
              <div className="flex flex-wrap gap-2">
                {component.tools.map(tool => (
                  <span key={tool} className="px-3 py-1 text-sm bg-indigo-50 text-indigo-700 rounded border border-indigo-200">
                    {tool}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Usage Stats */}
          {component.usageStats && (
            <div className="border-t pt-6 mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Usage Statistics</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-3 bg-gray-50 rounded">
                  <div className="text-2xl font-bold text-gray-900">{component.usageStats.totalRuns}</div>
                  <div className="text-sm text-gray-600">Total Runs</div>
                </div>
                <div className="text-center p-3 bg-gray-50 rounded">
                  <div className="text-2xl font-bold text-gray-900">
                    {component.usageStats.successRate.toFixed(1)}%
                  </div>
                  <div className="text-sm text-gray-600">Success Rate</div>
                </div>
                <div className="text-center p-3 bg-gray-50 rounded">
                  <div className="text-2xl font-bold text-gray-900">
                    {component.usageStats.avgRuntime.toFixed(0)}s
                  </div>
                  <div className="text-sm text-gray-600">Avg Runtime</div>
                </div>
                <div className="text-center p-3 bg-gray-50 rounded">
                  <div className="text-2xl font-bold text-gray-900">
                    ${component.usageStats.avgCost.toFixed(2)}
                  </div>
                  <div className="text-sm text-gray-600">Avg Cost</div>
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 hover:text-gray-900"
            >
              Close
            </button>
            <button
              onClick={onEdit}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Edit Component
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
