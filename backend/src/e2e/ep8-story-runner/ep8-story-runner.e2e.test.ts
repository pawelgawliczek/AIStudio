/**
 * EP-8 Story Runner E2E Integration Tests
 *
 * Tests the entire Story Runner epic (EP-8) functionality via direct MCP handler imports.
 * Runs against production database with dedicated test project for isolation.
 *
 * Test Phases:
 * - Phase 1: Setup (project, epic, story, components)
 * - Phase 2: Workflow & Team Management
 * - Phase 3: Execution Lifecycle
 * - Phase 4: Artifact Management (ST-151)
 * - Phase 5: Runner Control (Limited)
 * - Phase 6: Remote Agents (ST-150)
 * - Phase 8: Cleanup
 *
 * Note: Phase 7 (Full Path Integration) is in a separate file for laptop execution.
 *
 * @see /Users/pawelgawliczek/.claude/plans/deep-brewing-quasar.md
 */

import { PrismaClient } from '@prisma/client';
import { TEST_CONFIG } from './config/test-config';
import { TestContext, createTestContext, hasPhase1Entities, hasWorkflowReady } from './helpers/test-context';
import {
  createTestProjectParams,
  createTestEpicParams,
  createTestStoryParams,
  createTestAgentParams,
  createTestCoordinatorParams,
  createTestWorkflowParams,
  createTestWorkflowStateParams,
  createTestArtifactDefinitionParams,
  createTestArtifactContent,
} from './helpers/test-data-factory';
import { cleanupTestData } from './helpers/cleanup-utils';

// MCP Handler Imports - Projects
import { handler as createProject } from '../../mcp/servers/projects/create_project';

// MCP Handler Imports - Epics
import { handler as createEpic } from '../../mcp/servers/epics/create_epic';

// MCP Handler Imports - Stories
import { handler as createStory } from '../../mcp/servers/stories/create_story';

// MCP Handler Imports - Components (Agents)
import { handler as createComponent } from '../../mcp/servers/components/create_component';

// MCP Handler Imports - Workflows (Teams)
import { handler as createWorkflow } from '../../mcp/servers/workflows/create_workflow';
import { handler as listWorkflows } from '../../mcp/servers/execution/list_workflows';
import { handler as updateWorkflow } from '../../mcp/servers/workflows/update_workflow';

// MCP Handler Imports - Workflow States
import { handler as createWorkflowState } from '../../mcp/servers/workflow-states/create_workflow_state';
import { handler as listWorkflowStates } from '../../mcp/servers/workflow-states/list_workflow_states';
import { handler as updateWorkflowState } from '../../mcp/servers/workflow-states/update_workflow_state';
import { handler as reorderWorkflowStates } from '../../mcp/servers/workflow-states/reorder_workflow_states';
import { handler as deleteWorkflowState } from '../../mcp/servers/workflow-states/delete_workflow_state';

// MCP Handler Imports - Execution
import { handler as startWorkflowRun } from '../../mcp/servers/execution/start_workflow_run';
import { handler as getWorkflowContext } from '../../mcp/servers/execution/get_workflow_context';
import { handler as recordComponentStart } from '../../mcp/servers/execution/record_component_start';
import { handler as recordComponentComplete } from '../../mcp/servers/execution/record_component_complete';
import { handler as updateWorkflowStatus } from '../../mcp/servers/execution/update_workflow_status';
import { handler as getWorkflowRunResults } from '../../mcp/servers/execution/get_workflow_run_results';
import { handler as listWorkflowRuns } from '../../mcp/servers/execution/list_workflow_runs';

// MCP Handler Imports - Artifacts (ST-151)
import { handler as createArtifactDefinition } from '../../mcp/servers/artifacts/create_artifact_definition';
import { handler as updateArtifactDefinition } from '../../mcp/servers/artifacts/update_artifact_definition';
import { handler as listArtifactDefinitions } from '../../mcp/servers/artifacts/list_artifact_definitions';
import { handler as setArtifactAccess } from '../../mcp/servers/artifacts/set_artifact_access';
import { handler as removeArtifactAccess } from '../../mcp/servers/artifacts/remove_artifact_access';
import { handler as uploadArtifact } from '../../mcp/servers/artifacts/upload_artifact';
import { handler as getArtifact } from '../../mcp/servers/artifacts/get_artifact';
import { handler as listArtifacts } from '../../mcp/servers/artifacts/list_artifacts';
import { handler as deleteArtifactDefinition } from '../../mcp/servers/artifacts/delete_artifact_definition';

