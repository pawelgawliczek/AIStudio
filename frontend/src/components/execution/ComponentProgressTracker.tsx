import { CheckCircle, Error, HourglassEmpty, PlayArrow } from '@mui/icons-material';
import {
  Box,
  Paper,
  Typography,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Chip,
  Divider,
} from '@mui/material';
import React from 'react';

interface ComponentRun {
  componentRunId: string;
  componentName: string;
  status: string;
  startedAt: string;
  completedAt?: string;
  durationSeconds?: number;
  tokensUsed?: number;
  // ST-27 Enhanced Metrics
  tokensInput?: number;
  tokensOutput?: number;
  tokensCacheRead?: number;
  tokensCacheWrite?: number;
  cacheHits?: number;
  cacheMisses?: number;
  cacheHitRate?: number;
  // Quality & Behavior
  userPrompts: number;
  systemIterations?: number;
  humanInterventions?: number;
  errorRate?: number;
  successRate?: number;
  // Code Impact
  linesAdded?: number;
  linesDeleted?: number;
  linesModified?: number;
  locGenerated?: number;
  testsAdded?: number;
  filesModified?: string[];
  // Cost & Performance
  cost?: number;
  costBreakdown?: any;
  tokensPerSecond?: number;
  timeToFirstToken?: number;
  modelId?: string;
  temperature?: number;
  // Tool Usage
  toolBreakdown?: any;
  // Artifacts & Content
  artifacts: any[];
  inputData?: any;
  outputData?: any;
}

interface ComponentProgressTrackerProps {
  componentRuns: ComponentRun[];
  totalComponents: number;
}

const ComponentProgressTracker: React.FC<ComponentProgressTrackerProps> = ({
  componentRuns,
  totalComponents,
}) => {
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle fontSize="small" color="success" />;
      case 'failed':
        return <Error fontSize="small" color="error" />;
      case 'running':
        return <PlayArrow fontSize="small" color="primary" />;
      default:
        return <HourglassEmpty fontSize="small" color="disabled" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'success';
      case 'failed':
        return 'error';
      case 'running':
        return 'primary';
      default:
        return 'default';
    }
  };

  const formatDuration = (seconds: number | undefined) => {
    if (!seconds) return 'N/A';
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}m ${secs}s`;
  };

  if (componentRuns.length === 0) {
    return (
      <Paper sx={{ p: 3, mt: 3 }}>
        <Typography variant="body2" color="text.secondary">
          No components executed yet. Waiting for execution to start...
        </Typography>
      </Paper>
    );
  }

  return (
    <Paper sx={{ p: 3, mt: 3 }}>
      <Typography variant="h6" gutterBottom>
        Component Execution Progress
      </Typography>
      <Divider sx={{ mb: 2 }} />

      <Stepper orientation="vertical" activeStep={componentRuns.length}>
        {componentRuns.map((componentRun, index) => (
          <Step key={componentRun.componentRunId} active completed={componentRun.status !== 'running'}>
            <StepLabel
              StepIconComponent={() => getStatusIcon(componentRun.status)}
              optional={
                <Box display="flex" gap={1} alignItems="center" mt={0.5}>
                  <Chip
                    label={componentRun.status}
                    size="small"
                    color={getStatusColor(componentRun.status) as any}
                    sx={{ height: 20, fontSize: '0.7rem' }}
                  />
                  {componentRun.durationSeconds && (
                    <Typography variant="caption" color="text.secondary">
                      {formatDuration(componentRun.durationSeconds)}
                    </Typography>
                  )}
                </Box>
              }
            >
              <Typography fontWeight="medium">{componentRun.componentName}</Typography>
            </StepLabel>
            <StepContent>
              <Box pl={2}>
                {/* Token Breakdown */}
                <Box display="flex" gap={2} flexWrap="wrap" mb={0.5}>
                  {componentRun.tokensInput !== undefined && (
                    <Typography variant="caption" color="primary.main">
                      In: {componentRun.tokensInput.toLocaleString()}
                    </Typography>
                  )}
                  {componentRun.tokensOutput !== undefined && (
                    <Typography variant="caption" color="secondary.main">
                      Out: {componentRun.tokensOutput.toLocaleString()}
                    </Typography>
                  )}
                  {componentRun.tokensCacheRead !== undefined && componentRun.tokensCacheRead > 0 && (
                    <Typography variant="caption" color="success.main">
                      Cached: {componentRun.tokensCacheRead.toLocaleString()}
                    </Typography>
                  )}
                  {componentRun.cacheHitRate !== undefined && (
                    <Typography variant="caption" color="text.secondary">
                      ({(componentRun.cacheHitRate * 100).toFixed(0)}% cache)
                    </Typography>
                  )}
                </Box>
                {/* Other Metrics */}
                <Box display="flex" gap={2} flexWrap="wrap">
                  {componentRun.userPrompts > 0 && (
                    <Typography variant="caption" color="text.secondary">
                      Prompts: {componentRun.userPrompts}
                    </Typography>
                  )}
                  {componentRun.systemIterations !== undefined && componentRun.systemIterations > 0 && (
                    <Typography variant="caption" color="text.secondary">
                      Iterations: {componentRun.systemIterations}
                    </Typography>
                  )}
                  {componentRun.linesAdded !== undefined && componentRun.linesAdded > 0 && (
                    <Typography variant="caption" color="success.main">
                      +{componentRun.linesAdded} lines
                    </Typography>
                  )}
                  {componentRun.linesModified !== undefined && componentRun.linesModified > 0 && (
                    <Typography variant="caption" color="info.main">
                      ~{componentRun.linesModified} modified
                    </Typography>
                  )}
                  {componentRun.testsAdded !== undefined && componentRun.testsAdded > 0 && (
                    <Typography variant="caption" color="text.secondary">
                      Tests: {componentRun.testsAdded}
                    </Typography>
                  )}
                  {componentRun.cost !== undefined && (
                    <Typography variant="caption" color="warning.main">
                      ${componentRun.cost.toFixed(4)}
                    </Typography>
                  )}
                  {componentRun.artifacts.length > 0 && (
                    <Typography variant="caption" color="text.secondary">
                      Artifacts: {componentRun.artifacts.length}
                    </Typography>
                  )}
                </Box>
                <Typography variant="caption" color="text.secondary" display="block" mt={0.5}>
                  Started: {new Date(componentRun.startedAt).toLocaleTimeString()}
                  {componentRun.completedAt &&
                    ` • Completed: ${new Date(componentRun.completedAt).toLocaleTimeString()}`}
                </Typography>
              </Box>
            </StepContent>
          </Step>
        ))}
      </Stepper>

      {componentRuns.length < totalComponents && (
        <Box mt={2} p={2} bgcolor="action.hover" borderRadius={1}>
          <Typography variant="body2" color="text.secondary">
            {totalComponents - componentRuns.length} component(s) remaining
          </Typography>
        </Box>
      )}
    </Paper>
  );
};

export default ComponentProgressTracker;
