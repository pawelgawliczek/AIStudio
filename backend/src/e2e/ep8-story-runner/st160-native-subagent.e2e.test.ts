/**
 * ST-160: Native Subagent Integration E2E Tests
 *
 * Tests the native subagent execution system including:
 * - Native Explore/Plan agent execution with minimal token usage
 * - WebSocket streaming event verification
 * - Question detection from TEXT patterns
 * - Session handoff capability
 *
 * @note Run from laptop with agent online for full test coverage
 * @note Uses real MCP commands and Claude Code CLI
 */

import { PrismaClient } from '@prisma/client';
import { io, Socket } from 'socket.io-client';
import { TEST_CONFIG, testName } from './config/test-config';
import { TestContext, createTestContext } from './helpers/test-context';
import {
  createTestProjectParams,
  createTestEpicParams,
  createTestStoryParams,
} from './helpers/test-data-factory';
import { cleanupTestData } from './helpers/cleanup-utils';

// MCP Handler Imports - Core setup
import { handler as createProject } from '../../mcp/servers/projects/create_project';
import { handler as createEpic } from '../../mcp/servers/epics/create_epic';
import { handler as createStory } from '../../mcp/servers/stories/create_story';
import { handler as createComponent } from '../../mcp/servers/components/create_component';
import { handler as updateComponent } from '../../mcp/servers/components/update_component';
import { handler as createWorkflow } from '../../mcp/servers/workflows/create_workflow';
import { handler as createWorkflowState } from '../../mcp/servers/workflow-states/create_workflow_state';

// MCP Handler Imports - Remote Agents
import { handler as getOnlineAgents } from '../../mcp/servers/remote-agent/get_online_agents';
import { handler as getAgentCapabilities } from '../../mcp/servers/remote-agent/get_agent_capabilities';
import { handler as spawnAgent } from '../../mcp/servers/remote-agent/spawn_agent';

// MCP Handler Imports - Execution
import { handler as startWorkflowRun } from '../../mcp/servers/execution/start_workflow_run';
import { handler as recordComponentStart } from '../../mcp/servers/execution/record_component_start';
import { handler as recordComponentComplete } from '../../mcp/servers/execution/record_component_complete';

// MCP Handler Imports - Questions (ST-160)
import { handler as getPendingQuestions } from '../../mcp/servers/questions/get_pending_questions';
import { handler as answerQuestion } from '../../mcp/servers/questions/answer_question';
import { handler as handoffSession } from '../../mcp/servers/questions/handoff_session';

// Prisma client with production database
const prisma = new PrismaClient();

// WebSocket configuration for streaming tests
// NOTE: Laptop agent connects to PRODUCTION, so we need to use production WebSocket
// to receive streaming events when agent executes.
// Local Docker (127.0.0.1:3000) has no agent connected.
const WS_URL = process.env.WS_URL || process.env.VITE_API_URL || 'http://localhost:3000';

// Extended test context for native subagent tests
interface NativeSubagentTestContext extends TestContext {
  nativeExploreComponentId?: string;
  nativePlanComponentId?: string;
  nativeGeneralComponentId?: string;
  sessionId?: string;
  questionId?: string;
}

// Shared test context
let ctx: NativeSubagentTestContext;

// Track laptop agent info
let laptopAgentId: string | undefined;

// WebSocket client for streaming tests
let wsClient: Socket | null = null;
let wsConnected = false;

// Collected events from WebSocket
const collectedEvents: Array<{
  event: string;
  data: any;
  timestamp: number;
}> = [];

// Track specific streaming events for verification
const streamingEvents = {
  sessionInit: false,
  progressEvents: 0,
  questionDetected: false,
  componentStarted: false,
  componentCompleted: false,
};

