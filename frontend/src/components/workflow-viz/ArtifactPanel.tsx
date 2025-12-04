/**
 * ArtifactPanel Component
 * ST-168: Artifact quick access and preview panel
 */

import React, { useState } from 'react';

export interface ArtifactPanelProps {
  artifacts: Artifact[];
  onView: (artifactId: string) => void;
  onEdit: (artifactId: string) => void;
  onDownload: (artifactId: string) => void;
  onViewHistory: (artifactId: string) => void;
}

export interface Artifact {
  id: string;
  definitionKey: string;
  name: string;
  type: 'markdown' | 'json' | 'code' | 'report' | 'image' | 'other';
  version: number;
  status: 'pending' | 'writing' | 'complete';
  size?: number;
  createdBy?: string;
  createdAt?: string;
  preview?: string;
  accessType?: 'read' | 'write' | 'required';
}

const getTypeIcon = (type: Artifact['type']): string => {
  switch (type) {
    case 'markdown':
      return '📝';
    case 'json':
      return '📋';
    case 'code':
      return '💻';
    case 'report':
      return '📊';
    case 'image':
      return '🖼️';
    default:
      return '📄';
  }
};

const getStatusColor = (status: Artifact['status']): string => {
  switch (status) {
    case 'complete':
      return 'text-green-400 bg-green-500/20';
    case 'writing':
      return 'text-blue-400 bg-blue-500/20';
    case 'pending':
      return 'text-gray-400 bg-gray-500/20';
    default:
      return 'text-gray-400 bg-gray-500/20';
  }
};

const getAccessBadge = (accessType?: Artifact['accessType']): React.ReactNode => {
  if (!accessType) return null;

  switch (accessType) {
    case 'read':
      return (
        <span className="px-1 py-0.5 text-xs bg-gray-600 text-gray-300 rounded">
          📥 read
        </span>
      );
    case 'write':
      return (
        <span className="px-1 py-0.5 text-xs bg-blue-600/30 text-blue-300 rounded">
          📤 write
        </span>
      );
    case 'required':
      return (
        <span className="px-1 py-0.5 text-xs bg-orange-600/30 text-orange-300 rounded">
          ⚠️ required
        </span>
      );
    default:
      return null;
  }
};

const formatSize = (bytes?: number): string => {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export const ArtifactPanel: React.FC<ArtifactPanelProps> = ({
  artifacts,
  onView,
  onEdit,
  onDownload,
  onViewHistory,
}) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (artifacts.length === 0) {
    return (
      <div
        className="border border-gray-700 rounded-lg bg-gray-900 p-4"
        data-testid="artifact-panel-empty"
      >
        <div className="text-center text-gray-500">
          No artifacts for this workflow run
        </div>
      </div>
    );
  }

  return (
    <div
      className="border border-gray-700 rounded-lg bg-gray-900"
      data-testid="artifact-panel"
      role="region"
      aria-label="Workflow artifacts"
    >
      <div className="p-3 border-b border-gray-700">
        <h3 className="font-semibold text-gray-200">Artifacts</h3>
      </div>

      <div className="divide-y divide-gray-700">
        {artifacts.map((artifact) => (
          <div key={artifact.id} className="p-3">
            {/* Artifact Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <span className="text-lg">{getTypeIcon(artifact.type)}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-200 truncate">
                      {artifact.name}
                    </span>
                    <span className="text-xs text-gray-500">
                      ({artifact.definitionKey})
                    </span>
                    {getAccessBadge(artifact.accessType)}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <span>v{artifact.version}</span>
                    {artifact.size && <span>{formatSize(artifact.size)}</span>}
                    {artifact.createdBy && <span>by {artifact.createdBy}</span>}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span
                  className={`px-2 py-1 text-xs rounded ${getStatusColor(artifact.status)}`}
                  data-testid={`artifact-status-${artifact.id}`}
                >
                  {artifact.status === 'writing' ? '🔄 Writing...' : artifact.status}
                </span>
              </div>
            </div>

            {/* Preview (expandable) */}
            {artifact.preview && artifact.status === 'complete' && (
              <div className="mt-2">
                <button
                  onClick={() =>
                    setExpandedId(expandedId === artifact.id ? null : artifact.id)
                  }
                  className="text-xs text-blue-400 hover:text-blue-300"
                  data-testid={`toggle-preview-${artifact.id}`}
                >
                  {expandedId === artifact.id ? '▲ Hide Preview' : '▼ Show Preview'}
                </button>

                {expandedId === artifact.id && (
                  <div
                    className="mt-2 p-2 bg-gray-800 rounded text-xs text-gray-300 font-mono max-h-40 overflow-y-auto"
                    data-testid={`preview-${artifact.id}`}
                  >
                    <pre className="whitespace-pre-wrap">{artifact.preview}</pre>
                  </div>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="mt-2 flex items-center gap-2">
              {artifact.status === 'complete' && (
                <>
                  <button
                    onClick={() => onView(artifact.id)}
                    className="text-xs text-blue-400 hover:text-blue-300"
                    data-testid={`view-${artifact.id}`}
                  >
                    View
                  </button>
                  <button
                    onClick={() => onEdit(artifact.id)}
                    className="text-xs text-green-400 hover:text-green-300"
                    data-testid={`edit-${artifact.id}`}
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => onDownload(artifact.id)}
                    className="text-xs text-gray-400 hover:text-gray-300"
                    data-testid={`download-${artifact.id}`}
                  >
                    Download
                  </button>
                </>
              )}
              {artifact.status === 'writing' && (
                <button
                  onClick={() => onView(artifact.id)}
                  className="text-xs text-blue-400 hover:text-blue-300"
                  data-testid={`view-live-${artifact.id}`}
                >
                  View Live
                </button>
              )}
              {artifact.version > 1 && (
                <button
                  onClick={() => onViewHistory(artifact.id)}
                  className="text-xs text-purple-400 hover:text-purple-300"
                  data-testid={`history-${artifact.id}`}
                >
                  History (v1-v{artifact.version})
                </button>
              )}
            </div>

            {/* Pending artifact placeholder */}
            {artifact.status === 'pending' && (
              <div className="mt-2 text-xs text-gray-500 italic">
                Expected from this state • Not yet created
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
