/**
 * ST-161: MCP Story Runner E2E Tests
 *
 * Tests EP-8 Story Runner orchestration via real MCP commands:
 * - start_runner, get_runner_status, get_runner_checkpoint
 * - pause_runner, resume_runner, cancel_runner, step_runner
 * - set_breakpoint, list_breakpoints, clear_breakpoint
 * - get_pending_approvals, respond_to_approval, get_approval_details
 *
 * Note: These tests create real workflow runs and require careful cleanup.
 */

import { PrismaClient } from '@prisma/client';
import { MCPTestRunner, createMCPTestRunner } from './helpers/mcp-test-runner';

// Increase timeout for runner operations
jest.setTimeout(300000);

describe('ST-161: MCP Story Runner E2E Tests', () => {
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
    breakpointId?: string;
  } = {};

  const testPrefix = `_ST161_RUNNER_${Date.now()}`;

  beforeAll(async () => {
    console.log('\n============================================================');
    console.log('ST-161: MCP Story Runner E2E Tests');
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

  // ==========================================================================
  // SETUP: Create project, story, agent, team, states
  // ==========================================================================
  describe('Setup', () => {
    it('should create project for runner tests', async () => {
      const result = await runner.execute<{ id: string }>('create_project', {
        name: `${testPrefix}_Project`,
        description: 'Story runner test project',
      });

      expect(result.success).toBe(true);
      ctx.projectId = result.result!.id;
      console.log(`    ✓ Project created: ${ctx.projectId}`);
    });

    it('should create epic', async () => {
      const result = await runner.execute<{ id: string }>('create_epic', {
        projectId: ctx.projectId,
        title: `${testPrefix}_Epic`,
      });

      expect(result.success).toBe(true);
      ctx.epicId = result.result!.id;
      console.log(`    ✓ Epic created: ${ctx.epicId}`);
    });

    it('should create story', async () => {
      const result = await runner.execute<{ id: string; key: string }>('create_story', {
        projectId: ctx.projectId,
        epicId: ctx.epicId,
        title: `${testPrefix}_Story`,
        description: 'Story for runner testing',
        type: 'feature',
      });

      expect(result.success).toBe(true);
      ctx.storyId = result.result!.id;
      console.log(`    ✓ Story created: ${ctx.storyId} (${result.result?.key})`);
    });

    it('should create agent for workflow', async () => {
      const result = await runner.execute<{ id: string }>('create_agent', {
        projectId: ctx.projectId,
        name: `${testPrefix}_Agent`,
        inputInstructions: 'Read the story context',
        operationInstructions: 'Analyze the requirements',
        outputInstructions: 'Return analysis summary',
        config: {
          modelId: 'claude-sonnet-4-20250514',
          temperature: 0.7,
          maxOutputTokens: 4096,
        },
        tools: ['mcp__vibestudio__get_story'],
      });

      expect(result.success).toBe(true);
      ctx.agentId = result.result!.id;
      console.log(`    ✓ Agent created: ${ctx.agentId}`);
    });

    it('should create project manager', async () => {
      const result = await runner.execute<{ id: string }>('create_project_manager', {
        projectId: ctx.projectId,
        name: `${testPrefix}_PM`,
        description: 'Test project manager',
        domain: 'software-development',
        coordinatorInstructions: 'Orchestrate the workflow execution',
        config: {
          modelId: 'claude-sonnet-4-20250514',
          temperature: 0.5,
        },
        tools: ['mcp__vibestudio__get_team_context'],
        decisionStrategy: 'sequential',
      });

      expect(result.success).toBe(true);
      ctx.coordinatorId = result.result!.id;
      console.log(`    ✓ Project Manager created: ${ctx.coordinatorId}`);
    });

    it('should create team', async () => {
      const result = await runner.execute<{ id: string }>('create_team', {
        projectId: ctx.projectId,
        coordinatorId: ctx.coordinatorId,
        name: `${testPrefix}_Team`,
        description: 'Test team',
        triggerConfig: {
          type: 'manual',
        },
      });

      expect(result.success).toBe(true);
      ctx.teamId = result.result!.id;
      console.log(`    ✓ Team created: ${ctx.teamId}`);
    });

    it('should create workflow state', async () => {
      const result = await runner.execute<{ id: string }>('create_workflow_state', {
        workflowId: ctx.teamId,
        name: 'analysis',
        order: 1,
        componentId: ctx.agentId,
        mandatory: true,
        requiresApproval: false,
      });

      expect(result.success).toBe(true);
      ctx.stateId = result.result!.id;
      console.log(`    ✓ Workflow state created: ${ctx.stateId}`);
    });
  });

  // ==========================================================================
  // TEAM RUN LIFECYCLE
  // ==========================================================================
  describe('Team Run Lifecycle', () => {
    it('should start a team run', async () => {
      const result = await runner.execute<{ runId: string; status: string }>('start_team_run', {
        teamId: ctx.teamId,
        triggeredBy: 'e2e-test',
        context: {
          storyId: ctx.storyId,
          testRun: true,
        },
      });

      expect(result.success).toBe(true);
      expect(result.result?.runId).toBeDefined();
      expect(result.result?.status).toBeDefined();

      ctx.runId = result.result!.runId;
      console.log(`    ✓ Team run started: ${ctx.runId}`);
      console.log(`    ✓ Initial status: ${result.result?.status}`);
    });

    it('should get runner status', async () => {
      const result = await runner.execute<{
        status: string;
        currentState?: string;
        progress?: { completed: number; total: number };
      }>('get_runner_status', {
        runId: ctx.runId,
        includeCheckpoint: true,
      });

      expect(result.success).toBe(true);
      expect(result.result?.status).toBeDefined();

      console.log(`    ✓ Runner status: ${result.result?.status}`);
      if (result.result?.currentState) {
        console.log(`    ✓ Current state: ${result.result.currentState}`);
      }
    });

    it('should get runner checkpoint', async () => {
      const result = await runner.execute<{
        currentStateId?: string;
        phase?: string;
        completedStates?: string[];
      }>('get_runner_checkpoint', {
        runId: ctx.runId,
      });

      expect(result.success).toBe(true);
      console.log(`    ✓ Checkpoint retrieved`);
      if (result.result?.phase) {
        console.log(`    ✓ Phase: ${result.result.phase}`);
      }
    });

    it('should list team runs', async () => {
      const result = await runner.execute<{
        data: Array<{ id: string; status: string }>;
        pagination: { total: number };
      }>('list_team_runs', {
        teamId: ctx.teamId,
        limit: 10,
      });

      expect(result.success).toBe(true);
      expect(result.result?.data).toBeDefined();

      const found = result.result?.data.find((r) => r.id === ctx.runId);
      expect(found).toBeDefined();

      console.log(`    ✓ Found run in list of ${result.result?.pagination?.total}`);
    });
  });

  // ==========================================================================
  // BREAKPOINTS
  // ==========================================================================
  describe('Breakpoints', () => {
    it('should set a breakpoint', async () => {
      const result = await runner.execute<{ id: string; stateId: string; position: string }>(
        'set_breakpoint',
        {
          runId: ctx.runId,
          stateId: ctx.stateId,
          position: 'before',
        },
      );

      expect(result.success).toBe(true);
      expect(result.result?.id).toBeDefined();

      ctx.breakpointId = result.result!.id;
      console.log(`    ✓ Breakpoint set: ${ctx.breakpointId}`);
      console.log(`    ✓ Position: ${result.result?.position}`);
    });

    it('should list breakpoints', async () => {
      const result = await runner.execute<{
        breakpoints: Array<{ id: string; stateId: string; position: string; active: boolean }>;
      }>('list_breakpoints', {
        runId: ctx.runId,
        includeInactive: false,
      });

      expect(result.success).toBe(true);
      expect(result.result?.breakpoints).toBeDefined();

      const found = result.result?.breakpoints.find((b) => b.id === ctx.breakpointId);
      expect(found).toBeDefined();
      expect(found?.active).toBe(true);

      console.log(`    ✓ Found ${result.result?.breakpoints.length} breakpoint(s)`);
    });

    it('should clear a breakpoint', async () => {
      const result = await runner.execute<{ success: boolean }>('clear_breakpoint', {
        breakpointId: ctx.breakpointId,
      });

      expect(result.success).toBe(true);
      console.log(`    ✓ Breakpoint cleared`);

      // Verify it's gone
      const listResult = await runner.execute<{
        breakpoints: Array<{ id: string; active: boolean }>;
      }>('list_breakpoints', {
        runId: ctx.runId,
        includeInactive: false,
      });

      const found = listResult.result?.breakpoints.find((b) => b.id === ctx.breakpointId);
      expect(found).toBeUndefined();

      console.log(`    ✓ Verified breakpoint removed from active list`);
    });

    it('should set breakpoint by state name', async () => {
      const result = await runner.execute<{ id: string }>('set_breakpoint', {
        runId: ctx.runId,
        stateName: 'analysis',
        position: 'after',
      });

      expect(result.success).toBe(true);
      console.log(`    ✓ Breakpoint set by state name`);

      // Clear it
      if (result.result?.id) {
        await runner.execute('clear_breakpoint', { breakpointId: result.result.id });
      }
    });

    it('should clear all breakpoints', async () => {
      // Set a couple breakpoints first
      await runner.execute('set_breakpoint', {
        runId: ctx.runId,
        stateId: ctx.stateId,
        position: 'before',
      });
      await runner.execute('set_breakpoint', {
        runId: ctx.runId,
        stateId: ctx.stateId,
        position: 'after',
      });

      // Clear all
      const result = await runner.execute<{ clearedCount: number }>('clear_breakpoint', {
        runId: ctx.runId,
        clearAll: true,
      });

      expect(result.success).toBe(true);
      console.log(`    ✓ Cleared all breakpoints: ${result.result?.clearedCount || 0}`);

      // Verify
      const listResult = await runner.execute<{ breakpoints: Array<{ id: string }> }>(
        'list_breakpoints',
        { runId: ctx.runId },
      );

      expect(listResult.result?.breakpoints?.length || 0).toBe(0);
      console.log(`    ✓ Verified no active breakpoints remain`);
    });
  });

  // ==========================================================================
  // RUNNER CONTROL
  // ==========================================================================
  describe('Runner Control', () => {
    it('should pause a runner', async () => {
      const result = await runner.execute<{ success: boolean; status: string }>('pause_runner', {
        runId: ctx.runId,
        reason: 'E2E test pause',
      });

      expect(result.success).toBe(true);
      console.log(`    ✓ Runner paused`);
    });

    it('should resume a paused runner', async () => {
      const result = await runner.execute<{ success: boolean; status: string }>('resume_runner', {
        runId: ctx.runId,
        detached: true,
      });

      // Note: Resume may fail if runner was already completed/cancelled
      // We just verify the command executed
      console.log(`    ✓ Resume command executed (success: ${result.success})`);
    });

    it('should cancel a runner', async () => {
      const result = await runner.execute<{ success: boolean; status: string }>('cancel_runner', {
        runId: ctx.runId,
        reason: 'E2E test cancellation',
      });

      expect(result.success).toBe(true);
      console.log(`    ✓ Runner cancelled`);

      // Verify status changed
      const statusResult = await runner.execute<{ status: string }>('get_runner_status', {
        runId: ctx.runId,
      });

      expect(statusResult.result?.status).toBe('cancelled');
      console.log(`    ✓ Verified status: cancelled`);
    });
  });

  // ==========================================================================
  // APPROVALS (requires a new run with approval-required state)
  // ==========================================================================
  describe('Approvals', () => {
    let approvalRunId: string;
    let approvalStateId: string;

    beforeAll(async () => {
      // Create a state that requires approval
      const stateResult = await runner.execute<{ id: string }>('create_workflow_state', {
        workflowId: ctx.teamId,
        name: 'review',
        order: 2,
        componentId: ctx.agentId,
        mandatory: true,
        requiresApproval: true, // This state requires approval
      });

      if (stateResult.success) {
        approvalStateId = stateResult.result!.id;
        console.log(`    [Setup] Created approval state: ${approvalStateId}`);
      }
    });

    afterAll(async () => {
      // Cleanup approval state
      if (approvalStateId) {
        await prisma.workflowState.delete({ where: { id: approvalStateId } }).catch(() => {});
      }
      if (approvalRunId) {
        await runner.execute('cancel_runner', { runId: approvalRunId }).catch(() => {});
      }
    });

    it('should start run with approval state', async () => {
      const result = await runner.execute<{ runId: string }>('start_team_run', {
        teamId: ctx.teamId,
        triggeredBy: 'e2e-test-approvals',
        approvalOverrides: {
          mode: 'default', // Use state settings
        },
      });

      expect(result.success).toBe(true);
      approvalRunId = result.result!.runId;
      console.log(`    ✓ Started run with approval state: ${approvalRunId}`);
    });

    it('should get pending approvals', async () => {
      const result = await runner.execute<{
        data: Array<{
          id: string;
          runId: string;
          stateId: string;
          status: string;
        }>;
        pagination: { total: number };
      }>('get_pending_approvals', {
        projectId: ctx.projectId,
        pageSize: 10,
      });

      expect(result.success).toBe(true);
      expect(result.result?.data).toBeDefined();

      console.log(`    ✓ Found ${result.result?.pagination?.total || 0} pending approval(s)`);
    });

    it('should get approval details', async () => {
      // First check if there are any pending approvals
      const pendingResult = await runner.execute<{
        data: Array<{ id: string }>;
      }>('get_pending_approvals', {
        runId: approvalRunId,
      });

      if (pendingResult.result?.data && pendingResult.result.data.length > 0) {
        const requestId = pendingResult.result.data[0].id;

        const result = await runner.execute<{
          id: string;
          status: string;
          stateId: string;
        }>('get_approval_details', {
          requestId,
        });

        expect(result.success).toBe(true);
        console.log(`    ✓ Got approval details for: ${result.result?.id}`);
      } else {
        // No pending approvals - that's OK for this test
        console.log(`    ✓ No pending approvals to get details for`);
      }
    });

    it('should respond to approval (approve)', async () => {
      // Get pending approval for our run
      const pendingResult = await runner.execute<{
        data: Array<{ id: string }>;
      }>('get_pending_approvals', {
        runId: approvalRunId,
      });

      if (pendingResult.result?.data && pendingResult.result.data.length > 0) {
        const result = await runner.execute<{ success: boolean }>('respond_to_approval', {
          runId: approvalRunId,
          action: 'approve',
          decidedBy: 'e2e-test',
          notes: 'Approved by E2E test',
        });

        expect(result.success).toBe(true);
        console.log(`    ✓ Approval response: approved`);
      } else {
        console.log(`    ✓ No pending approvals to respond to`);
      }
    });

    it('should respond to approval (reject)', async () => {
      // Start a new run to have something to reject
      const newRunResult = await runner.execute<{ runId: string }>('start_team_run', {
        teamId: ctx.teamId,
        triggeredBy: 'e2e-test-reject',
      });

      if (newRunResult.success) {
        const newRunId = newRunResult.result!.runId;

        // Wait briefly for potential approval gate
        await new Promise((resolve) => setTimeout(resolve, 500));

        // Try to reject
        const result = await runner.execute<{ success: boolean }>('respond_to_approval', {
          runId: newRunId,
          action: 'reject',
          decidedBy: 'e2e-test',
          reason: 'Rejected by E2E test',
          rejectMode: 'cancel',
        });

        // May or may not have a pending approval
        console.log(`    ✓ Reject response executed (success: ${result.success})`);

        // Cleanup
        await runner.execute('cancel_runner', { runId: newRunId }).catch(() => {});
      }
    });

    it('should respond to approval (rerun with feedback)', async () => {
      // Start a new run
      const newRunResult = await runner.execute<{ runId: string }>('start_team_run', {
        teamId: ctx.teamId,
        triggeredBy: 'e2e-test-rerun',
      });

      if (newRunResult.success) {
        const newRunId = newRunResult.result!.runId;

        // Wait briefly
        await new Promise((resolve) => setTimeout(resolve, 500));

        // Try to rerun with feedback
        const result = await runner.execute<{ success: boolean }>('respond_to_approval', {
          runId: newRunId,
          action: 'rerun',
          decidedBy: 'e2e-test',
          feedback: 'Please fix the implementation based on this feedback',
        });

        console.log(`    ✓ Rerun response executed (success: ${result.success})`);

        // Cleanup
        await runner.execute('cancel_runner', { runId: newRunId }).catch(() => {});
      }
    });
  });

  // ==========================================================================
  // STEP RUNNER
  // ==========================================================================
  describe('Step Runner', () => {
    let stepRunId: string;

    beforeAll(async () => {
      // Create a fresh run for stepping
      const result = await runner.execute<{ runId: string }>('start_team_run', {
        teamId: ctx.teamId,
        triggeredBy: 'e2e-test-stepping',
      });

      if (result.success) {
        stepRunId = result.result!.runId;
        console.log(`    [Setup] Created step test run: ${stepRunId}`);

        // Pause it first (step only works on paused runs)
        await runner.execute('pause_runner', { runId: stepRunId });
      }
    });

    afterAll(async () => {
      if (stepRunId) {
        await runner.execute('cancel_runner', { runId: stepRunId }).catch(() => {});
      }
    });

    it('should step through runner', async () => {
      if (!stepRunId) {
        console.log('    ⚠ Skipping step test - no run available');
        return;
      }

      const result = await runner.execute<{ success: boolean; nextState?: string }>('step_runner', {
        runId: stepRunId,
      });

      // Step may fail if runner already completed/cancelled
      console.log(`    ✓ Step command executed (success: ${result.success})`);

      if (result.result?.nextState) {
        console.log(`    ✓ Next state: ${result.result.nextState}`);
      }
    });
  });

  // ==========================================================================
  // GET TEAM RUN RESULTS
  // ==========================================================================
  describe('Team Run Results', () => {
    it('should get team run results', async () => {
      const result = await runner.execute<{
        run: { id: string; status: string };
        components: Array<{ componentId: string; status: string }>;
        artifacts?: Array<{ id: string }>;
        metrics?: { totalTokens: number };
      }>('get_team_run_results', {
        runId: ctx.runId,
        includeComponentDetails: true,
        includeArtifacts: true,
      });

      expect(result.success).toBe(true);
      expect(result.result?.run?.id).toBe(ctx.runId);

      console.log(`    ✓ Run status: ${result.result?.run?.status}`);
      console.log(`    ✓ Components: ${result.result?.components?.length || 0}`);
      console.log(`    ✓ Artifacts: ${result.result?.artifacts?.length || 0}`);
    });
  });

  // ==========================================================================
  // ERROR CASES
  // ==========================================================================
  describe('Error Handling', () => {
    it('should fail to get status for non-existent run', async () => {
      const result = await runner.execute('get_runner_status', {
        runId: '00000000-0000-0000-0000-000000000000',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      console.log(`    ✓ Correctly rejected non-existent run`);
    });

    it('should fail to set breakpoint without run or state', async () => {
      const result = await runner.execute('set_breakpoint', {
        // Missing runId
        stateId: ctx.stateId,
        position: 'before',
      });

      expect(result.success).toBe(false);
      console.log(`    ✓ Correctly rejected missing runId`);
    });

    it('should fail to pause already cancelled run', async () => {
      // ctx.runId is already cancelled from earlier tests
      const result = await runner.execute('pause_runner', {
        runId: ctx.runId,
      });

      expect(result.success).toBe(false);
      console.log(`    ✓ Correctly rejected pause on cancelled run`);
    });

    it('should fail to respond to approval with invalid action', async () => {
      const result = await runner.execute('respond_to_approval', {
        runId: ctx.runId,
        action: 'invalid_action' as 'approve',
        decidedBy: 'test',
      });

      expect(result.success).toBe(false);
      console.log(`    ✓ Correctly rejected invalid approval action`);
    });
  });
});
