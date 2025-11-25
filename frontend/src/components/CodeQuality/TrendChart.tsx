/**
 * Trend Chart Component
 * Beautiful line charts using Recharts library
 * Matching the style from PerformanceDashboard
 */

import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface TrendChartProps {
  title?: string;
  subtitle?: string;
  data: Array<{
    date: string;
    value: number;
    [key: string]: string | number;
  }>;
  dataKey?: string;
  height?: number;
  color?: string;
  stroke?: string;
  fill?: string;
  yAxisDomain?: [number | string, number | string];
  children?: React.ReactNode;
}

export const TrendChart: React.FC<TrendChartProps> = ({
  title,
  subtitle,
  data,
  dataKey = 'value',
  height = 256,
  color = '#135bec',
  stroke,
  fill,
  yAxisDomain,
  children,
}) => {
  // Format date for X axis
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return `${date.getMonth() + 1}/${date.getDate()}`;
  };

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6">
      {title && <p className="font-semibold text-gray-900 dark:text-white">{title}</p>}
      {subtitle && (
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{subtitle}</p>
      )}
      <div className="mt-4 w-full" style={{ height: `${height}px` }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            {children}
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
            <XAxis
              dataKey="date"
              tickFormatter={formatDate}
              stroke="#9CA3AF"
              fontSize={12}
            />
            <YAxis stroke="#9CA3AF" fontSize={12} domain={yAxisDomain} />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1F2937',
                border: 'none',
                borderRadius: '8px',
                color: '#F9FAFB',
              }}
              labelFormatter={(label) => new Date(label).toLocaleDateString()}
            />
            <Legend />
            <Line
              type="monotone"
              dataKey={dataKey}
              stroke={stroke || color}
              fill={fill}
              strokeWidth={3}
              dot={{ fill: stroke || color, strokeWidth: 2 }}
              activeDot={{ r: 8 }}
              name={title}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
