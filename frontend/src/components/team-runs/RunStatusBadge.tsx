import { RunStatus } from '../../services/workflow-runs.service';

interface RunStatusBadgeProps {
  status: RunStatus;
}

export function RunStatusBadge({ status }: RunStatusBadgeProps) {
  const getStatusConfig = (status: RunStatus) => {
    switch (status) {
      case RunStatus.COMPLETED:
        return {
          label: 'Completed',
          icon: '✓',
          className: 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300',
        };
      case RunStatus.RUNNING:
        return {
          label: 'In Progress',
          icon: '⏸',
          className: 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300',
        };
      case RunStatus.FAILED:
        return {
          label: 'Failed',
          icon: '✗',
          className: 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300',
        };
      case RunStatus.PENDING:
        return {
          label: 'Pending',
          icon: '⚪',
          className: 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-300',
        };
      case RunStatus.CANCELLED:
        return {
          label: 'Cancelled',
          icon: '🚫',
          className: 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300',
        };
      default:
        return {
          label: status,
          icon: '⚪',
          className: 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-300',
        };
    }
  };

  const config = getStatusConfig(status);

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full ${config.className}`}>
      <span>{config.icon}</span>
      <span>{config.label}</span>
    </span>
  );
}
