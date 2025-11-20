import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

interface CacheDonutChartProps {
  hits: number;
  misses: number;
  hitRate: number;
}

const COLORS = {
  hits: '#10B981', // green-500
  misses: '#EF4444', // red-500
};

export function CacheDonutChart({ hits, misses, hitRate }: CacheDonutChartProps) {
  const data = [
    { name: 'Cache Hits', value: hits, color: COLORS.hits },
    { name: 'Cache Misses', value: misses, color: COLORS.misses },
  ];

  const total = hits + misses;
  const hitRatePercent = (hitRate * 100).toFixed(1);

  return (
    <div className="bg-surface rounded-lg border border-border p-4">
      <h3 className="text-lg font-semibold text-fg mb-4">Cache Performance</h3>
      <div className="relative">
        <ResponsiveContainer width="100%" height={250}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={90}
              paddingAngle={2}
              dataKey="value"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value: number, name: string) => [
                `${value.toLocaleString()} (${((value / total) * 100).toFixed(1)}%)`,
                name,
              ]}
              contentStyle={{
                backgroundColor: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: '0.5rem',
              }}
            />
            <Legend
              verticalAlign="bottom"
              height={36}
              formatter={(value: string) => (
                <span className="text-fg text-sm">{value}</span>
              )}
            />
          </PieChart>
        </ResponsiveContainer>
        {/* Center label */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center -mt-8">
            <div className="text-3xl font-bold text-fg">{hitRatePercent}%</div>
            <div className="text-xs text-muted">Hit Rate</div>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4 mt-4">
        <div className="text-center">
          <div className="text-sm text-muted">Total Hits</div>
          <div className="text-lg font-semibold text-green-600 dark:text-green-400">
            {hits.toLocaleString()}
          </div>
        </div>
        <div className="text-center">
          <div className="text-sm text-muted">Total Misses</div>
          <div className="text-lg font-semibold text-red-600 dark:text-red-400">
            {misses.toLocaleString()}
          </div>
        </div>
      </div>
    </div>
  );
}
