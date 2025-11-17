/**
 * Test setup for Agent Metrics MCP tools
 */
import { PrismaClient } from '@prisma/client';
import { mockDeep, mockReset, DeepMockProxy } from 'jest-mock-extended';

// Create mock Prisma client
export const prismaMock = mockDeep<PrismaClient>() as unknown as DeepMockProxy<PrismaClient>;

// Reset mocks before each test
beforeEach(() => {
  mockReset(prismaMock);
});

// Common fixtures for metrics tests
export const fixtures = {
  componentRun: {
    id: 'component-run-123',
    workflowRunId: 'workflow-run-456',
    componentId: 'component-789',
    executionOrder: 1,
    status: 'completed',
    success: true,

    // Session tracking
    sessionId: 'session-abc-123',

    // Basic metrics
    tokensInput: 65000,
    tokensOutput: 8000,
    totalTokens: 73000,
    durationSeconds: 120,
    cost: 0.32,

    // ST-27 Cache metrics
    tokensCacheRead: 12000,
    tokensCacheWrite: 3500,
    cacheHits: 45,
    cacheMisses: 12,
    cacheHitRate: 0.789,

    // ST-27 Code impact
    linesAdded: 150,
    linesDeleted: 35,
    linesModified: 22,
    complexityBefore: 8.5,
    complexityAfter: 9.2,
    coverageBefore: 78.5,
    coverageAfter: 82.3,

    // ST-27 Quality metrics
    errorRate: 0.03,
    successRate: 0.97,
    toolBreakdown: {
      Read: { calls: 25, errors: 0, avgDuration: 0.15, totalDuration: 3.75 },
      Write: { calls: 8, errors: 1, avgDuration: 0.42, totalDuration: 3.36 },
      Grep: { calls: 12, errors: 0, avgDuration: 0.28, totalDuration: 3.36 },
      Edit: { calls: 15, errors: 0, avgDuration: 0.35, totalDuration: 5.25 },
    },

    // ST-27 Agent behavior
    contextSwitches: 7,
    explorationDepth: 15,

    // ST-27 Cost & performance
    costBreakdown: {
      input: 0.195,
      output: 0.12,
      cache: 0.0036,
      total: 0.3186,
      currency: 'USD',
    },
    modelId: 'claude-sonnet-4-5-20250929',
    temperature: 0.2,
    maxTokens: 20800,
    stopReason: 'end_turn',
    timeToFirstToken: 0.85,
    tokensPerSecond: 608.3,

    // Execution tracking
    userPrompts: 2,
    systemIterations: 6,
    humanInterventions: 0,
    iterationLog: [],

    // Metadata
    inputData: { task: 'Implement feature' },
    outputData: { filesCreated: 5 },
    filesModified: ['src/file1.ts', 'src/file2.ts'],

    startedAt: new Date('2025-11-17T10:00:00Z'),
    finishedAt: new Date('2025-11-17T10:02:00Z'),
    retryCount: 0,
    errorType: null,
    errorMessage: null,
  },

  component: {
    id: 'component-789',
    name: 'Full-Stack Developer',
    description: 'Implements code changes',
  },

  workflowRun: {
    id: 'workflow-run-456',
    workflowId: 'workflow-123',
    storyId: 'story-abc',
    status: 'completed',
    startedAt: new Date('2025-11-17T10:00:00Z'),
    completedAt: new Date('2025-11-17T10:30:00Z'),
  },

  workflow: {
    id: 'workflow-123',
    name: 'Standard Development Workflow',
    description: 'Standard flow for story implementation',
  },

  story: {
    id: 'story-abc',
    key: 'ST-2',
    title: 'Comprehensive Agent Statistics Tracking System',
    status: 'impl',
  },

  otelEvent: {
    id: 'event-123',
    projectId: 'project-xyz',
    sessionId: 'session-abc-123',
    workflowRunId: 'workflow-run-456',
    componentRunId: 'component-run-123',
    timestamp: new Date('2025-11-17T10:01:00Z'),
    eventType: 'claude_code.tool_use',
    eventName: 'Tool Call: Read',
    toolName: 'Read',
    toolParameters: { file_path: '/src/index.ts' },
    toolDuration: 0.15,
    toolSuccess: true,
    toolError: null,
    processed: false,
    aggregatedAt: null,
  },
};
