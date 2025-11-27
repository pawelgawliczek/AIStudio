import { BackupInfo } from '../services/backups.service';

interface BackupsTableProps {
  backups: BackupInfo[];
  isLoading?: boolean;
  onRestore: (backup: BackupInfo) => void;
  emptyMessage?: string;
}

export function BackupsTable({
  backups,
  isLoading = false,
  onRestore,
  emptyMessage = 'No backups found',
}: BackupsTableProps) {
  const formatSize = (sizeMB: number) => {
    if (sizeMB < 1) return `${Math.round(sizeMB * 1024)} KB`;
    if (sizeMB > 1024) return `${(sizeMB / 1024).toFixed(2)} GB`;
    return `${sizeMB.toFixed(2)} MB`;
  };

  const formatAge = (ageHours: number) => {
    if (ageHours < 1) return `${Math.round(ageHours * 60)} mins`;
    if (ageHours < 24) return `${Math.round(ageHours)} hours`;
    const days = Math.floor(ageHours / 24);
    return `${days} day${days !== 1 ? 's' : ''}`;
  };

  const getEnvironmentColor = (environment: string) => {
    switch (environment) {
      case 'production':
        return 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300';
      case 'development':
        return 'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-800 dark:text-cyan-300';
      case 'legacy':
        return 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-300';
      default:
        return 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-300';
    }
  };

  if (isLoading) {
    return (
      <div className="bg-card rounded-lg shadow border border-border overflow-hidden">
        <div className="flex justify-center items-center p-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-fg"></div>
        </div>
      </div>
    );
  }

  if (backups.length === 0) {
    return (
      <div className="bg-card rounded-lg shadow border border-border overflow-hidden">
        <div className="p-12 text-center">
          <svg
            className="mx-auto h-12 w-12 text-muted"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"
            />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-fg">{emptyMessage}</h3>
          <p className="mt-1 text-sm text-muted">
            No backup files found in the backup directory.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-lg shadow border border-border overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-border">
          <thead className="bg-bg-secondary">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">
                Filename
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">
                Environment
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">
                Size
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">
                Age
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">
                Created
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-muted uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-card divide-y divide-border">
            {backups.map((backup) => (
              <tr
                key={backup.filename}
                className="hover:bg-bg-secondary transition-colors"
              >
                <td className="px-6 py-4 text-sm font-medium text-fg">
                  <div className="max-w-xs truncate" title={backup.filename}>
                    {backup.filename}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span
                    className={`px-2 py-1 text-xs font-medium rounded ${getEnvironmentColor(backup.environment)}`}
                  >
                    {backup.environment}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-muted">
                  {formatSize(backup.sizeMB)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-muted">
                  {formatAge(backup.ageHours)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-muted">
                  {backup.createdAt
                    ? new Date(backup.createdAt).toLocaleString()
                    : backup.timestamp}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                  <button
                    onClick={() => onRestore(backup)}
                    className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 font-medium"
                  >
                    Restore
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
