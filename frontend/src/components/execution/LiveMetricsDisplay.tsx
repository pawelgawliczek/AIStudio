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
} from '@mui/icons-material';

interface Metrics {
  totalTokens: number | null;
  totalCost: number | null;
  totalDuration: number | null;
  totalUserPrompts: number | null;
  totalIterations: number | null;
  totalInterventions: number | null;
  totalLocGenerated: number | null;
  totalTestsAdded: number | null;
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

  const MetricCard = ({ icon, label, value, color = 'primary' }: any) => (
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
        <Typography variant="caption" color="text.secondary">
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

      {/* Metrics Grid */}
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
            icon={<AccessTime />}
            label="Duration"
            value={formatDuration(metrics.totalDuration)}
            color="info"
          />
        </div>
        <div>
          <MetricCard
            icon={<Token />}
            label="Tokens"
            value={formatNumber(metrics.totalTokens)}
            color="primary"
          />
        </div>
        <div>
          <MetricCard
            icon={<AttachMoney />}
            label="Cost"
            value={formatCost(metrics.totalCost)}
            color="warning"
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
        <div>
          <MetricCard
            icon={<ChatBubbleOutline />}
            label="User Prompts"
            value={formatNumber(metrics.totalUserPrompts)}
            color="secondary"
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
      </div>
    </Box>
  );
};

export default LiveMetricsDisplay;
