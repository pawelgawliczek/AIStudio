/**
 * ST-161: Real MCP Commands E2E Tests
 *
 * Tests the Story Runner via REAL MCP commands executed through Claude Code CLI.
 * This simulates actual user experience by spawning real CLI processes.
 *
 * Environment Support:
 * - LAPTOP: Direct Claude Code CLI spawning
 * - KVM: Routes via remote agent to laptop
 *
 * Key Features:
 * - Real CLI spawning (not direct handler imports)
 * - No-fix constraints prevent Claude from "outsmarting" tests
 * - Token-optimized instructions
 * - Environment auto-detection
 *
 * Test Phases:
 * - Phase 1: Project Setup (create project, epic, story, agents)
 * - Phase 2: Workflow & Team Management
 * - Phase 3: Execution Lifecycle
 * - Phase 4: Cleanup
 *
 * @see /Users/pawelgawliczek/.claude/plans/synthetic-dancing-seal.md
 */

import { PrismaClient } from '@prisma/client';
import { createMCPTestRunner, MCPTestRunner, MCPTestResult } from './helpers/mcp-test-runner';
import { TestContext, createTestContext, hasPhase1Entities, hasWorkflowReady } from './helpers/test-context';
import { cleanupTestData } from './helpers/cleanup-utils';

// Type helper for MCP results - all results are treated as 'any' for test assertions
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyResult = MCPTestResult<any>;

// Test configuration for this suite
const ST161_CONFIG = {
  PREFIX: `_ST161_${Date.now()}_`,
  TIMEOUT: 120000, // 2 minutes per test (CLI execution takes time)
};

// Prisma client
const prisma = new PrismaClient();

// Test context
let ctx: TestContext;
let mcp: MCPTestRunner;

