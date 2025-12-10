/**
 * EP-8 Story Runner E2E Test Data Factory
 * Factory functions for creating test entities
 */

import { TEST_CONFIG, testName } from '../config/test-config';

/**
 * Create test project parameters
 */
export function createTestProjectParams() {
  return {
    name: TEST_CONFIG.PROJECT_NAME,
    description: 'EP-8 E2E Integration Test Project - Safe to delete',
    repositoryUrl: 'https://github.com/test/ep8-e2e-test',
  };
}

/**
 * Create test epic parameters
 */
export function createTestEpicParams(projectId: string) {
  return {
    projectId,
    title: testName('Epic'),
    description: 'Test epic for EP-8 E2E tests',
    priority: 5,
  };
}

/**
 * Create test story parameters
 */
export function createTestStoryParams(projectId: string, epicId?: string) {
  return {
    projectId,
    epicId,
    title: testName('Story'),
    description: 'Test story for EP-8 E2E tests',
    type: 'feature' as const,
  };
}

/**
 * Create test agent component parameters
 */
export function createTestAgentParams(projectId: string) {
  return {
    projectId,
    name: testName('Agent'),
    description: 'Test agent component for EP-8 E2E tests',
    inputInstructions: 'Read story context from get_story MCP tool',
    operationInstructions: 'Analyze the story requirements and create a simple report',
    outputInstructions: 'Save analysis to story baAnalysis field via update_story',
    config: TEST_CONFIG.MODEL_CONFIG,
    tools: TEST_CONFIG.DEFAULT_TOOLS,
    tags: ['test', 'e2e', 'ep8'],
    active: true,
    version: 'v1.0',
  };
}

/**
 * Create test workflow (team) parameters
 * Note: ST-164 removed coordinator/project manager - teams no longer require coordinatorId
 */
export function createTestWorkflowParams(projectId: string) {
  return {
    projectId,
    name: testName('Workflow'),
    description: 'Test workflow for EP-8 E2E tests',
    triggerConfig: {
      type: 'manual',
      filters: {},
      notifications: {},
    },
    active: true,
    version: 'v1.0',
  };
}

/**
 * Create test workflow state parameters
 */
export function createTestWorkflowStateParams(
  workflowId: string,
  componentId: string | null,
  name: string,
  order: number
) {
  return {
    workflowId,
    componentId,
    name: testName(`State_${name}`),
    order,
    mandatory: true,
    requiresApproval: false,
    preExecutionInstructions: `Pre-execution for ${name}`,
    postExecutionInstructions: `Post-execution for ${name}`,
    runLocation: 'local' as const,
    offlineFallback: 'pause' as const,
  };
}

/**
 * Create test artifact definition parameters
 */
export function createTestArtifactDefinitionParams(workflowId: string) {
  return {
    workflowId,
    name: testName('ARCH_DOC'),
    key: `ARCH_DOC_${TEST_CONFIG.TIMESTAMP}`,
    type: 'markdown' as const,
    description: 'Test architecture document artifact',
    isMandatory: false,
    schema: null,
  };
}

/**
 * Create test artifact content
 */
export function createTestArtifactContent() {
  return `# Test Architecture Document

## Overview
This is a test artifact created by EP-8 E2E tests.

## Timestamp
Created: ${new Date().toISOString()}

## Test ID
${TEST_CONFIG.TIMESTAMP}
`;
}

/**
 * Create E2E test workflow run parameters
 * ST-170: start_workflow_run now requires sessionId and transcriptPath for live streaming
 * For E2E tests, we use test values that simulate what the SessionStart hook would provide
 */
export function createE2EWorkflowRunParams(
  workflowId: string,
  triggeredBy: string,
  options?: {
    cwd?: string;
    context?: Record<string, unknown>;
    approvalOverrides?: {
      mode?: 'default' | 'all' | 'none';
      stateOverrides?: Record<string, boolean>;
    };
  }
) {
  const timestamp = Date.now();
  const sessionId = `e2e-test-session-${timestamp}`;
  const cwd = options?.cwd || '/Users/pawelgawliczek/projects/AIStudio';
  // Path escaping: /Users/pawelgawliczek/projects/AIStudio → -Users-pawelgawliczek-projects-AIStudio
  const escapedPath = cwd.replace(/^\//, '-').replace(/\//g, '-');
  const transcriptPath = `${cwd}/.claude/projects/${escapedPath}/${sessionId}.jsonl`;

  return {
    workflowId,
    triggeredBy,
    cwd,
    sessionId,
    transcriptPath,
    context: options?.context,
    approvalOverrides: options?.approvalOverrides,
  };
}
