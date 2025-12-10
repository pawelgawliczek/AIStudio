/**
 * ST-148 Approval Gates E2E Integration Tests
 *
 * Tests the approval gates functionality (ST-148) via direct MCP handler imports.
 * Runs against production database with dedicated test project for isolation.
 *
 * Test Phases:
 * - Phase 1: Setup (project, workflow, states with requiresApproval)
 * - Phase 2: Approval Request Lifecycle
 * - Phase 3: Approval Response Actions (approve, rerun, reject)
 * - Phase 4: Per-run Approval Overrides
 * - Phase 5: Cleanup
 *
 * @see ST-148 Approval Gates - Human-in-the-Loop
 */

import { PrismaClient } from '@prisma/client';
import { handler as createComponent } from '../../mcp/servers/components/create_component';
import { handler as recordComponentComplete } from '../../mcp/servers/execution/record_component_complete';
import { handler as recordComponentStart } from '../../mcp/servers/execution/record_component_start';
import { handler as startWorkflowRun } from '../../mcp/servers/execution/start_workflow_run';
import { handler as createProject } from '../../mcp/servers/projects/create_project';
import { handler as getApprovalDetails } from '../../mcp/servers/runner/get_approval_details';
import { handler as getPendingApprovals } from '../../mcp/servers/runner/get_pending_approvals';
import { handler as respondToApproval } from '../../mcp/servers/runner/respond_to_approval';
import { handler as createWorkflowState } from '../../mcp/servers/workflow-states/create_workflow_state';
import { handler as updateWorkflowState } from '../../mcp/servers/workflow-states/update_workflow_state';
import { handler as createWorkflow } from '../../mcp/servers/workflows/create_workflow';
import { TEST_CONFIG } from './config/test-config';
import { cleanupTestData } from './helpers/cleanup-utils';
import { TestContext, createTestContext, hasPhase1Entities, hasWorkflowReady } from './helpers/test-context';
import {
  createTestProjectParams,
  createTestAgentParams,
  // Note: ST-164 removed createTestCoordinatorParams
  createTestWorkflowParams,
  createTestWorkflowStateParams,
  createE2EWorkflowRunParams,
} from './helpers/test-data-factory';

// MCP Handler Imports - Core

// MCP Handler Imports - Execution

// MCP Handler Imports - Approval Gates (ST-148)

// Prisma client
const prisma = new PrismaClient();

// Shared test context
let ctx: TestContext;

// Track approval test entities
let approvalRunId: string;
let approvalStateId: string;
let componentRunId: string;
let approvalRequestId: string;

