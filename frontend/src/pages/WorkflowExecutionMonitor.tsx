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
  status: string;
  startedAt: string;
  completedAt?: string;
  errorMessage?: string;
  context: any;
  metrics: {
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
  };
  componentRuns: Array<{
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
  }>;
}

const WorkflowExecutionMonitor: React.FC = () => {
  const { runId } = useParams<{ runId: string }>();
  const [activeTab, setActiveTab] = useState(0);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [liveStatus, setLiveStatus] = useState<WorkflowRunStatus | null>(null);

  // Get project ID from context or localStorage
  const projectId = localStorage.getItem('selectedProjectId') ||
                    localStorage.getItem('currentProjectId') ||
                    '345a29ee-d6ab-477d-8079-c5dda0844d77'; // Fallback to AI Studio project

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
        `${import.meta.env.VITE_API_URL || '/api'}/projects/${projectId}/workflow-runs/${runId}/status`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
          },
        }
      );
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Failed to fetch workflow run status:', response.status, errorText);
        throw new Error(`Failed to fetch workflow run status: ${response.status}`);
      }
      return response.json();
    },
    refetchInterval: 5000, // Fallback polling every 5 seconds
  });

  // Set up WebSocket connection
  useEffect(() => {
    // ST-108: Use VITE_WS_URL for WebSocket, fallback to window.location.origin
    const wsUrl = import.meta.env.VITE_WS_URL || window.location.origin;
    const newSocket = io(wsUrl, {
      transports: ['websocket', 'polling'],
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
          <Tab label="Agent Details" />
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
          {activeTab === 1 && (
            <Box>
              <Typography variant="h6" gutterBottom>
                Agent Execution Details
              </Typography>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Detailed input/output data and tool usage for each component agent
              </Typography>
              {liveStatus.componentRuns.map((cr) => (
                <Paper key={cr.componentRunId} variant="outlined" sx={{ p: 3, mb: 3 }}>
                  <Typography variant="h6" gutterBottom color="primary">
                    {cr.componentName}
                  </Typography>
                  <Box display="flex" gap={3} flexWrap="wrap" mb={2}>
                    {cr.modelId && (
                      <Typography variant="body2">
                        <strong>Model:</strong> {cr.modelId}
                      </Typography>
                    )}
                    {cr.temperature !== undefined && (
                      <Typography variant="body2">
                        <strong>Temperature:</strong> {cr.temperature}
                      </Typography>
                    )}
                    {cr.tokensPerSecond !== undefined && (
                      <Typography variant="body2">
                        <strong>Throughput:</strong> {cr.tokensPerSecond.toFixed(1)} tok/s
                      </Typography>
                    )}
                    {cr.timeToFirstToken !== undefined && (
                      <Typography variant="body2">
                        <strong>Time to First Token:</strong> {cr.timeToFirstToken}ms
                      </Typography>
                    )}
                  </Box>

                  {/* Token Breakdown */}
                  {(cr.tokensInput || cr.tokensOutput || cr.tokensCacheRead) && (
                    <Box mb={2}>
                      <Typography variant="subtitle2" gutterBottom>
                        Token Usage
                      </Typography>
                      <Box display="flex" gap={2} flexWrap="wrap">
                        {cr.tokensInput !== undefined && (
                          <Chip
                            label={`Input: ${cr.tokensInput.toLocaleString()}`}
                            size="small"
                            color="primary"
                            variant="outlined"
                          />
                        )}
                        {cr.tokensOutput !== undefined && (
                          <Chip
                            label={`Output: ${cr.tokensOutput.toLocaleString()}`}
                            size="small"
                            color="secondary"
                            variant="outlined"
                          />
                        )}
                        {cr.tokensCacheRead !== undefined && cr.tokensCacheRead > 0 && (
                          <Chip
                            label={`Cache Read: ${cr.tokensCacheRead.toLocaleString()}`}
                            size="small"
                            color="success"
                            variant="outlined"
                          />
                        )}
                        {cr.cacheHitRate !== undefined && (
                          <Chip
                            label={`Cache Hit: ${(cr.cacheHitRate * 100).toFixed(1)}%`}
                            size="small"
                            color="info"
                            variant="outlined"
                          />
                        )}
                      </Box>
                    </Box>
                  )}

                  {/* Tool Usage */}
                  {cr.toolBreakdown && Object.keys(cr.toolBreakdown).length > 0 && (
                    <Box mb={2}>
                      <Typography variant="subtitle2" gutterBottom>
                        Tool Usage
                      </Typography>
                      <Box display="flex" gap={1} flexWrap="wrap">
                        {Object.entries(cr.toolBreakdown).map(([tool, count]) => (
                          <Chip
                            key={tool}
                            label={`${tool}: ${count}`}
                            size="small"
                            variant="filled"
                          />
                        ))}
                      </Box>
                    </Box>
                  )}

                  {/* Files Modified */}
                  {cr.filesModified && cr.filesModified.length > 0 && (
                    <Box mb={2}>
                      <Typography variant="subtitle2" gutterBottom>
                        Files Modified ({cr.filesModified.length})
                      </Typography>
                      <Paper variant="outlined" sx={{ p: 1, maxHeight: 150, overflow: 'auto' }}>
                        {cr.filesModified.map((file, idx) => (
                          <Typography key={idx} variant="caption" display="block" fontFamily="monospace">
                            {file}
                          </Typography>
                        ))}
                      </Paper>
                    </Box>
                  )}

                  {/* Input Data (Prompt Content) */}
                  {cr.inputData && (
                    <Box mb={2}>
                      <Typography variant="subtitle2" gutterBottom color="info.main">
                        Input / Prompt Content
                      </Typography>
                      <Paper
                        variant="outlined"
                        sx={{ p: 2, bgcolor: 'action.hover', maxHeight: 300, overflow: 'auto' }}
                      >
                        <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: '0.8rem' }}>
                          {typeof cr.inputData === 'string'
                            ? cr.inputData
                            : JSON.stringify(cr.inputData, null, 2)}
                        </pre>
                      </Paper>
                    </Box>
                  )}

                  {/* Output Data */}
                  {cr.outputData && (
                    <Box>
                      <Typography variant="subtitle2" gutterBottom color="success.main">
                        Output / Response Content
                      </Typography>
                      <Paper
                        variant="outlined"
                        sx={{ p: 2, bgcolor: 'action.hover', maxHeight: 300, overflow: 'auto' }}
                      >
                        <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: '0.8rem' }}>
                          {typeof cr.outputData === 'string'
                            ? cr.outputData
                            : JSON.stringify(cr.outputData, null, 2)}
                        </pre>
                      </Paper>
                    </Box>
                  )}
                </Paper>
              ))}
            </Box>
          )}
          {activeTab === 2 && <ArtifactViewer runId={liveStatus.runId} />}
          {activeTab === 3 && (
            <Box>
              <Typography variant="h6" gutterBottom>
                Workflow Context
              </Typography>
              <Paper variant="outlined" sx={{ p: 2, bgcolor: 'action.hover' }}>
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
