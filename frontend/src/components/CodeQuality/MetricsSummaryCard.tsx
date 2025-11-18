/**
 * Metric Summary Card Component
 * Reusable KPI card for displaying code quality metrics
 */

import React from 'react';
import {
  getHealthColor,
  getTrendIcon,
  getTrendColor,
  formatPercentageChange,
} from '../../utils/codeQuality/healthCalculations';

interface MetricsSummaryCardProps {
  title: string;
  value: string | number;
  trend?: {
    direction: 'improving' | 'stable' | 'declining';
    value: number;
  };
  icon?: string;
  healthScore?: number;
}

export const MetricsSummaryCard: React.FC<MetricsSummaryCardProps> = ({
  title,
  value,
  trend,
  icon,
  healthScore,
}) => {
  const cardClasses = healthScore
    ? `${getHealthColor(healthScore)} border-2`
    : 'bg-white dark:bg-[#1A202C] border border-gray-200 dark:border-[#3b4354]';

  return (
    <div
      className={`${cardClasses} rounded-xl p-5 hover:shadow-lg hover:-translate-y-1 transition-all duration-200`}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-gray-500 dark:text-[#9da6b9] text-sm font-medium">
          {title}
        </span>
        {icon && (
          <span className="material-symbols-outlined text-gray-400 text-xl">
            {icon}
          </span>
        )}
      </div>
      <div className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
        {value}
      </div>
      {trend && (
        <div className={`flex items-center text-sm ${getTrendColor(trend.direction)}`}>
          <span className="material-symbols-outlined text-base mr-1">
            {getTrendIcon(trend.direction)}
          </span>
          <span>{formatPercentageChange(trend.value)}</span>
        </div>
      )}
    </div>
  );
};
