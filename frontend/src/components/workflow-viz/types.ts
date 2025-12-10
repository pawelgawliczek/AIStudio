/**
 * Type definitions for Workflow State Visualization component
 * ST-168: Workflow State Visualization Web Component
 */

import { WorkflowRunStatus } from '../../types/workflow-tracking';

// Extended ComponentRun with token metrics for visualization
export interface ComponentRunWithMetrics {
  id: string;
  componentId: string;
  componentName: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped' | 'paused';
  startedAt: string | null;
  completedAt: string | null;
  output: any;
  errorMessage: string | null;
  componentSummary?: string | null; // ST-147: AI-generated summary of what this agent accomplished
  tokenMetrics?: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
}

// ST-182: Spawned agent transcript info
export interface SpawnedAgentTranscript {
  agentId: string;
  spawnedAt: string;
  componentId: string;
  transcriptPath: string;
}

// Extended WorkflowRun with states for visualization
export interface WorkflowRunWithStates {
  id: string;
  workflowId: string;
  storyId: string;
  status: WorkflowRunStatus;
  states?: WorkflowState[];
  componentRuns?: ComponentRunWithMetrics[];
  // ST-182: Master transcript paths for live streaming
  masterTranscriptPaths?: string[];
  // ST-182: Spawned agent transcripts for live streaming
  spawnedAgentTranscripts?: SpawnedAgentTranscript[];
  executingAgentId?: string;
}

export interface WorkflowStateVizProps {
  runId: string;
  variant: 'compact' | 'standard' | 'full';
  showLiveStream?: boolean;
  showArtifacts?: boolean;
  showBreakpointControls?: boolean;
  defaultExpandedStates?: 'all' | 'active' | 'none';
  onStateClick?: (stateId: string) => void;
  onViewFullDetails?: () => void;
}

export interface StateBlockProps {
  state: WorkflowState;
  componentRun?: ComponentRunWithMetrics;
  isExpanded: boolean;
  onToggle: () => void;
  variant: 'compact' | 'standard' | 'full';
}

export interface WorkflowState {
  id: string;
  name: string;
  order: number;
  componentId: string | null;
  preExecutionInstructions: string | null;
  postExecutionInstructions: string | null;
  mandatory: boolean;
  requiresApproval: boolean;
  runLocation: 'local' | 'laptop';
  offlineFallback: 'pause' | 'skip' | 'fail';
}

export interface ApprovalRequest {
  id: string;
  workflowRunId: string;
  stateId: string;
  status: 'pending' | 'approved' | 'rejected';
  requestedAt: string;
  decidedBy: string | null;
  decidedAt: string | null;
  feedback: string | null;
}

export interface AgentQuestion {
  id: string;
  workflowRunId: string;
  stateId: string;
  question: string;
  answer: string | null;
  status: 'pending' | 'answered' | 'skipped';
  askedAt: string;
  answeredAt: string | null;
  answeredBy: string | null;
}

export interface Breakpoint {
  id: string;
  runId: string;
  stateId: string;
  position: 'before' | 'after';
  condition: any | null;
  active: boolean;
  hitAt: string | null;
}

export interface BreakpointIndicatorProps {
  breakpoint: Breakpoint;
  onClear?: (breakpointId: string) => void;
  onEdit?: (breakpoint: Breakpoint) => void;
}

export interface CompactStatePipelineProps {
  states: WorkflowState[];
  componentRuns?: ComponentRunWithMetrics[];
  onViewFullDetails?: () => void;
}

export interface StandardStateListProps {
  states: WorkflowState[];
  componentRuns?: ComponentRunWithMetrics[];
  expandedStates: Set<string>;
  onToggle: (stateId: string) => void;
  onStateClick?: (stateId: string) => void;
  onViewLiveFeed?: (componentRunId: string) => void;
}

export interface FullStatePanelProps {
  states: WorkflowState[];
  componentRuns?: ComponentRunWithMetrics[];
  expandedStates: Set<string>;
  onToggle: (stateId: string) => void;
  showLiveStream?: boolean;
  showArtifacts?: boolean;
  showBreakpointControls?: boolean;
  // Artifact and transcript callbacks
  artifacts?: ArtifactInstance[];
  artifactAccess?: Record<string, ArtifactAccess[]>; // keyed by stateId
  transcriptIds?: Record<string, string>; // keyed by componentRunId
  onViewLiveFeed?: (componentRunId: string) => void;
  onViewTranscript?: (transcriptId: string, componentRunId: string, type: 'agent') => void;
  onViewArtifact?: (artifactId: string) => void;
  onViewOutput?: (componentRun: ComponentRunWithMetrics) => void;
}

export type StateStatus = 'completed' | 'running' | 'failed' | 'pending' | 'paused';

export interface StatePhase {
  type: 'pre' | 'agent' | 'post';
  status: StateStatus;
  instructions?: string;
}

// Artifact definitions for state access
export interface ArtifactAccess {
  definitionKey: string;
  definitionName: string;
  accessType: 'read' | 'write' | 'required';
}

// Artifact instance for display
export interface ArtifactInstance {
  id: string;
  definitionKey: string;
  definitionName: string;
  type: 'markdown' | 'json' | 'code' | 'report' | 'image' | 'other';
  version: number;
  createdAt: string;
  updatedAt: string;
}

// Extended StateBlock props with artifacts and transcript
export interface StateBlockExtendedProps extends StateBlockProps {
  artifacts?: ArtifactInstance[];
  artifactAccess?: ArtifactAccess[];
  transcriptId?: string;
  componentRunId?: string;
  onViewLiveFeed?: (componentRunId: string) => void;
  onViewTranscript?: (transcriptId: string, componentRunId: string, type: 'agent') => void;
  onViewArtifact?: (artifactId: string) => void;
}
