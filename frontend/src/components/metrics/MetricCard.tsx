import React from 'react';

interface MetricCardProps {
  title: string;
  value: string | number;
  unit?: string;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  description?: string;
  color?: 'green' | 'red' | 'blue' | 'amber' | 'purple';
  size?: 'small' | 'medium' | 'large';
}

const colorClasses = {
  green: 'border-green-200 dark:border-green-800',
  red: 'border-red-200 dark:border-red-800',
  blue: 'border-blue-200 dark:border-blue-800',
  amber: 'border-amber-200 dark:border-amber-800',
  purple: 'border-purple-200 dark:border-purple-800',
};

const trendColors = {
  up: 'text-green-600 dark:text-green-400',
  down: 'text-red-600 dark:text-red-400',
  neutral: 'text-gray-600 dark:text-gray-400',
};

const trendIcons = {
  up: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
    </svg>
  ),
  down: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
    </svg>
  ),
  neutral: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14" />
    </svg>
  ),
};

export function MetricCard({
  title,
  value,
  unit,
  trend,
  trendValue,
  description,
  color = 'blue',
  size = 'medium',
}: MetricCardProps) {
  const sizeClasses = {
    small: 'p-3',
    medium: 'p-4',
    large: 'p-6',
  };

  const valueSizeClasses = {
    small: 'text-xl',
    medium: 'text-2xl',
    large: 'text-3xl',
  };

  return (
    <div
      className={`
        bg-surface rounded-lg border-2 ${colorClasses[color]}
        ${sizeClasses[size]} transition-all hover:shadow-md
      `}
    >
      <div className="flex justify-between items-start mb-2">
        <h3 className="text-sm font-medium text-muted">{title}</h3>
        {trend && (
          <div className={`flex items-center space-x-1 ${trendColors[trend]}`}>
            {trendIcons[trend]}
            {trendValue && <span className="text-xs font-medium">{trendValue}</span>}
          </div>
        )}
      </div>
      <div className="flex items-baseline space-x-1">
        <span className={`${valueSizeClasses[size]} font-bold text-fg`}>
          {typeof value === 'number' ? value.toLocaleString() : value}
        </span>
        {unit && <span className="text-sm text-muted">{unit}</span>}
      </div>
      {description && (
        <p className="mt-2 text-xs text-muted">{description}</p>
      )}
    </div>
  );
}
