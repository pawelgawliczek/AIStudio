import React from 'react';
import { StatusIconProps } from '../../types/workflow-tracking';

/**
 * Status icon component with color coding
 * Green (running/completed), Yellow (pending/queued), Red (failed), Gray (paused/cancelled)
 */
export const WorkflowStatusIcon: React.FC<StatusIconProps> = ({
  status,
  size = 'md',
  className = '',
}) => {
  const sizeClasses = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
  };

  const statusConfig = {
    running: {
      color: 'text-green-500',
      icon: '●',
      title: 'Running',
    },
    completed: {
      color: 'text-green-500',
      icon: '✓',
      title: 'Completed',
    },
    failed: {
      color: 'text-red-500',
      icon: '✗',
      title: 'Failed',
    },
    paused: {
      color: 'text-gray-500',
      icon: '⏸',
      title: 'Paused',
    },
    pending: {
      color: 'text-yellow-500',
      icon: '○',
      title: 'Pending',
    },
    cancelled: {
      color: 'text-gray-400',
      icon: '⊗',
      title: 'Cancelled',
    },
  };

  const config = statusConfig[status];

  return (
    <span
      data-testid="status-icon"
      className={`${config.color} ${sizeClasses[size]} flex items-center justify-center font-bold ${className}`}
      title={config.title}
      aria-label={config.title}
    >
      {config.icon}
    </span>
  );
};
