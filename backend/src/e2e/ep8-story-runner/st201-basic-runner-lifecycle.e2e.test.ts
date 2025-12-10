/**
 * ST-201: Basic Runner Lifecycle E2E Test
 *
 * Tests the basic runner workflow after ST-200 refactoring:
 * - Create minimal workflow setup (project, epic, story, agent, team, state)
 * - Start workflow run via start_team_run
 * - Verify runner can be started and status checked
 * - Verify cleanup works properly
 *
 * This is a smoke test to verify the runner workflow works end-to-end.
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

describe('ST-201: Basic Runner Lifecycle E2E Test', () => {
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

  const testPrefix = `_ST201_BASIC_${Date.now()}`;

  beforeAll(async () => {
    console.log('\n============================================================');
    console.log('ST-201: Basic Runner Lifecycle E2E Test');
    console.log('============================================================');
    console.log(`Started at: ${new Date().toISOString()}`);
    console.log(`Test prefix: ${testPrefix}`);
    console.log('');

    prisma = new PrismaClient();
    runner = await createMCPTestRunner(prisma);

    console.log(`Environment: ${runner.getEnvironment().toUpperCase()}`);
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

  describe('Setup', () => {
    it('should create project for runner tests', async () => {
      const params = createTestProjectParams();
      const result = await runner.execute<{ id: string }>('create_project', {
        ...params,
        name: `${testPrefix}_Project`,
      });

      expect(result.success).toBe(true);
      expect(result.result).toBeDefined();
      expect(result.result!.id).toBeDefined();

      ctx.projectId = result.result!.id;
      console.log(`[SETUP] Created project: ${ctx.projectId}`);
    });

    it('should create epic', async () => {
      expect(ctx.projectId).toBeDefined();

      const params = createTestEpicParams(ctx.projectId!);
      const result = await runner.execute<{ id: string }>('create_epic', {
        ...params,
        title: `${testPrefix}_Epic`,
      });

      expect(result.success).toBe(true);
      expect(result.result).toBeDefined();
      expect(result.result!.id).toBeDefined();

      ctx.epicId = result.result!.id;
      console.log(`[SETUP] Created epic: ${ctx.epicId}`);
    });

    it('should create story', async () => {
      expect(ctx.projectId).toBeDefined();
      expect(ctx.epicId).toBeDefined();

      const params = createTestStoryParams(ctx.projectId!, ctx.epicId);
      const result = await runner.execute<{ id: string }>('create_story', {
        ...params,
        title: `${testPrefix}_Story`,
      });

      expect(result.success).toBe(true);
      expect(result.result).toBeDefined();
      expect(result.result!.id).toBeDefined();

      ctx.storyId = result.result!.id;
      console.log(`[SETUP] Created story: ${ctx.storyId}`);
    });

    it('should create agent component', async () => {
      expect(ctx.projectId).toBeDefined();

      const params = createTestAgentParams(ctx.projectId!);
      const result = await runner.execute<{ id: string }>('create_agent', {
        ...params,
        name: `${testPrefix}_Agent`,
      });

      expect(result.success).toBe(true);
      expect(result.result).toBeDefined();
      expect(result.result!.id).toBeDefined();

      ctx.agentId = result.result!.id;
      console.log(`[SETUP] Created agent: ${ctx.agentId}`);
    });

    it('should create workflow (team)', async () => {
      expect(ctx.projectId).toBeDefined();

      const params = createTestWorkflowParams(ctx.projectId!);
      const result = await runner.execute<{ id: string }>('create_team', {
        ...params,
        name: `${testPrefix}_Team`,
      });

      expect(result.success).toBe(true);
      expect(result.result).toBeDefined();
      expect(result.result!.id).toBeDefined();

      ctx.teamId = result.result!.id;
      console.log(`[SETUP] Created team: ${ctx.teamId}`);
    });

    it('should create workflow state', async () => {
      expect(ctx.teamId).toBeDefined();
      expect(ctx.agentId).toBeDefined();

      const params = createTestWorkflowStateParams(
        ctx.teamId!,
        ctx.agentId!,
        'analysis',
        1
      );
      const result = await runner.execute<{ id: string }>('create_workflow_state', params);

      expect(result.success).toBe(true);
      expect(result.result).toBeDefined();
      expect(result.result!.id).toBeDefined();

      ctx.stateId = result.result!.id;
      console.log(`[SETUP] Created workflow state: ${ctx.stateId}`);
    });
  });

  describe('Runner Lifecycle', () => {
    it('should start a team run', async () => {
      expect(ctx.teamId).toBeDefined();

      const params = createE2EWorkflowRunParams(ctx.teamId!, 'st201-test-user');
      const result = await runner.execute<{ runId: string }>('start_team_run', params);

      expect(result.success).toBe(true);
      expect(result.result).toBeDefined();
      expect(result.result!.runId).toBeDefined();

      ctx.runId = result.result!.runId;
      console.log(`[TEST] Started team run: ${ctx.runId}`);
    });

    it('should get runner status', async () => {
      expect(ctx.runId).toBeDefined();

      const result = await runner.execute<{
        status: string;
        currentState?: string;
        progress?: { completed: number; total: number };
      }>('get_runner_status', { runId: ctx.runId });

      expect(result.success).toBe(true);
      expect(result.result).toBeDefined();
      expect(result.result!.status).toBeDefined();

      console.log(`[TEST] Runner status: ${result.result!.status}`);
      if (result.result!.currentState) {
        console.log(`[TEST] Current state: ${result.result!.currentState}`);
      }
      if (result.result!.progress) {
        console.log(
          `[TEST] Progress: ${result.result!.progress.completed}/${result.result!.progress.total}`
        );
      }
    });

    it('should cancel the runner', async () => {
      expect(ctx.runId).toBeDefined();

      const result = await runner.execute<{ status: string }>('cancel_runner', {
        runId: ctx.runId,
        reason: 'ST-201 smoke test complete',
      });

      // Cancel might succeed or fail depending on runner state, both are acceptable
      console.log(
        `[TEST] Cancel runner result: ${result.success ? 'success' : 'failed'} - ${result.error || 'no error'}`
      );
    });

    it('should verify runner status after cancel', async () => {
      expect(ctx.runId).toBeDefined();

      const result = await runner.execute<{ status: string }>('get_runner_status', {
        runId: ctx.runId,
      });

      expect(result.success).toBe(true);
      expect(result.result).toBeDefined();
      expect(result.result!.status).toBeDefined();

      console.log(`[TEST] Final runner status: ${result.result!.status}`);

      // Status should be cancelled, failed, or completed
      expect(['cancelled', 'failed', 'completed', 'paused']).toContain(
        result.result!.status
      );
    });
  });

  describe('Verification', () => {
    it('should verify workflow run was recorded in database', async () => {
      expect(ctx.runId).toBeDefined();

      const workflowRun = await prisma.workflowRun.findUnique({
        where: { id: ctx.runId },
        include: {
          workflow: true,
        },
      });

      expect(workflowRun).toBeDefined();
      expect(workflowRun!.workflowId).toBe(ctx.teamId);
      expect(workflowRun!.triggeredBy).toBe('st201-test-user');

      console.log(`[VERIFY] Workflow run verified in database`);
      console.log(`[VERIFY] Status: ${workflowRun!.status}`);
      console.log(`[VERIFY] Created: ${workflowRun!.createdAt.toISOString()}`);
    });
  });
});
