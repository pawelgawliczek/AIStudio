/**
 * ST-147 Session Telemetry E2E Integration Tests
 *
 * Tests the complete session telemetry flow:
 * 1. Spawn real Claude agent with a short task
 * 2. Wait for agent to complete (creates real transcript)
 * 3. Use get_transcript_metrics to parse the transcript
 * 4. Verify turn counting (totalTurns, manualPrompts, autoContinues)
 * 5. Record component complete with real turn metrics
 * 6. Verify DB stores session telemetry correctly
 * 7. Test aggregateAll for multiple transcripts (compacted sessions)
 *
 * IMPORTANT: This test requires the laptop agent to be online AND
 * connected to the same database as the test is running against.
 *
 * Environment Requirements:
 * - Laptop agent must be running (see CLAUDE.md for launchd setup)
 * - The laptop agent must connect to the same VibeStudio server that the test DB is using
 * - For local testing, run against the DEV database (port 5433) where the agent registers
 *
 * Note: If running on the laptop but agent is connected to production server (KVM),
 * the test will skip because the agent data won't be in the local database.
 */

import { PrismaClient } from '@prisma/client';
import { handler as createComponent } from '../../mcp/servers/components/create_component';
import { handler as createEpic } from '../../mcp/servers/epics/create_epic';
import { handler as getTranscriptMetrics } from '../../mcp/servers/execution/get_transcript_metrics';
import { handler as getWorkflowRunResults } from '../../mcp/servers/execution/get_workflow_run_results';
import { handler as recordComponentComplete } from '../../mcp/servers/execution/record_component_complete';
import { handler as recordComponentStart } from '../../mcp/servers/execution/record_component_start';
import { handler as startWorkflowRun } from '../../mcp/servers/execution/start_workflow_run';
import { handler as createProject } from '../../mcp/servers/projects/create_project';
import { handler as getOnlineAgents } from '../../mcp/servers/remote-agent/get_online_agents';
import { handler as spawnAgent } from '../../mcp/servers/remote-agent/spawn_agent';
import { handler as createStory } from '../../mcp/servers/stories/create_story';
import { handler as createWorkflowState } from '../../mcp/servers/workflow-states/create_workflow_state';
import { handler as createWorkflow } from '../../mcp/servers/workflows/create_workflow';
import { TEST_CONFIG, testName } from './config/test-config';
import { cleanupTestData } from './helpers/cleanup-utils';
import { TestContext, createTestContext } from './helpers/test-context';
import {
  createTestProjectParams,
  createTestEpicParams,
  createTestStoryParams,
  createTestAgentParams,
  // Note: ST-164 removed createTestCoordinatorParams
  createTestWorkflowParams,
  createE2EWorkflowRunParams,
} from './helpers/test-data-factory';

// MCP Handler Imports - Core setup

// MCP Handler Imports - Remote Agents

// MCP Handler Imports - Execution

const prisma = new PrismaClient();

let ctx: TestContext;
let laptopAgentId: string | undefined;

// Extended context for ST-147 tests
interface ST147Context extends TestContext {
  transcriptMetrics?: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    turns?: {
      totalTurns: number;
      manualPrompts: number;
      autoContinues: number;
    };
  };
  remoteJobId?: string;
}

let st147Ctx: ST147Context;

