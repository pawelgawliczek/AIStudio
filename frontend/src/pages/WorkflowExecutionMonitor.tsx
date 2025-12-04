import React, { useEffect, useState, useCallback } from 'react';
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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import { ArrowBack, Refresh } from '@mui/icons-material';
import ExecutionTimeline from '../components/execution/ExecutionTimeline';
import LiveMetricsDisplay from '../components/execution/LiveMetricsDisplay';
import ArtifactViewer from '../components/execution/ArtifactViewer';
import ComponentProgressTracker from '../components/execution/ComponentProgressTracker';
// Use direct imports to avoid potential circular dependency issues with barrel exports
import { FullStatePanel } from '../components/workflow-viz/FullStatePanel';
import { useWorkflowRun } from '../components/workflow-viz/hooks/useWorkflowRun';

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
  const [expandedStates, setExpandedStates] = useState<Set<string>>(new Set());
  const [breakpointModalOpen, setBreakpointModalOpen] = useState(false);
  const [selectedStateForBreakpoint, setSelectedStateForBreakpoint] = useState<string>('');
  const [breakpointPosition, setBreakpointPosition] = useState<'before' | 'after'>('before');
  const [liveFeedModalOpen, setLiveFeedModalOpen] = useState(false);
  const [transcriptModalOpen, setTranscriptModalOpen] = useState(false);
  const [selectedComponentRunId, setSelectedComponentRunId] = useState<string>('');
  const [selectedTranscriptId, setSelectedTranscriptId] = useState<string>('');

  // Get project ID from context or localStorage
  const projectId = localStorage.getItem('selectedProjectId') ||
                    localStorage.getItem('currentProjectId') ||
                    '345a29ee-d6ab-477d-8079-c5dda0844d77'; // Fallback to AI Studio project

  // Fetch workflow run with states using the new hook
  const { workflowRun, isLoading: isWorkflowRunLoading } = useWorkflowRun({
    runId: runId || '',
    enabled: !!runId,
    refetchInterval: 5000,
  });

  // ST-168: Fetch artifacts for the workflow run
  // Use consistent URL pattern: base URL without /api suffix + /api/... path
  const { data: artifactsData } = useQuery<{ runId: string; artifacts: any[]; total: number }>({
    queryKey: ['workflow-run-artifacts', runId],
    queryFn: async () => {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL || '/api'}/projects/${projectId}/workflow-runs/${runId}/artifacts`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
          },
        }
      );
      if (!response.ok) {
        throw new Error('Failed to fetch artifacts');
      }
      return response.json();
    },
    enabled: !!runId && !!projectId,
    refetchInterval: 10000, // Refresh every 10 seconds
  });

  // Fetch initial status (moved here to make refetch available for callbacks)
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

  // Auto-expand running/paused states when workflow data loads
  useEffect(() => {
    if (!workflowRun?.states || !workflowRun?.componentRuns) return;

    const newExpanded = new Set<string>();
    workflowRun.states.forEach((state: any) => {
      // Check status in componentRuns
      const componentRun = workflowRun.componentRuns?.find(
        (r: any) => r.id === state.id || r.componentId === state.componentId
      );
      if (componentRun?.status === 'running' || componentRun?.status === 'paused') {
        newExpanded.add(state.id);
      }
      // Also check state's own status if available
      if (state.status === 'running' || state.status === 'paused') {
        newExpanded.add(state.id);
      }
    });

    // Only update if there are running/paused states
    if (newExpanded.size > 0) {
      setExpandedStates(newExpanded);
    }
  }, [workflowRun]);

  const handleToggleState = (stateId: string) => {
    setExpandedStates(prev => {
      const newSet = new Set(prev);
      if (newSet.has(stateId)) {
        newSet.delete(stateId);
      } else {
        newSet.add(stateId);
      }
      return newSet;
    });
  };

  // Callback handlers for workflow-viz components
  const handleViewLiveFeed = useCallback((componentRunId: string) => {
    setSelectedComponentRunId(componentRunId);
    setLiveFeedModalOpen(true);
  }, []);

  const handleViewTranscript = useCallback((transcriptId: string) => {
    setSelectedTranscriptId(transcriptId);
    setTranscriptModalOpen(true);
  }, []);

  const handleViewArtifact = useCallback((artifactId: string) => {
    // Switch to artifacts tab and scroll to artifact
    setActiveTab(3);
    console.log('View artifact:', artifactId);
  }, []);

  const handleAddBreakpoint = useCallback(async () => {
    if (!selectedStateForBreakpoint || !runId) return;

    try {
      // ST-168: Use the correct REST API endpoint for breakpoints
      // Use consistent URL pattern: base URL without /api suffix + /api/... path
      const response = await fetch(
        `${import.meta.env.VITE_API_URL || '/api'}/runner/breakpoints`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
          },
          body: JSON.stringify({
            runId,
            stateId: selectedStateForBreakpoint,
            position: breakpointPosition,
          }),
        }
      );

      if (response.ok) {
        const result = await response.json();
        console.log('Breakpoint created:', result);
        setBreakpointModalOpen(false);
        setSelectedStateForBreakpoint('');
        // Trigger refetch
        refetch();
      } else {
        const errorText = await response.text();
        console.error('Failed to set breakpoint:', errorText);
      }
    } catch (error) {
      console.error('Error setting breakpoint:', error);
    }
  }, [selectedStateForBreakpoint, runId, breakpointPosition, refetch]);

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
          <Tab label="Workflow States" />
          <Tab label="Timeline" />
          <Tab label="Agent Details" />
          <Tab label="Artifacts" />
          <Tab label="Context" />
        </Tabs>

        <Box p={3}>
          {activeTab === 0 && (
            <>
              {isWorkflowRunLoading ? (
                <Box display="flex" justifyContent="center" py={4}>
                  <CircularProgress />
                </Box>
              ) : workflowRun?.states && workflowRun.states.length > 0 ? (
                <>
                  <FullStatePanel
                    states={workflowRun.states}
                    componentRuns={workflowRun.componentRuns}
                    expandedStates={expandedStates}
                    onToggle={handleToggleState}
                    showLiveStream={true}
                    showArtifacts={true}
                    showBreakpointControls={true}
                    onViewLiveFeed={handleViewLiveFeed}
                    onViewTranscript={handleViewTranscript}
                    onViewArtifact={handleViewArtifact}
                    artifacts={(artifactsData?.artifacts || []).map((a: any) => ({
                      id: a.s3Key || a.id,
                      definitionKey: a.artifactType || a.definitionKey || 'artifact',
                      definitionName: a.filename || a.definitionName || 'Artifact',
                      type: a.format === 'md' ? 'markdown' :
                            a.format === 'json' ? 'json' :
                            a.format === 'png' || a.format === 'jpg' ? 'image' : 'other',
                      version: 1,
                      createdAt: a.uploadedAt || new Date().toISOString(),
                      updatedAt: a.uploadedAt || new Date().toISOString(),
                    }))}
                  />
                  {/* Add Breakpoint Button */}
                  <Box mt={2}>
                    <Button
                      variant="outlined"
                      color="warning"
                      onClick={() => setBreakpointModalOpen(true)}
                      startIcon={<span>🛑</span>}
                    >
                      Add Breakpoint
                    </Button>
                  </Box>
                </>
              ) : (
                <Alert severity="info">
                  No workflow states available for this run.
                </Alert>
              )}
            </>
          )}
          {activeTab === 1 && (
            <ExecutionTimeline
              componentRuns={liveStatus.componentRuns}
              startedAt={liveStatus.startedAt}
              completedAt={liveStatus.completedAt}
            />
          )}
          {activeTab === 2 && (
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
          {activeTab === 3 && <ArtifactViewer runId={liveStatus.runId} />}
          {activeTab === 4 && (
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

      {/* Breakpoint Modal */}
      <Dialog
        open={breakpointModalOpen}
        onClose={() => setBreakpointModalOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Add Breakpoint</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <FormControl fullWidth>
              <InputLabel>Select State</InputLabel>
              <Select
                value={selectedStateForBreakpoint}
                label="Select State"
                onChange={(e) => setSelectedStateForBreakpoint(e.target.value)}
              >
                {workflowRun?.states?.map((state: any) => (
                  <MenuItem key={state.id} value={state.id}>
                    {state.name} (Order: {state.order})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel>Position</InputLabel>
              <Select
                value={breakpointPosition}
                label="Position"
                onChange={(e) => setBreakpointPosition(e.target.value as 'before' | 'after')}
              >
                <MenuItem value="before">Before state execution</MenuItem>
                <MenuItem value="after">After state completion</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBreakpointModalOpen(false)}>Cancel</Button>
          <Button
            onClick={handleAddBreakpoint}
            variant="contained"
            color="warning"
            disabled={!selectedStateForBreakpoint}
          >
            Add Breakpoint
          </Button>
        </DialogActions>
      </Dialog>

      {/* Live Feed Modal */}
      <Dialog
        open={liveFeedModalOpen}
        onClose={() => setLiveFeedModalOpen(false)}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle>
          <Box display="flex" alignItems="center" gap={1}>
            <span>🔴</span>
            Live Execution Stream
            <Chip label="Connected" color="success" size="small" sx={{ ml: 'auto' }} />
          </Box>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ minHeight: 400 }}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Component Run ID: {selectedComponentRunId}
            </Typography>
            <Paper
              variant="outlined"
              sx={{
                p: 2,
                bgcolor: 'grey.900',
                color: 'grey.100',
                fontFamily: 'monospace',
                fontSize: '0.85rem',
                minHeight: 300,
                maxHeight: 500,
                overflow: 'auto',
              }}
            >
              {/* WebSocket stream would render here */}
              <Typography variant="body2" sx={{ color: 'grey.500' }}>
                Connecting to live stream...
              </Typography>
              <Typography variant="body2" sx={{ color: 'grey.400', mt: 1 }}>
                {'>'} Waiting for agent output...
              </Typography>
            </Paper>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setLiveFeedModalOpen(false)}>Close</Button>
          <Button variant="outlined">Pause Stream</Button>
          <Button variant="outlined">Download Transcript</Button>
        </DialogActions>
      </Dialog>

      {/* Transcript Modal */}
      <Dialog
        open={transcriptModalOpen}
        onClose={() => setTranscriptModalOpen(false)}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle>Agent Transcript</DialogTitle>
        <DialogContent>
          <Box sx={{ minHeight: 400 }}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Transcript ID: {selectedTranscriptId}
            </Typography>
            <Paper
              variant="outlined"
              sx={{
                p: 2,
                bgcolor: 'grey.900',
                color: 'grey.100',
                fontFamily: 'monospace',
                fontSize: '0.85rem',
                minHeight: 300,
                maxHeight: 500,
                overflow: 'auto',
              }}
            >
              <Typography variant="body2" sx={{ color: 'grey.500' }}>
                Loading transcript...
              </Typography>
            </Paper>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTranscriptModalOpen(false)}>Close</Button>
          <Button variant="outlined">Download JSONL</Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default WorkflowExecutionMonitor;
