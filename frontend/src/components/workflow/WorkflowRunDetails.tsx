import React from 'react';
import { motion } from 'framer-motion';
import { WorkflowRunDetailsProps } from '../../types/workflow-tracking';

/**
 * Expandable details panel for a workflow run
 */
export const WorkflowRunDetails: React.FC<WorkflowRunDetailsProps> = ({
  run,
  onClose,
}) => {
  return (
    <motion.div
      data-testid="workflow-run-details"
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: 'auto', opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="bg-gray-50 border-t border-gray-200 px-4 py-3 overflow-hidden"
    >
      <div className="grid grid-cols-2 gap-4">
        {/* Left Column: Story & Component Details */}
        <div className="space-y-3">
          <div>
            <h4 className="text-xs font-semibold text-gray-600 mb-1">Story Details</h4>
            <p className="text-sm text-gray-800">{run.storyTitle}</p>
            <p className="text-xs text-gray-500">ID: {run.storyId}</p>
          </div>

          <div>
            <h4 className="text-xs font-semibold text-gray-600 mb-1">
              Components ({run.componentRuns.length})
            </h4>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {run.componentRuns.map((component) => (
                <div
                  key={component.id}
                  className="flex items-center justify-between text-xs"
                >
                  <span className="text-gray-700">{component.componentName}</span>
                  <span
                    className={`px-2 py-0.5 rounded text-xs ${
                      component.status === 'completed'
                        ? 'bg-green-100 text-green-700'
                        : component.status === 'running'
                        ? 'bg-blue-100 text-blue-700'
                        : component.status === 'failed'
                        ? 'bg-red-100 text-red-700'
                        : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {component.status}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {run.recentOutputs.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-gray-600 mb-1">
                Recent Outputs
              </h4>
              <div className="bg-gray-900 text-gray-100 p-2 rounded text-xs font-mono max-h-24 overflow-y-auto">
                {run.recentOutputs.slice(-5).map((output, idx) => (
                  <div key={idx}>{output}</div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Branch, Queue, Actions */}
        <div className="space-y-3">
          {run.branchName && (
            <div>
              <h4 className="text-xs font-semibold text-gray-600 mb-1">Branch Info</h4>
              <p className="text-sm text-gray-800 font-mono">{run.branchName}</p>
              {(run.commitsAhead !== null || run.commitsBehind !== null) && (
                <p className="text-xs text-gray-500">
                  {run.commitsAhead !== null && `↑${run.commitsAhead} ahead`}
                  {run.commitsAhead !== null && run.commitsBehind !== null && ' • '}
                  {run.commitsBehind !== null && `↓${run.commitsBehind} behind`}
                </p>
              )}
            </div>
          )}

          {run.queueStatus && (
            <div>
              <h4 className="text-xs font-semibold text-gray-600 mb-1">Queue Info</h4>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-600">Status:</span>
                  <span className="text-gray-800 font-medium">{run.queueStatus}</span>
                </div>
                {run.queuePosition !== null && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Position:</span>
                    <span className="text-gray-800">#{run.queuePosition}</span>
                  </div>
                )}
                {run.queuePriority !== null && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Priority:</span>
                    <span className="text-gray-800">{run.queuePriority}/10</span>
                  </div>
                )}
                {run.queueWaitTimeMs !== null && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Wait Time:</span>
                    <span className="text-gray-800">
                      {formatDuration(run.queueWaitTimeMs)}
                    </span>
                  </div>
                )}
                {run.queueLocked && (
                  <div className="flex items-center gap-1 text-yellow-600">
                    <span>🔒</span>
                    <span>Queue Locked</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {run.transcriptPath && (
            <div>
              <a
                href={`/transcripts/${run.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-blue-600 hover:text-blue-800 underline"
              >
                View Full Transcript →
              </a>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <button
              onClick={onClose}
              className="flex-1 px-3 py-1.5 bg-gray-200 hover:bg-gray-300 rounded text-xs font-medium transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
}
