/**
 * ST-201: Error Handling E2E Test
 *
 * Tests error scenarios after ST-200 refactoring:
 * - Invalid workflow ID
 * - Invalid run ID
 * - Missing required parameters
 * - Runner already running
 * - Invalid state transitions
 *
 * This verifies proper error handling in the new WebSocket-based runner.
 */

import { PrismaClient } from '@prisma/client';
import { MCPTestRunner, createMCPTestRunner } from './helpers/mcp-test-runner';
import {
  createTestProjectParams,
  createTestEpicParams,
  createTestStoryParams,
  createTestAgentParams,
  createTestWorkflowParams,
  createTestWorkflowStateParams,
  createE2EWorkflowRunParams,
} from './helpers/test-data-factory';

// Increase timeout for runner operations
jest.setTimeout(300000);

describe('ST-201: Error Handling E2E Test', () => {
  let prisma: PrismaClient;
  let runner: MCPTestRunner;

  // Test context
  const ctx: {
    projectId?: string;
    epicId?: string;
    storyId?: string;
    agentId?: string;
    teamId?: string;
    stateId?: string;
    runId?: string;
  } = {};

  const testPrefix = `_ST201_ERROR_${Date.now()}`;

  beforeAll(async () => {
    console.log('\n============================================================');
    console.log('ST-201: Error Handling E2E Test');
    console.log('============================================================');
    console.log(`Started at: ${new Date().toISOString()}`);
    console.log(`Test prefix: ${testPrefix}`);
    console.log('');

    prisma = new PrismaClient();
    runner = await createMCPTestRunner(prisma);

    console.log(`Environment: ${runner.getEnvironment().toUpperCase()}`);

    // Create minimal setup for valid workflow run
    await setupValidWorkflow();
  });

  afterAll(async () => {
    console.log('\n[CLEANUP] Starting cleanup...');

    try {
      // Cancel any running workflow
      if (ctx.runId) {
        await runner.execute('cancel_runner', { runId: ctx.runId }).catch(() => {});
      }

      // Delete workflow state
      if (ctx.stateId) {
        await prisma.workflowState.delete({ where: { id: ctx.stateId } }).catch(() => {});
      }

      // Delete team/workflow
      if (ctx.teamId) {
        await prisma.workflow.delete({ where: { id: ctx.teamId } }).catch(() => {});
      }

      // Delete agent
      if (ctx.agentId) {
        await prisma.component.delete({ where: { id: ctx.agentId } }).catch(() => {});
      }

      // Delete story
      if (ctx.storyId) {
        await prisma.story.delete({ where: { id: ctx.storyId } }).catch(() => {});
      }

      // Delete epic
      if (ctx.epicId) {
        await prisma.epic.delete({ where: { id: ctx.epicId } }).catch(() => {});
      }

      // Delete project
      if (ctx.projectId) {
        await prisma.project.delete({ where: { id: ctx.projectId } }).catch(() => {});
      }

      console.log('[CLEANUP] Cleanup complete');
    } catch (err) {
      console.error('[CLEANUP] Error during cleanup:', err);
    }

    await prisma.$disconnect();

    console.log('\n============================================================');
    console.log(`Completed at: ${new Date().toISOString()}`);
    console.log('============================================================\n');
  });

  async function setupValidWorkflow() {
    console.log('[SETUP] Creating valid workflow for error testing...');

    // Create project
    const projectParams = createTestProjectParams();
    const projectResult = await runner.execute<{ id: string }>('create_project', {
      ...projectParams,
      name: `${testPrefix}_Project`,
    });
    ctx.projectId = projectResult.result!.id;

    // Create epic
    const epicParams = createTestEpicParams(ctx.projectId!);
    const epicResult = await runner.execute<{ id: string }>('create_epic', {
      ...epicParams,
      title: `${testPrefix}_Epic`,
    });
    ctx.epicId = epicResult.result!.id;

    // Create story
    const storyParams = createTestStoryParams(ctx.projectId!, ctx.epicId);
    const storyResult = await runner.execute<{ id: string }>('create_story', {
      ...storyParams,
      title: `${testPrefix}_Story`,
    });
    ctx.storyId = storyResult.result!.id;

    // Create agent
    const agentParams = createTestAgentParams(ctx.projectId!);
    const agentResult = await runner.execute<{ id: string }>('create_agent', {
      ...agentParams,
      name: `${testPrefix}_Agent`,
    });
    ctx.agentId = agentResult.result!.id;

    // Create team
    const teamParams = createTestWorkflowParams(ctx.projectId!);
    const teamResult = await runner.execute<{ id: string }>('create_team', {
      ...teamParams,
      name: `${testPrefix}_Team`,
    });
    ctx.teamId = teamResult.result!.id;

    // Create workflow state
    const stateParams = createTestWorkflowStateParams(
      ctx.teamId!,
      ctx.agentId!,
      'analysis',
      1
    );
    const stateResult = await runner.execute<{ id: string }>(
      'create_workflow_state',
      stateParams
    );
    ctx.stateId = stateResult.result!.id;

    console.log('[SETUP] Valid workflow created successfully');
  }

  describe('Invalid Workflow ID Errors', () => {
    it('should reject start_team_run with invalid workflow ID', async () => {
      const invalidWorkflowId = '00000000-0000-0000-0000-000000000000';
      const params = createE2EWorkflowRunParams(invalidWorkflowId, 'st201-test-user');

      const result = await runner.execute('start_team_run', params);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();

      console.log(`[TEST] Expected error received: ${result.error}`);
    });

    it('should reject start_runner with invalid workflow ID', async () => {
      const invalidWorkflowId = '00000000-0000-0000-0000-000000000000';
      const invalidRunId = '00000000-0000-0000-0000-000000000001';

      const result = await runner.execute('start_runner', {
        runId: invalidRunId,
        workflowId: invalidWorkflowId,
        triggeredBy: 'st201-test-user',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();

      console.log(`[TEST] Expected error received: ${result.error}`);
    });
  });

  describe('Invalid Run ID Errors', () => {
    it('should reject get_runner_status with non-existent run ID', async () => {
      const invalidRunId = '00000000-0000-0000-0000-000000000000';

      const result = await runner.execute('get_runner_status', { runId: invalidRunId });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();

      console.log(`[TEST] Expected error received: ${result.error}`);
    });

    it('should reject cancel_runner with non-existent run ID', async () => {
      const invalidRunId = '00000000-0000-0000-0000-000000000000';

      const result = await runner.execute('cancel_runner', {
        runId: invalidRunId,
        reason: 'test',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();

      console.log(`[TEST] Expected error received: ${result.error}`);
    });

    it('should reject pause_runner with non-existent run ID', async () => {
      const invalidRunId = '00000000-0000-0000-0000-000000000000';

      const result = await runner.execute('pause_runner', {
        runId: invalidRunId,
        reason: 'test',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();

      console.log(`[TEST] Expected error received: ${result.error}`);
    });
  });

  describe('Missing Parameter Errors', () => {
    it('should reject start_team_run without required teamId', async () => {
      const result = await runner.execute('start_team_run', {
        triggeredBy: 'st201-test-user',
        cwd: '/test',
        sessionId: 'test-session',
        transcriptPath: '/test/transcript.jsonl',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();

      console.log(`[TEST] Expected error received: ${result.error}`);
    });

    it('should reject start_runner without required runId', async () => {
      const result = await runner.execute('start_runner', {
        workflowId: ctx.teamId!,
        triggeredBy: 'st201-test-user',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();

      console.log(`[TEST] Expected error received: ${result.error}`);
    });

    it('should reject get_runner_status without runId', async () => {
      const result = await runner.execute('get_runner_status', {});

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();

      console.log(`[TEST] Expected error received: ${result.error}`);
    });
  });

  describe('Invalid State Transition Errors', () => {
    it('should start a workflow run for state transition tests', async () => {
      const params = createE2EWorkflowRunParams(ctx.teamId!, 'st201-test-user');
      const result = await runner.execute<{ runId: string }>('start_team_run', params);

      expect(result.success).toBe(true);
      ctx.runId = result.result!.runId;

      console.log(`[TEST] Created workflow run: ${ctx.runId}`);
    });

    it('should reject pause_runner on already completed/cancelled run', async () => {
      expect(ctx.runId).toBeDefined();

      // First cancel the run
      await runner.execute('cancel_runner', {
        runId: ctx.runId,
        reason: 'test setup',
      });

      // Try to pause the cancelled run
      const result = await runner.execute('pause_runner', {
        runId: ctx.runId,
        reason: 'test',
      });

      // Should fail because run is already cancelled
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();

      console.log(`[TEST] Expected error on invalid state transition: ${result.error}`);
    });

    it('should reject resume_runner on non-paused run', async () => {
      expect(ctx.runId).toBeDefined();

      // Try to resume a run that was never paused (it's cancelled)
      const result = await runner.execute('resume_runner', { runId: ctx.runId });

      // Should fail because run is not paused
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();

      console.log(`[TEST] Expected error on resume non-paused run: ${result.error}`);
    });
  });

  describe('Breakpoint Errors', () => {
    it('should reject set_breakpoint with invalid run ID', async () => {
      const invalidRunId = '00000000-0000-0000-0000-000000000000';

      const result = await runner.execute('set_breakpoint', {
        runId: invalidRunId,
        stateName: 'analysis',
        position: 'before',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();

      console.log(`[TEST] Expected error received: ${result.error}`);
    });

    it('should reject clear_breakpoint with invalid breakpoint ID', async () => {
      const invalidBreakpointId = '00000000-0000-0000-0000-000000000000';

      const result = await runner.execute('clear_breakpoint', {
        breakpointId: invalidBreakpointId,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();

      console.log(`[TEST] Expected error received: ${result.error}`);
    });
  });

  describe('Approval Errors', () => {
    it('should reject respond_to_approval with invalid run ID', async () => {
      const invalidRunId = '00000000-0000-0000-0000-000000000000';

      const result = await runner.execute('respond_to_approval', {
        runId: invalidRunId,
        action: 'approve',
        decidedBy: 'st201-test-user',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();

      console.log(`[TEST] Expected error received: ${result.error}`);
    });

    it('should reject respond_to_approval with invalid action', async () => {
      expect(ctx.runId).toBeDefined();

      const result = await runner.execute('respond_to_approval', {
        runId: ctx.runId,
        action: 'invalid_action',
        decidedBy: 'st201-test-user',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();

      console.log(`[TEST] Expected error received: ${result.error}`);
    });
  });
});
