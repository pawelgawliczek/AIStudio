import { motion } from 'framer-motion';
import React, { useState } from 'react';
import { WorkflowRunDetailsProps } from '../../types/workflow-tracking';
import { LiveTranscriptViewer } from '../workflow-viz/LiveTranscriptViewer';

/**
 * Expandable details panel for a workflow run
 */
export const WorkflowRunDetails: React.FC<WorkflowRunDetailsProps> = ({
  run,
  onClose,
}) => {
  const [transcriptModalOpen, setTranscriptModalOpen] = useState(false);
  const [selectedComponent, setSelectedComponent] = useState<{
    id: string;
    name: string;
  } | null>(null);

  const handleViewTranscript = (componentId: string, componentName: string) => {
    setSelectedComponent({ id: componentId, name: componentName });
    setTranscriptModalOpen(true);
  };

  return (
    <>
      <motion.div
        data-testid="workflow-run-details"
        initial={{ height: 0, opacity: 0 }}
        animate={{ height: 'auto', opacity: 1 }}
        exit={{ height: 0, opacity: 0 }}
        transition={{ duration: 0.3 }}
        className="bg-bg border-t border-border px-4 py-3 overflow-hidden"
      >
        <div className="grid grid-cols-2 gap-4">
          {/* Left Column: Story & Component Details */}
          <div className="space-y-3">
            <div>
              <h4 className="text-xs font-semibold text-muted mb-1">Story Details</h4>
              <p className="text-sm text-fg">{run.storyTitle}</p>
              <p className="text-xs text-muted">ID: {run.storyId}</p>
            </div>

            <div>
              <h4 className="text-xs font-semibold text-muted mb-1">
                Components ({run.componentRuns.length})
              </h4>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {run.componentRuns.map((component) => (
                  <div
                    key={component.id}
                    className="flex items-center justify-between gap-2 text-xs"
                  >
                    <span className="text-fg truncate">{component.componentName}</span>
                    <div className="flex items-center gap-1">
                      {component.status === 'running' && (
                        <button
                          onClick={() => handleViewTranscript(component.id, component.componentName)}
                          className="px-2 py-0.5 rounded text-xs bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 transition-colors"
                          title="View live transcript"
                        >
                          📺 Live
                        </button>
                      )}
                      <span
                        className={`px-2 py-0.5 rounded text-xs ${
                          component.status === 'completed'
                            ? 'bg-green-500/20 text-green-400'
                            : component.status === 'running'
                            ? 'bg-blue-500/20 text-blue-400'
                            : component.status === 'failed'
                            ? 'bg-red-500/20 text-red-400'
                            : 'bg-muted/20 text-muted'
                        }`}
                      >
                        {component.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          {run.recentOutputs.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-muted mb-1">
                Recent Outputs
              </h4>
              <div className="bg-bg border border-border text-fg p-2 rounded text-xs font-mono max-h-24 overflow-y-auto">
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
              <h4 className="text-xs font-semibold text-muted mb-1">Branch Info</h4>
              <p className="text-sm text-fg font-mono">{run.branchName}</p>
              {(run.commitsAhead !== null || run.commitsBehind !== null) && (
                <p className="text-xs text-muted">
                  {run.commitsAhead !== null && `↑${run.commitsAhead} ahead`}
                  {run.commitsAhead !== null && run.commitsBehind !== null && ' • '}
                  {run.commitsBehind !== null && `↓${run.commitsBehind} behind`}
                </p>
              )}
            </div>
          )}

          {run.queueStatus && (
            <div>
              <h4 className="text-xs font-semibold text-muted mb-1">Queue Info</h4>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted">Status:</span>
                  <span className="text-fg font-medium">{run.queueStatus}</span>
                </div>
                {run.queuePosition !== null && (
                  <div className="flex justify-between">
                    <span className="text-muted">Position:</span>
                    <span className="text-fg">#{run.queuePosition}</span>
                  </div>
                )}
                {run.queuePriority !== null && (
                  <div className="flex justify-between">
                    <span className="text-muted">Priority:</span>
                    <span className="text-fg">{run.queuePriority}/10</span>
                  </div>
                )}
                {run.queueWaitTimeMs !== null && (
                  <div className="flex justify-between">
                    <span className="text-muted">Wait Time:</span>
                    <span className="text-fg">
                      {formatDuration(run.queueWaitTimeMs)}
                    </span>
                  </div>
                )}
                {run.queueLocked && (
                  <div className="flex items-center gap-1 text-yellow-500">
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
                className="text-xs text-accent hover:text-accent-dark underline"
              >
                View Full Transcript →
              </a>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <button
              onClick={onClose}
              className="flex-1 px-3 py-1.5 bg-muted/20 hover:bg-muted/30 rounded text-xs font-medium text-fg transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </motion.div>

      {/* Live Transcript Modal */}
      {selectedComponent && (
        <LiveTranscriptViewer
          open={transcriptModalOpen}
          componentRunId={selectedComponent.id}
          componentName={selectedComponent.name}
          onClose={() => {
            setTranscriptModalOpen(false);
            setSelectedComponent(null);
          }}
        />
      )}
    </>
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
