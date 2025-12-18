import { CheckCircle, Error, PlayArrow, Flag } from '@mui/icons-material';
import {
  Timeline,
  TimelineItem,
  TimelineSeparator,
  TimelineConnector,
  TimelineContent,
  TimelineDot,
  TimelineOppositeContent,
} from '@mui/lab';
import {
  Box,
  Typography,
  Paper,
  Chip,
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
  cacheHitRate?: number;
  userPrompts: number;
  linesAdded?: number;
  linesModified?: number;
  cost?: number;
  artifacts: any[];
}

interface ExecutionTimelineProps {
  componentRuns: ComponentRun[];
  startedAt: string;
  completedAt?: string;
}

const ExecutionTimeline: React.FC<ExecutionTimelineProps> = ({
  componentRuns,
  startedAt,
  completedAt,
}) => {
  const formatTime = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleTimeString();
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle />;
      case 'failed':
        return <Error />;
      case 'running':
        return <PlayArrow />;
      default:
        return <PlayArrow />;
    }
  };

  const getStatusColor = (status: string): 'success' | 'error' | 'primary' | 'default' => {
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

  const getTimelineDotColor = (status: string): 'success' | 'error' | 'primary' | 'grey' => {
    switch (status) {
      case 'completed':
        return 'success';
      case 'failed':
        return 'error';
      case 'running':
        return 'primary';
      default:
        return 'grey';
    }
  };

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Execution Timeline
      </Typography>

      <Timeline position="right">
        {/* Workflow Start */}
        <TimelineItem>
          <TimelineOppositeContent color="text.secondary" sx={{ flex: 0.2 }}>
            {formatTime(startedAt)}
          </TimelineOppositeContent>
          <TimelineSeparator>
            <TimelineDot color="primary">
              <Flag />
            </TimelineDot>
            <TimelineConnector />
          </TimelineSeparator>
          <TimelineContent>
            <Paper elevation={0} sx={{ p: 2, border: 1, borderColor: 'divider' }}>
              <Typography variant="subtitle2" fontWeight="bold">
                Workflow Started
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Execution initialized
              </Typography>
            </Paper>
          </TimelineContent>
        </TimelineItem>

        {/* Component Runs */}
        {componentRuns.map((run, index) => (
          <TimelineItem key={run.componentRunId}>
            <TimelineOppositeContent color="text.secondary" sx={{ flex: 0.2 }}>
              {formatTime(run.startedAt)}
            </TimelineOppositeContent>
            <TimelineSeparator>
              <TimelineDot color={getTimelineDotColor(run.status)}>
                {getStatusIcon(run.status)}
              </TimelineDot>
              {index < componentRuns.length - 1 || !completedAt ? <TimelineConnector /> : null}
            </TimelineSeparator>
            <TimelineContent>
              <Paper elevation={0} sx={{ p: 2, border: 1, borderColor: 'divider' }}>
                <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={1}>
                  <Typography variant="subtitle2" fontWeight="bold">
                    {run.componentName}
                  </Typography>
                  <Chip
                    label={run.status}
                    size="small"
                    color={getStatusColor(run.status)}
                    sx={{ height: 20 }}
                  />
                </Box>

                <Box display="flex" gap={2} flexWrap="wrap" mb={1}>
                  {run.durationSeconds && (
                    <Typography variant="caption" color="text.secondary">
                      {run.durationSeconds}s
                    </Typography>
                  )}
                  {run.tokensInput !== undefined && (
                    <Typography variant="caption" color="primary.main">
                      In: {run.tokensInput.toLocaleString()}
                    </Typography>
                  )}
                  {run.tokensOutput !== undefined && (
                    <Typography variant="caption" color="secondary.main">
                      Out: {run.tokensOutput.toLocaleString()}
                    </Typography>
                  )}
                  {run.tokensCacheRead !== undefined && run.tokensCacheRead > 0 && (
                    <Typography variant="caption" color="success.main">
                      Cached: {run.tokensCacheRead.toLocaleString()}
                    </Typography>
                  )}
                  {run.linesAdded !== undefined && run.linesAdded > 0 && (
                    <Typography variant="caption" color="success.main">
                      +{run.linesAdded} lines
                    </Typography>
                  )}
                  {run.cost !== undefined && (
                    <Typography variant="caption" color="warning.main">
                      ${run.cost.toFixed(4)}
                    </Typography>
                  )}
                  {run.userPrompts > 0 && (
                    <Typography variant="caption" color="text.secondary">
                      {run.userPrompts} prompts
                    </Typography>
                  )}
                  {run.artifacts.length > 0 && (
                    <Typography variant="caption" color="text.secondary">
                      {run.artifacts.length} artifacts
                    </Typography>
                  )}
                </Box>

                {run.completedAt && (
                  <Typography variant="caption" color="text.secondary">
                    Completed at {formatTime(run.completedAt)}
                  </Typography>
                )}
              </Paper>
            </TimelineContent>
          </TimelineItem>
        ))}

        {/* Workflow Complete */}
        {completedAt && (
          <TimelineItem>
            <TimelineOppositeContent color="text.secondary" sx={{ flex: 0.2 }}>
              {formatTime(completedAt)}
            </TimelineOppositeContent>
            <TimelineSeparator>
              <TimelineDot color="success">
                <CheckCircle />
              </TimelineDot>
            </TimelineSeparator>
            <TimelineContent>
              <Paper elevation={0} sx={{ p: 2, border: 1, borderColor: 'success.main', bgcolor: 'action.hover' }}>
                <Typography variant="subtitle2" fontWeight="bold" color="success.main">
                  Workflow Completed
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  All components executed successfully
                </Typography>
              </Paper>
            </TimelineContent>
          </TimelineItem>
        )}
      </Timeline>

      {!completedAt && componentRuns.length > 0 && (
        <Box mt={2} p={2} bgcolor="action.hover" borderRadius={1}>
          <Typography variant="body2" color="info.main">
            ⏳ Workflow is still running...
          </Typography>
        </Box>
      )}
    </Box>
  );
};

export default ExecutionTimeline;
