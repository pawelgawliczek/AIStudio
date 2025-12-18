/**
 * Workflow State Management Type Definitions
 */

import { PaginationParams } from './common.types';

export interface CreateWorkflowStateParams {
  workflowId: string;
  name: string;
  order: number;
  componentId?: string;
  preExecutionInstructions?: string;
  postExecutionInstructions?: string;
  requiresApproval?: boolean;
  mandatory?: boolean;
  runLocation?: 'local' | 'laptop'; // ST-150: Where to execute
  offlineFallback?: 'pause' | 'skip' | 'fail'; // ST-150: What to do if laptop offline
}

export interface UpdateWorkflowStateParams {
  workflowStateId: string;
  name?: string;
  order?: number;
  componentId?: string | null; // null to clear
  preExecutionInstructions?: string | null;
  postExecutionInstructions?: string | null;
  requiresApproval?: boolean;
  mandatory?: boolean;
  runLocation?: 'local' | 'laptop'; // ST-150: Where to execute
  offlineFallback?: 'pause' | 'skip' | 'fail'; // ST-150: What to do if laptop offline
}

export interface DeleteWorkflowStateParams {
  workflowStateId: string;
  confirm: boolean;
}

export interface DeleteWorkflowStateResponse {
  id: string;
  workflowId: string;
  name: string;
  order: number;
  cascadeDeleted: {
    breakpoints: number;
  };
  reorderedStates: number; // Number of states that had their order normalized
  message: string;
}

export interface ListWorkflowStatesParams extends PaginationParams {
  workflowId: string;
  includeComponent?: boolean;
}

export interface ReorderWorkflowStatesParams {
  workflowId: string;
  stateOrder: Array<{ stateId: string; newOrder: number }>;
}

export interface WorkflowStateResponse {
  id: string;
  workflowId: string;
  name: string;
  order: number;
  componentId?: string;
  preExecutionInstructions?: string;
  postExecutionInstructions?: string;
  requiresApproval: boolean;
  mandatory: boolean;
  runLocation: string; // ST-150: 'local' | 'laptop'
  offlineFallback: string; // ST-150: 'pause' | 'skip' | 'fail'
  createdAt: string;
  updatedAt: string;
  component?: {
    id: string;
    name: string;
    description?: string;
  };
}