describe('ST-148 Approval Gates E2E Tests', () => {
  // Initialize context
  beforeAll(async () => {
    console.log('\n============================================================');
    console.log('ST-148 Approval Gates E2E Tests');
    console.log('============================================================');
    console.log(`Started at: ${new Date().toISOString()}`);
    console.log(`Test Project: ${TEST_CONFIG.PROJECT_NAME}_ST148`);
    console.log('');

    ctx = createTestContext();
  });

  // Cleanup after all tests
  afterAll(async () => {
    console.log('\n============================================================');
    console.log('CLEANUP');
    console.log('============================================================');

    const result = await cleanupTestData(prisma, ctx);

    if (result.success) {
      console.log('  ✓ All test data removed');
    } else {
      console.log('  ⚠ Cleanup completed with errors:');
      result.errors.forEach(err => console.log(`    - ${err}`));
    }

    await prisma.$disconnect();

    console.log('\n============================================================');
    console.log(`Completed at: ${new Date().toISOString()}`);
    console.log('============================================================');
  });

  // ============================================================
  // PHASE 1: SETUP
  // ============================================================
  describe('Phase 1: Setup', () => {
    it('should create test project for approval testing', async () => {
      const params = {
        ...createTestProjectParams(),
        name: `${TEST_CONFIG.PREFIX}ApprovalTest_${TEST_CONFIG.TIMESTAMP}`,
      };
      const result = await createProject(prisma, params);

      ctx.projectId = result.id;

      expect(result.id).toBeDefined();
      console.log(`  ✓ Project created: ${result.name} (${result.id})`);
    });

    it('should create test agent', async () => {
      expect(ctx.projectId).toBeDefined();

      const params = createTestAgentParams(ctx.projectId!);
      const result = await createComponent(prisma, params);

      ctx.agentComponentId = result.id;

      expect(result.id).toBeDefined();
      console.log(`  ✓ Agent created: ${result.name} (${result.id})`);
    });

    // Note: ST-164 removed coordinator - teams no longer require one

    it('should create workflow', async () => {
      expect(ctx.projectId).toBeDefined();

      // ST-164: no coordinatorId required
      const params = {
        ...createTestWorkflowParams(ctx.projectId!),
        name: `${TEST_CONFIG.PREFIX}ApprovalWorkflow_${TEST_CONFIG.TIMESTAMP}`,
      };
      const result = await createWorkflow(prisma, params);

      ctx.workflowId = result.id;

      expect(result.id).toBeDefined();
      console.log(`  ✓ Workflow created: ${result.name} (${result.id})`);
    });

    it('should create state 1 (analysis) without approval', async () => {
      expect(ctx.workflowId).toBeDefined();

      const params = createTestWorkflowStateParams(
        ctx.workflowId!,
        ctx.agentComponentId!,
        'analysis',
        1,
      );
      const result = await createWorkflowState(prisma, params);

      ctx.workflowStateIds = ctx.workflowStateIds || [];
      ctx.workflowStateIds.push(result.id);

      expect(result.requiresApproval).toBe(false);
      console.log(`  ✓ State 1 created: ${result.name} (requiresApproval: false)`);
    });

    it('should create state 2 (implementation) WITH approval required', async () => {
      expect(ctx.workflowId).toBeDefined();

      const params = {
        ...createTestWorkflowStateParams(
          ctx.workflowId!,
          ctx.agentComponentId!,
          'implementation',
          2,
        ),
        requiresApproval: true,
      };
      const result = await createWorkflowState(prisma, params);

      ctx.workflowStateIds!.push(result.id);
      approvalStateId = result.id;

      expect(result.requiresApproval).toBe(true);
      console.log(`  ✓ State 2 created: ${result.name} (requiresApproval: true)`);
    });

    it('should create state 3 (review) without approval', async () => {
      expect(ctx.workflowId).toBeDefined();

      const params = createTestWorkflowStateParams(
        ctx.workflowId!,
        ctx.agentComponentId!,
        'review',
        3,
      );
      const result = await createWorkflowState(prisma, params);

      ctx.workflowStateIds!.push(result.id);

      console.log(`  ✓ State 3 created: ${result.name}`);
    });
  });

  // ============================================================
  // PHASE 2: APPROVAL REQUEST LIFECYCLE
  // ============================================================
  describe('Phase 2: Approval Request Lifecycle', () => {
    it('should start workflow run', async () => {
      expect(ctx.workflowId).toBeDefined();

      // ST-170: Use E2E helper for required sessionId and transcriptPath
      const runParams = createE2EWorkflowRunParams(ctx.workflowId!, 'st148-e2e-test', {
        context: {
          testCase: 'approval-lifecycle',
        },
      });
      const result = await startWorkflowRun(prisma, runParams);

      ctx.workflowRunId = result.runId;
      approvalRunId = result.runId;

      expect(result.runId).toBeDefined();
      console.log(`  ✓ Workflow run started: ${result.runId}`);
    });

    it('should simulate component execution on approval state', async () => {
      expect(approvalRunId).toBeDefined();
      expect(ctx.agentComponentId).toBeDefined();

      // Record component start
      const startResult = await recordComponentStart(prisma, {
        runId: approvalRunId,
        componentId: ctx.agentComponentId!,
        input: { test: true },
      });

      componentRunId = startResult.componentRunId;

      // Record component complete
      await recordComponentComplete(prisma, {
        runId: approvalRunId,
        componentId: ctx.agentComponentId!,
        status: 'completed',
        output: { implementation: 'Test implementation complete' },
        transcriptMetrics: {
          inputTokens: 1000,
          outputTokens: 500,
          totalTokens: 1500,
          cacheCreationTokens: 0,
          cacheReadTokens: 0,
          model: 'claude-sonnet-4-20250514',
        },
      });

      console.log(`  ✓ Component execution simulated: ${componentRunId}`);
    });

    it('should create approval request (simulating runner behavior)', async () => {
      expect(approvalRunId).toBeDefined();
      expect(approvalStateId).toBeDefined();

      // Create approval request directly (simulating what runner does)
      const approval = await prisma.approvalRequest.create({
        data: {
          workflowRunId: approvalRunId,
          stateId: approvalStateId,
          projectId: ctx.projectId!,
          stateName: 'implementation',
          stateOrder: 2,
          requestedBy: 'st148-e2e-runner',
          contextSummary: 'Implementation phase complete, awaiting approval',
          artifactKeys: ['IMPL_DOC'],
          tokensUsed: 1500,
        },
      });

      approvalRequestId = approval.id;

      // Update run to paused (waiting for approval)
      await prisma.workflowRun.update({
        where: { id: approvalRunId },
        data: {
          status: 'paused',
          isPaused: true,
          pauseReason: 'awaiting_approval',
          currentStateId: approvalStateId,
        },
      });

      expect(approval.id).toBeDefined();
      expect(approval.status).toBe('pending');
      console.log(`  ✓ Approval request created: ${approval.id}`);
    });

    it('should list pending approvals for project', async () => {
      expect(ctx.projectId).toBeDefined();

      const result = await getPendingApprovals(prisma, {
        projectId: ctx.projectId!,
      });

      expect(result.success).toBe(true);
      expect(result.approvals.length).toBeGreaterThan(0);

      const ourApproval = result.approvals.find((a: any) => a.id === approvalRequestId);
      expect(ourApproval).toBeDefined();
      expect(ourApproval.stateName).toBe('implementation');
      expect(ourApproval.waitingMinutes).toBeGreaterThanOrEqual(0);

      console.log(`  ✓ Found ${result.approvals.length} pending approvals`);
      console.log(`    - Our approval: ${ourApproval.stateName} (waiting ${ourApproval.waitingMinutes} min)`);
    });

    it('should get approval details by request ID', async () => {
      expect(approvalRequestId).toBeDefined();

      const result = await getApprovalDetails(prisma, {
        requestId: approvalRequestId,
      });

      expect(result.success).toBe(true);
      expect(result.found).toBe(true);
      expect(result.approval.id).toBe(approvalRequestId);
      expect(result.approval.status).toBe('pending');
      expect(result.approval.stateName).toBe('implementation');
      expect(result.state.requiresApproval).toBe(true);
      expect(result.availableActions).toContain('approve');
      expect(result.availableActions).toContain('rerun');
      expect(result.availableActions).toContain('reject');

      console.log(`  ✓ Approval details retrieved`);
      console.log(`    - Status: ${result.approval.status}`);
      console.log(`    - Actions: ${result.availableActions.join(', ')}`);
    });

    it('should get approval details by run ID', async () => {
      expect(approvalRunId).toBeDefined();

      const result = await getApprovalDetails(prisma, {
        runId: approvalRunId,
      });

      expect(result.success).toBe(true);
      expect(result.found).toBe(true);
      expect(result.approval.id).toBe(approvalRequestId);

      console.log(`  ✓ Found approval by run ID`);
    });
  });

  // ============================================================
  // PHASE 3: APPROVAL RESPONSE ACTIONS
  // ============================================================
  describe('Phase 3: Approval Response Actions', () => {
    describe('Phase 3A: Approve Action', () => {
      let approveTestRunId: string;
      let approveTestApprovalId: string;

      beforeAll(async () => {
        // Create fresh run and approval for approve test
        // ST-170: Use E2E helper for required sessionId and transcriptPath
        const runParams = createE2EWorkflowRunParams(ctx.workflowId!, 'st148-approve-test');
        const runResult = await startWorkflowRun(prisma, runParams);
        approveTestRunId = runResult.runId;

        const approval = await prisma.approvalRequest.create({
          data: {
            workflowRunId: approveTestRunId,
            stateId: approvalStateId,
            projectId: ctx.projectId!,
            stateName: 'implementation',
            stateOrder: 2,
            requestedBy: 'test-runner',
            tokensUsed: 1000,
          },
        });
        approveTestApprovalId = approval.id;

        await prisma.workflowRun.update({
          where: { id: approveTestRunId },
          data: { status: 'paused', isPaused: true },
        });
      });

      it('should approve and trigger resume', async () => {
        const result = await respondToApproval(prisma, {
          runId: approveTestRunId,
          action: 'approve',
          decidedBy: 'e2e-reviewer',
        });

        expect(result.success).toBe(true);
        expect(result.action).toBe('approve');
        expect(result.approval.resolution).toBe('approved');
        expect(result.shouldResume).toBe(true);
        expect(result.shouldRerun).toBe(false);

        console.log(`  ✓ Approval action: approve`);
        console.log(`    - Resume triggered: ${result.resumeTriggered || 'failed (expected in test env)'}`);
      });

      it('should verify approval is no longer pending', async () => {
        const details = await getApprovalDetails(prisma, {
          requestId: approveTestApprovalId,
        });

        expect(details.approval.status).toBe('approved');
        expect(details.approval.resolution).toBe('approved');
        expect(details.approval.resolvedBy).toBe('e2e-reviewer');
        expect(details.availableActions).toHaveLength(0);

        console.log(`  ✓ Approval resolved: ${details.approval.status}`);
      });
    });

    describe('Phase 3B: Rerun Action with Feedback', () => {
      let rerunTestRunId: string;
      let rerunTestApprovalId: string;

      beforeAll(async () => {
        // ST-170: Use E2E helper for required sessionId and transcriptPath
        const runParams = createE2EWorkflowRunParams(ctx.workflowId!, 'st148-rerun-test');
        const runResult = await startWorkflowRun(prisma, runParams);
        rerunTestRunId = runResult.runId;

        const approval = await prisma.approvalRequest.create({
          data: {
            workflowRunId: rerunTestRunId,
            stateId: approvalStateId,
            projectId: ctx.projectId!,
            stateName: 'implementation',
            stateOrder: 2,
            requestedBy: 'test-runner',
            tokensUsed: 1000,
          },
        });
        rerunTestApprovalId = approval.id;

        await prisma.workflowRun.update({
          where: { id: rerunTestRunId },
          data: { status: 'paused', isPaused: true },
        });
      });

      it('should rerun with feedback injection', async () => {
        const feedback = 'Please add error handling for edge cases and improve test coverage';

        const result = await respondToApproval(prisma, {
          runId: rerunTestRunId,
          action: 'rerun',
          decidedBy: 'e2e-reviewer',
          feedback,
        });

        expect(result.success).toBe(true);
        expect(result.action).toBe('rerun');
        expect(result.shouldResume).toBe(true);
        expect(result.shouldRerun).toBe(true);

        console.log(`  ✓ Rerun action with feedback`);
        console.log(`    - Feedback: "${feedback.substring(0, 50)}..."`);
      });

      it('should store feedback in workflow run metadata', async () => {
        const run = await prisma.workflowRun.findUnique({
          where: { id: rerunTestRunId },
          select: { metadata: true },
        });

        const metadata = run?.metadata as Record<string, unknown>;
        expect(metadata.approvalFeedback).toBeDefined();
        expect(metadata.shouldRerunCurrentState).toBe(true);

        console.log(`  ✓ Feedback stored in metadata`);
      });

      it('should reject rerun without feedback', async () => {
        // Create another approval for this test
        // ST-170: Use E2E helper for required sessionId and transcriptPath
        const runParams = createE2EWorkflowRunParams(ctx.workflowId!, 'st148-rerun-validation');
        const runResult = await startWorkflowRun(prisma, runParams);

        await prisma.approvalRequest.create({
          data: {
            workflowRunId: runResult.runId,
            stateId: approvalStateId,
            projectId: ctx.projectId!,
            stateName: 'implementation',
            stateOrder: 2,
            requestedBy: 'test-runner',
            tokensUsed: 500,
          },
        });

        await prisma.workflowRun.update({
          where: { id: runResult.runId },
          data: { status: 'paused', isPaused: true },
        });

        await expect(
          respondToApproval(prisma, {
            runId: runResult.runId,
            action: 'rerun',
            decidedBy: 'e2e-reviewer',
            // Missing feedback
          })
        ).rejects.toThrow(/feedback.*required/i);

        console.log(`  ✓ Rerun without feedback rejected`);
      });
    });

    describe('Phase 3C: Reject Actions', () => {
      let rejectCancelRunId: string;
      let rejectPauseRunId: string;

      beforeAll(async () => {
        // Create run for cancel rejection
        // ST-170: Use E2E helper for required sessionId and transcriptPath
        const cancelRunParams = createE2EWorkflowRunParams(ctx.workflowId!, 'st148-reject-cancel-test');
        const cancelRun = await startWorkflowRun(prisma, cancelRunParams);
        rejectCancelRunId = cancelRun.runId;

        await prisma.approvalRequest.create({
          data: {
            workflowRunId: rejectCancelRunId,
            stateId: approvalStateId,
            projectId: ctx.projectId!,
            stateName: 'implementation',
            stateOrder: 2,
            requestedBy: 'test-runner',
            tokensUsed: 500,
          },
        });

        await prisma.workflowRun.update({
          where: { id: rejectCancelRunId },
          data: { status: 'paused', isPaused: true },
        });

        // Create run for pause rejection
        // ST-170: Use E2E helper for required sessionId and transcriptPath
        const pauseRunParams = createE2EWorkflowRunParams(ctx.workflowId!, 'st148-reject-pause-test');
        const pauseRun = await startWorkflowRun(prisma, pauseRunParams);
        rejectPauseRunId = pauseRun.runId;

        await prisma.approvalRequest.create({
          data: {
            workflowRunId: rejectPauseRunId,
            stateId: approvalStateId,
            projectId: ctx.projectId!,
            stateName: 'implementation',
            stateOrder: 2,
            requestedBy: 'test-runner',
            tokensUsed: 500,
          },
        });

        await prisma.workflowRun.update({
          where: { id: rejectPauseRunId },
          data: { status: 'paused', isPaused: true },
        });
      });

      it('should reject with cancel mode (default)', async () => {
        const result = await respondToApproval(prisma, {
          runId: rejectCancelRunId,
          action: 'reject',
          decidedBy: 'e2e-reviewer',
          reason: 'Implementation does not meet requirements',
        });

        expect(result.success).toBe(true);
        expect(result.action).toBe('reject');
        expect(result.workflowStatus).toBe('cancelled');

        // Verify run is cancelled
        const run = await prisma.workflowRun.findUnique({
          where: { id: rejectCancelRunId },
        });
        expect(run?.status).toBe('cancelled');
        expect(run?.finishedAt).toBeDefined();

        console.log(`  ✓ Reject with cancel: workflow cancelled`);
      });

      it('should reject with pause mode', async () => {
        const result = await respondToApproval(prisma, {
          runId: rejectPauseRunId,
          action: 'reject',
          decidedBy: 'e2e-reviewer',
          rejectMode: 'pause',
          reason: 'Needs manual intervention',
        });

        expect(result.success).toBe(true);
        expect(result.action).toBe('reject');
        expect(result.workflowStatus).toBe('paused');

        // Verify run is paused (not cancelled)
        const run = await prisma.workflowRun.findUnique({
          where: { id: rejectPauseRunId },
        });
        expect(run?.status).toBe('paused');
        expect(run?.finishedAt).toBeNull();

        console.log(`  ✓ Reject with pause: workflow paused for manual intervention`);
      });
    });

    describe('Phase 3D: Error Cases', () => {
      it('should reject approval on non-existent run', async () => {
        await expect(
          respondToApproval(prisma, {
            runId: '00000000-0000-0000-0000-000000000000',
            action: 'approve',
            decidedBy: 'e2e-reviewer',
          })
        ).rejects.toThrow(/not found|no pending/i);

        console.log(`  ✓ Non-existent run rejected`);
      });

      it('should reject approval on run without pending approval', async () => {
        // Create run without approval
        // ST-170: Use E2E helper for required sessionId and transcriptPath
        const runParams = createE2EWorkflowRunParams(ctx.workflowId!, 'st148-no-approval-test');
        const runResult = await startWorkflowRun(prisma, runParams);

        await expect(
          respondToApproval(prisma, {
            runId: runResult.runId,
            action: 'approve',
            decidedBy: 'e2e-reviewer',
          })
        ).rejects.toThrow(/no pending approval/i);

        console.log(`  ✓ Run without pending approval rejected`);
      });

      it('should reject invalid action', async () => {
        // Create fresh approval for test
        // ST-170: Use E2E helper for required sessionId and transcriptPath
        const runParams = createE2EWorkflowRunParams(ctx.workflowId!, 'st148-invalid-action-test');
        const runResult = await startWorkflowRun(prisma, runParams);

        await prisma.approvalRequest.create({
          data: {
            workflowRunId: runResult.runId,
            stateId: approvalStateId,
            projectId: ctx.projectId!,
            stateName: 'implementation',
            stateOrder: 2,
            requestedBy: 'test-runner',
            tokensUsed: 500,
          },
        });

        await prisma.workflowRun.update({
          where: { id: runResult.runId },
          data: { status: 'paused', isPaused: true },
        });

        await expect(
          respondToApproval(prisma, {
            runId: runResult.runId,
            action: 'invalid' as any,
            decidedBy: 'e2e-reviewer',
          })
        ).rejects.toThrow(/invalid action/i);

        console.log(`  ✓ Invalid action rejected`);
      });
    });
  });

  // ============================================================
  // PHASE 4: PER-RUN APPROVAL OVERRIDES
  // ============================================================
  describe('Phase 4: Per-run Approval Overrides', () => {
    it('should accept approvalOverrides in start_team_run', async () => {
      expect(ctx.workflowId).toBeDefined();

      // Test mode: 'all' - require approval for all states
      // ST-170: Use E2E helper for required sessionId and transcriptPath
      const runParams = createE2EWorkflowRunParams(ctx.workflowId!, 'st148-override-all-test', {
        approvalOverrides: {
          mode: 'all',
        },
      });
      const result = await startWorkflowRun(prisma, runParams);

      expect(result.runId).toBeDefined();

      // Verify override stored in metadata
      const run = await prisma.workflowRun.findUnique({
        where: { id: result.runId },
        select: { metadata: true },
      });

      const metadata = run?.metadata as Record<string, unknown>;
      expect(metadata._approvalOverrides).toBeDefined();
      expect((metadata._approvalOverrides as any).mode).toBe('all');

      console.log(`  ✓ Approval override mode='all' stored in metadata`);
    });

    it('should accept mode: none to skip all approvals', async () => {
      // ST-170: Use E2E helper for required sessionId and transcriptPath
      const runParams = createE2EWorkflowRunParams(ctx.workflowId!, 'st148-override-none-test', {
        approvalOverrides: {
          mode: 'none',
        },
      });
      const result = await startWorkflowRun(prisma, runParams);

      const run = await prisma.workflowRun.findUnique({
        where: { id: result.runId },
        select: { metadata: true },
      });

      const metadata = run?.metadata as Record<string, unknown>;
      expect((metadata._approvalOverrides as any).mode).toBe('none');

      console.log(`  ✓ Approval override mode='none' stored in metadata`);
    });

    it('should accept stateOverrides for specific states', async () => {
      // ST-170: Use E2E helper for required sessionId and transcriptPath
      const runParams = createE2EWorkflowRunParams(ctx.workflowId!, 'st148-override-specific-test', {
        approvalOverrides: {
          mode: 'default',
          stateOverrides: {
            analysis: true,     // Require approval for analysis (normally false)
            implementation: false, // Skip approval for implementation (normally true)
          },
        },
      });
      const result = await startWorkflowRun(prisma, runParams);

      const run = await prisma.workflowRun.findUnique({
        where: { id: result.runId },
        select: { metadata: true },
      });

      const metadata = run?.metadata as Record<string, unknown>;
      const overrides = metadata._approvalOverrides as any;
      expect(overrides.mode).toBe('default');
      expect(overrides.stateOverrides.analysis).toBe(true);
      expect(overrides.stateOverrides.implementation).toBe(false);

      console.log(`  ✓ State-specific overrides stored in metadata`);
    });

    it('should default to mode: default when no overrides specified', async () => {
      // ST-170: Use E2E helper for required sessionId and transcriptPath
      const runParams = createE2EWorkflowRunParams(ctx.workflowId!, 'st148-no-override-test');
      const result = await startWorkflowRun(prisma, runParams);

      const run = await prisma.workflowRun.findUnique({
        where: { id: result.runId },
        select: { metadata: true },
      });

      const metadata = run?.metadata as Record<string, unknown>;
      const overrides = metadata._approvalOverrides as any;
      expect(overrides.mode).toBe('default');

      console.log(`  ✓ Default mode applied when no overrides specified`);
    });
  });

  // Final summary
  afterAll(() => {
    console.log('\n============================================================');
    console.log('ST-148 Approval Gates E2E Test Summary');
    console.log('============================================================');
    console.log('  Phase 1: Setup ✓');
    console.log('    - Project, workflow, states with requiresApproval');
    console.log('  Phase 2: Approval Request Lifecycle ✓');
    console.log('    - Create, list, get details');
    console.log('  Phase 3: Approval Response Actions ✓');
    console.log('    - Approve (resume to next state)');
    console.log('    - Rerun (feedback injection)');
    console.log('    - Reject (cancel or pause)');
    console.log('  Phase 4: Per-run Approval Overrides ✓');
    console.log('    - mode: all/none/default');
    console.log('    - stateOverrides for specific states');
  });
});
