/**
 * Utility functions for formatting analysis data in Code Quality Dashboard
 * BR-Display-1: Timestamp formatting per business requirements
 */

import { formatDistanceToNow, format, differenceInHours } from 'date-fns';
import { AnalysisRunStatus } from '../types/codeQualityTypes';

/**
 * Format analysis timestamp according to BR-Display-1 business rule:
 * - < 1 hour: "X minutes ago"
 * - < 24 hours: "X hours ago"
 * - < 7 days: "Yesterday at HH:MM" or "X days ago"
 * - >= 7 days: "MMM d, yyyy"
 */
export function formatAnalysisTimestamp(timestamp: Date | string): string {
  const date = new Date(timestamp);
  const hoursDiff = differenceInHours(new Date(), date);

  if (hoursDiff < 1) {
    const minutes = Math.max(1, Math.floor((Date.now() - date.getTime()) / 60000));
    return `${minutes} min ago`;
  }

  if (hoursDiff < 24) {
    return formatDistanceToNow(date, { addSuffix: true });
  }

  if (hoursDiff < 168) { // < 7 days
    const days = Math.floor(hoursDiff / 24);
    if (days === 1) return format(date, "'Yesterday at' h:mm a");
    return `${days} days ago`;
  }

  return format(date, 'MMM d, yyyy');
}

/**
 * Get icon, color, and label for analysis status
 * Based on BR-Analysis-1 status definition
 */
export function getAnalysisStatusConfig(status: AnalysisRunStatus) {
  const configs = {
    completed: { icon: 'check_circle', color: 'text-green-500', label: 'Analysis Completed' },
    failed: { icon: 'cancel', color: 'text-red-500', label: 'Analysis Failed' },
    partial: { icon: 'warning', color: 'text-yellow-500', label: 'Partial Analysis' },
    running: { icon: 'pending', color: 'text-blue-500', label: 'Analysis Running' },
    unknown: { icon: 'help_outline', color: 'text-gray-400', label: 'Status Unknown' }
  };

  return configs[status] || configs.unknown;
}

/**
 * Construct commit URL for GitHub/GitLab
 * BR-Commit-1: Link commit if hash available
 */
export function getCommitUrl(commitHash: string, repoUrl?: string): string | undefined {
  if (!repoUrl || !commitHash) return undefined;

  const normalizedUrl = repoUrl.replace(/\.git$/, '');

  if (normalizedUrl.includes('github.com')) {
    return `${normalizedUrl}/commit/${commitHash}`;
  }

  if (normalizedUrl.includes('gitlab.com')) {
    return `${normalizedUrl}/-/commit/${commitHash}`;
  }

  // Generic fallback
  return `${normalizedUrl}/commit/${commitHash}`;
}

/**
 * Get test status icon and color based on results
 * From designerAnalysis specifications
 */
export function getTestStatusIcon(passing: number, total: number) {
  if (total === 0) return { icon: 'help_outline', color: 'text-gray-400' };
  if (passing === total) return { icon: 'check_circle', color: 'text-green-500' };
  if (passing === 0) return { icon: 'cancel', color: 'text-red-500' };
  return { icon: 'warning', color: 'text-yellow-500' };
}