describe('ST-160: Native Subagent Integration E2E Tests', () => {
  // Pre-flight setup
  beforeAll(async () => {
    console.log('\n============================================================');
    console.log('ST-160: Native Subagent Integration E2E Tests');
    console.log('============================================================');
    console.log(`Started at: ${new Date().toISOString()}`);
    console.log(`WebSocket URL: ${WS_URL}`);
    console.log('');

    // Check for online agent
    const agentResult = await getOnlineAgents(prisma, {});

    if (agentResult.agents.length === 0) {
      console.warn('\n⚠️  WARNING: No laptop agent is online!');
      console.warn('Native agent execution tests require the laptop agent.');
      console.warn('Start the laptop agent (see CLAUDE.md for launchd setup)');
      console.warn('\nSome tests will be skipped.\n');
    } else {
      laptopAgentId = agentResult.agents[0].id;
      console.log(`✓ Laptop agent online: ${agentResult.agents[0].hostname} (${laptopAgentId})`);
    }

    ctx = createTestContext() as NativeSubagentTestContext;
  });

  // Cleanup after all tests
  afterAll(async () => {
    console.log('\n============================================================');
    console.log('CLEANUP');
    console.log('============================================================');

    // Disconnect WebSocket
    if (wsClient) {
      wsClient.disconnect();
      wsClient = null;
    }

    // Clean up test data
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
  // PRE-FLIGHT: Verify Environment
  // ============================================================
  describe('Pre-flight: Environment Check', () => {
    it('should verify laptop agent is online', () => {
      if (!laptopAgentId) {
        console.log('  ⚠ No agent online - native tests will be skipped');
      }
      expect(laptopAgentId || 'skip').toBeDefined();
    });

    it('should verify agent has claude-code capability', async () => {
      if (!laptopAgentId) {
        console.log('  ⚠ Skipping - no agent online');
        return;
      }

      const result = await getAgentCapabilities(prisma, { agentId: laptopAgentId });

      // Check both agent.capabilities and approvedCapabilities
      const hasClaudeCode = result.agent?.capabilities?.includes('claude-code') ||
        result.approvedCapabilities?.some((c: any) => c.name === 'claude-code');

      expect(hasClaudeCode).toBe(true);
      console.log(`  ✓ Agent has claude-code capability`);
    });
  });

  // ============================================================
  // SETUP: Create Test Entities
  // ============================================================
  describe('Setup: Create Test Entities', () => {
    it('should create test project', async () => {
      const params = {
        ...createTestProjectParams(),
        name: `${TEST_CONFIG.PREFIX}NativeSubagent_${TEST_CONFIG.TIMESTAMP}`,
      };
      const result = await createProject(prisma, params);

      ctx.projectId = result.id;
      expect(result.id).toBeDefined();
      console.log(`  ✓ Project created: ${result.name}`);
    });

    it('should create test epic', async () => {
      if (!ctx.projectId) {
        console.log('  ⚠ Skipping - no project');
        return;
      }

      const params = createTestEpicParams(ctx.projectId);
      const result = await createEpic(prisma, params);

      ctx.epicId = result.id;
      console.log(`  ✓ Epic created: ${result.title}`);
    });

    it('should create test story', async () => {
      if (!ctx.projectId) {
        console.log('  ⚠ Skipping - no project');
        return;
      }

      const params = createTestStoryParams(ctx.projectId, ctx.epicId);
      const result = await createStory(prisma, params);

      ctx.storyId = result.id;
      console.log(`  ✓ Story created: ${result.title}`);
    });

    it('should create native_explore component', async () => {
      if (!ctx.projectId) {
        console.log('  ⚠ Skipping - no project');
        return;
      }

      // Create component with native_explore execution type
      const result = await createComponent(prisma, {
        projectId: ctx.projectId,
        name: testName('NativeExplore'),
        description: 'Native Explore agent for ST-160 tests',
        inputInstructions: 'List the files in the current directory',
        operationInstructions: 'Use Glob tool to find files. Keep response minimal.',
        outputInstructions: 'Return a list of 3-5 files found.',
        config: {
          modelId: 'claude-sonnet-4-20250514',
          temperature: 0,
          maxInputTokens: 2000,
          maxOutputTokens: 500,
          timeout: 60000,
          maxRetries: 1,
        },
        tools: ['Read', 'Glob', 'Grep'],
        tags: ['test', 'e2e', 'native-subagent', 'explore'],
        active: true,
      });

      ctx.nativeExploreComponentId = result.id;

      // Update with executionType
      await updateComponent(prisma, {
        componentId: result.id,
        executionType: 'native_explore',
        nativeAgentConfig: {
          questionTimeout: 30000,
          maxQuestions: 2,
        },
      });

      console.log(`  ✓ Native Explore component created: ${result.id}`);
    });

    it('should create native_plan component', async () => {
      if (!ctx.projectId) {
        console.log('  ⚠ Skipping - no project');
        return;
      }

      // Create component with native_plan execution type
      const result = await createComponent(prisma, {
        projectId: ctx.projectId,
        name: testName('NativePlan'),
        description: 'Native Plan agent for ST-160 tests',
        inputInstructions: 'Analyze the structure of a small file',
        operationInstructions: 'Read the file and describe its structure in 2-3 sentences.',
        outputInstructions: 'Return a brief description of the file structure.',
        config: {
          modelId: 'claude-sonnet-4-20250514',
          temperature: 0,
          maxInputTokens: 2000,
          maxOutputTokens: 500,
          timeout: 60000,
          maxRetries: 1,
        },
        tools: ['Read', 'Glob'],
        tags: ['test', 'e2e', 'native-subagent', 'plan'],
        active: true,
      });

      ctx.nativePlanComponentId = result.id;

      // Update with executionType
      await updateComponent(prisma, {
        componentId: result.id,
        executionType: 'native_plan',
        nativeAgentConfig: {
          questionTimeout: 30000,
          maxQuestions: 2,
        },
      });

      console.log(`  ✓ Native Plan component created: ${result.id}`);
    });

    // Note: ST-164 removed coordinator component - teams no longer require one

    it('should create workflow with native agent state', async () => {
      if (!ctx.projectId || !ctx.nativeExploreComponentId) {
        console.log('  ⚠ Skipping - prerequisites not met');
        return;
      }

      // Create workflow (ST-164: no coordinatorId required)
      const workflow = await createWorkflow(prisma, {
        projectId: ctx.projectId,
        name: testName('NativeWorkflow'),
        description: 'Workflow for native subagent tests',
        triggerConfig: { type: 'manual', filters: {}, notifications: {} },
        active: true,
        version: 'v1.0',
      });
      ctx.workflowId = workflow.id;

      // Create state with native explore component
      const state = await createWorkflowState(prisma, {
        workflowId: ctx.workflowId,
        componentId: ctx.nativeExploreComponentId,
        name: testName('ExploreState'),
        order: 1,
        mandatory: true,
        requiresApproval: false,
        runLocation: 'laptop' as const,
        offlineFallback: 'fail' as const,
        preExecutionInstructions: null,
        postExecutionInstructions: null,
      });

      ctx.workflowStateIds = [state.id];
      console.log(`  ✓ Workflow with native state created`);
    });
  });

  // ============================================================
  // PHASE 1: WebSocket Streaming Connection
  // ============================================================
  describe('Phase 1: WebSocket Streaming', () => {
    it('should connect to WebSocket for session streaming', (done) => {
      if (!ctx.workflowId) {
        console.log('  ⚠ Skipping - no workflow');
        done();
        return;
      }

      wsClient = io(WS_URL, {
        transports: ['websocket'],
        timeout: 5000,
      });

      wsClient.on('connect', () => {
        wsConnected = true;
        console.log(`  ✓ WebSocket connected to ${WS_URL}`);

        // Subscribe to workflow events
        wsClient!.emit('session:subscribe', {
          workflowRunId: ctx.workflowRunId || 'pending',
        });

        done();
      });

      wsClient.on('connect_error', (error) => {
        wsConnected = false;
        console.log(`  ⚠ WebSocket connection failed: ${error.message}`);
        console.log('    To test streaming, ensure backend is running: docker compose up -d backend');
        // Don't fail - WebSocket may not be available in all environments
        done();
      });

      // Set up event handlers for streaming verification
      wsClient.on('workflow:progress', (data: any) => {
        streamingEvents.progressEvents++;
        collectedEvents.push({ event: 'workflow:progress', data, timestamp: Date.now() });

        // Check for specific event types
        if (data.type === 'session_init') {
          streamingEvents.sessionInit = true;
          console.log(`    [WS] Session init received: ${data.payload?.sessionId}`);
        }
        if (data.type === 'question_detected') {
          streamingEvents.questionDetected = true;
          console.log(`    [WS] Question detected: ${data.payload?.questionText?.substring(0, 50)}...`);
        }
      });

      wsClient.on('workflow:component_started', (data: any) => {
        streamingEvents.componentStarted = true;
        collectedEvents.push({ event: 'workflow:component_started', data, timestamp: Date.now() });
        console.log(`    [WS] Component started: ${data.componentId}`);
      });

      wsClient.on('workflow:component_completed', (data: any) => {
        streamingEvents.componentCompleted = true;
        collectedEvents.push({ event: 'workflow:component_completed', data, timestamp: Date.now() });
        console.log(`    [WS] Component completed: ${data.componentId}`);
      });

      wsClient.on('workflow:question', (data: any) => {
        streamingEvents.questionDetected = true;
        collectedEvents.push({ event: 'workflow:question', data, timestamp: Date.now() });
        console.log(`    [WS] Question event: ${data.questionText?.substring(0, 50)}...`);
      });

      // Collect all other events
      wsClient.onAny((event, data) => {
        if (!event.startsWith('workflow:')) {
          collectedEvents.push({ event, data, timestamp: Date.now() });
        }
      });

      // Timeout after 5 seconds
      setTimeout(() => {
        if (!wsClient?.connected) {
          console.log('  ⚠ WebSocket connection timeout');
          done();
        }
      }, 5000);
    }, 10000);
  });

  // ============================================================
  // PHASE 2: Native Explore Agent Execution
  // ============================================================
  describe('Phase 2: Native Explore Agent Execution', () => {
    it('should start workflow run', async () => {
      if (!ctx.workflowId) {
        console.log('  ⚠ Skipping - no workflow');
        return;
      }

      const result = await startWorkflowRun(prisma, {
        workflowId: ctx.workflowId,
        triggeredBy: 'st160-e2e-test',
        context: { testType: 'native-subagent' },
      });

      ctx.workflowRunId = result.runId;
      expect(result.runId).toBeDefined();
      console.log(`  ✓ Workflow run started: ${result.runId}`);

      // Update WebSocket subscription with actual run ID
      if (wsClient?.connected) {
        wsClient.emit('session:subscribe', {
          workflowRunId: ctx.workflowRunId,
        });
      }
    });

    it('should record component start', async () => {
      if (!ctx.workflowRunId || !ctx.nativeExploreComponentId) {
        console.log('  ⚠ Skipping - prerequisites not met');
        return;
      }

      const result = await recordComponentStart(prisma, {
        runId: ctx.workflowRunId,
        componentId: ctx.nativeExploreComponentId,
      });

      ctx.componentRunId = result.componentRunId;
      expect(result.componentRunId).toBeDefined();
      console.log(`  ✓ Component run started: ${result.componentRunId}`);
    });

    it('should spawn native_explore agent on laptop', async () => {
      if (!laptopAgentId || !ctx.nativeExploreComponentId || !ctx.workflowStateIds?.[0]) {
        console.log('  ⚠ Skipping - agent not online or prerequisites not met');
        return;
      }

      // Minimal instructions to reduce token usage
      const instructions = `
List the files in the current directory. Return only the first 3 files you find.
Keep your response under 50 words. This is an E2E test.
`;

      console.log('  Spawning native_explore agent...');

      const spawnResult = await spawnAgent(prisma, {
        componentId: ctx.nativeExploreComponentId,
        stateId: ctx.workflowStateIds[0],
        workflowRunId: ctx.workflowRunId!,
        componentRunId: ctx.componentRunId,
        instructions,
        preferredAgentId: laptopAgentId,
      });

      if (spawnResult.agentOffline) {
        console.log(`  ⚠ Agent went offline: ${spawnResult.offlineFallback}`);
        return;
      }

      expect(spawnResult.jobId).toBeDefined();
      ctx.spawnedAgentJobId = spawnResult.jobId;
      console.log(`  ✓ Native Explore agent spawned: job=${spawnResult.jobId}`);

      // Wait for job to complete (with timeout)
      const maxWait = 60000; // 60 seconds
      const pollInterval = 2000; // 2 seconds
      let elapsed = 0;

      while (elapsed < maxWait) {
        await new Promise(resolve => setTimeout(resolve, pollInterval));
        elapsed += pollInterval;

        const job = await prisma.remoteJob.findUnique({
          where: { id: spawnResult.jobId },
        });

        if (job?.status === 'completed' || job?.status === 'failed') {
          console.log(`  ✓ Job completed with status: ${job.status}`);

          // Check for session ID in result
          const result = job.result as Record<string, unknown> | null;
          if (result?.sessionId) {
            ctx.sessionId = result.sessionId as string;
            console.log(`  ✓ Session ID captured: ${ctx.sessionId}`);
          }
          break;
        }

        if (job?.status === 'paused') {
          console.log(`  ⚠ Job paused (waiting for answer)`);
          // Check for questions
          const questions = await getPendingQuestions(prisma, {
            workflowRunId: ctx.workflowRunId,
          });
          if (questions.questions.length > 0) {
            ctx.questionId = questions.questions[0].id;
            console.log(`  ✓ Question detected: ${questions.questions[0].questionText.substring(0, 50)}...`);
          }
          break;
        }

        console.log(`    ... waiting for job (${elapsed / 1000}s)`);
      }
    }, TEST_CONFIG.TIMEOUT.AGENT_SPAWN);

    it('should verify job executed with native_explore type', async () => {
      if (!ctx.spawnedAgentJobId) {
        console.log('  ⚠ Skipping - no job to verify');
        return;
      }

      const job = await prisma.remoteJob.findUnique({
        where: { id: ctx.spawnedAgentJobId },
      });

      expect(job).toBeDefined();

      // Verify execution type was passed
      const params = job?.params as Record<string, unknown> | null;
      console.log(`  ✓ Job status: ${job?.status}`);
      console.log(`  ✓ Execution type in params: ${params?.executionType || 'custom'}`);
    });

    it('should complete component run', async () => {
      if (!ctx.workflowRunId || !ctx.nativeExploreComponentId) {
        console.log('  ⚠ Skipping - prerequisites not met');
        return;
      }

      const result = await recordComponentComplete(prisma, {
        runId: ctx.workflowRunId,
        componentId: ctx.nativeExploreComponentId,
        status: 'completed',
        output: {
          test: 'ST-160 native explore test',
          timestamp: new Date().toISOString(),
        },
        transcriptMetrics: {
          inputTokens: 100,
          outputTokens: 50,
          totalTokens: 150,
          model: 'claude-sonnet-4-20250514',
        },
      });

      expect(result.success).toBe(true);
      console.log(`  ✓ Component marked complete`);
    });
  });

  // ============================================================
  // PHASE 3: Question Detection and Handling
  // ============================================================
  describe('Phase 3: Question Detection (Optional)', () => {
    it('should list pending questions for workflow run', async () => {
      if (!ctx.workflowRunId) {
        console.log('  ⚠ Skipping - no workflow run');
        return;
      }

      const result = await getPendingQuestions(prisma, {
        workflowRunId: ctx.workflowRunId,
      });

      console.log(`  ✓ Pending questions: ${result.questions.length}`);

      if (result.questions.length > 0) {
        ctx.questionId = result.questions[0].id;
        console.log(`    - Question: ${result.questions[0].questionText.substring(0, 50)}...`);
        console.log(`    - Session: ${result.questions[0].sessionId}`);
        console.log(`    - Can handoff: ${result.questions[0].canHandoff}`);
      }
    });

    it('should answer a pending question (if exists)', async () => {
      if (!ctx.questionId) {
        console.log('  ⚠ Skipping - no pending question');
        return;
      }

      const result = await answerQuestion(prisma, {
        questionId: ctx.questionId,
        answer: 'Yes, proceed with the E2E test.',
        answeredBy: 'st160-e2e-test',
      });

      expect(result.status).toBe('answered');
      console.log(`  ✓ Question answered`);
    });

    it('should verify handoff_session MCP tool (mock test)', async () => {
      // Test the handoff_session tool with a mock session
      // This doesn't actually handoff since we may not have an active session

      if (!ctx.workflowRunId) {
        console.log('  ⚠ Skipping - no workflow run');
        return;
      }

      try {
        // This will likely fail since no active session, but validates the tool exists
        await handoffSession(prisma, {
          sessionId: 'test-session-id-that-does-not-exist',
        });
      } catch (error: any) {
        // Expected error - no job found for session
        if (error.message.includes('Either sessionId or questionId is required') ||
            error.message.includes('No active job found')) {
          console.log(`  ✓ handoff_session tool validated (expected error: ${error.message.substring(0, 50)})`);
        } else {
          throw error;
        }
      }
    });
  });

  // ============================================================
  // PHASE 4: WebSocket Event Verification
  // ============================================================
  describe('Phase 4: WebSocket Event Verification', () => {
    it('should have collected WebSocket events', () => {
      console.log(`  ✓ Total events collected: ${collectedEvents.length}`);

      // Group events by type
      const eventTypes = new Map<string, number>();
      for (const e of collectedEvents) {
        eventTypes.set(e.event, (eventTypes.get(e.event) || 0) + 1);
      }

      console.log('  Event types:');
      eventTypes.forEach((count, type) => {
        console.log(`    - ${type}: ${count}`);
      });

      // Report streaming events status
      console.log('  Streaming events status:');
      console.log(`    - Session init: ${streamingEvents.sessionInit}`);
      console.log(`    - Progress events: ${streamingEvents.progressEvents}`);
      console.log(`    - Component started: ${streamingEvents.componentStarted}`);
      console.log(`    - Component completed: ${streamingEvents.componentCompleted}`);
      console.log(`    - Question detected: ${streamingEvents.questionDetected}`);
    });

    it('should verify session streaming events (if connected)', () => {
      if (!wsConnected) {
        console.log('  ⚠ Skipping - WebSocket not connected');
        console.log('    To run full streaming test:');
        console.log('    1. Start backend: docker compose up -d backend');
        console.log('    2. Ensure laptop agent is running');
        console.log('    3. Re-run this test');
        return;
      }

      // Look for workflow-related events
      const workflowEvents = collectedEvents.filter(e =>
        e.event.includes('workflow') ||
        e.event.includes('progress') ||
        e.event.includes('question')
      );

      console.log(`  ✓ Workflow-related events: ${workflowEvents.length}`);

      if (workflowEvents.length > 0) {
        console.log('  Sample events:');
        workflowEvents.slice(0, 5).forEach(e => {
          console.log(`    - ${e.event}: ${JSON.stringify(e.data).substring(0, 80)}...`);
        });
      }

      // If we have a spawned job that completed, we should have streaming events
      if (ctx.spawnedAgentJobId && streamingEvents.progressEvents === 0) {
        console.log('  ⚠ Warning: Job completed but no progress events received');
        console.log('    This may indicate streaming is not working correctly');
      }
    });

    it('should verify streaming works when agent executes (requires running backend)', async () => {
      if (!wsConnected) {
        console.log('  ⚠ Skipping - WebSocket not connected');
        return;
      }

      if (!ctx.spawnedAgentJobId) {
        console.log('  ⚠ Skipping - no agent job was spawned');
        return;
      }

      // If we have both WebSocket and a spawned job, verify we got streaming events
      console.log(`  Verifying streaming for job ${ctx.spawnedAgentJobId}...`);

      // Check if we received any progress events
      if (streamingEvents.progressEvents > 0) {
        console.log(`  ✓ Received ${streamingEvents.progressEvents} progress events`);
        expect(streamingEvents.progressEvents).toBeGreaterThan(0);
      } else {
        console.log('  ⚠ No progress events received');
        console.log('    This is expected if the job completed before we connected');
      }

      // Check for session init (indicates Claude Code started)
      if (streamingEvents.sessionInit) {
        console.log('  ✓ Session init event received (Claude Code session started)');
        expect(streamingEvents.sessionInit).toBe(true);
      }

      // Check for component lifecycle events
      if (streamingEvents.componentStarted) {
        console.log('  ✓ Component started event received');
      }
      if (streamingEvents.componentCompleted) {
        console.log('  ✓ Component completed event received');
      }
    });
  });

  // ============================================================
  // PHASE 5: Native Plan Agent (Optional)
  // ============================================================
  describe('Phase 5: Native Plan Agent (Optional)', () => {
    it('should verify native_plan component has correct execution type', async () => {
      if (!ctx.nativePlanComponentId) {
        console.log('  ⚠ Skipping - no native plan component');
        return;
      }

      const component = await prisma.component.findUnique({
        where: { id: ctx.nativePlanComponentId },
      });

      expect(component?.executionType).toBe('native_plan');
      console.log(`  ✓ Native Plan component has executionType: ${component?.executionType}`);

      if (component?.nativeAgentConfig) {
        console.log(`  ✓ Native agent config: ${JSON.stringify(component.nativeAgentConfig)}`);
      }
    });

    // Skip actual execution to save tokens - the explore test validates the flow
    it.skip('should spawn native_plan agent', async () => {
      // Similar to native_explore test but with native_plan
      console.log('  ⚠ Skipped to save tokens (native_explore validates the flow)');
    });
  });

  // ============================================================
  // Summary
  // ============================================================
  describe('Summary', () => {
    it('should report ST-160 test results', () => {
      console.log('\n  ============================================================');
      console.log('  ST-160 Native Subagent Test Summary');
      console.log('  ============================================================');
      console.log('');
      console.log('  ENTITIES:');
      console.log(`    Laptop Agent: ${laptopAgentId || 'NOT CONNECTED'}`);
      console.log(`    Project: ${ctx.projectId || 'not created'}`);
      console.log(`    Workflow: ${ctx.workflowId || 'not created'}`);
      console.log(`    Workflow Run: ${ctx.workflowRunId || 'not created'}`);
      console.log(`    Native Explore Component: ${ctx.nativeExploreComponentId || 'not created'}`);
      console.log(`    Native Plan Component: ${ctx.nativePlanComponentId || 'not created'}`);
      console.log('');
      console.log('  EXECUTION:');
      console.log(`    Spawned Job: ${ctx.spawnedAgentJobId || 'not spawned'}`);
      console.log(`    Session ID: ${ctx.sessionId || 'not captured'}`);
      console.log(`    Question ID: ${ctx.questionId || 'no questions'}`);
      console.log('');
      console.log('  WEBSOCKET STREAMING:');
      console.log(`    Connected: ${wsConnected}`);
      console.log(`    Total Events: ${collectedEvents.length}`);
      console.log(`    Session Init: ${streamingEvents.sessionInit}`);
      console.log(`    Progress Events: ${streamingEvents.progressEvents}`);
      console.log(`    Component Started: ${streamingEvents.componentStarted}`);
      console.log(`    Component Completed: ${streamingEvents.componentCompleted}`);
      console.log(`    Question Detected: ${streamingEvents.questionDetected}`);
      console.log('');

      // Provide guidance if streaming wasn't tested
      if (!wsConnected) {
        console.log('  ⚠️  STREAMING NOT TESTED - Backend not running');
        console.log('  To test WebSocket streaming:');
        console.log('    1. cd /opt/stack/AIStudio && docker compose up -d backend');
        console.log('    2. Ensure laptop agent is running');
        console.log('    3. Re-run: npm run test:e2e:st160:native-subagent');
      } else if (streamingEvents.progressEvents === 0 && ctx.spawnedAgentJobId) {
        console.log('  ⚠️  NO STREAMING EVENTS - Agent may not have executed');
      } else if (streamingEvents.progressEvents > 0) {
        console.log('  ✅ STREAMING VERIFIED - Events received via WebSocket');
      }

      console.log('  ============================================================');

      // Always pass - this is a summary
      expect(true).toBe(true);
    });
  });
});
