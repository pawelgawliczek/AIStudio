import { Refresh as RefreshIcon } from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { BackupsTable } from '../components/BackupsTable';
import { RestoreBackupModal } from '../components/RestoreBackupModal';
import {
  backupsService,
  BackupInfo,
} from '../services/backups.service';

export function BackupsPage() {
  const queryClient = useQueryClient();
  const [selectedBackup, setSelectedBackup] = useState<BackupInfo | null>(null);
  const [isRestoreModalOpen, setIsRestoreModalOpen] = useState(false);
  const [environmentFilter, setEnvironmentFilter] = useState<string>('production');

  const {
    data: statusData,
    isLoading: isStatusLoading,
    refetch: refetchStatus,
  } = useQuery({
    queryKey: ['backup-status'],
    queryFn: () => backupsService.getStatus(),
    refetchInterval: 60000, // Refresh every minute
  });

  const {
    data: backupsData,
    isLoading: isBackupsLoading,
    refetch: refetchBackups,
    isFetching,
  } = useQuery({
    queryKey: ['backups', environmentFilter],
    queryFn: () =>
      backupsService.listBackups({
        environment: environmentFilter,
        limit: 100,
      }),
  });

  const createBackupMutation = useMutation({
    mutationFn: () => backupsService.runBackup('production'),
    onSuccess: (data) => {
      toast.success(
        `Backup created successfully: ${data.backupFile} (${data.sizeMB.toFixed(2)} MB)`
      );
      queryClient.invalidateQueries({ queryKey: ['backups'] });
      queryClient.invalidateQueries({ queryKey: ['backup-status'] });
    },
    onError: (error: any) => {
      toast.error(`Failed to create backup: ${error.message || 'Unknown error'}`);
    },
  });

  const restoreBackupMutation = useMutation({
    mutationFn: (backupFile: string) =>
      backupsService.restoreBackup(backupFile, true),
    onSuccess: (data) => {
      toast.success(
        `Backup restored successfully! ${data.tablesRestored} tables restored in ${(data.duration / 1000).toFixed(1)}s`
      );
      setIsRestoreModalOpen(false);
      setSelectedBackup(null);
      queryClient.invalidateQueries({ queryKey: ['backup-status'] });
    },
    onError: (error: any) => {
      toast.error(`Failed to restore backup: ${error.message || 'Unknown error'}`);
    },
  });

  const backups = backupsData?.backups || [];
  const status = statusData?.production;

  const handleRefresh = () => {
    refetchStatus();
    refetchBackups();
  };

  const handleCreateBackup = () => {
    if (window.confirm('Create a new production database backup?')) {
      createBackupMutation.mutate();
    }
  };

  const handleRestoreClick = (backup: BackupInfo) => {
    setSelectedBackup(backup);
    setIsRestoreModalOpen(true);
  };

  const handleRestoreConfirm = (backupFile: string) => {
    restoreBackupMutation.mutate(backupFile);
  };

  return (
    <div className="container mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-fg">Backups</h1>
          <p className="mt-1 text-sm text-muted">
            Database backup management and restore operations
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleRefresh}
            disabled={isFetching}
            className="inline-flex items-center gap-2 px-4 py-2 border border-border rounded-lg text-sm font-medium text-fg bg-card hover:bg-bg-secondary disabled:opacity-50 transition-colors"
          >
            <RefreshIcon className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={handleCreateBackup}
            disabled={createBackupMutation.isPending}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:opacity-50 transition-colors"
          >
            {createBackupMutation.isPending ? 'Creating...' : 'Create Backup'}
          </button>
        </div>
      </div>

      {/* Status Card */}
      {status && (
        <div className="mb-6 bg-card rounded-lg shadow border border-border p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-fg">Backup Health</h2>
            <span
              className={`px-3 py-1 text-sm font-medium rounded-full ${
                status.healthy
                  ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
                  : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300'
              }`}
            >
              {status.healthy ? 'Healthy' : 'Unhealthy'}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <dt className="text-sm text-muted">Last Backup</dt>
              <dd className="mt-1 text-lg font-semibold text-fg">
                {status.lastBackupTime
                  ? new Date(status.lastBackupTime).toLocaleString()
                  : 'Never'}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-muted">Hours Since Last Backup</dt>
              <dd className="mt-1 text-lg font-semibold text-fg">
                {status.hoursSinceLastBackup !== null
                  ? Math.round(status.hoursSinceLastBackup)
                  : '-'}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-muted">Total Backups</dt>
              <dd className="mt-1 text-lg font-semibold text-fg">
                {status.backupCount}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-muted">Total Size</dt>
              <dd className="mt-1 text-lg font-semibold text-fg">
                {(status.totalSizeMB / 1024).toFixed(2)} GB
              </dd>
            </div>
          </div>

          {status.alerts && status.alerts.length > 0 && (
            <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-sm font-medium text-red-800 dark:text-red-300">
                Alerts:
              </p>
              <ul className="mt-1 text-sm text-red-700 dark:text-red-400 list-disc list-inside">
                {status.alerts.map((alert, index) => (
                  <li key={index}>{alert}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Environment Filter */}
      <div className="mb-4 flex items-center gap-4">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-fg">Environment:</label>
          <select
            value={environmentFilter}
            onChange={(e) => setEnvironmentFilter(e.target.value)}
            className="px-3 py-2 border border-border rounded-lg bg-card text-fg focus:ring-2 focus:ring-ring focus:border-accent"
          >
            <option value="all">All Environments</option>
            <option value="production">Production</option>
            <option value="development">Development</option>
            <option value="legacy">Legacy</option>
          </select>
        </div>
      </div>

      {/* Results count */}
      <div className="mb-4 text-sm text-muted">
        {isBackupsLoading ? (
          <span>Loading backups...</span>
        ) : (
          <span>
            Found {backups.length} backup{backups.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Backups Table */}
      <BackupsTable
        backups={backups}
        isLoading={isBackupsLoading}
        onRestore={handleRestoreClick}
        emptyMessage="No backups found for selected environment"
      />

      {/* Restore Modal */}
      <RestoreBackupModal
        backup={selectedBackup}
        isOpen={isRestoreModalOpen}
        onClose={() => {
          setIsRestoreModalOpen(false);
          setSelectedBackup(null);
        }}
        onConfirm={handleRestoreConfirm}
        isLoading={restoreBackupMutation.isPending}
      />
    </div>
  );
}
