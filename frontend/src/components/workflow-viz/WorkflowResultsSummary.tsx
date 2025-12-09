/**
 * WorkflowResultsSummary Component
 * ST-195: Side panel showing agent results and artifacts for each completed state
 */

import React from 'react';
import { Box, Typography, Button, Chip } from '@mui/material';
import { formatDuration } from './utils/format-duration';

interface ComponentRun {
  id: string;
  componentName?: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'paused';
  componentSummary?: string;
  startedAt?: string;
  completedAt?: string;
  stateId: string;
}

interface WorkflowState {
  id: string;
  name: string;
  order: number;
}

interface Artifact {
  id: string;
  definitionKey: string;
  definitionName: string;
  version: number;
}

interface WorkflowResultsSummaryProps {
  componentRuns?: ComponentRun[];
  states: WorkflowState[];
  artifacts?: Artifact[];
  onViewTranscript?: (componentRunId: string) => void;
  onViewArtifact?: (artifactId: string) => void;
  onRepeatState?: (stateId: string) => void;
}

export const WorkflowResultsSummary: React.FC<WorkflowResultsSummaryProps> = ({
  componentRuns = [],
  states = [],
  artifacts = [],
  onViewTranscript,
  onViewArtifact,
  onRepeatState,
}) => {
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return '✓';
      case 'running':
        return '▶';
      case 'failed':
        return '✕';
      case 'paused':
        return '⏸';
      default:
        return '○';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'success';
      case 'running':
        return 'info';
      case 'failed':
        return 'error';
      case 'paused':
        return 'warning';
      default:
        return 'default';
    }
  };

  const getStateStatus = (stateId: string): string => {
    const run = componentRuns.find((r) => r.stateId === stateId);
    return run?.status || 'pending';
  };

  const getStateRun = (stateId: string) => {
    return componentRuns.find((r) => r.stateId === stateId);
  };

  const getStateArtifacts = (stateId: string) => {
    // In a real implementation, we'd filter artifacts by state
    // For now, just return all artifacts
    return artifacts;
  };

  return (
    <Box
      data-testid="workflow-results-summary"
      sx={{
        p: 2,
        bgcolor: 'background.paper',
        border: 1,
        borderColor: 'divider',
        borderRadius: 1,
        maxHeight: '80vh',
        overflowY: 'auto',
      }}
    >
      <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        📊 RESULTS SUMMARY
      </Typography>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {states
          .sort((a, b) => a.order - b.order)
          .map((state) => {
            const status = getStateStatus(state.id);
            const run = getStateRun(state.id);
            const stateArtifacts = getStateArtifacts(state.id);

            return (
              <Box
                key={state.id}
                sx={{
                  pb: 2,
                  borderBottom: 1,
                  borderColor: 'divider',
                  '&:last-child': { borderBottom: 0 },
                }}
              >
                {/* State header */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <Typography variant="body2" fontWeight="medium">
                    {getStatusIcon(status)} {state.name}
                  </Typography>
                  <Chip
                    label={status.toUpperCase()}
                    size="small"
                    color={getStatusColor(status) as any}
                    sx={{ ml: 'auto' }}
                  />
                </Box>

                {/* Component summary */}
                {run?.componentSummary && (
                  <Box
                    sx={{
                      p: 1,
                      bgcolor: 'action.hover',
                      borderRadius: 1,
                      mb: 1,
                    }}
                  >
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                      📝 {run.componentSummary}
                    </Typography>
                  </Box>
                )}

                {/* Duration for completed states */}
                {status === 'completed' && run?.startedAt && run?.completedAt && (
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                    ⏱ {formatDuration(run.startedAt, run.completedAt)}
                  </Typography>
                )}

                {/* Running state duration */}
                {status === 'running' && run?.startedAt && (
                  <Typography variant="caption" color="info.main" sx={{ display: 'block', mb: 0.5 }}>
                    ⏱ {formatDuration(run.startedAt)} elapsed
                  </Typography>
                )}

                {/* Artifacts */}
                {stateArtifacts.length > 0 && (
                  <Box sx={{ mb: 1 }}>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                      📁 Artifacts:
                    </Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {stateArtifacts.map((artifact) => (
                        <Chip
                          key={artifact.id}
                          label={`${artifact.definitionKey} v${artifact.version}`}
                          size="small"
                          onClick={() => onViewArtifact?.(artifact.id)}
                          sx={{ fontSize: '0.7rem' }}
                        />
                      ))}
                    </Box>
                  </Box>
                )}

                {/* Action buttons */}
                {(status === 'completed' || status === 'failed') && (
                  <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                    {run && onViewTranscript && (
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => onViewTranscript(run.id)}
                        sx={{ fontSize: '0.7rem', py: 0.5 }}
                      >
                        View
                      </Button>
                    )}
                    {onRepeatState && (
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => onRepeatState(state.id)}
                        sx={{ fontSize: '0.7rem', py: 0.5 }}
                      >
                        Repeat
                      </Button>
                    )}
                  </Box>
                )}

                {/* Live feed for running state */}
                {status === 'running' && (
                  <Button
                    size="small"
                    variant="contained"
                    color="info"
                    onClick={() => run && onViewTranscript?.(run.id)}
                    sx={{ fontSize: '0.7rem', py: 0.5, mt: 1 }}
                  >
                    Live Feed
                  </Button>
                )}
              </Box>
            );
          })}
      </Box>
    </Box>
  );
};
