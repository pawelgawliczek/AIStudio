/**
 * Test Setup and Fixtures for Workflow Execution Tests
 * Provides common test utilities, mocks, and fixtures
 */

// Import the pre-mocked PrismaClient from our global mock
// This avoids importing from the real @prisma/client which can trigger engine initialization
import { PrismaClient, prismaMock as globalPrismaMock, resetAllMocks } from '@prisma/client';

// Re-export the mock type for test files that need it
export type MockPrisma = typeof globalPrismaMock;

// Use the global mock instead of creating a new one
export const prismaMock = globalPrismaMock;

// Export a reset function that can be called in beforeEach hooks
// Uses the custom resetAllMocks from the @prisma/client mock instead of jest-mock-extended's mockReset
export function resetPrismaMock() {
  resetAllMocks();
}

// ST-170: Required params for transcript tracking
export const requiredTranscriptParams = {
  sessionId: 'test-session-id-001',
  transcriptPath: '/tmp/test-transcript.jsonl',
  cwd: '/opt/stack/AIStudio',
};

// Test Fixtures
export const fixtures = {
  project: {
    id: 'proj-test-001',
    name: 'Test Project',
    description: 'Test project for workflow execution',
    localPath: '/app',
    hostPath: '/opt/stack/AIStudio',
    status: 'active' as const,
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
  },

  epic: {
    id: 'epic-test-001',
    projectId: 'proj-test-001',
    key: 'EP-TEST-1',
    title: 'Test Epic',
    description: 'Test epic for workflow execution',
    status: 'planning' as const,
    priority: 1,
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
  },

  story: {
    id: 'story-test-001',
    projectId: 'proj-test-001',
    epicId: 'epic-test-001',
    key: 'ST-TEST-1',
    title: 'Test Story',
    description: 'Test story for workflow execution',
    type: 'feature' as const,
    status: 'planning' as const,
    businessImpact: 5,
    technicalComplexity: 5,
    assignedWorkflowId: null,
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
  },

  storyDone: {
    id: 'story-test-002',
    projectId: 'proj-test-001',
    epicId: 'epic-test-001',
    key: 'ST-TEST-2',
    title: 'Done Story',
    description: 'Completed story',
    type: 'feature' as const,
    status: 'done' as const,
    businessImpact: 5,
    technicalComplexity: 5,
    assignedWorkflowId: null,
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
  },

  // ST-164: Coordinator entity removed - workflows use WorkflowState for execution order

  workflowState: {
    id: 'state-test-001',
    workflowId: 'workflow-test-001',
    name: 'Initial State',
    order: 0,
    componentId: 'comp-1',
    preExecution: null,
    postExecution: null,
    requiresApproval: false,
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
  },

  workflow: {
    id: 'workflow-test-001',
    projectId: 'proj-test-001',
    name: 'Test Workflow',
    description: 'Test workflow for execution',
    active: true,
    triggerConfig: { type: 'manual' },
    componentIds: ['comp-1', 'comp-2'],
    version: 'v1.0',
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
  },

  workflowInactive: {
    id: 'workflow-test-002',
    projectId: 'proj-test-001',
    name: 'Inactive Workflow',
    description: 'Inactive workflow',
    active: false,
    triggerConfig: { type: 'manual' },
    componentIds: ['comp-1'],
    version: 'v1.0',
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
  },

  workflowRun: {
    id: 'run-test-001',
    projectId: 'proj-test-001',
    workflowId: 'workflow-test-001',
    storyId: 'story-test-001',
    epicId: 'epic-test-001',
    status: 'running' as const,
    triggeredBy: 'test-user',
    triggerType: 'manual',
    startedAt: new Date('2025-01-01T10:00:00Z'),
    finishedAt: null,
    durationSeconds: null,
    totalTokens: 0,
    estimatedCost: null,
    totalUserPrompts: 0,
    totalIterations: 0,
    errorMessage: null,
    context: { storyKey: 'ST-TEST-1' },
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
  },

  component: {
    id: 'comp-test-001',
    projectId: 'proj-test-001',
    name: 'Test Component',
    description: 'Test component',
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

  componentRun: {
    id: 'comprun-test-001',
    workflowRunId: 'run-test-001',
    componentId: 'comp-test-001',
    executionOrder: 1,
    status: 'completed' as const,
    startedAt: new Date('2025-01-01T10:00:00Z'),
    finishedAt: new Date('2025-01-01T10:05:00Z'),
    durationSeconds: 300,
    tokensUsed: 5000,
    estimatedCost: 0.05,
    userPrompts: 0,
    systemIterations: 1,
    output: { result: 'success' },
    errorMessage: null,
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
  },
};

// Helper to create story with running workflow
export function createStoryWithRunningWorkflow() {
  return {
    story: fixtures.story,
    existingRun: fixtures.workflowRun,
  };
}

// Helper to create epic with multiple stories
export function createEpicWithStories(count: number = 3) {
  const stories = [];
  for (let i = 0; i < count; i++) {
    stories.push({
      ...fixtures.story,
      id: `story-test-00${i + 1}`,
      key: `ST-TEST-${i + 1}`,
      title: `Test Story ${i + 1}`,
    });
  }
  return {
    epic: fixtures.epic,
    stories,
  };
}

// Helper to create workflow with components
// ST-164: Coordinator removed - workflows use WorkflowState for execution order
export function createWorkflowWithComponents() {
  return {
    workflow: fixtures.workflow,
    components: [
      { ...fixtures.component, id: 'comp-1', name: 'Component 1' },
      { ...fixtures.component, id: 'comp-2', name: 'Component 2' },
    ],
  };
}
