import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Box, LinearProgress, Typography, Chip, CircularProgress } from '@mui/material';
import { PlayArrow as PlayArrowIcon } from '@mui/icons-material';
import { getActiveWorkflowForProject } from '../../services/api';

interface ActiveWorkflowStatus {
  runId: string;
  status: string;
  storyKey: string | null;
  storyTitle: string | null;
  activeComponentName: string | null;
  progress: {
    completed: number;
    total: number;
    percentage: number;
  };
  startedAt: string;
  estimatedCost?: number;
}

export const GlobalWorkflowTrackingBar: React.FC = () => {
  // Get project ID from localStorage
  const projectId =
    localStorage.getItem('selectedProjectId') ||
    localStorage.getItem('currentProjectId') ||
    '345a29ee-d6ab-477d-8079-c5dda0844d77'; // Fallback to AI Studio project

  const { data: activeWorkflow, isLoading } = useQuery<ActiveWorkflowStatus | null>({
    queryKey: ['active-workflow', projectId],
    queryFn: () => getActiveWorkflowForProject(projectId),
    refetchInterval: 3000, // Poll every 3 seconds
    retry: false,
  });

  // Don't render if loading or no active workflow
  if (isLoading || !activeWorkflow) {
    return null;
  }

  const { storyKey, storyTitle, activeComponentName, progress, status } = activeWorkflow;
  const isRunning = status === 'running';

  return (
    <Box
      data-testid="workflow-tracking-bar"
      sx={{
        position: 'fixed',
        top: 64, // Below MUI AppBar default height
        left: 0,
        right: 0,
        width: '100%',
        height: '48px',
        backgroundColor: 'primary.main',
        color: 'primary.contrastText',
        boxShadow: 2,
        zIndex: 1100,
        display: 'flex',
        alignItems: 'center',
        px: 3,
        gap: 2,
      }}
    >
      {/* Spinning indicator */}
      {isRunning && (
        <CircularProgress
          data-testid="workflow-spinner"
          size={20}
          sx={{
            color: 'primary.contrastText',
            '& .MuiCircularProgress-circle': {
              animation: 'spinning 1s linear infinite',
            },
          }}
          className="spinning"
        />
      )}

      {/* Story key and title */}
      {storyKey && (
        <Link
          to={`/stories/${storyKey}`}
          style={{
            textDecoration: 'none',
            color: 'inherit',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            maxWidth: '40%',
          }}
        >
          <Chip
            label={storyKey}
            size="small"
            sx={{
              backgroundColor: 'rgba(255, 255, 255, 0.2)',
              color: 'primary.contrastText',
              fontWeight: 'bold',
            }}
          />
          <Typography
            variant="body2"
            sx={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {storyTitle}
          </Typography>
        </Link>
      )}

      {/* Active component */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <PlayArrowIcon sx={{ fontSize: 16 }} />
        <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
          {activeComponentName || 'Initializing...'}
        </Typography>
      </Box>

      {/* Progress indicator */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, ml: 'auto' }}>
        <Typography variant="body2">
          {progress.completed}/{progress.total} components completed
        </Typography>
        <Chip
          label={`${progress.percentage}%`}
          size="small"
          sx={{
            backgroundColor: 'rgba(255, 255, 255, 0.2)',
            color: 'primary.contrastText',
            minWidth: '50px',
          }}
        />
      </Box>

      {/* Linear progress bar */}
      <LinearProgress
        variant="determinate"
        value={progress.percentage}
        role="progressbar"
        aria-valuenow={progress.percentage}
        sx={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: 2,
          backgroundColor: 'rgba(255, 255, 255, 0.2)',
          '& .MuiLinearProgress-bar': {
            backgroundColor: 'secondary.main',
          },
        }}
      />

      {/* Spinning animation keyframes */}
      <style>
        {`
          @keyframes spinning {
            from {
              transform: rotate(0deg);
            }
            to {
              transform: rotate(360deg);
            }
          }
        `}
      </style>
    </Box>
  );
};
