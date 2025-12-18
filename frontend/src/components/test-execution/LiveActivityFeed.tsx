import { formatDistanceToNow } from 'date-fns';
import { useState, useEffect, useRef } from 'react';
import { TestExecutionEvent } from '../../hooks/useTestExecutionWebSocket';

interface LiveActivityFeedProps {
  items: TestExecutionEvent[];
  autoScroll?: boolean;
}

export function LiveActivityFeed({ items, autoScroll = true }: LiveActivityFeedProps) {
  const [scrollEnabled, setScrollEnabled] = useState(autoScroll);
  const feedRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to top when new items arrive
  useEffect(() => {
    if (scrollEnabled && feedRef.current) {
      feedRef.current.scrollTop = 0;
    }
  }, [items, scrollEnabled]);

  const getStatusIcon = (status?: string) => {
    switch (status) {
      case 'pass':
        return '✅';
      case 'fail':
        return '❌';
      case 'skip':
        return '⏭️';
      case 'error':
        return '⚠️';
      default:
        return '⏳';
    }
  };

  const getStatusText = (status?: string) => {
    switch (status) {
      case 'pass':
        return 'Pass';
      case 'fail':
        return 'Fail';
      case 'skip':
        return 'Skip';
      case 'error':
        return 'Error';
      default:
        return 'Running...';
    }
  };

  const formatTime = (timestamp?: string) => {
    if (!timestamp) return new Date().toLocaleTimeString();
    return new Date(timestamp).toLocaleTimeString();
  };

  if (items.length === 0) {
    return (
      <div className="bg-card rounded-lg shadow border border-border p-8 text-center">
        <p className="text-muted">No recent activity. Tests will appear here in real-time.</p>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-lg shadow border border-border">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
          <h3 className="text-sm font-semibold text-fg">LIVE Recent Activity</h3>
        </div>
        <button
          onClick={() => setScrollEnabled(!scrollEnabled)}
          className="text-xs px-3 py-1 rounded border border-border hover:bg-bg-secondary transition-colors"
        >
          Auto-scroll: {scrollEnabled ? 'ON ⬇' : 'OFF'}
        </button>
      </div>

      {/* Activity list */}
      <div
        ref={feedRef}
        className="divide-y divide-border max-h-64 overflow-y-auto"
        style={{ scrollBehavior: 'smooth' }}
      >
        {items.map((item, index) => (
          <div
            key={`${item.executionId}-${index}`}
            className="px-4 py-3 hover:bg-bg-secondary transition-colors"
          >
            <div className="flex items-start gap-3">
              <span className="text-sm text-muted font-mono flex-shrink-0">
                {formatTime(item.completedAt || item.startedAt)}
              </span>
              <span className="text-lg flex-shrink-0">
                {getStatusIcon(item.status)}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm text-fg">
                    {item.testCaseKey}
                  </span>
                  <span className="text-sm text-muted truncate">
                    {item.testCaseTitle}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {item.durationMs !== undefined && (
                  <span className="text-xs text-muted">
                    {(item.durationMs / 1000).toFixed(1)}s
                  </span>
                )}
                <span className={`text-xs font-medium ${
                  item.status === 'pass' ? 'text-green-600' :
                  item.status === 'fail' ? 'text-red-600' :
                  item.status === 'skip' ? 'text-yellow-600' :
                  'text-blue-600'
                }`}>
                  {getStatusText(item.status)}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
