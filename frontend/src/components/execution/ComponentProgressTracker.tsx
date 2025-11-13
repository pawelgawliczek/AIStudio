import React from 'react';
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
import { CheckCircle, Error, HourglassEmpty, PlayArrow } from '@mui/icons-material';

interface ComponentRun {
  componentRunId: string;
  componentName: string;
  status: string;
  startedAt: string;
  completedAt?: string;
  durationSeconds?: number;
  tokensUsed?: number;
  userPrompts: number;
  artifacts: string[];
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
                <Box display="flex" gap={2} flexWrap="wrap">
                  {componentRun.tokensUsed && (
                    <Typography variant="caption" color="text.secondary">
                      Tokens: {componentRun.tokensUsed.toLocaleString()}
                    </Typography>
                  )}
                  {componentRun.userPrompts > 0 && (
                    <Typography variant="caption" color="text.secondary">
                      Prompts: {componentRun.userPrompts}
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
        <Box mt={2} p={2} bgcolor="grey.50" borderRadius={1}>
          <Typography variant="body2" color="text.secondary">
            {totalComponents - componentRuns.length} component(s) remaining
          </Typography>
        </Box>
      )}
    </Paper>
  );
};

export default ComponentProgressTracker;
