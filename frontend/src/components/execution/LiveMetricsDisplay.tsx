import React from 'react';
import { Box, Paper, Typography, Chip, LinearProgress, Grid } from '@mui/material';
import {
  AccessTime,
  Token,
  AttachMoney,
  ChatBubbleOutline,
  Loop,
  CheckCircle,
  Code,
  Science,
  CachedOutlined,
  TrendingUp,
  Speed,
  Input,
  Output,
} from '@mui/icons-material';

interface Metrics {
  totalTokens: number | null;
  // ST-27 Token Breakdown
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCacheRead: number;
  totalCacheWrite: number;
  // Cache Performance
  totalCacheHits: number;
  totalCacheMisses: number;
  avgCacheHitRate: number;
  // Cost Metrics
  totalCost: number | null;
  costPerLOC: number;
  // Code Impact
  totalLinesAdded: number;
  totalLinesDeleted: number;
  totalLinesModified: number;
  totalLocGenerated: number | null;
  totalTestsAdded: number | null;
  // Efficiency Ratios
  tokensPerLOC: number;
  // Execution Metrics
  totalDuration: number | null;
  totalUserPrompts: number | null;
  totalIterations: number | null;
  totalInterventions: number | null;
  componentsCompleted: number;
  componentsTotal: number;
  percentComplete: number;
}

interface LiveMetricsDisplayProps {
  metrics: Metrics;
  status: string;
}

const LiveMetricsDisplay: React.FC<LiveMetricsDisplayProps> = ({ metrics, status }) => {
  const formatDuration = (seconds: number | null) => {
    if (!seconds) return 'N/A';
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}m ${secs}s`;
  };

  const formatCost = (cost: number | null) => {
    if (!cost) return '$0.00';
    return `$${cost.toFixed(4)}`;
  };

  const formatNumber = (num: number | null) => {
    if (num === null) return '0';
    return num.toLocaleString();
  };

  const MetricCard = ({ icon, label, value, color = 'primary', tooltip }: any) => (
    <Paper
      elevation={0}
      sx={{
        p: 2,
        border: 1,
        borderColor: 'divider',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: 1,
      }}
    >
      <Box display="flex" alignItems="center" gap={1}>
        {React.cloneElement(icon, { fontSize: 'small', color })}
        <Typography
          variant="caption"
          color="text.secondary"
          title={tooltip}
          sx={{ cursor: tooltip ? 'help' : 'default' }}
        >
          {label}
        </Typography>
      </Box>
      <Typography variant="h5" fontWeight="bold">
        {value}
      </Typography>
    </Paper>
  );

  return (
    <Box>
      {/* Progress Bar */}
      {status === 'running' && (
        <Box mb={3}>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
            <Typography variant="body2" fontWeight="medium">
              Overall Progress
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {metrics.componentsCompleted} / {metrics.componentsTotal} components (
              {metrics.percentComplete}%)
            </Typography>
          </Box>
          <LinearProgress
            variant="determinate"
            value={metrics.percentComplete}
            sx={{ height: 8, borderRadius: 4 }}
          />
        </Box>
      )}

      {/* Token Metrics Section */}
      <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1, mt: 2 }}>
        Token Usage
      </Typography>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-4">
        <div>
          <MetricCard
            icon={<Token />}
            label="Total Tokens"
            value={formatNumber(metrics.totalTokens)}
            color="primary"
          />
        </div>
        <div>
          <MetricCard
            icon={<Input />}
            label="Input Tokens"
            value={formatNumber(metrics.totalInputTokens)}
            color="info"
          />
        </div>
        <div>
          <MetricCard
            icon={<Output />}
            label="Output Tokens"
            value={formatNumber(metrics.totalOutputTokens)}
            color="secondary"
          />
        </div>
        <div>
          <MetricCard
            icon={<CachedOutlined />}
            label="Cache Read"
            value={formatNumber(metrics.totalCacheRead)}
            color="success"
          />
        </div>
        <div>
          <MetricCard
            icon={<Speed />}
            label="Cache Hit Rate"
            value={`${(metrics.avgCacheHitRate * 100).toFixed(1)}%`}
            color="success"
          />
        </div>
      </div>

      {/* Efficiency & Cost Section */}
      <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
        Efficiency & Cost
      </Typography>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-4">
        <div>
          <MetricCard
            icon={<TrendingUp />}
            label="Tokens / LOC"
            value={metrics.tokensPerLOC > 0 ? metrics.tokensPerLOC.toFixed(1) : 'N/A'}
            color="primary"
          />
        </div>
        <div>
          <MetricCard
            icon={<AttachMoney />}
            label="Total Cost"
            value={formatCost(metrics.totalCost)}
            color="warning"
          />
        </div>
        <div>
          <MetricCard
            icon={<AttachMoney />}
            label="Cost / LOC"
            value={metrics.costPerLOC > 0 ? `$${metrics.costPerLOC.toFixed(4)}` : 'N/A'}
            color="warning"
          />
        </div>
        <div>
          <MetricCard
            icon={<AccessTime />}
            label="Duration"
            value={formatDuration(metrics.totalDuration)}
            color="info"
          />
        </div>
      </div>

      {/* Code Impact Section */}
      <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
        Code Impact
      </Typography>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-4">
        <div>
          <MetricCard
            icon={<Code />}
            label="Lines Added"
            value={formatNumber(metrics.totalLinesAdded)}
            color="success"
          />
        </div>
        <div>
          <MetricCard
            icon={<Code />}
            label="Lines Modified"
            value={formatNumber(metrics.totalLinesModified)}
            color="info"
          />
        </div>
        <div>
          <MetricCard
            icon={<Code />}
            label="Lines Deleted"
            value={formatNumber(metrics.totalLinesDeleted)}
            color="error"
          />
        </div>
        <div>
          <MetricCard
            icon={<Code />}
            label="LOC Generated"
            value={formatNumber(metrics.totalLocGenerated)}
            color="success"
          />
        </div>
        <div>
          <MetricCard
            icon={<Science />}
            label="Tests Added"
            value={formatNumber(metrics.totalTestsAdded)}
            color="info"
          />
        </div>
      </div>

      {/* Execution Metrics Section */}
      <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
        Execution Metrics
      </Typography>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        <div>
          <MetricCard
            icon={<CheckCircle />}
            label="Components"
            value={`${metrics.componentsCompleted}/${metrics.componentsTotal}`}
            color="success"
          />
        </div>
        <div>
          <MetricCard
            icon={<ChatBubbleOutline />}
            label="Human Prompts"
            value={formatNumber(metrics.totalUserPrompts)}
            color="secondary"
            tooltip="Live count of human interventions during workflow execution"
          />
        </div>
        <div>
          <MetricCard
            icon={<Loop />}
            label="Iterations"
            value={formatNumber(metrics.totalIterations)}
            color="info"
          />
        </div>
        <div>
          <MetricCard
            icon={<Loop />}
            label="Interventions"
            value={formatNumber(metrics.totalInterventions)}
            color="warning"
          />
        </div>
      </div>
    </Box>
  );
};

export default LiveMetricsDisplay;
