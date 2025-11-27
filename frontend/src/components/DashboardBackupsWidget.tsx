import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { backupsService } from '../services/backups.service';

export function DashboardBackupsWidget() {
  const navigate = useNavigate();

  const { data: status, isLoading } = useQuery({
    queryKey: ['backup-status'],
    queryFn: () => backupsService.getStatus(),
    refetchInterval: 60000, // Refresh every minute
  });

  const { data: backupsData } = useQuery({
    queryKey: ['recent-backups'],
    queryFn: () => backupsService.listBackups({ environment: 'production', limit: 5 }),
    refetchInterval: 60000,
  });

  const recentBackups = backupsData?.backups || [];

  const formatRelativeTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="bg-card rounded-lg shadow border border-border overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <h3 className="text-lg font-semibold text-fg">Database Backups</h3>
        <button
          onClick={() => navigate('/backups')}
          className="text-sm text-accent hover:text-accent/80 font-medium"
        >
          View All →
        </button>
      </div>

      {/* Content */}
      <div className="p-4">
        {isLoading ? (
          <div className="flex justify-center items-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-fg"></div>
          </div>
        ) : status ? (
          <>
            {/* Health Status */}
            <div className="mb-4 p-3 rounded-lg border border-border bg-bg-secondary">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-fg">Status</span>
                <span
                  className={`px-2 py-1 text-xs font-medium rounded-full ${
                    status.production.healthy
                      ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
                      : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300'
                  }`}
                >
                  {status.production.healthy ? 'Healthy' : 'Unhealthy'}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-muted">Last Backup:</span>
                  <div className="font-medium text-fg">
                    {status.production.lastBackupTime
                      ? formatRelativeTime(status.production.lastBackupTime)
                      : 'Never'}
                  </div>
                </div>
                <div>
                  <span className="text-muted">Total:</span>
                  <div className="font-medium text-fg">
                    {status.production.backupCount} backups
                  </div>
                </div>
              </div>
            </div>

            {/* Recent Backups List */}
            {recentBackups.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-fg mb-2">Recent Backups</h4>
                <div className="divide-y divide-border">
                  {recentBackups.map((backup) => (
                    <div
                      key={backup.filename}
                      className="py-2 flex items-center justify-between"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-fg truncate">
                          {backup.filename.replace('vibestudio_production_', '').replace('.sql.gz', '')}
                        </p>
                        <p className="text-xs text-muted">
                          {backup.sizeMB.toFixed(1)} MB · {formatRelativeTime(backup.timestamp)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Alerts */}
            {status.production.alerts && status.production.alerts.length > 0 && (
              <div className="mt-4 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded">
                <p className="text-xs font-medium text-red-800 dark:text-red-300">
                  {status.production.alerts.length} alert{status.production.alerts.length !== 1 ? 's' : ''}
                </p>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-8">
            <p className="text-sm text-muted">No backup data available</p>
          </div>
        )}
      </div>
    </div>
  );
}
