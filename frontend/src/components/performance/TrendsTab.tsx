import { TrendsResponse, WeeklyAggregation } from '../../services/metrics.service';
import { EmptyState } from './EmptyState';
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

interface TrendsTabProps {
  trendsData: TrendsResponse[];
  weeklyData: WeeklyAggregation[];
  isLoading: boolean;
}

export function TrendsTab({ trendsData, weeklyData, isLoading }: TrendsTabProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Show empty state if no data
  if (!isLoading && weeklyData.length === 0) {
    return (
      <EmptyState
        title="No Trend Data Available"
        message="There are no metrics to display trends for the selected time period."
        icon="📈"
      />
    );
  }

  // Prepare data for charts from weekly data
  const prepareChartData = () => {
    return weeklyData.map((week) => ({
      week: `W${week.weekNumber}`,
      fullWeek: `${week.year}-W${week.weekNumber}`,
      stories: week.storiesCompleted,
      tokens: week.aggregated.avgTokens || 0,
      cost: week.aggregated.avgCost || 0,
      duration: week.aggregated.avgDuration ? week.aggregated.avgDuration / 60 : 0, // Convert to minutes
      loc: week.aggregated.totalLoc || 0,
      tokensPerLoc: week.aggregated.avgTokensPerLoc || 0,
      locPerPrompt: week.aggregated.avgLocPerPrompt || 0,
      successRate: week.aggregated.successRate || 0,
    })).reverse(); // Reverse to show oldest first
  };

  const chartData = prepareChartData();

  const getTrendBadge = (trend: 'UP' | 'DOWN' | 'STABLE', changePercent: number) => {
    const colors = {
      UP: 'bg-red-100 text-red-800',
      DOWN: 'bg-green-100 text-green-800',
      STABLE: 'bg-gray-100 text-fg',
    };

    const icons = {
      UP: '↑',
      DOWN: '↓',
      STABLE: '→',
    };

    return (
      <span className={`px-2 py-1 rounded text-xs font-medium ${colors[trend]}`}>
        {icons[trend]} {Math.abs(changePercent).toFixed(1)}%
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Trend Summary Cards */}
      {trendsData.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {trendsData.map((trend) => (
            <div key={trend.metric} className="bg-card rounded-lg shadow p-4">
              <div className="text-sm text-muted mb-1 capitalize">{trend.metric} Trend</div>
              <div className="flex items-center justify-between">
                <div className="text-2xl font-bold text-fg">
                  {trend.dataPoints.length > 0
                    ? trend.dataPoints[trend.dataPoints.length - 1].value.toLocaleString()
                    : '-'}
                </div>
                {getTrendBadge(trend.trend, trend.changePercent)}
              </div>
              <div className="text-xs text-muted mt-1">
                {trend.dataPoints.length} data points
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Stories Delivered Over Time */}
      <div className="bg-card rounded-lg shadow p-6">
        <h2 className="text-xl font-bold text-fg mb-4">Stories Delivered Over Time</h2>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="week" />
            <YAxis />
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  return (
                    <div className="bg-card border border-border rounded shadow-lg p-3">
                      <div className="font-semibold">{payload[0].payload.fullWeek}</div>
                      <div className="text-sm text-muted">
                        Stories: <strong>{payload[0].value}</strong>
                      </div>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Legend />
            <Line
              type="monotone"
              dataKey="stories"
              stroke="#3b82f6"
              strokeWidth={2}
              name="Stories Completed"
              dot={{ r: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Cost and Token Trends */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Token Usage Trend */}
        <div className="bg-card rounded-lg shadow p-6">
          <h2 className="text-xl font-bold text-fg mb-4">Token Usage Trend</h2>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="week" />
              <YAxis />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    return (
                      <div className="bg-card border border-border rounded shadow-lg p-3">
                        <div className="font-semibold">{payload[0].payload.fullWeek}</div>
                        <div className="text-sm text-muted">
                          Avg Tokens: <strong>{payload[0].value?.toLocaleString()}</strong>
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Line
                type="monotone"
                dataKey="tokens"
                stroke="#8b5cf6"
                strokeWidth={2}
                name="Avg Tokens"
                dot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Cost Trend */}
        <div className="bg-card rounded-lg shadow p-6">
          <h2 className="text-xl font-bold text-fg mb-4">Cost Trend</h2>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="week" />
              <YAxis />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    return (
                      <div className="bg-card border border-border rounded shadow-lg p-3">
                        <div className="font-semibold">{payload[0].payload.fullWeek}</div>
                        <div className="text-sm text-muted">
                          Avg Cost: <strong>${typeof payload[0].value === 'number' ? payload[0].value.toFixed(2) : payload[0].value}</strong>
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Line
                type="monotone"
                dataKey="cost"
                stroke="#10b981"
                strokeWidth={2}
                name="Avg Cost ($)"
                dot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Efficiency Metrics Trends */}
      <div className="bg-card rounded-lg shadow p-6">
        <h2 className="text-xl font-bold text-fg mb-4">Efficiency Metrics Trends</h2>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="week" />
            <YAxis yAxisId="left" />
            <YAxis yAxisId="right" orientation="right" />
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  return (
                    <div className="bg-card border border-border rounded shadow-lg p-3">
                      <div className="font-semibold mb-1">{payload[0].payload.fullWeek}</div>
                      {payload.map((entry: any, index: number) => (
                        <div key={index} className="text-sm" style={{ color: entry.color }}>
                          {entry.name}: <strong>{entry.value?.toFixed(1)}</strong>
                        </div>
                      ))}
                    </div>
                  );
                }
                return null;
              }}
            />
            <Legend />
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="tokensPerLoc"
              stroke="#ef4444"
              strokeWidth={2}
              name="Tokens/LOC"
              dot={{ r: 4 }}
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="locPerPrompt"
              stroke="#06b6d4"
              strokeWidth={2}
              name="LOC/Prompt"
              dot={{ r: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Success Rate Trend */}
      <div className="bg-card rounded-lg shadow p-6">
        <h2 className="text-xl font-bold text-fg mb-4">Success Rate Trend</h2>
        <ResponsiveContainer width="100%" height={250}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="week" />
            <YAxis domain={[0, 100]} />
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  return (
                    <div className="bg-card border border-border rounded shadow-lg p-3">
                      <div className="font-semibold">{payload[0].payload.fullWeek}</div>
                      <div className="text-sm text-muted">
                        Success Rate: <strong>{typeof payload[0].value === 'number' ? payload[0].value.toFixed(0) : payload[0].value}%</strong>
                      </div>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Line
              type="monotone"
              dataKey="successRate"
              stroke="#10b981"
              strokeWidth={2}
              name="Success Rate (%)"
              dot={{ r: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {chartData.length === 0 && (
        <div className="bg-card rounded-lg shadow p-6">
          <div className="text-center py-8 text-muted">
            No trend data available for the selected period.
          </div>
        </div>
      )}
    </div>
  );
}
