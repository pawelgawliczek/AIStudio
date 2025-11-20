/**
 * Coordinator Metrics Test - ST-17
 * Tests that coordinator statistics are properly tracked and updated when workflow completes
 *
 * @jest-environment node
 */

// CRITICAL: Set flag BEFORE any imports to prevent mock loading
process.env.SKIP_PRISMA_MOCK = 'true';

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { PrismaClient } from '@prisma/client';
import { CoordinatorMetricsDto } from '../../../../workflow-runs/dto/workflow-run-response.dto';
import { handler as getWorkflowRunResults } from '../get_workflow_run_results';
import { handler as startWorkflowRun } from '../start_workflow_run';
import { handler as updateWorkflowStatus } from '../update_workflow_status';

// Mock filesystem to simulate transcript files
jest.mock('fs');
const mockFs = fs as jest.Mocked<typeof fs>;

// TODO ST-36: Fix Prisma mocking issue - test needs real DB but Jest setup conflicts
// This test should be moved to a separate integration test suite
describe.skip('ST-17: Coordinator Statistics Not Updated', () => {
  let prisma: PrismaClient;
  let testProjectId: string;
  let testWorkflowId: string;
  let testCoordinatorId: string;
  let testComponentId: string;
  let mockTranscriptDir: string;

  beforeAll(async () => {
    // Debug: Check if DATABASE_URL is actually set
    console.log('DATABASE_URL in beforeAll:', process.env.DATABASE_URL ? 'SET' : 'UNDEFINED');
    console.log('SKIP_PRISMA_MOCK:', process.env.SKIP_PRISMA_MOCK);
    console.log('PrismaClient type:', typeof PrismaClient);
    console.log('PrismaClient name:', PrismaClient.name);

    prisma = new PrismaClient({
      datasources: {
        db: {
          url: process.env.DATABASE_URL || 'postgresql://postgres:CHANGE_ME_POSTGRES_PASSWORD@127.0.0.1:5433/vibestudio?schema=public'
        }
      }
    });

    console.log('Prisma instance created, type:', typeof prisma);
    console.log('Prisma.project:', typeof prisma.project);

    // Create test project
    const project = await prisma.project.create({
      data: {
        name: `Test Project ST-17 ${Date.now()}`,
        description: 'Test project for coordinator metrics',
        localPath: '/opt/stack/AIStudio',
      },
    });
    testProjectId = project.id;

    // Create test coordinator as component with coordinator tags
    const coordinator = await prisma.component.create({
      data: {
        projectId: testProjectId,
        name: 'Test Coordinator',
        description: 'Test coordinator for metrics tracking',
        inputInstructions: 'Coordinator receives workflow context',
        operationInstructions: 'Test instructions',
        outputInstructions: 'Coordinator spawns components',
        config: {
          modelId: 'claude-sonnet-4-5-20250929',
          temperature: 1.0,
          domain: 'software-development',
          decisionStrategy: 'sequential',
          componentIds: [],
        },
        tools: ['record_component_start', 'record_component_complete'],
        tags: ['coordinator', 'orchestrator', 'software-development'],
      },
    });
    testCoordinatorId = coordinator.id;

    // Create test component
    const component = await prisma.component.create({
      data: {
        projectId: testProjectId,
        name: 'Test Component',
        description: 'Test component',
        inputInstructions: 'Test input',
        operationInstructions: 'Test operation',
        outputInstructions: 'Test output',
        config: { modelId: 'claude-sonnet-4-5-20250929' },
        tools: ['Read', 'Write'],
      },
    });
    testComponentId = component.id;

    // Create test workflow
    const workflow = await prisma.workflow.create({
      data: {
        projectId: testProjectId,
        coordinatorId: testCoordinatorId,
        name: 'Test Workflow',
        description: 'Test workflow for metrics tracking',
        triggerConfig: { type: 'manual' },
      },
    });
    testWorkflowId = workflow.id;

    // Setup mock transcript directory
    mockTranscriptDir = path.join(os.homedir(), '.claude', 'projects', '-opt-stack-AIStudio');
  });

  afterAll(async () => {
    // Cleanup test data
    await prisma.workflow.deleteMany({ where: { projectId: testProjectId } });
    await prisma.component.deleteMany({ where: { projectId: testProjectId } });
    // Coordinators are now stored in components table, deleted by line above
    await prisma.project.delete({ where: { id: testProjectId } });
    await prisma.$disconnect();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Coordinator Transcript Tracking', () => {
    it('should detect and record orchestrator transcript at workflow start', async () => {
      // Mock filesystem to simulate transcript directory with existing transcripts
      const mockTranscriptFile = 'test-session-123.jsonl';
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readdirSync.mockReturnValue([mockTranscriptFile] as any);
      mockFs.statSync.mockReturnValue({ mtime: new Date() } as any);

      const result = await startWorkflowRun(prisma, {
        workflowId: testWorkflowId,
        triggeredBy: 'test-user',
        cwd: '/opt/stack/AIStudio',
      });

      expect(result.success).toBe(true);
      expect(result.runId).toBeDefined();

      // Verify transcript tracking metadata was stored
      const workflowRun = await prisma.workflowRun.findUnique({
        where: { id: result.runId },
      });

      const metadata = workflowRun?.metadata as any;
      expect(metadata._transcriptTracking).toBeDefined();
      expect(metadata._transcriptTracking.transcriptDirectory).toBe(mockTranscriptDir);
      expect(metadata._transcriptTracking.orchestratorTranscript).toBe(mockTranscriptFile);
      expect(metadata._transcriptTracking.existingTranscriptsAtStart).toEqual([mockTranscriptFile]);
    });
  });

  describe('Coordinator Metrics Parsing and Storage', () => {
    it('should parse orchestrator transcript and store metrics in coordinatorMetrics field', async () => {
      // Create a workflow run
      const workflowRun = await prisma.workflowRun.create({
        data: {
          workflowId: testWorkflowId,
          coordinatorId: testCoordinatorId,
          projectId: testProjectId,
          status: 'running',
          startedAt: new Date(),
          metadata: {
            _transcriptTracking: {
              projectPath: '/opt/stack/AIStudio',
              transcriptDirectory: mockTranscriptDir,
              orchestratorTranscript: 'coordinator-session.jsonl',
              existingTranscriptsAtStart: [],
            },
          },
        },
      });

      // Mock transcript file with realistic content
      const mockTranscriptPath = path.join(mockTranscriptDir, 'coordinator-session.jsonl');
      const mockTranscriptContent = [
        JSON.stringify({
          type: 'assistant',
          timestamp: new Date().toISOString(),
          message: {
            content: [
              { type: 'text', text: 'Starting workflow execution' },
              { type: 'tool_use', id: '1', name: 'record_component_start', input: {} },
            ],
          },
          usage: {
            input_tokens: 1000,
            output_tokens: 500,
            cache_read_input_tokens: 200,
            cache_creation_input_tokens: 0,
          },
        }),
        JSON.stringify({
          type: 'assistant',
          timestamp: new Date().toISOString(),
          message: {
            content: [
              { type: 'text', text: 'Completing workflow' },
              { type: 'tool_use', id: '2', name: 'update_workflow_status', input: {} },
            ],
          },
          usage: {
            input_tokens: 800,
            output_tokens: 300,
            cache_read_input_tokens: 100,
            cache_creation_input_tokens: 0,
          },
        }),
      ].join('\n');

      mockFs.existsSync.mockReturnValue(true);
      mockFs.createReadStream.mockReturnValue({
        [Symbol.asyncIterator]: async function* () {
          for (const line of mockTranscriptContent.split('\n')) {
            yield line;
          }
        },
      } as any);

      // Update workflow status (this should parse transcript and store metrics)
      const result = await updateWorkflowStatus(prisma, {
        runId: workflowRun.id,
        status: 'completed',
        summary: 'Test workflow completed',
      });

      expect(result.success).toBe(true);
      expect(result.orchestratorMetrics).toBeDefined();
      expect(result.orchestratorMetrics.tokensInput).toBe(1800); // 1000 + 800
      expect(result.orchestratorMetrics.tokensOutput).toBe(800); // 500 + 300
      // Total tokens = input + output only (cache tokens tracked separately)
      expect(result.orchestratorMetrics.totalTokens).toBe(2600); // 1800 + 800 (NOT including 300 cache read)
      expect(result.orchestratorMetrics.tokensCacheRead).toBe(300); // Tracked separately
      expect(result.orchestratorMetrics.toolCalls).toBe(2);

      // Verify metrics are stored in database coordinatorMetrics field (fixes ST-17)
      const updatedRun = await prisma.workflowRun.findUnique({
        where: { id: workflowRun.id },
      });

      expect(updatedRun?.coordinatorMetrics).toBeDefined();
      const coordinatorMetrics = updatedRun?.coordinatorMetrics as CoordinatorMetricsDto;
      expect(coordinatorMetrics.tokensInput).toBe(1800);
      expect(coordinatorMetrics.tokensOutput).toBe(800);
      expect(coordinatorMetrics.totalTokens).toBe(2600); // Fixed: input + output only
      // Note: tokensCacheRead is tracked in component runs, not in coordinator metrics DTO
      expect(coordinatorMetrics.costUsd).toBeGreaterThan(0);
      expect(coordinatorMetrics.toolCalls).toBe(2);
      expect(coordinatorMetrics.dataSource).toBe('transcript');
    });

    it('should aggregate totalTokensInput and totalTokensOutput from coordinator and agents', async () => {
      // Create workflow run with components
      const workflowRun = await prisma.workflowRun.create({
        data: {
          workflowId: testWorkflowId,
          coordinatorId: testCoordinatorId,
          projectId: testProjectId,
          status: 'running',
          startedAt: new Date(),
          metadata: {
            _transcriptTracking: {
              transcriptDirectory: mockTranscriptDir,
              orchestratorTranscript: 'coordinator-session.jsonl',
            },
          },
        },
      });

      // Create completed component runs with metrics
      await prisma.componentRun.create({
        data: {
          workflowRunId: workflowRun.id,
          componentId: testComponentId,
          status: 'completed',
          startedAt: new Date(),
          finishedAt: new Date(),
          tokensInput: 5000,
          tokensOutput: 2000,
          totalTokens: 7000,
          cost: 0.05,
        },
      });

      await prisma.componentRun.create({
        data: {
          workflowRunId: workflowRun.id,
          componentId: testComponentId,
          status: 'completed',
          startedAt: new Date(),
          finishedAt: new Date(),
          tokensInput: 3000,
          tokensOutput: 1500,
          totalTokens: 4500,
          cost: 0.03,
        },
      });

      // Mock coordinator transcript
      mockFs.existsSync.mockReturnValue(true);
      mockFs.createReadStream.mockReturnValue({
        [Symbol.asyncIterator]: async function* () {
          yield JSON.stringify({
            type: 'assistant',
            timestamp: new Date().toISOString(),
            message: { content: [{ type: 'tool_use', name: 'test' }] },
            usage: { input_tokens: 1000, output_tokens: 500 },
          });
        },
      } as any);

      // Complete workflow
      const result = await updateWorkflowStatus(prisma, {
        runId: workflowRun.id,
        status: 'completed',
      });

      expect(result.success).toBe(true);

      // Verify aggregated metrics (fixes ST-17)
      const updatedRun = await prisma.workflowRun.findUnique({
        where: { id: workflowRun.id },
      });

      // totalTokensInput should be: coordinator (1000) + agent1 (5000) + agent2 (3000) = 9000
      expect(updatedRun?.totalTokensInput).toBe(9000);
      // totalTokensOutput should be: coordinator (500) + agent1 (2000) + agent2 (1500) = 4000
      expect(updatedRun?.totalTokensOutput).toBe(4000);
      // totalTokens should be: coordinator (1500) + agents (11500) = 13000
      expect(updatedRun?.totalTokens).toBeGreaterThan(0);
      // estimatedCost should include coordinator + agents
      expect(updatedRun?.estimatedCost).toBeGreaterThan(0.08); // At least agent costs
    });
  });

  describe('get_workflow_run_results Integration', () => {
    it('should return coordinator metrics from coordinatorMetrics field', async () => {
      // Create workflow run with coordinator metrics
      const workflowRun = await prisma.workflowRun.create({
        data: {
          workflowId: testWorkflowId,
          coordinatorId: testCoordinatorId,
          projectId: testProjectId,
          status: 'completed',
          startedAt: new Date(),
          finishedAt: new Date(),
          totalTokensInput: 9000,
          totalTokensOutput: 4000,
          totalTokens: 13000,
          estimatedCost: 0.15,
          coordinatorMetrics: {
            tokensInput: 1000,
            tokensOutput: 500,
            totalTokens: 1500,
            costUsd: 0.02,
            toolCalls: 5,
            userPrompts: 0,
            iterations: 3,
            dataSource: 'transcript',
          },
        },
      });

      // Get workflow run results
      const result = await getWorkflowRunResults(prisma, {
        runId: workflowRun.id,
      });

      expect(result.success).toBe(true);
      expect(result.run).toBeDefined();

      // Verify metrics are properly returned (fixes ST-17)
      expect(result.run.metrics.totalTokensInput).toBe(9000);
      expect(result.run.metrics.totalTokensOutput).toBe(4000);
      expect(result.run.metrics.totalTokens).toBe(13000);
      expect(result.run.metrics.estimatedCost).toBe(0.15);

      // Verify coordinator metrics are returned
      expect(result.run.coordinatorMetrics).toBeDefined();
      const returnedCoordinatorMetrics = result.run.coordinatorMetrics as CoordinatorMetricsDto;
      expect(returnedCoordinatorMetrics.tokensInput).toBe(1000);
      expect(returnedCoordinatorMetrics.tokensOutput).toBe(500);
      expect(returnedCoordinatorMetrics.totalTokens).toBe(1500);
      expect(returnedCoordinatorMetrics.costUsd).toBe(0.02);
      expect(returnedCoordinatorMetrics.toolCalls).toBe(5);
    });

    it('should not return zeros for valid workflow executions', async () => {
      // This test reproduces the bug reported in ST-17
      const workflowRun = await prisma.workflowRun.create({
        data: {
          workflowId: testWorkflowId,
          coordinatorId: testCoordinatorId,
          projectId: testProjectId,
          status: 'running',
          startedAt: new Date(),
          metadata: {
            _transcriptTracking: {
              transcriptDirectory: mockTranscriptDir,
              orchestratorTranscript: 'test-transcript.jsonl',
            },
          },
        },
      });

      // Add component runs
      await prisma.componentRun.create({
        data: {
          workflowRunId: workflowRun.id,
          componentId: testComponentId,
          status: 'completed',
          startedAt: new Date(),
          finishedAt: new Date(),
          tokensInput: 1000,
          tokensOutput: 500,
          totalTokens: 1500,
        },
      });

      // Mock transcript
      mockFs.existsSync.mockReturnValue(true);
      mockFs.createReadStream.mockReturnValue({
        [Symbol.asyncIterator]: async function* () {
          yield JSON.stringify({
            type: 'assistant',
            timestamp: new Date().toISOString(),
            message: { content: [] },
            usage: { input_tokens: 500, output_tokens: 250 },
          });
        },
      } as any);

      // Complete workflow
      await updateWorkflowStatus(prisma, {
        runId: workflowRun.id,
        status: 'completed',
      });

      // Get results
      const result = await getWorkflowRunResults(prisma, {
        runId: workflowRun.id,
      });

      // Verify metrics are NOT zero (bug is fixed)
      expect(result.run.metrics.totalTokensInput).toBeGreaterThan(0);
      expect(result.run.metrics.totalTokensOutput).toBeGreaterThan(0);
      expect(result.run.metrics.totalTokens).toBeGreaterThan(0);
      const finalCoordinatorMetrics = result.run.coordinatorMetrics as CoordinatorMetricsDto;
      expect(finalCoordinatorMetrics.tokensInput).toBeGreaterThan(0);
      expect(finalCoordinatorMetrics.tokensOutput).toBeGreaterThan(0);
      expect(finalCoordinatorMetrics.totalTokens).toBeGreaterThan(0);
    });
  });
});
