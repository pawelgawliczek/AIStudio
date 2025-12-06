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
import LiveMetricsDisplay from '../components/execution/LiveMetricsDisplay';
// Use direct imports to avoid potential circular dependency issues with barrel exports
import { FullStatePanel } from '../components/workflow-viz/FullStatePanel';
import { useWorkflowRun } from '../components/workflow-viz/hooks/useWorkflowRun';
import { useApprovals } from '../components/workflow-viz/hooks/useApprovals';
import { useArtifacts, useArtifactAccess } from '../components/workflow-viz/hooks/useArtifacts';
import { ApprovalGate } from '../components/workflow-viz/ApprovalGate';
import { ArtifactPanel } from '../components/workflow-viz/ArtifactPanel';
import { ArtifactViewerModal } from '../components/workflow-viz/ArtifactViewerModal';
import { TranscriptViewerModal } from '../components/workflow-viz/TranscriptViewerModal';
import { MasterTranscriptPanel } from '../components/workflow-viz/MasterTranscriptPanel';
import { useRemoteAgents } from '../components/workflow-viz/hooks/useRemoteAgents';

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
  const [selectedTranscript, setSelectedTranscript] = useState<{
    artifactId: string;
    type: 'master' | 'agent';
    componentRunId?: string;
  } | null>(null);
  const [artifactModalOpen, setArtifactModalOpen] = useState(false);
  const [selectedArtifact, setSelectedArtifact] = useState<any>(null);
  const [artifactModalMode, setArtifactModalMode] = useState<'view' | 'edit'>('view');

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

  // ST-168: Fetch pending approvals for this workflow run
  const {
    pendingApproval,
    respondToApproval,
    isResponding: isRespondingToApproval,
    refetch: refetchApprovals,
  } = useApprovals({
    runId: runId || '',
    enabled: !!runId,
  });

  // ST-168: Fetch artifacts for the workflow run using new hook
  const { artifacts: artifactsData } = useArtifacts({
    runId: runId || '',
    enabled: !!runId,
  });

  // ST-168: Fetch artifact access rules (expected artifacts per state)
  const { artifactAccess } = useArtifactAccess({
    runId: runId || '',
    enabled: !!runId,
  });

  // ST-182: Check for online remote agents with watch-transcripts capability
  const { hasTailFileAgent, tailFileAgent } = useRemoteAgents({
    capability: 'watch-transcripts',
    enabled: !!runId,
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

  const handleViewTranscript = useCallback((
    transcriptId: string,
    componentRunId: string,
    type: 'agent'
  ) => {
    setSelectedTranscript({ artifactId: transcriptId, type, componentRunId });
    setTranscriptModalOpen(true);
  }, []);

  const handleViewArtifact = useCallback((artifactId: string) => {
    // Find the artifact and open modal
    const artifact = artifactsData.find((a) => a.id === artifactId);
    if (artifact) {
      setSelectedArtifact(artifact);
      setArtifactModalMode('view');
      setArtifactModalOpen(true);
    }
  }, [artifactsData]);

  // ST-168: Approval gate handlers
  const handleApprove = useCallback(async () => {
    try {
      await respondToApproval({
        action: 'approve',
        decidedBy: 'web-user',
      });
      refetchApprovals();
      refetch();
    } catch (error) {
      console.error('Failed to approve:', error);
    }
  }, [respondToApproval, refetchApprovals, refetch]);

  const handleRerun = useCallback(async (feedback: string) => {
    try {
      await respondToApproval({
        action: 'rerun',
        decidedBy: 'web-user',
        feedback,
      });
      refetchApprovals();
      refetch();
    } catch (error) {
      console.error('Failed to rerun:', error);
    }
  }, [respondToApproval, refetchApprovals, refetch]);

  const handleReject = useCallback(async (reason: string, mode: 'cancel' | 'pause') => {
    try {
      await respondToApproval({
        action: 'reject',
        decidedBy: 'web-user',
        reason,
        rejectMode: mode,
      });
      refetchApprovals();
      refetch();
    } catch (error) {
      console.error('Failed to reject:', error);
    }
  }, [respondToApproval, refetchApprovals, refetch]);

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
    // ST-182: Include auth token for WebSocket connection (required by backend)
    const token = localStorage.getItem('accessToken');
    const newSocket = io(wsUrl, {
      transports: ['websocket', 'polling'],
      auth: {
        token,
      },
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

    // ST-172: Agent question events
    newSocket.on('question:detected', (data: any) => {
      console.log('Agent question detected:', data);
      refetch();
      // Could show a notification/toast here in the future
    });

    newSocket.on('question:answered', (data: any) => {
      console.log('Agent question answered:', data);
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

      {/* ST-182: Master Session Transcript Panel */}
      {workflowRun?.masterTranscriptPaths && workflowRun.masterTranscriptPaths.length > 0 && (
        <Box sx={{ mt: 3 }}>
          <MasterTranscriptPanel
            runId={runId || ''}
            masterTranscriptPaths={workflowRun.masterTranscriptPaths}
            socket={socket}
            isAgentOnline={hasTailFileAgent}
            agentHostname={tailFileAgent?.hostname}
          />
        </Box>
      )}

      {/* Tabs */}
      <Paper sx={{ mt: 3 }}>
        <Tabs value={activeTab} onChange={(_, newValue) => setActiveTab(newValue)}>
          <Tab label="Workflow States" />
          <Tab label={`Artifacts (${artifactsData.length})`} />
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
                  {/* ST-168: Approval Gate - Show when there's a pending approval */}
                  {pendingApproval && (
                    <Box mb={3}>
                      <ApprovalGate
                        approval={pendingApproval}
                        stateName={
                          workflowRun.states.find((s: any) => s.id === pendingApproval.stateId)?.name ||
                          'Unknown State'
                        }
                        artifacts={artifactsData.map((a) => ({
                          id: a.id,
                          key: a.definitionKey,
                          name: a.definitionName,
                          type: a.type as 'markdown' | 'json' | 'code' | 'report' | 'image' | 'other',
                        }))}
                        contextSummary={liveStatus?.context ? JSON.stringify(liveStatus.context, null, 2) : undefined}
                        onApprove={handleApprove}
                        onRerun={handleRerun}
                        onReject={handleReject}
                      />
                    </Box>
                  )}
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
                    artifacts={artifactsData.map((a) => ({
                      id: a.id,
                      definitionKey: a.definitionKey,
                      definitionName: a.definitionName,
                      type: a.type as 'markdown' | 'json' | 'code' | 'report' | 'image' | 'other',
                      version: a.version,
                      createdAt: a.createdAt,
                      updatedAt: a.updatedAt,
                    }))}
                    artifactAccess={artifactAccess}
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
            <ArtifactPanel
              artifacts={artifactsData.map((a) => ({
                id: a.id,
                definitionKey: a.definitionKey,
                name: a.definitionName,
                type: a.type as 'markdown' | 'json' | 'code' | 'report' | 'image' | 'other',
                version: a.version,
                status: 'complete' as const,
                size: a.size,
                createdBy: a.createdBy || undefined,
                createdAt: a.createdAt,
                preview: a.contentPreview || undefined,
              }))}
              onView={(artifactId) => handleViewArtifact(artifactId)}
              onEdit={(artifactId) => {
                const artifact = artifactsData.find((a) => a.id === artifactId);
                if (artifact) {
                  setSelectedArtifact(artifact);
                  setArtifactModalMode('edit');
                  setArtifactModalOpen(true);
                }
              }}
              onDownload={(artifactId) => {
                const artifact = artifactsData.find((a) => a.id === artifactId);
                if (artifact) {
                  const content = artifact.content || artifact.contentPreview || '';
                  const blob = new Blob([content], { type: 'text/plain' });
                  const url = URL.createObjectURL(blob);
                  const link = document.createElement('a');
                  link.href = url;
                  const ext = artifact.type === 'markdown' ? 'md' : artifact.type === 'json' ? 'json' : 'txt';
                  link.download = `${artifact.definitionKey}_v${artifact.version}.${ext}`;
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
                  URL.revokeObjectURL(url);
                }
              }}
              onViewHistory={(artifactId) => {
                console.log('View history for:', artifactId);
              }}
            />
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
      {selectedTranscript && projectId && (
        <TranscriptViewerModal
          open={transcriptModalOpen}
          transcriptId={selectedTranscript.artifactId}
          transcriptType={selectedTranscript.type}
          componentRunId={selectedTranscript.componentRunId}
          runId={runId || ''}
          projectId={projectId}
          onClose={() => {
            setTranscriptModalOpen(false);
            setSelectedTranscript(null);
          }}
        />
      )}

      {/* Artifact Viewer Modal */}
      <ArtifactViewerModal
        open={artifactModalOpen}
        artifact={selectedArtifact}
        mode={artifactModalMode}
        onClose={() => {
          setArtifactModalOpen(false);
          setSelectedArtifact(null);
        }}
        onModeChange={setArtifactModalMode}
      />
    </Container>
  );
};

export default WorkflowExecutionMonitor;
