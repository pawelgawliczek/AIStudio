/**
 * Metric Summary Card Component
 * Reusable KPI card for displaying code quality metrics
 * Redesigned to match PerformanceDashboard aesthetic
 */

import React from 'react';
import { TrendingUpIcon, TrendingDownIcon, InfoIcon } from './Icons';

interface MetricsSummaryCardProps {
  title: string;
  value: string | number;
  unit?: string;
  change?: number;
  infoText?: string;
  invertColor?: boolean; // For metrics where decrease is good (e.g., complexity, tech debt)
}

export const MetricsSummaryCard: React.FC<MetricsSummaryCardProps> = ({
  title,
  value,
  unit = '',
  change,
  infoText,
  invertColor = false,
}) => {
  // Determine if change is positive (good) or negative (bad)
  const isPositive = change !== undefined && change !== 0
    ? (invertColor ? change < 0 : change > 0)
    : null;

  const trendColor = isPositive === null
    ? 'text-gray-500 dark:text-gray-400'
    : (isPositive ? 'text-green-500' : 'text-red-500');

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{title}</p>
        {infoText && (
          <div className="text-gray-400 dark:text-gray-500 cursor-help" title={infoText}>
            <InfoIcon />
          </div>
        )}
      </div>
      <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-white">
        {typeof value === 'number' ? value.toLocaleString() : value}
        {unit}
      </p>
      {change !== undefined && (
        <div className="mt-4 flex items-center gap-2 text-sm">
          <span className={trendColor}>
            {isPositive ? <TrendingUpIcon /> : (isPositive === false ? <TrendingDownIcon /> : null)}
          </span>
          <span className="text-gray-500 dark:text-gray-400">
            {change > 0 ? '+' : ''}
            {change.toFixed(1)}% vs last period
          </span>
        </div>
      )}
    </div>
  );
};