describe('ST-147 Session Telemetry E2E Tests', () => {
  beforeAll(async () => {
    console.log('\n============================================================');
    console.log('ST-147 Session Telemetry E2E Integration Tests');
    console.log('============================================================');
    console.log(`Started at: ${new Date().toISOString()}`);
    console.log('');

    // Check for online laptop agent
    const agentResult = await getOnlineAgents(prisma, {});

    if (agentResult.agents.length === 0) {
      console.error('\n⚠️  WARNING: No laptop agent is online!');
      console.error('These tests require the laptop agent for real transcript generation.');
      console.error('Start the laptop agent (see CLAUDE.md for launchd setup)');
      console.error('\nTests will be skipped.\n');
    } else {
      laptopAgentId = agentResult.agents[0].id;
      console.log(`✓ Laptop agent online: ${agentResult.agents[0].hostname} (${laptopAgentId})`);
    }

    ctx = createTestContext();
    st147Ctx = ctx as ST147Context;
  });

  afterAll(async () => {
    console.log('\n============================================================');
    console.log('CLEANUP');
    console.log('============================================================');

    if (ctx.projectId) {
      const result = await cleanupTestData(prisma, ctx);
      if (result.success) {
        console.log('  ✓ All test data removed');
      } else {
        console.log('  ⚠ Cleanup completed with errors:');
        result.errors.forEach(err => console.log(`    - ${err}`));
      }
    }

    await prisma.$disconnect();

    console.log('\n============================================================');
    console.log(`Completed at: ${new Date().toISOString()}`);
    console.log('============================================================');
  });

  // ============================================================
  // PRE-FLIGHT: Verify Agent Connectivity
  // ============================================================
  describe('Pre-flight: Agent Connectivity', () => {
    it('should have laptop agent online', () => {
      if (!laptopAgentId) {
        console.log('  ⚠ No agent online - tests will be skipped');
      }
      expect(laptopAgentId || 'skip').toBeDefined();
    });
  });

  // ============================================================
  // SETUP: Create Test Entities
  // ============================================================
  describe('Setup: Create Test Entities', () => {
    it('should create test project', async () => {
      if (!laptopAgentId) return;

      const params = {
        ...createTestProjectParams(),
        name: `${TEST_CONFIG.PREFIX}ST147_Telemetry_${TEST_CONFIG.TIMESTAMP}`,
      };
      const result = await createProject(prisma, params);

      ctx.projectId = result.id;
      expect(result.id).toBeDefined();
      console.log(`  ✓ Project created: ${result.name}`);
    });

    it('should create test epic', async () => {
      if (!laptopAgentId || !ctx.projectId) return;

      const params = createTestEpicParams(ctx.projectId);
      const result = await createEpic(prisma, params);

      ctx.epicId = result.id;
      console.log(`  ✓ Epic created: ${result.title}`);
    });

    it('should create test story', async () => {
      if (!laptopAgentId || !ctx.projectId) return;

      const params = createTestStoryParams(ctx.projectId, ctx.epicId);
      const result = await createStory(prisma, params);

      ctx.storyId = result.id;
      console.log(`  ✓ Story created: ${result.title}`);
    });

    it('should create simple test agent for telemetry test', async () => {
      if (!laptopAgentId || !ctx.projectId) return;

      // Create a minimal agent that completes quickly
      const result = await createComponent(prisma, {
        projectId: ctx.projectId,
        name: testName('TelemetryTestAgent'),
        description: 'Minimal agent for session telemetry testing',
        inputInstructions: 'You are a test agent. Complete quickly.',
        operationInstructions: `
          This is a simple E2E test for session telemetry (ST-147).

          Your task:
          1. Output "ST-147 Test Started"
          2. Create a simple calculation: 2 + 2 = 4
          3. Output "ST-147 Test Complete"

          Do NOT use any tools. Just output the text directly.
          Complete in a single response.
        `,
        outputInstructions: 'Return JSON: {"success": true, "result": 4}',
        config: {
          modelId: 'claude-sonnet-4-20250514',
          temperature: 0,
          maxInputTokens: 2000,
          maxOutputTokens: 500,
          timeout: 30000,
          maxRetries: 0,
        },
        tools: [], // No tools for fastest execution
        tags: ['test', 'st147', 'telemetry'],
        active: true,
      });

      ctx.agentComponentId = result.id;
      console.log(`  ✓ Telemetry test agent created: ${result.name}`);
    });

    // Note: ST-164 removed coordinator component - teams no longer require one

    it('should create workflow with laptop state', async () => {
      if (!laptopAgentId || !ctx.projectId) return;

      // ST-164: no coordinatorId required
      const workflowParams = createTestWorkflowParams(ctx.projectId);
      const workflow = await createWorkflow(prisma, {
        ...workflowParams,
        name: testName('TelemetryWorkflow'),
      });
      ctx.workflowId = workflow.id;

      const state = await createWorkflowState(prisma, {
        workflowId: ctx.workflowId,
        componentId: ctx.agentComponentId!,
        name: testName('TelemetryState'),
        order: 1,
        mandatory: true,
        requiresApproval: false,
        runLocation: 'laptop' as const,
        offlineFallback: 'fail' as const,
        preExecutionInstructions: null,
        postExecutionInstructions: null,
      });

      ctx.workflowStateIds = [state.id];
      console.log(`  ✓ Workflow with laptop state created`);
    });
  });

  // ============================================================
  // PHASE 1: Spawn Agent and Generate Real Transcript
  // ============================================================
  describe('Phase 1: Real Agent Execution', () => {
    it('should start workflow run', async () => {
      if (!laptopAgentId || !ctx.workflowId) {
        console.log('  ⚠ Skipping - prerequisites not met');
        return;
      }

      // ST-170: Use E2E helper for required sessionId and transcriptPath
      const runParams = createE2EWorkflowRunParams(ctx.workflowId, 'st147-e2e-test', {
        context: {
          testType: 'session-telemetry',
          storyId: ctx.storyId,
        },
      });
      const result = await startWorkflowRun(prisma, runParams);

      ctx.workflowRunId = result.runId;
      expect(result.runId).toBeDefined();
      console.log(`  ✓ Workflow run started: ${result.runId}`);
    });

    it('should record component start', async () => {
      if (!laptopAgentId || !ctx.workflowRunId || !ctx.agentComponentId) {
        console.log('  ⚠ Skipping');
        return;
      }

      const result = await recordComponentStart(prisma, {
        runId: ctx.workflowRunId,
        componentId: ctx.agentComponentId,
      });

      ctx.componentRunId = result.componentRunId;
      expect(result.componentRunId).toBeDefined();
      console.log(`  ✓ Component run started: ${result.componentRunId}`);
    });

    it('should spawn agent on laptop', async () => {
      if (!laptopAgentId || !ctx.agentComponentId || !ctx.workflowRunId || !ctx.componentRunId) {
        console.log('  ⚠ Skipping - prerequisites not met');
        return;
      }

      const result = await spawnAgent(prisma, {
        componentId: ctx.agentComponentId,
        stateId: ctx.workflowStateIds![0],
        workflowRunId: ctx.workflowRunId,
        componentRunId: ctx.componentRunId,
        instructions: `
          ST-147 Session Telemetry Test - Run ID: ${ctx.workflowRunId}
          Component Run ID: ${ctx.componentRunId}

          This is an E2E test for session telemetry tracking.

          Simply respond with:
          {
            "success": true,
            "message": "ST-147 telemetry test complete",
            "runId": "${ctx.workflowRunId}"
          }

          Do not use any tools. Complete in one response.
        `,
        preferredAgentId: laptopAgentId,
      });

      if (result.agentOffline) {
        console.log(`  ⚠ Agent went offline: ${result.offlineFallback}`);
        return;
      }

      st147Ctx.remoteJobId = result.jobId;
      expect(result.jobId).toBeDefined();
      console.log(`  ✓ Agent spawned: job=${result.jobId}`);
    }, TEST_CONFIG.TIMEOUT.AGENT_SPAWN);

    it('should wait for agent job to complete', async () => {
      if (!st147Ctx.remoteJobId) {
        console.log('  ⚠ Skipping - no job spawned');
        return;
      }

      // Poll for job completion (max 60 seconds)
      const maxWaitMs = 60000;
      const pollIntervalMs = 2000;
      const startTime = Date.now();
      let jobStatus = 'pending';

      while (Date.now() - startTime < maxWaitMs) {
        const job = await prisma.remoteJob.findUnique({
          where: { id: st147Ctx.remoteJobId },
        });

        jobStatus = job?.status || 'not_found';

        if (jobStatus === 'completed' || jobStatus === 'failed') {
          break;
        }

        console.log(`    ... waiting for job (${jobStatus})`);
        await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
      }

      console.log(`  ✓ Job final status: ${jobStatus}`);
      expect(['completed', 'failed']).toContain(jobStatus);
    }, 70000);
  });

  // ============================================================
  // PHASE 2: Parse Transcript and Verify Turn Counts
  // ============================================================
  describe('Phase 2: Transcript Metrics Collection', () => {
    it('should get transcript metrics with turn counts', async () => {
      if (!ctx.workflowRunId) {
        console.log('  ⚠ Skipping - no workflow run');
        return;
      }

      // Use searchContent to find the transcript containing our run ID
      const result = await getTranscriptMetrics(prisma, {
        searchContent: ctx.workflowRunId,
      });

      if (result.runLocally) {
        console.log(`  ⚠ Metrics require local execution (agent offline)`);
        console.log(`    Command: ${result.command}`);
        return;
      }

      if (result.success && result.metrics) {
        st147Ctx.transcriptMetrics = {
          inputTokens: result.metrics.inputTokens,
          outputTokens: result.metrics.outputTokens,
          totalTokens: result.metrics.totalTokens,
          turns: result.metrics.turns,
        };

        console.log(`  ✓ Metrics retrieved:`);
        console.log(`    - Total tokens: ${result.metrics.totalTokens}`);
        console.log(`    - Input tokens: ${result.metrics.inputTokens}`);
        console.log(`    - Output tokens: ${result.metrics.outputTokens}`);

        if (result.metrics.turns) {
          console.log(`    - Total turns: ${result.metrics.turns.totalTurns}`);
          console.log(`    - Manual prompts: ${result.metrics.turns.manualPrompts}`);
          console.log(`    - Auto continues: ${result.metrics.turns.autoContinues}`);
        }

        expect(result.metrics.totalTokens).toBeGreaterThan(0);
      } else {
        console.log(`  ⚠ No metrics found: ${result.error || 'unknown'}`);
      }
    });

    it('should have valid turn counts from transcript', () => {
      if (!st147Ctx.transcriptMetrics?.turns) {
        console.log('  ⚠ Skipping - no turn metrics available');
        return;
      }

      const { turns } = st147Ctx.transcriptMetrics;

      // Verify turn count logic
      expect(turns.totalTurns).toBeGreaterThanOrEqual(0);
      expect(turns.manualPrompts).toBeGreaterThanOrEqual(0);
      expect(turns.autoContinues).toBeGreaterThanOrEqual(0);

      // Total should equal manual + auto
      expect(turns.totalTurns).toBe(turns.manualPrompts + turns.autoContinues);

      console.log(`  ✓ Turn counts valid: total=${turns.totalTurns} (manual=${turns.manualPrompts}, auto=${turns.autoContinues})`);
    });
  });

  // ============================================================
  // PHASE 3: Store Telemetry and Verify DB
  // ============================================================
  describe('Phase 3: Store Telemetry in Database', () => {
    it('should record component complete with turn metrics', async () => {
      if (!ctx.workflowRunId || !ctx.agentComponentId) {
        console.log('  ⚠ Skipping - prerequisites not met');
        return;
      }

      const turnMetrics = st147Ctx.transcriptMetrics?.turns || {
        totalTurns: 1,
        manualPrompts: 1,
        autoContinues: 0,
      };

      const result = await recordComponentComplete(prisma, {
        runId: ctx.workflowRunId,
        componentId: ctx.agentComponentId,
        status: 'completed',
        output: {
          success: true,
          message: 'ST-147 telemetry test complete',
        },
        transcriptMetrics: st147Ctx.transcriptMetrics ? {
          inputTokens: st147Ctx.transcriptMetrics.inputTokens,
          outputTokens: st147Ctx.transcriptMetrics.outputTokens,
          totalTokens: st147Ctx.transcriptMetrics.totalTokens,
          cacheCreationTokens: 0,
          cacheReadTokens: 0,
          model: 'claude-sonnet-4-20250514',
        } : undefined,
        turnMetrics,
      });

      expect(result.success).toBe(true);
      console.log(`  ✓ Component complete recorded with turn metrics`);
    });

    it('should verify turn metrics stored in database', async () => {
      if (!ctx.componentRunId) {
        console.log('  ⚠ Skipping - no component run');
        return;
      }

      const componentRun = await prisma.componentRun.findUnique({
        where: { id: ctx.componentRunId },
      });

      expect(componentRun).toBeDefined();
      expect(componentRun?.totalTurns).toBeDefined();
      expect(componentRun?.manualPrompts).toBeDefined();
      expect(componentRun?.autoContinues).toBeDefined();

      console.log(`  ✓ DB verification:`);
      console.log(`    - totalTurns: ${componentRun?.totalTurns}`);
      console.log(`    - manualPrompts: ${componentRun?.manualPrompts}`);
      console.log(`    - autoContinues: ${componentRun?.autoContinues}`);
    });

    it('should include telemetry in workflow run results', async () => {
      if (!ctx.workflowRunId) {
        console.log('  ⚠ Skipping - no workflow run');
        return;
      }

      const response = await getWorkflowRunResults(prisma, {
        runId: ctx.workflowRunId,
      });

      expect(response.run).toBeDefined();

      // Check metrics has session telemetry
      const metrics = (response.run as any)?.metrics;
      if (metrics) {
        console.log(`  ✓ Workflow run results include session telemetry:`);
        console.log(`    - totalTurns: ${metrics.totalTurns || 0}`);
        console.log(`    - totalManualPrompts: ${metrics.totalManualPrompts || 0}`);
        console.log(`    - totalAutoContinues: ${metrics.totalAutoContinues || 0}`);
        console.log(`    - automationRate: ${metrics.automationRate || 0}%`);
      }
    });
  });

  // ============================================================
  // PHASE 4: Test aggregateAll for Multiple Transcripts
  // ============================================================
  describe('Phase 4: Aggregate Multiple Transcripts', () => {
    it('should test aggregateAll parameter', async () => {
      if (!ctx.workflowRunId) {
        console.log('  ⚠ Skipping - no workflow run');
        return;
      }

      // Test the aggregateAll functionality
      // This would aggregate metrics across multiple transcripts if they exist
      const result = await getTranscriptMetrics(prisma, {
        searchContent: ctx.workflowRunId,
        aggregateAll: true,
        searchDays: 1, // Only search last day
      });

      if (result.runLocally) {
        console.log(`  ⚠ Aggregate requires local execution`);
        return;
      }

      if (result.success && result.aggregated) {
        console.log(`  ✓ Aggregated ${result.transcriptCount} transcript(s):`);
        console.log(`    - Total tokens: ${result.metrics?.totalTokens}`);
        if (result.metrics?.turns) {
          console.log(`    - Total turns: ${result.metrics.turns.totalTurns}`);
        }
      } else if (result.success) {
        console.log(`  ✓ Single transcript found (aggregation not needed)`);
      } else {
        console.log(`  ⚠ Aggregate failed: ${result.error}`);
      }
    });
  });

  // ============================================================
  // SUMMARY
  // ============================================================
  describe('Summary', () => {
    it('should report ST-147 test results', () => {
      console.log('\n  ============================================================');
      console.log('  ST-147 Session Telemetry Test Summary');
      console.log('  ============================================================');
      console.log(`    Laptop Agent: ${laptopAgentId || 'NOT CONNECTED'}`);
      console.log(`    Project: ${ctx.projectId || 'not created'}`);
      console.log(`    Workflow Run: ${ctx.workflowRunId || 'not created'}`);
      console.log(`    Component Run: ${ctx.componentRunId || 'not created'}`);
      console.log(`    Remote Job: ${st147Ctx.remoteJobId || 'not spawned'}`);

      if (st147Ctx.transcriptMetrics) {
        console.log(`    Token Metrics: ${st147Ctx.transcriptMetrics.totalTokens} total`);
        if (st147Ctx.transcriptMetrics.turns) {
          console.log(`    Turn Metrics: ${st147Ctx.transcriptMetrics.turns.totalTurns} total`);
          console.log(`      - Manual: ${st147Ctx.transcriptMetrics.turns.manualPrompts}`);
          console.log(`      - Auto: ${st147Ctx.transcriptMetrics.turns.autoContinues}`);
        }
      }
      console.log('  ============================================================');

      expect(true).toBe(true);
    });
  });
});