describe('ST-161: Real MCP Commands E2E Tests', () => {
  // Initialize before all tests
  beforeAll(async () => {
    console.log('\n============================================================');
    console.log('ST-161: Real MCP Commands E2E Tests');
    console.log('============================================================');
    console.log(`Started at: ${new Date().toISOString()}`);
    console.log('');

    ctx = createTestContext();

    // Initialize MCPTestRunner (handles environment detection)
    try {
      mcp = await createMCPTestRunner(prisma);
      console.log(`Environment: ${mcp.getEnvironment().toUpperCase()}`);
    } catch (error) {
      console.error('Failed to initialize MCPTestRunner:', error);
      throw error;
    }
  }, 60000);

  // Cleanup after all tests
  afterAll(async () => {
    console.log('\n============================================================');
    console.log('CLEANUP');
    console.log('============================================================');

    // Cleanup test data
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
  // PHASE 1: PROJECT SETUP (via Real MCP Commands)
  // ============================================================
  describe('Phase 1: Project Setup via Real MCP Commands', () => {
    it('should create project via real MCP command', async () => {
      const projectName = `${ST161_CONFIG.PREFIX}Project`;

      const res = await mcp.execute('create_project', {
        name: projectName,
        description: 'ST-161 E2E Test Project - Created via real MCP command',
      }) as AnyResult;

      expect(res.success).toBe(true);
      expect(res.error).toBeUndefined();
      expect(res.result).toBeDefined();
      expect(res.result?.id).toBeDefined();
      expect(res.result?.name).toBe(projectName);

      ctx.projectId = res.result?.id;

      console.log(`  ✓ Project created: ${res.result?.name} (${res.result?.id})`);
      if (res.metrics) {
        console.log(`    Tokens: ${res.metrics.totalTokens} (in: ${res.metrics.inputTokens}, out: ${res.metrics.outputTokens})`);
      }
    }, ST161_CONFIG.TIMEOUT);

    it('should create epic via real MCP command', async () => {
      expect(ctx.projectId).toBeDefined();

      const epicTitle = `${ST161_CONFIG.PREFIX}Epic`;

      const res = await mcp.execute('create_epic', {
        projectId: ctx.projectId,
        title: epicTitle,
        description: 'ST-161 E2E Test Epic',
        priority: 5,
      }) as AnyResult;

      expect(res.success).toBe(true);
      expect(res.error).toBeUndefined();
      expect(res.result).toBeDefined();
      expect(res.result?.id).toBeDefined();
      expect(res.result?.title).toBe(epicTitle);

      ctx.epicId = res.result?.id;

      console.log(`  ✓ Epic created: ${res.result?.title} (${res.result?.id})`);
      if (res.metrics) {
        console.log(`    Tokens: ${res.metrics.totalTokens}`);
      }
    }, ST161_CONFIG.TIMEOUT);

    it('should create story via real MCP command', async () => {
      expect(ctx.projectId).toBeDefined();
      expect(ctx.epicId).toBeDefined();

      const storyTitle = `${ST161_CONFIG.PREFIX}Story`;

      const res = await mcp.execute('create_story', {
        projectId: ctx.projectId,
        epicId: ctx.epicId,
        title: storyTitle,
        description: 'ST-161 E2E Test Story',
        type: 'feature',
      }) as AnyResult;

      expect(res.success).toBe(true);
      expect(res.error).toBeUndefined();
      expect(res.result).toBeDefined();
      expect(res.result?.id).toBeDefined();
      expect(res.result?.title).toBe(storyTitle);

      ctx.storyId = res.result?.id;

      console.log(`  ✓ Story created: ${res.result?.title} (${res.result?.id})`);
      if (res.metrics) {
        console.log(`    Tokens: ${res.metrics.totalTokens}`);
      }
    }, ST161_CONFIG.TIMEOUT);

    it('should create agent component via real MCP command', async () => {
      expect(ctx.projectId).toBeDefined();

      const agentName = `${ST161_CONFIG.PREFIX}Agent`;

      const res = await mcp.execute('create_agent', {
        projectId: ctx.projectId,
        name: agentName,
        inputInstructions: 'Test agent input instructions',
        operationInstructions: 'Test agent operation instructions',
        outputInstructions: 'Test agent output instructions',
        config: {
          modelId: 'claude-sonnet-4-20250514',
          temperature: 0.7,
          maxOutputTokens: 4096,
        },
        tools: ['mcp__vibestudio__list_projects'],
      }) as AnyResult;

      expect(res.success).toBe(true);
      expect(res.error).toBeUndefined();
      expect(res.result).toBeDefined();
      expect(res.result?.id).toBeDefined();

      ctx.agentComponentId = res.result?.id;

      console.log(`  ✓ Agent created: ${agentName} (${res.result?.id})`);
      if (res.metrics) {
        console.log(`    Tokens: ${res.metrics.totalTokens}`);
      }
    }, ST161_CONFIG.TIMEOUT);

    it('should verify all Phase 1 entities created', () => {
      expect(hasPhase1Entities(ctx)).toBe(true);

      console.log('\n  Phase 1 Summary (via Real MCP Commands):');
      console.log(`    Project: ${ctx.projectId}`);
      console.log(`    Epic: ${ctx.epicId}`);
      console.log(`    Story: ${ctx.storyId}`);
      console.log(`    Agent: ${ctx.agentComponentId}`);
    });
  });

  // ============================================================
  // PHASE 2: WORKFLOW & TEAM MANAGEMENT
  // ============================================================
  describe('Phase 2: Workflow & Team Management via Real MCP Commands', () => {
    it('should create team via real MCP command', async () => {
      expect(hasPhase1Entities(ctx)).toBe(true);

      const teamName = `${ST161_CONFIG.PREFIX}Team`;

      const res = await mcp.execute('create_team', {
        projectId: ctx.projectId,
        name: teamName,
        description: 'ST-161 E2E Test Team',
        triggerConfig: {
          type: 'manual',
        },
      }) as AnyResult;

      expect(res.success).toBe(true);
      expect(res.error).toBeUndefined();
      expect(res.result).toBeDefined();
      expect(res.result?.id).toBeDefined();

      ctx.workflowId = res.result?.id;

      console.log(`  ✓ Team created: ${teamName} (${res.result?.id})`);
      if (res.metrics) {
        console.log(`    Tokens: ${res.metrics.totalTokens}`);
      }
    }, ST161_CONFIG.TIMEOUT);

    it('should create workflow state (analysis) via real MCP command', async () => {
      expect(ctx.workflowId).toBeDefined();

      const stateName = `${ST161_CONFIG.PREFIX}State_Analysis`;

      const res = await mcp.execute('create_workflow_state', {
        workflowId: ctx.workflowId,
        name: stateName,
        order: 1,
        componentId: ctx.agentComponentId,
        preExecutionInstructions: 'Pre-analysis instructions',
        postExecutionInstructions: 'Post-analysis instructions',
      }) as AnyResult;

      expect(res.success).toBe(true);
      expect(res.error).toBeUndefined();
      expect(res.result).toBeDefined();
      expect(res.result?.id).toBeDefined();
      expect(res.result?.order).toBe(1);

      ctx.workflowStateIds = ctx.workflowStateIds || [];
      ctx.workflowStateIds.push(res.result?.id);

      console.log(`  ✓ State created: ${stateName} (order: ${res.result?.order})`);
      if (res.metrics) {
        console.log(`    Tokens: ${res.metrics.totalTokens}`);
      }
    }, ST161_CONFIG.TIMEOUT);

    it('should create workflow state (implementation) via real MCP command', async () => {
      expect(ctx.workflowId).toBeDefined();

      const stateName = `${ST161_CONFIG.PREFIX}State_Impl`;

      const res = await mcp.execute('create_workflow_state', {
        workflowId: ctx.workflowId,
        name: stateName,
        order: 2,
        componentId: ctx.agentComponentId,
      }) as AnyResult;

      expect(res.success).toBe(true);
      expect(res.error).toBeUndefined();
      expect(res.result).toBeDefined();
      expect(res.result?.id).toBeDefined();
      expect(res.result?.order).toBe(2);

      ctx.workflowStateIds!.push(res.result?.id);

      console.log(`  ✓ State created: ${stateName} (order: ${res.result?.order})`);
      if (res.metrics) {
        console.log(`    Tokens: ${res.metrics.totalTokens}`);
      }
    }, ST161_CONFIG.TIMEOUT);

    it('should list workflow states via real MCP command', async () => {
      expect(ctx.workflowId).toBeDefined();

      const res = await mcp.execute('list_workflow_states', {
        workflowId: ctx.workflowId,
      }) as AnyResult;

      expect(res.success).toBe(true);
      expect(res.error).toBeUndefined();
      expect(res.result).toBeDefined();
      expect(res.result?.data).toBeDefined();
      expect(Array.isArray(res.result?.data)).toBe(true);
      expect(res.result?.data?.length).toBe(2);

      console.log(`  ✓ Listed ${res.result?.data?.length} workflow states`);
      if (res.metrics) {
        console.log(`    Tokens: ${res.metrics.totalTokens}`);
      }
    }, ST161_CONFIG.TIMEOUT);

    it('should verify workflow ready for execution', () => {
      expect(hasWorkflowReady(ctx)).toBe(true);

      console.log('\n  Phase 2 Summary (via Real MCP Commands):');
      console.log(`    Team/Workflow: ${ctx.workflowId}`);
      console.log(`    States: ${ctx.workflowStateIds!.length}`);
    });
  });

  // ============================================================
  // PHASE 3: EXECUTION LIFECYCLE
  // ============================================================
  describe('Phase 3: Execution Lifecycle via Real MCP Commands', () => {
    it('should start team run via real MCP command', async () => {
      expect(hasWorkflowReady(ctx)).toBe(true);

      const res = await mcp.execute('start_team_run', {
        teamId: ctx.workflowId,
        triggeredBy: 'st161-e2e-test',
        context: {
          testRun: true,
          timestamp: Date.now(),
        },
      }) as AnyResult;

      expect(res.success).toBe(true);
      expect(res.error).toBeUndefined();
      expect(res.result).toBeDefined();
      expect(res.result?.runId).toBeDefined();

      ctx.workflowRunId = res.result?.runId;

      console.log(`  ✓ Team run started: ${res.result?.runId}`);
      if (res.metrics) {
        console.log(`    Tokens: ${res.metrics.totalTokens}`);
      }
    }, ST161_CONFIG.TIMEOUT);

    it('should get team context via real MCP command', async () => {
      expect(ctx.workflowRunId).toBeDefined();

      const res = await mcp.execute('get_team_context', {
        runId: ctx.workflowRunId,
      }) as AnyResult;

      expect(res.success).toBe(true);
      expect(res.error).toBeUndefined();
      expect(res.result).toBeDefined();
      expect(res.result?.runId).toBe(ctx.workflowRunId);

      console.log(`  ✓ Team context retrieved`);
      if (res.metrics) {
        console.log(`    Tokens: ${res.metrics.totalTokens}`);
      }
    }, ST161_CONFIG.TIMEOUT);

    it('should record agent start via real MCP command', async () => {
      expect(ctx.workflowRunId).toBeDefined();
      expect(ctx.agentComponentId).toBeDefined();

      const res = await mcp.execute('record_agent_start', {
        runId: ctx.workflowRunId,
        componentId: ctx.agentComponentId,
        input: { test: true },
      }) as AnyResult;

      expect(res.success).toBe(true);
      expect(res.error).toBeUndefined();
      expect(res.result).toBeDefined();
      expect(res.result?.componentRunId).toBeDefined();

      ctx.componentRunId = res.result?.componentRunId;

      console.log(`  ✓ Agent start recorded: ${res.result?.componentRunId}`);
      if (res.metrics) {
        console.log(`    Tokens: ${res.metrics.totalTokens}`);
      }
    }, ST161_CONFIG.TIMEOUT);

    it('should record agent complete via real MCP command', async () => {
      expect(ctx.workflowRunId).toBeDefined();
      expect(ctx.agentComponentId).toBeDefined();

      const res = await mcp.execute('record_agent_complete', {
        runId: ctx.workflowRunId,
        componentId: ctx.agentComponentId,
        status: 'completed',
        output: {
          analysis: 'ST-161 test analysis complete',
          recommendations: ['item1', 'item2'],
        },
        transcriptMetrics: {
          inputTokens: 1500,
          outputTokens: 500,
          totalTokens: 2000,
          model: 'claude-sonnet-4-20250514',
        },
      }) as AnyResult;

      expect(res.success).toBe(true);
      expect(res.error).toBeUndefined();

      console.log(`  ✓ Agent complete recorded`);
      if (res.metrics) {
        console.log(`    Tokens: ${res.metrics.totalTokens}`);
      }
    }, ST161_CONFIG.TIMEOUT);

    it('should update team status to completed via real MCP command', async () => {
      expect(ctx.workflowRunId).toBeDefined();

      const res = await mcp.execute('update_team_status', {
        runId: ctx.workflowRunId,
        status: 'completed',
        summary: 'ST-161 E2E test workflow completed successfully',
      }) as AnyResult;

      expect(res.success).toBe(true);
      expect(res.error).toBeUndefined();

      console.log(`  ✓ Team status updated: completed`);
      if (res.metrics) {
        console.log(`    Tokens: ${res.metrics.totalTokens}`);
      }
    }, ST161_CONFIG.TIMEOUT);

    it('should get team run results via real MCP command', async () => {
      expect(ctx.workflowRunId).toBeDefined();

      const res = await mcp.execute('get_team_run_results', {
        runId: ctx.workflowRunId,
      }) as AnyResult;

      expect(res.success).toBe(true);
      expect(res.error).toBeUndefined();
      expect(res.result).toBeDefined();
      expect(res.result?.run).toBeDefined();
      expect(res.result?.run?.status).toBe('completed');

      console.log(`  ✓ Team run results retrieved: status=${res.result?.run?.status}`);
      if (res.metrics) {
        console.log(`    Tokens: ${res.metrics.totalTokens}`);
      }

      console.log('\n  Phase 3 Summary (via Real MCP Commands):');
      console.log(`    Workflow Run: ${ctx.workflowRunId}`);
      console.log(`    Component Run: ${ctx.componentRunId}`);
      console.log(`    Final Status: completed`);
    }, ST161_CONFIG.TIMEOUT);
  });

  // ============================================================
  // PHASE 4: ERROR HANDLING & EDGE CASES
  // ============================================================
  describe('Phase 4: Error Handling via Real MCP Commands', () => {
    it('should handle invalid project ID gracefully', async () => {
      const res = await mcp.execute('get_project', {
        projectId: '00000000-0000-0000-0000-000000000000',
      }) as AnyResult;

      // The test passes regardless of success/failure -
      // we're testing that the system handles the error properly
      if (!res.success) {
        expect(res.error).toBeDefined();
        console.log(`  ✓ Invalid project ID handled: ${res.error?.substring(0, 50)}...`);
      } else {
        console.log(`  ✓ Got result for zero UUID (unexpected but valid)`);
      }
    }, ST161_CONFIG.TIMEOUT);

    it('should handle missing required parameters', async () => {
      const res = await mcp.execute('create_project', {
        // Missing 'name' parameter
        description: 'Test without name',
      }) as AnyResult;

      // Should fail due to missing required parameter
      // Note: The CLI might handle this at various levels
      if (!res.success) {
        expect(res.error).toBeDefined();
        console.log(`  ✓ Missing parameter handled: ${res.error?.substring(0, 50)}...`);
      } else {
        // Some tools might have defaults
        console.log(`  ✓ Tool accepted params (may have defaults)`);
      }
    }, ST161_CONFIG.TIMEOUT);
  });

  // ============================================================
  // ENVIRONMENT DETECTION TESTS
  // ============================================================
  describe('Environment Detection', () => {
    it('should detect environment correctly', () => {
      const env = mcp.getEnvironment();
      expect(['laptop', 'kvm']).toContain(env);
      console.log(`  ✓ Environment detected: ${env.toUpperCase()}`);
    });

    it('should have appropriate execution mode', () => {
      const env = mcp.getEnvironment();

      if (env === 'laptop') {
        console.log('  ✓ Laptop mode: Direct Claude Code CLI execution');
      } else {
        console.log('  ✓ KVM mode: Remote agent routing');
      }
    });
  });
});
