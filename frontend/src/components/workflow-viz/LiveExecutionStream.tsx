/**
 * LiveExecutionStream Component
 * ST-168: Real-time agent execution visualization via WebSocket
 */

import React, { useState, useEffect, useRef } from 'react';

export interface LiveExecutionStreamProps {
  runId: string;
  componentRunId?: string;
  agentName?: string;
  stateName?: string;
  isConnected?: boolean;
  entries?: StreamEntry[];
  onPauseToggle?: () => void;
  onViewTranscript?: () => void;
  onDownload?: () => void;
}

export interface StreamEntry {
  id: string;
  timestamp: string;
  type: 'tool_call' | 'tool_result' | 'response' | 'error' | 'system';
  content: {
    toolName?: string;
    toolInput?: any;
    result?: string;
    text?: string;
    error?: string;
  };
}

export interface LiveMetrics {
  tokensIn: number;
  tokensOut: number;
  turns: number;
  duration: number;
  toolsUsed: Record<string, number>;
}

export const LiveExecutionStream: React.FC<LiveExecutionStreamProps> = ({
  runId,
  componentRunId,
  agentName = 'Agent',
  stateName = 'Execution',
  isConnected = true,
  entries = [],
  onPauseToggle,
  onViewTranscript,
  onDownload,
}) => {
  const [isPaused, setIsPaused] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const streamRef = useRef<HTMLDivElement>(null);

  // Calculate live metrics from entries
  const metrics = React.useMemo<LiveMetrics>(() => {
    const toolsUsed: Record<string, number> = {};
    const tokensIn = 0;
    let tokensOut = 0;

    entries.forEach((entry) => {
      if (entry.type === 'tool_call' && entry.content.toolName) {
        toolsUsed[entry.content.toolName] = (toolsUsed[entry.content.toolName] || 0) + 1;
      }
      // Rough token estimation
      if (entry.type === 'response' && entry.content.text) {
        tokensOut += Math.ceil(entry.content.text.length / 4);
      }
    });

    return {
      tokensIn,
      tokensOut,
      turns: entries.filter((e) => e.type === 'response').length,
      duration: entries.length > 0
        ? Math.floor(
            (Date.now() - new Date(entries[0].timestamp).getTime()) / 1000
          )
        : 0,
      toolsUsed,
    };
  }, [entries]);

  // Auto-scroll effect
  useEffect(() => {
    if (autoScroll && streamRef.current && !isPaused) {
      streamRef.current.scrollTop = streamRef.current.scrollHeight;
    }
  }, [entries, autoScroll, isPaused]);

  const handlePauseToggle = () => {
    setIsPaused(!isPaused);
    onPauseToggle?.();
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toISOString().substring(11, 19);
  };

  const renderEntry = (entry: StreamEntry) => {
    switch (entry.type) {
      case 'tool_call':
        return (
          <div className="text-blue-400">
            <span className="text-gray-400">[{formatTimestamp(entry.timestamp)}]</span>{' '}
            <span className="text-blue-300">🔧 Tool:</span>{' '}
            <span className="font-mono">{entry.content.toolName}</span>
            {entry.content.toolInput && (
              <div className="ml-4 text-xs text-gray-500 truncate">
                {typeof entry.content.toolInput === 'string'
                  ? entry.content.toolInput
                  : JSON.stringify(entry.content.toolInput).substring(0, 100)}
              </div>
            )}
          </div>
        );

      case 'tool_result':
        return (
          <div className="text-green-400">
            <span className="text-gray-400">[{formatTimestamp(entry.timestamp)}]</span>{' '}
            <span className="text-green-300">✓ Result:</span>{' '}
            <span className="text-gray-300 truncate">
              {entry.content.result?.substring(0, 80)}
              {(entry.content.result?.length || 0) > 80 && '...'}
            </span>
          </div>
        );

      case 'response':
        return (
          <div className="text-gray-200">
            <span className="text-gray-400">[{formatTimestamp(entry.timestamp)}]</span>{' '}
            <span className="text-purple-300">💬 Response:</span>
            <div className="ml-4 text-sm text-gray-300 whitespace-pre-wrap">
              {entry.content.text?.substring(0, 200)}
              {(entry.content.text?.length || 0) > 200 && '...'}
            </div>
          </div>
        );

      case 'error':
        return (
          <div className="text-red-400">
            <span className="text-gray-400">[{formatTimestamp(entry.timestamp)}]</span>{' '}
            <span className="text-red-300">⚠️ Error:</span>{' '}
            <span>{entry.content.error}</span>
          </div>
        );

      case 'system':
        return (
          <div className="text-yellow-400">
            <span className="text-gray-400">[{formatTimestamp(entry.timestamp)}]</span>{' '}
            <span className="text-yellow-300">ℹ️</span>{' '}
            <span>{entry.content.text}</span>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div
      className="border border-gray-700 rounded-lg bg-gray-900"
      data-testid="live-execution-stream"
      role="region"
      aria-label="Live execution stream"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-gray-700">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
          <span className="font-semibold text-gray-200">Live Execution Stream</span>
          <span
            className={`text-xs px-2 py-0.5 rounded ${
              isConnected
                ? 'bg-green-500/20 text-green-400'
                : 'bg-red-500/20 text-red-400'
            }`}
            data-testid="connection-status"
          >
            {isConnected ? '🔴 CONNECTED' : 'DISCONNECTED'}
          </span>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <span>Agent: {agentName}</span>
          <span>|</span>
          <span>State: {stateName}</span>
        </div>
      </div>

      {/* Stream Content */}
      <div
        ref={streamRef}
        className="h-64 overflow-y-auto p-3 font-mono text-xs space-y-2 bg-black/30"
        data-testid="stream-content"
      >
        {entries.length === 0 ? (
          <div className="text-gray-500 text-center py-8">
            Waiting for agent output...
            <span className="animate-pulse">█</span>
          </div>
        ) : (
          entries.map((entry) => (
            <div key={entry.id} className="border-b border-gray-800 pb-2">
              {renderEntry(entry)}
            </div>
          ))
        )}

        {/* Cursor */}
        {entries.length > 0 && !isPaused && (
          <div className="text-gray-500 animate-pulse">█</div>
        )}
      </div>

      {/* Metrics Bar */}
      <div className="px-3 py-2 border-t border-gray-700 bg-gray-800/50">
        <div className="flex items-center justify-between text-xs text-gray-400">
          <div className="flex items-center gap-4">
            <span>
              Tokens: <span className="text-gray-200">{metrics.tokensIn}</span> in /{' '}
              <span className="text-gray-200">{metrics.tokensOut}</span> out
            </span>
            <span>
              Turns: <span className="text-gray-200">{metrics.turns}</span>
            </span>
            <span>
              Duration: <span className="text-gray-200">{metrics.duration}s</span>
            </span>
          </div>
          <div>
            Tools: {Object.entries(metrics.toolsUsed).map(([tool, count]) => (
              <span key={tool} className="ml-1">
                {tool}({count})
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between px-3 py-2 border-t border-gray-700">
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1 text-xs text-gray-400 cursor-pointer">
            <input
              type="checkbox"
              checked={autoScroll}
              onChange={(e) => setAutoScroll(e.target.checked)}
              className="w-3 h-3"
            />
            Auto-scroll
          </label>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handlePauseToggle}
            className={`px-3 py-1 text-xs rounded ${
              isPaused
                ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                : 'bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30'
            }`}
            data-testid="pause-button"
          >
            {isPaused ? '▶ Resume' : '⏸ Pause'}
          </button>

          <button
            onClick={onViewTranscript}
            className="px-3 py-1 text-xs rounded bg-gray-700 text-gray-300 hover:bg-gray-600"
            data-testid="view-transcript"
          >
            View Full Transcript
          </button>

          <button
            onClick={onDownload}
            className="px-3 py-1 text-xs rounded bg-gray-700 text-gray-300 hover:bg-gray-600"
            data-testid="download-button"
          >
            Download JSONL
          </button>
        </div>
      </div>
    </div>
  );
};
