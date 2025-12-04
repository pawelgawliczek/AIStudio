/**
 * Status color mapping utilities
 * ST-168: Workflow State Visualization
 */

import { StateStatus } from '../types';

export const getStatusClasses = (status: StateStatus): string => {
  const baseClasses = 'px-2 py-1 rounded text-xs font-medium';

  switch (status) {
    case 'completed':
      return `${baseClasses} bg-green-500/20 text-green-400`;
    case 'running':
      return `${baseClasses} bg-blue-500/20 text-blue-400 animate-pulse`;
    case 'failed':
      return `${baseClasses} bg-red-500/20 text-red-400`;
    case 'pending':
      return `${baseClasses} bg-muted/20 text-muted`;
    case 'paused':
      return `${baseClasses} bg-yellow-500/20 text-yellow-400`;
    default:
      return `${baseClasses} bg-muted/20 text-muted`;
  }
};

export const getStatusIcon = (status: StateStatus): string => {
  switch (status) {
    case 'completed':
      return '✓';
    case 'running':
      return '▶▶';
    case 'failed':
      return '✗';
    case 'pending':
      return '○';
    case 'paused':
      return '⏸';
    default:
      return '○';
  }
};

export const getStatusLabel = (status: StateStatus): string => {
  return status.toUpperCase();
};
