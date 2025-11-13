import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import io, { Socket } from 'socket.io-client';
import {
  Box,
  Container,
  Typography,
  Paper,
  Tab,
  Tabs,
  Chip,
  Alert,
  CircularProgress,
  Button,
} from '@mui/material';
import { ArrowBack, Refresh } from '@mui/icons-material';
import ExecutionTimeline from '../components/execution/ExecutionTimeline';
import LiveMetricsDisplay from '../components/execution/LiveMetricsDisplay';
import ArtifactViewer from '../components/execution/ArtifactViewer';
import ComponentProgressTracker from '../components/execution/ComponentProgressTracker';

interface WorkflowRunStatus {
  runId: string;
  workflowId: string;
  workflowName: string;
  coordinatorName: string;
  status: string;
  startedAt: string;
  completedAt?: string;
  errorMessage?: string;
  context: any;
  metrics: {
    totalTokens: number | null;
    totalCost: number | null;
    totalDuration: number | null;
    totalUserPrompts: number | null;
    totalIterations: number | null;
    totalInterventions: number | null;
    componentsCompleted: number;
    componentsTotal: number;
    percentComplete: number;
  };
  componentRuns: Array<{
    componentRunId: string;
    componentName: string;
    status: string;
    startedAt: string;
    completedAt?: string;
    durationSeconds?: number;
    tokensUsed?: number;
    userPrompts: number;
    artifacts: string[];
  }>;
}

const WorkflowExecutionMonitor: React.FC = () => {
  const { runId } = useParams<{ runId: string }>();
  const [activeTab, setActiveTab] = useState(0);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [liveStatus, setLiveStatus] = useState<WorkflowRunStatus | null>(null);

  // Fetch initial status
  const {
    data: status,
    isLoading,
    error,
    refetch,
  } = useQuery<WorkflowRunStatus>({
    queryKey: ['workflow-run-status', runId],
    queryFn: async () => {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/projects/${localStorage.getItem('currentProjectId')}/workflow-runs/${runId}/status`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`,
          },
        }
      );
      if (!response.ok) throw new Error('Failed to fetch workflow run status');
      return response.json();
    },
    refetchInterval: 5000, // Fallback polling every 5 seconds
  });

  // Set up WebSocket connection
  useEffect(() => {
    const newSocket = io(import.meta.env.VITE_API_URL || 'http://localhost:3000', {
      transports: ['websocket'],
    });

    newSocket.on('connect', () => {
      console.log('WebSocket connected');
      // Join workflow run room
      newSocket.emit('join-room', { room: `workflow-run:${runId}` });
    });

    // Listen for workflow events
    newSocket.on('workflow:status', (data: any) => {
      console.log('Workflow status update:', data);
      refetch(); // Refresh data
    });

    newSocket.on('component:started', (data: any) => {
      console.log('Component started:', data);
      refetch();
    });

    newSocket.on('component:completed', (data: any) => {
      console.log('Component completed:', data);
      refetch();
    });

    newSocket.on('component:progress', (data: any) => {
      console.log('Component progress:', data);
    });

    newSocket.on('artifact:stored', (data: any) => {
      console.log('Artifact stored:', data);
      refetch();
    });

    newSocket.on('metrics:updated', (data: any) => {
      console.log('Metrics updated:', data);
      refetch();
    });

    setSocket(newSocket);

    return () => {
      newSocket.emit('leave-room', { room: `workflow-run:${runId}` });
      newSocket.disconnect();
    };
  }, [runId, refetch]);

  // Update live status when data changes
  useEffect(() => {
    if (status) {
      setLiveStatus(status);
    }
  }, [status]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running':
        return 'primary';
      case 'completed':
        return 'success';
      case 'failed':
        return 'error';
      case 'paused':
        return 'warning';
      case 'cancelled':
        return 'default';
      default:
        return 'default';
    }
  };

  const getStatusLabel = (status: string) => {
    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  if (isLoading) {
    return (
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  if (error || !liveStatus) {
    return (
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Alert severity="error">
          Failed to load workflow run status. Please try again.
          <Button onClick={() => refetch()} sx={{ ml: 2 }}>
            Retry
          </Button>
        </Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      {/* Header */}
      <Box mb={3}>
        <Box display="flex" alignItems="center" gap={2} mb={2}>
          <Button
            component={Link}
            to="/workflows"
            startIcon={<ArrowBack />}
            variant="outlined"
            size="small"
          >
            Back to Workflows
          </Button>
          <Button startIcon={<Refresh />} onClick={() => refetch()} variant="outlined" size="small">
            Refresh
          </Button>
        </Box>

        <Box display="flex" justifyContent="space-between" alignItems="flex-start">
          <Box>
            <Typography variant="h4" gutterBottom>
              {liveStatus.workflowName}
            </Typography>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Coordinator: {liveStatus.coordinatorName}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Run ID: {liveStatus.runId}
            </Typography>
          </Box>
          <Box display="flex" gap={1} alignItems="center">
            <Chip label={getStatusLabel(liveStatus.status)} color={getStatusColor(liveStatus.status)} />
            {socket?.connected && (
              <Chip label="Live" color="success" size="small" variant="outlined" />
            )}
          </Box>
        </Box>
      </Box>

      {/* Error Message */}
      {liveStatus.errorMessage && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {liveStatus.errorMessage}
        </Alert>
      )}

      {/* Metrics Overview */}
      <LiveMetricsDisplay metrics={liveStatus.metrics} status={liveStatus.status} />

      {/* Progress Tracker */}
      <ComponentProgressTracker
        componentRuns={liveStatus.componentRuns}
        totalComponents={liveStatus.metrics.componentsTotal}
      />

      {/* Tabs */}
      <Paper sx={{ mt: 3 }}>
        <Tabs value={activeTab} onChange={(_, newValue) => setActiveTab(newValue)}>
          <Tab label="Timeline" />
          <Tab label="Artifacts" />
          <Tab label="Context" />
        </Tabs>

        <Box p={3}>
          {activeTab === 0 && (
            <ExecutionTimeline
              componentRuns={liveStatus.componentRuns}
              startedAt={liveStatus.startedAt}
              completedAt={liveStatus.completedAt}
            />
          )}
          {activeTab === 1 && <ArtifactViewer runId={liveStatus.runId} />}
          {activeTab === 2 && (
            <Box>
              <Typography variant="h6" gutterBottom>
                Workflow Context
              </Typography>
              <Paper variant="outlined" sx={{ p: 2, bgcolor: 'grey.50' }}>
                <pre style={{ margin: 0, overflow: 'auto' }}>
                  {JSON.stringify(liveStatus.context, null, 2)}
                </pre>
              </Paper>
            </Box>
          )}
        </Box>
      </Paper>
    </Container>
  );
};

export default WorkflowExecutionMonitor;
