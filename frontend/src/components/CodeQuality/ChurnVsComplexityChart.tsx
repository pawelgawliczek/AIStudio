/**
 * Churn vs Complexity Scatter Chart Component
 * Scatter plot showing relationship between churn rate and complexity
 */

import React from 'react';
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ZAxis,
} from 'recharts';
import { FileHotspot } from '../../types/codeQualityTypes';

interface ChurnVsComplexityChartProps {
  hotspots: FileHotspot[];
}

export const ChurnVsComplexityChart: React.FC<ChurnVsComplexityChartProps> = ({
  hotspots,
}) => {
  // Transform hotspots data for scatter chart
  const data = hotspots.map(h => ({
    x: h.churnCount || 0,
    y: h.complexity || 0,
    z: h.riskScore || 0,
    filePath: h.filePath,
    loc: h.loc || 0,
  }));

  // Color based on risk score
  const getColor = (riskScore: number) => {
    if (riskScore > 7) return '#ef4444'; // Critical - Red
    if (riskScore > 5) return '#f97316'; // High - Orange
    if (riskScore > 3) return '#eab308'; // Medium - Yellow
    return '#22c55e'; // Low - Green
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-3 shadow-lg">
          <p className="text-white font-medium text-sm mb-2 truncate max-w-xs">
            {data.filePath.split('/').pop()}
          </p>
          <p className="text-gray-300 text-xs">Churn: {data.x} commits</p>
          <p className="text-gray-300 text-xs">Complexity: {data.y}</p>
          <p className="text-gray-300 text-xs">Risk Score: {data.z.toFixed(1)}</p>
          <p className="text-gray-300 text-xs">LOC: {data.loc}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <ResponsiveContainer width="100%" height="100%">
      <ScatterChart
        margin={{ top: 20, right: 20, bottom: 20, left: 20 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
        <XAxis
          type="number"
          dataKey="x"
          name="Churn Rate"
          stroke="#9CA3AF"
          fontSize={12}
          label={{ value: 'Churn (commits)', position: 'bottom', fill: '#9CA3AF', fontSize: 12 }}
        />
        <YAxis
          type="number"
          dataKey="y"
          name="Complexity"
          stroke="#9CA3AF"
          fontSize={12}
          label={{ value: 'Complexity', angle: -90, position: 'left', fill: '#9CA3AF', fontSize: 12 }}
        />
        <ZAxis type="number" dataKey="z" range={[50, 400]} />
        <Tooltip content={<CustomTooltip />} />
        <Scatter data={data} fill="#8884d8">
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={getColor(entry.z)} />
          ))}
        </Scatter>
      </ScatterChart>
    </ResponsiveContainer>
  );
};
