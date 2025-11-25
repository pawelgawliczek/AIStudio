import React from 'react';
import { OverflowIndicatorProps } from '../../types/workflow-tracking';

/**
 * Overflow indicator showing "+X more" runs
 */
export const WorkflowRunOverflow: React.FC<OverflowIndicatorProps> = ({
  count,
  onClick,
}) => {
  if (count <= 0) return null;

  return (
    <button
      onClick={onClick}
      className="flex items-center justify-center px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors text-sm font-medium text-gray-700"
      title={`Show ${count} more workflow runs`}
    >
      +{count} more
    </button>
  );
};
