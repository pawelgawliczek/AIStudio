/**
 * Test Setup and Fixtures for Workflow State Tests (ST-144)
 * Provides common test utilities, mocks, and fixtures
 */

import { PrismaClient } from '@prisma/client';
import { mockDeep, mockReset, DeepMockProxy } from 'jest-mock-extended';

export type MockPrisma = DeepMockProxy<PrismaClient>;

// Mock Prisma Client
export const prismaMock = mockDeep<PrismaClient>() as MockPrisma;

// Export a reset function that can be called in beforeEach hooks
export function resetPrismaMock() {
  mockReset(prismaMock);
}

// Test Fixtures
export const fixtures = {
  project: {
    id: 'proj-test-001',
    name: 'Test Project',
    description: 'Test project for workflow states',
    localPath: '/app',
    hostPath: '/opt/stack/AIStudio',
    status: 'active' as const,
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
  },

  workflow: {
    id: 'workflow-test-001',
    projectId: 'proj-test-001',
    coordinatorId: 'coord-test-001',
    name: 'Test Workflow',
    description: 'Test workflow for state management',
    active: true,
    triggerConfig: { type: 'manual' },
    version: 'v1.0',
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
  },

  component: {
    id: 'comp-test-001',
    projectId: 'proj-test-001',
    name: 'Test Component',
    description: 'Test component for workflow state',
    inputInstructions: 'Input test',
    operationInstructions: 'Operation test',
    outputInstructions: 'Output test',
    active: true,
    config: { modelId: 'claude-3-5-sonnet-20241022', temperature: 0.7 },
    tools: ['read'],
    onFailure: 'stop' as const,
    version: 'v1.0',
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
  },

  workflowState: {
    id: 'state-test-001',
    workflowId: 'workflow-test-001',
    name: 'analysis',
    order: 1,
    componentId: 'comp-test-001',
    preExecutionInstructions: 'Read the story requirements',
    postExecutionInstructions: 'Save the analysis results',
    requiresApproval: false,
    mandatory: true,
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
  },

  workflowStateSecond: {
    id: 'state-test-002',
    workflowId: 'workflow-test-001',
    name: 'implementation',
    order: 2,
    componentId: 'comp-test-001',
    preExecutionInstructions: null,
    postExecutionInstructions: null,
    requiresApproval: true,
    mandatory: true,
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
  },

  workflowStateThird: {
    id: 'state-test-003',
    workflowId: 'workflow-test-001',
    name: 'review',
    order: 3,
    componentId: null,
    preExecutionInstructions: null,
    postExecutionInstructions: null,
    requiresApproval: false,
    mandatory: false,
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
  },

  workflowRun: {
    id: 'run-test-001',
    workflowId: 'workflow-test-001',
    storyId: 'story-test-001',
    status: 'running' as const,
    currentStateId: 'state-test-001', // Running at first state
    triggeredBy: 'test-user',
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
  },

  breakpoint: {
    id: 'bp-test-001',
    workflowRunId: 'run-test-001',
    stateId: 'state-test-001',
    type: 'manual' as const,
    reason: 'Debug pause',
    createdAt: new Date('2025-01-01'),
  },
};

// Helper to create workflow state with component
export function createWorkflowStateWithComponent() {
  return {
    ...fixtures.workflowState,
    component: fixtures.component,
  };
}

// Helper to create multiple states
export function createMultipleStates() {
  return [
    { ...fixtures.workflowState, _count: { breakpointsAtState: 0, workflowRunsAtState: 0 } },
    { ...fixtures.workflowStateSecond, _count: { breakpointsAtState: 0, workflowRunsAtState: 0 } },
    { ...fixtures.workflowStateThird, _count: { breakpointsAtState: 0, workflowRunsAtState: 0 } },
  ];
}

// Helper to create state with active runs
export function createStateWithActiveRuns() {
  return {
    ...fixtures.workflowState,
    _count: {
      breakpointsAtState: 1,
      workflowRunsAtState: 2,
    },
  };
}