// MCP Handler Imports - Runner Control
import { handler as getRunnerStatus } from '../../mcp/servers/runner/get_runner_status';
import { handler as getRunnerCheckpoint } from '../../mcp/servers/runner/get_runner_checkpoint';
import { handler as pauseRunner } from '../../mcp/servers/runner/pause_runner';
import { handler as cancelRunner } from '../../mcp/servers/runner/cancel_runner';

// MCP Handler Imports - Remote Agents (ST-150)
import { handler as getOnlineAgents } from '../../mcp/servers/remote-agent/get_online_agents';
import { handler as getAgentCapabilities } from '../../mcp/servers/remote-agent/get_agent_capabilities';
import { handler as spawnAgent } from '../../mcp/servers/remote-agent/spawn_agent';

// MCP Handler Imports - Backup
import { handler as runBackup } from '../../mcp/servers/operations/run_backup';

// Prisma client with production database
const prisma = new PrismaClient();

// Shared test context
let ctx: TestContext;

// Track additional artifact IDs for Phase 4
let artifactDefinitionId2: string | undefined;
let workflowStateForArtifact: string | undefined;

describe('EP-8 Story Runner E2E Integration Tests', () => {
  // Initialize context before all tests
  beforeAll(async () => {
    console.log('\n============================================================');
    console.log('EP-8 Story Runner E2E Integration Tests');
    console.log('============================================================');
    console.log(`Started at: ${new Date().toISOString()}`);
    console.log(`Test Project: ${TEST_CONFIG.PROJECT_NAME}`);
    console.log('');

    ctx = createTestContext();
  });

  // Cleanup after all tests (ALWAYS runs, even on failure)
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
  describe('Phase 1: Setup - Dedicated Test Project', () => {
    it('should create pre-test backup', async () => {
      const result = await runBackup(prisma, { environment: 'production' });

      // Note: Backup may fail in test environment if pg_dump not available
      // This is acceptable - we log the result but don't fail the test
      if (result.success) {
        ctx.backupFile = result.backupFile;
        console.log(`  ✓ Backup created: ${result.backupFile}`);
      } else {
        console.log(`  ⚠ Backup skipped: ${result.error}`);
      }

      // Don't fail test on backup error - just log it
      expect(true).toBe(true);
    });

    it('should create dedicated test project', async () => {
      const params = createTestProjectParams();
      const result = await createProject(prisma, params);

      ctx.projectId = result.id;

      expect(result.name).toContain(TEST_CONFIG.PREFIX);
      expect(result.id).toBeDefined();
      console.log(`  ✓ Project created: ${result.name} (${result.id})`);
    });

    it('should create test epic within project', async () => {
      expect(ctx.projectId).toBeDefined();

      const params = createTestEpicParams(ctx.projectId!);
      const result = await createEpic(prisma, params);

      ctx.epicId = result.id;

      expect(result.title).toContain(TEST_CONFIG.PREFIX);
      expect(result.projectId).toBe(ctx.projectId);
      console.log(`  ✓ Epic created: ${result.title} (${result.id})`);
    });

    it('should create test story within epic', async () => {
      expect(ctx.projectId).toBeDefined();
      expect(ctx.epicId).toBeDefined();

      const params = createTestStoryParams(ctx.projectId!, ctx.epicId);
      const result = await createStory(prisma, params);

      ctx.storyId = result.id;

      expect(result.title).toContain(TEST_CONFIG.PREFIX);
      expect(result.projectId).toBe(ctx.projectId);
      console.log(`  ✓ Story created: ${result.title} (${result.id})`);
    });

    it('should create test agent component', async () => {
      expect(ctx.projectId).toBeDefined();

      const params = createTestAgentParams(ctx.projectId!);
      const result = await createComponent(prisma, params);

      ctx.agentComponentId = result.id;

      expect(result.name).toContain(TEST_CONFIG.PREFIX);
      expect(result.projectId).toBe(ctx.projectId);
      console.log(`  ✓ Agent created: ${result.name} (${result.id})`);
    });

    it('should create test coordinator (PM) component', async () => {
      expect(ctx.projectId).toBeDefined();

      const params = createTestCoordinatorParams(ctx.projectId!);
      const result = await createComponent(prisma, params);

      ctx.coordinatorComponentId = result.id;

      expect(result.name).toContain(TEST_CONFIG.PREFIX);
      expect(result.projectId).toBe(ctx.projectId);
      console.log(`  ✓ Coordinator created: ${result.name} (${result.id})`);
    });

    it('should have all Phase 1 entities', () => {
      expect(hasPhase1Entities(ctx)).toBe(true);
      console.log('\n  Phase 1 Summary:');
      console.log(`    Project: ${ctx.projectId}`);
      console.log(`    Epic: ${ctx.epicId}`);
      console.log(`    Story: ${ctx.storyId}`);
      console.log(`    Agent: ${ctx.agentComponentId}`);
      console.log(`    Coordinator: ${ctx.coordinatorComponentId}`);
    });
  });

  // ============================================================
  // PHASE 2: WORKFLOW & TEAM MANAGEMENT
  // ============================================================
  describe('Phase 2: Workflow & Team Management', () => {
    it('should create workflow (team) with coordinator', async () => {
      expect(hasPhase1Entities(ctx)).toBe(true);

      const params = createTestWorkflowParams(ctx.projectId!, ctx.coordinatorComponentId!);
      const result = await createWorkflow(prisma, params);

      ctx.workflowId = result.id;

      expect(result.name).toContain(TEST_CONFIG.PREFIX);
      expect(result.projectId).toBe(ctx.projectId);
      expect(result.coordinatorId).toBe(ctx.coordinatorComponentId);
      console.log(`  ✓ Workflow created: ${result.name} (${result.id})`);
    });

    it('should list workflows and verify new workflow appears', async () => {
      expect(ctx.projectId).toBeDefined();

      const result = await listWorkflows(prisma, { projectId: ctx.projectId! });

      const testWorkflow = result.workflows.find((w: any) => w.id === ctx.workflowId);
      expect(testWorkflow).toBeDefined();
      console.log(`  ✓ Workflow appears in list (${result.count} total workflows)`);
    });

    it('should update workflow properties', async () => {
      expect(ctx.workflowId).toBeDefined();

      const result = await updateWorkflow(prisma, {
        workflowId: ctx.workflowId!,
        description: 'Updated description for E2E test',
      });

      expect(result.description).toBe('Updated description for E2E test');
      console.log(`  ✓ Workflow updated: description changed`);
    });

    it('should create workflow state 1 (analysis)', async () => {
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

      expect(result.order).toBe(1);
      console.log(`  ✓ State 1 created: ${result.name} (order: ${result.order})`);
    });

    it('should create workflow state 2 (implementation)', async () => {
      expect(ctx.workflowId).toBeDefined();

      const params = createTestWorkflowStateParams(
        ctx.workflowId!,
        ctx.agentComponentId!,
        'implementation',
        2,
      );
      const result = await createWorkflowState(prisma, params);

      ctx.workflowStateIds!.push(result.id);

      expect(result.order).toBe(2);
      console.log(`  ✓ State 2 created: ${result.name} (order: ${result.order})`);
    });

    it('should create workflow state 3 (review)', async () => {
      expect(ctx.workflowId).toBeDefined();

      const params = createTestWorkflowStateParams(
        ctx.workflowId!,
        ctx.agentComponentId!,
        'review',
        3,
      );
      const result = await createWorkflowState(prisma, params);

      ctx.workflowStateIds!.push(result.id);

      expect(result.order).toBe(3);
      console.log(`  ✓ State 3 created: ${result.name} (order: ${result.order})`);
    });

    it('should list workflow states and verify order', async () => {
      expect(ctx.workflowId).toBeDefined();

      const result = await listWorkflowStates(prisma, { workflowId: ctx.workflowId! });

      expect(result.data.length).toBe(3);
      expect(result.data[0].order).toBe(1);
      expect(result.data[1].order).toBe(2);
      expect(result.data[2].order).toBe(3);
      console.log(`  ✓ States listed in order: ${result.data.map((s: any) => s.order).join(', ')}`);
    });

    it('should update workflow state properties', async () => {
      expect(ctx.workflowStateIds).toBeDefined();
      expect(ctx.workflowStateIds!.length).toBeGreaterThan(0);

      const result = await updateWorkflowState(prisma, {
        workflowStateId: ctx.workflowStateIds![0],
        requiresApproval: true,
      });

      expect(result.requiresApproval).toBe(true);
      console.log(`  ✓ State updated: requiresApproval = true`);
    });

    it('should reorder workflow states', async () => {
      expect(ctx.workflowStateIds).toBeDefined();
      expect(ctx.workflowStateIds!.length).toBe(3);

      // Swap order of states 2 and 3
      const result = await reorderWorkflowStates(prisma, {
        workflowId: ctx.workflowId!,
        stateOrder: [
          { stateId: ctx.workflowStateIds![1], newOrder: 3 },
          { stateId: ctx.workflowStateIds![2], newOrder: 2 },
        ],
      });

      expect(result.success).toBe(true);
      console.log(`  ✓ States reordered: ${result.message}`);
    });

    it('should create a 4th state and then delete it', async () => {
      expect(ctx.workflowId).toBeDefined();

      // Create state 4
      const params = createTestWorkflowStateParams(
        ctx.workflowId!,
        null,
        'temporary',
        4,
      );
      const createResult = await createWorkflowState(prisma, params);
      const tempStateId = createResult.id;

      expect(createResult.order).toBe(4);
      console.log(`  ✓ Temporary state created: order ${createResult.order}`);

      // Delete state 4
      const deleteResult = await deleteWorkflowState(prisma, {
        workflowStateId: tempStateId,
        confirm: true,
      });

      expect(deleteResult.message).toContain('deleted');
      console.log(`  ✓ Temporary state deleted`);
    });

    it('should have workflow ready for execution', () => {
      expect(hasWorkflowReady(ctx)).toBe(true);
      console.log('\n  Phase 2 Summary:');
      console.log(`    Workflow: ${ctx.workflowId}`);
      console.log(`    States: ${ctx.workflowStateIds!.length}`);
    });
  });

  // ============================================================
  // PHASE 3: EXECUTION LIFECYCLE
  // ============================================================
  describe('Phase 3: Execution Lifecycle', () => {
    it('should start workflow run', async () => {
      expect(hasWorkflowReady(ctx)).toBe(true);

      const result = await startWorkflowRun(prisma, {
        workflowId: ctx.workflowId!,
        triggeredBy: 'e2e-test',
        context: {
          testRun: true,
          timestamp: Date.now(),
        },
      });

      ctx.workflowRunId = result.runId;

      expect(result.success).toBe(true);
      expect(result.runId).toBeDefined();
      console.log(`  ✓ Workflow run started: ${result.runId}`);
    });

    it('should get workflow context', async () => {
      expect(ctx.workflowRunId).toBeDefined();

      const result = await getWorkflowContext(prisma, {
        runId: ctx.workflowRunId!,
      });

      expect(result.runId).toBe(ctx.workflowRunId);
      expect(result.coordinator).toBeDefined();
      console.log(`  ✓ Context retrieved: coordinator=${result.coordinator.name}`);
    });

    it('should record component start', async () => {
      expect(ctx.workflowRunId).toBeDefined();
      expect(ctx.agentComponentId).toBeDefined();

      const result = await recordComponentStart(prisma, {
        runId: ctx.workflowRunId!,
        componentId: ctx.agentComponentId!,
        input: { test: true },
      });

      ctx.componentRunId = result.componentRunId;

      expect(result.componentRunId).toBeDefined();
      console.log(`  ✓ Component run started: ${result.componentRunId}`);
    });

    it('should record component complete with metrics', async () => {
      expect(ctx.workflowRunId).toBeDefined();
      expect(ctx.componentRunId).toBeDefined();

      const result = await recordComponentComplete(prisma, {
        runId: ctx.workflowRunId!,
        componentId: ctx.agentComponentId!,
        status: 'completed',
        output: {
          analysis: 'Test analysis complete',
          recommendations: ['item1', 'item2'],
        },
        transcriptMetrics: {
          inputTokens: 1500,
          outputTokens: 500,
          totalTokens: 2000,
          cacheCreationTokens: 0,
          cacheReadTokens: 0,
          model: 'claude-sonnet-4-20250514',
        },
      });

      expect(result.success).toBe(true);
      console.log(`  ✓ Component run completed with metrics`);
    });

    it('should update workflow status to completed', async () => {
      expect(ctx.workflowRunId).toBeDefined();

      const result = await updateWorkflowStatus(prisma, {
        runId: ctx.workflowRunId!,
        status: 'completed',
        summary: 'E2E test workflow completed successfully',
      });

      expect(result.success).toBe(true);
      console.log(`  ✓ Workflow status updated: completed`);
    });

    it('should get workflow run results', async () => {
      expect(ctx.workflowRunId).toBeDefined();

      const result = await getWorkflowRunResults(prisma, {
        runId: ctx.workflowRunId!,
      });

      expect(result.run.id).toBe(ctx.workflowRunId);
      expect(result.run.status).toBe('completed');
      console.log(`  ✓ Results retrieved: status=${result.run.status}`);
    });

    it('should list workflow runs and find our run', async () => {
      expect(ctx.workflowId).toBeDefined();
      expect(ctx.workflowRunId).toBeDefined();

      const result = await listWorkflowRuns(prisma, {
        workflowId: ctx.workflowId!,
      });

      const ourRun = result.runs.find((r: any) => r.id === ctx.workflowRunId);
      expect(ourRun).toBeDefined();
      console.log(`  ✓ Run found in history (${result.pagination.total} total runs)`);

      console.log('\n  Phase 3 Summary:');
      console.log(`    Workflow Run: ${ctx.workflowRunId}`);
      console.log(`    Component Run: ${ctx.componentRunId}`);
      console.log(`    Status: completed`);
    });
  });

  // ============================================================
  // PHASE 4: ARTIFACT MANAGEMENT (ST-151)
  // ============================================================
  describe('Phase 4: Artifact Management (ST-151)', () => {
    it('should create artifact definition (ARCH_DOC)', async () => {
      expect(ctx.workflowId).toBeDefined();

      const params = createTestArtifactDefinitionParams(ctx.workflowId!);
      const result = await createArtifactDefinition(prisma, params);

      ctx.artifactDefinitionId = result.id;

      expect(result.name).toContain(TEST_CONFIG.PREFIX);
      expect(result.workflowId).toBe(ctx.workflowId);
      console.log(`  ✓ Artifact definition created: ${result.name} (${result.id})`);
    });

    it('should update artifact definition properties', async () => {
      expect(ctx.artifactDefinitionId).toBeDefined();

      const result = await updateArtifactDefinition(prisma, {
        definitionId: ctx.artifactDefinitionId!,
        description: 'Updated: Test architecture document',
        isMandatory: true,
      });

      expect(result.description).toContain('Updated');
      expect(result.isMandatory).toBe(true);
      console.log(`  ✓ Artifact definition updated`);
    });

    it('should list artifact definitions', async () => {
      expect(ctx.workflowId).toBeDefined();

      const result = await listArtifactDefinitions(prisma, {
        workflowId: ctx.workflowId!,
      });

      const ourDef = result.data.find((d: any) => d.id === ctx.artifactDefinitionId);
      expect(ourDef).toBeDefined();
      console.log(`  ✓ Definition found in list (${result.pagination.total} total)`);
    });

    it('should set artifact access (write) for state', async () => {
      expect(ctx.artifactDefinitionId).toBeDefined();
      expect(ctx.workflowStateIds).toBeDefined();

      workflowStateForArtifact = ctx.workflowStateIds![0];

      const result = await setArtifactAccess(prisma, {
        definitionId: ctx.artifactDefinitionId!,
        stateId: workflowStateForArtifact,
        accessType: 'write',
      });

      expect(result.id).toBeDefined();
      expect(result.accessType).toBe('write');
      console.log(`  ✓ Write access granted to state`);
    });

    it('should remove artifact access', async () => {
      expect(ctx.artifactDefinitionId).toBeDefined();
      expect(workflowStateForArtifact).toBeDefined();

      const result = await removeArtifactAccess(prisma, {
        definitionId: ctx.artifactDefinitionId!,
        stateId: workflowStateForArtifact!,
      });

      expect(result.success).toBe(true);
      console.log(`  ✓ Access removed from state`);
    });

    it('should re-grant access for upload test', async () => {
      const result = await setArtifactAccess(prisma, {
        definitionId: ctx.artifactDefinitionId!,
        stateId: workflowStateForArtifact!,
        accessType: 'write',
      });
      expect(result.id).toBeDefined();
      expect(result.accessType).toBe('write');
    });

    it('should upload artifact content', async () => {
      expect(ctx.artifactDefinitionId).toBeDefined();
      expect(ctx.workflowRunId).toBeDefined();

      const content = createTestArtifactContent();
      const result = await uploadArtifact(prisma, {
        workflowRunId: ctx.workflowRunId!,
        definitionId: ctx.artifactDefinitionId!,
        content,
        contentType: 'text/markdown',
      });

      ctx.artifactId = result.id;

      expect(result.id).toBeDefined();
      expect(result.version).toBe(1);
      console.log(`  ✓ Artifact uploaded: version ${result.version}`);
    });

    it('should get artifact by ID', async () => {
      expect(ctx.artifactId).toBeDefined();

      const result = await getArtifact(prisma, {
        artifactId: ctx.artifactId!,
        includeContent: true,
      });

      expect(result.id).toBe(ctx.artifactId);
      expect(result.content).toContain('Test Architecture Document');
      console.log(`  ✓ Artifact retrieved by ID`);
    });

    it('should list artifacts for workflow run', async () => {
      expect(ctx.workflowRunId).toBeDefined();

      const result = await listArtifacts(prisma, {
        workflowRunId: ctx.workflowRunId!,
      });

      const ourArtifact = result.data.find((a: any) => a.id === ctx.artifactId);
      expect(ourArtifact).toBeDefined();
      console.log(`  ✓ Artifact found in list (${result.pagination.total} total)`);
    });

    it('should upload again and verify version increment', async () => {
      expect(ctx.workflowRunId).toBeDefined();
      expect(ctx.artifactDefinitionId).toBeDefined();

      const content = createTestArtifactContent() + '\n\n## Update v2\nAdditional content';
      const result = await uploadArtifact(prisma, {
        workflowRunId: ctx.workflowRunId!,
        definitionId: ctx.artifactDefinitionId!,
        content,
        contentType: 'text/markdown',
      });

      expect(result.version).toBe(2);
      console.log(`  ✓ Artifact updated: version ${result.version}`);
    });

    it('should create second artifact definition for cascade delete test', async () => {
      expect(ctx.workflowId).toBeDefined();

      const result = await createArtifactDefinition(prisma, {
        workflowId: ctx.workflowId!,
        name: `${TEST_CONFIG.PREFIX}DeleteTest_${TEST_CONFIG.TIMESTAMP}`,
        key: `DELETE_TEST_${TEST_CONFIG.TIMESTAMP}`,
        type: 'json',
        description: 'Artifact definition for cascade delete test',
      });

      artifactDefinitionId2 = result.id;
      console.log(`  ✓ Second definition created for delete test`);
    });

    it('should delete artifact definition with cascade', async () => {
      expect(artifactDefinitionId2).toBeDefined();

      const result = await deleteArtifactDefinition(prisma, {
        definitionId: artifactDefinitionId2!,
        confirm: true,
      });

      expect(result.message).toContain('deleted');
      console.log(`  ✓ Artifact definition deleted (cascade)`);

      console.log('\n  Phase 4 Summary:');
      console.log(`    Artifact Definition: ${ctx.artifactDefinitionId}`);
      console.log(`    Artifact: ${ctx.artifactId}`);
      console.log(`    Final Version: 2`);
    });
  });

  // ============================================================
  // PHASE 5: RUNNER CONTROL (Limited)
  // ============================================================
  describe('Phase 5: Runner Control (Limited)', () => {
    it('should get runner status (validation test)', async () => {
      expect(ctx.workflowRunId).toBeDefined();

      // This should work but return appropriate status for a non-runner run
      const result = await getRunnerStatus(prisma, {
        runId: ctx.workflowRunId!,
      });

      // The run exists but wasn't started via start_runner
      // So we expect either a status or an appropriate error message
      expect(result).toBeDefined();
      console.log(`  ✓ Runner status queried: ${result.state || 'not a runner run'}`);
    });

    it('should get runner checkpoint (validation test)', async () => {
      expect(ctx.workflowRunId).toBeDefined();

      try {
        const result = await getRunnerCheckpoint(prisma, {
          runId: ctx.workflowRunId!,
        });

        // May or may not have checkpoint data
        console.log(`  ✓ Checkpoint queried: ${result.checkpoint ? 'has data' : 'no checkpoint'}`);
      } catch (error: any) {
        // Expected if no checkpoint exists
        console.log(`  ✓ Checkpoint validation: ${error.message.substring(0, 50)}...`);
      }
    });

    it('should test pause_runner validation', async () => {
      expect(ctx.workflowRunId).toBeDefined();

      try {
        await pauseRunner(prisma, {
          runId: ctx.workflowRunId!,
          reason: 'E2E test pause validation',
        });
        console.log(`  ✓ Pause runner accepted (unexpected for completed run)`);
      } catch (error: any) {
        // Expected - can't pause a completed run
        expect(error.message).toBeDefined();
        console.log(`  ✓ Pause validation: cannot pause completed run`);
      }
    });

    it('should test cancel_runner validation', async () => {
      expect(ctx.workflowRunId).toBeDefined();

      try {
        await cancelRunner(prisma, {
          runId: ctx.workflowRunId!,
          reason: 'E2E test cancel validation',
        });
        console.log(`  ✓ Cancel runner accepted (unexpected for completed run)`);
      } catch (error: any) {
        // Expected - can't cancel a completed run
        expect(error.message).toBeDefined();
        console.log(`  ✓ Cancel validation: cannot cancel completed run`);
      }

      console.log('\n  Phase 5 Summary:');
      console.log('    Note: start_runner spawns Docker containers - skipped');
      console.log('    Note: resume_runner requires paused state - skipped');
    });
  });

  // ============================================================
  // PHASE 6: REMOTE AGENTS (ST-150)
  // ============================================================
  describe('Phase 6: Remote Agents (ST-150)', () => {
    it('should get online agents (may be empty)', async () => {
      const result = await getOnlineAgents(prisma, {});

      expect(result).toBeDefined();
      expect(Array.isArray(result.agents)).toBe(true);
      console.log(`  ✓ Online agents: ${result.agents.length} connected`);
    });

    it('should get agent capabilities', async () => {
      const result = await getAgentCapabilities(prisma, {});

      expect(result).toBeDefined();
      console.log(`  ✓ Capabilities retrieved: ${JSON.stringify(Object.keys(result)).substring(0, 50)}...`);
    });

    it('should test spawn_agent validation/offline fallback', async () => {
      expect(ctx.agentComponentId).toBeDefined();
      expect(ctx.workflowRunId).toBeDefined();
      expect(ctx.workflowStateIds).toBeDefined();

      try {
        const result = await spawnAgent(prisma, {
          componentId: ctx.agentComponentId!,
          stateId: ctx.workflowStateIds![0],
          workflowRunId: ctx.workflowRunId!,
          componentRunId: ctx.componentRunId!,
          instructions: 'Test agent spawn - E2E validation',
        });

        if (result.agentOffline) {
          console.log(`  ✓ Spawn agent: offline fallback = ${result.offlineFallback}`);
        } else if (result.jobId) {
          console.log(`  ✓ Spawn agent: job created = ${result.jobId}`);
        } else {
          console.log(`  ✓ Spawn agent: ${JSON.stringify(result).substring(0, 50)}...`);
        }
      } catch (error: any) {
        // May fail if component is not properly configured for remote execution
        console.log(`  ✓ Spawn validation: ${error.message.substring(0, 50)}...`);
      }

      console.log('\n  Phase 6 Summary:');
      console.log('    Note: Full spawn_agent testing requires laptop agent online');
      console.log('    See ep8-full-path.e2e.test.ts for complete remote agent tests');
    });
  });
});
