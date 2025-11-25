import React from 'react';
import { motion } from 'framer-motion';
import { ProgressBarProps } from '../../types/workflow-tracking';

/**
 * Animated progress bar component with status-based coloring
 */
export const WorkflowRunProgress: React.FC<ProgressBarProps> = ({
  progress,
  status,
  animated = true,
  height = 'h-2',
}) => {
  const colorClasses = {
    running: 'bg-green-500',
    completed: 'bg-green-600',
    failed: 'bg-red-500',
    paused: 'bg-gray-400',
    pending: 'bg-yellow-500',
    cancelled: 'bg-gray-300',
  };

  const bgColor = colorClasses[status];

  return (
    <div
      className={`w-full bg-gray-200 rounded-full overflow-hidden ${height}`}
      role="progressbar"
      aria-valuenow={progress}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      {animated ? (
        <motion.div
          className={`${bgColor} ${height} rounded-full`}
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.5, ease: 'easeInOut' }}
        />
      ) : (
        <div
          className={`${bgColor} ${height} rounded-full`}
          style={{ width: `${progress}%` }}
        />
      )}
    </div>
  );
};
