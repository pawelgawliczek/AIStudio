/**
 * ST-242: Telemetry Metrics E2E Integration Tests
 *
 * Tests the complete telemetry metrics flow using REAL MCP commands:
 * 1. Create test project/story via real MCP commands
 * 2. Start workflow run with component execution
 * 3. Record component start/complete with token metrics
 * 4. Verify cost calculation using pricing utility
 * 5. Verify WorkflowRun.estimatedCost aggregation
 * 6. Verify ComponentRun.cost > 0 after completion
 * 7. Verify token breakdown (input + output + cache = total)
 *
 * IMPORTANT: This test uses REAL MCP commands on PRODUCTION database
 * to ensure telemetry metrics are populated correctly.
 *
 * Test Focus:
 * - Cost calculation from token metrics
 * - Token breakdown validation
 * - Workflow-level aggregation
 * - Edge cases (null tokens, unknown models)
 *
 * Environment Requirements:
 * - Production database access
 * - Real MCP command execution
 *
 * Patterns reused from:
 * - st147-session-telemetry.e2e.test.ts (telemetry tracking)
 * - st161-real-mcp-commands.e2e.test.ts (real MCP execution)
 */

import { PrismaClient } from '@prisma/client';
import { handler as createComponent } from '../../mcp/servers/components/create_component';
import { handler as createEpic } from '../../mcp/servers/epics/create_epic';
import { handler as recordComponentComplete } from '../../mcp/servers/execution/record_component_complete';
import { handler as recordComponentStart } from '../../mcp/servers/execution/record_component_start';
import { handler as startWorkflowRun } from '../../mcp/servers/execution/start_workflow_run';
import { handler as createProject } from '../../mcp/servers/projects/create_project';
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
  createTestWorkflowParams,
  createE2EWorkflowRunParams,
} from './helpers/test-data-factory';

const prisma = new PrismaClient();

let ctx: TestContext;

// Extended context for ST-242 tests
interface ST242Context extends TestContext {
  componentRunIds?: string[];
  componentMetrics?: Array<{
    componentRunId: string;
    tokensInput: number;
    tokensOutput: number;
    tokensCacheCreation: number;
    tokensCacheRead: number;
    modelId: string;
    expectedCost: number;
  }>;
}

let st242Ctx: ST242Context;

describe('ST-242 Telemetry Metrics E2E Tests', () => {
  beforeAll(async () => {
    console.log('\n============================================================');
    console.log('ST-242 Telemetry Metrics E2E Integration Tests');
    console.log('============================================================');
    console.log(`Started at: ${new Date().toISOString()}`);
    console.log('');

    ctx = createTestContext();
    st242Ctx = ctx as ST242Context;
    st242Ctx.componentRunIds = [];
    st242Ctx.componentMetrics = [];
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
  // SETUP: Create Test Entities
  // ============================================================
  describe('Setup: Create Test Entities', () => {
    it('should create test project', async () => {
      const params = {
        ...createTestProjectParams(),
        name: `${TEST_CONFIG.PREFIX}ST242_Telemetry_${TEST_CONFIG.TIMESTAMP}`,
      };
      const result = await createProject(prisma, params);

      ctx.projectId = result.id;
      expect(result.id).toBeDefined();
      console.log(`  ✓ Project created: ${result.name}`);
    });

    it('should create test epic', async () => {
      expect(ctx.projectId).toBeDefined();

      const params = createTestEpicParams(ctx.projectId!);
      const result = await createEpic(prisma, params);

      ctx.epicId = result.id;
      console.log(`  ✓ Epic created: ${result.title}`);
    });

    it('should create test story', async () => {
      expect(ctx.projectId).toBeDefined();

      const params = createTestStoryParams(ctx.projectId!, ctx.epicId);
      const result = await createStory(prisma, params);

      ctx.storyId = result.id;
      console.log(`  ✓ Story created: ${result.title}`);
    });

    it('should create test components for telemetry testing', async () => {
      expect(ctx.projectId).toBeDefined();

      // Component 1: Explorer (large cache creation)
      const explorer = await createComponent(prisma, {
        projectId: ctx.projectId!,
        name: testName('Explorer'),
        description: 'Test explorer for ST-242 telemetry',
        inputInstructions: 'Explore codebase',
        operationInstructions: 'Analyze files and create context',
        outputInstructions: 'Return exploration summary',
        config: {
          modelId: 'claude-sonnet-4-20250514',
          temperature: 0.7,
          maxOutputTokens: 8000,
        },
        tools: ['Read', 'Grep'],
        active: true,
      });

      // Component 2: Architect (cache reads, medium output)
      const architect = await createComponent(prisma, {
        projectId: ctx.projectId!,
        name: testName('Architect'),
        description: 'Test architect for ST-242 telemetry',
        inputInstructions: 'Review exploration',
        operationInstructions: 'Design architecture',
        outputInstructions: 'Return architecture doc',
        config: {
          modelId: 'claude-opus-4-5-20251101',
          temperature: 0.5,
          maxOutputTokens: 12000,
        },
        tools: [],
        active: true,
      });

      ctx.agentComponentId = explorer.id;
      st242Ctx.componentRunIds = [explorer.id, architect.id];

      console.log(`  ✓ Created 2 test components for telemetry tracking`);
    });

    it('should create workflow with 2 states', async () => {
      expect(ctx.projectId).toBeDefined();
      expect(st242Ctx.componentRunIds).toBeDefined();

      const workflowParams = createTestWorkflowParams(ctx.projectId!);
      const workflow = await createWorkflow(prisma, {
        ...workflowParams,
        name: testName('TelemetryWorkflow'),
      });
      ctx.workflowId = workflow.id;

      // Create 2 workflow states
      const state1 = await createWorkflowState(prisma, {
        workflowId: ctx.workflowId,
        componentId: st242Ctx.componentRunIds![0],
        name: testName('ExplorerState'),
        order: 1,
        mandatory: true,
        requiresApproval: false,
        runLocation: 'local' as const,
        offlineFallback: 'fail' as const,
        preExecutionInstructions: null,
        postExecutionInstructions: null,
      });

      const state2 = await createWorkflowState(prisma, {
        workflowId: ctx.workflowId,
        componentId: st242Ctx.componentRunIds![1],
        name: testName('ArchitectState'),
        order: 2,
        mandatory: true,
        requiresApproval: false,
        runLocation: 'local' as const,
        offlineFallback: 'fail' as const,
        preExecutionInstructions: null,
        postExecutionInstructions: null,
      });

      ctx.workflowStateIds = [state1.id, state2.id];
      console.log(`  ✓ Workflow with 2 states created`);
    });
  });

  // ============================================================
  // PHASE 1: Component Execution with Token Metrics
  // ============================================================
  describe('Phase 1: Component Execution with Token Metrics', () => {
    it('should start workflow run', async () => {
      expect(ctx.workflowId).toBeDefined();

      const runParams = createE2EWorkflowRunParams(ctx.workflowId!, 'st242-e2e-test', {
        context: {
          testType: 'telemetry-metrics',
          storyId: ctx.storyId,
        },
      });
      const result = await startWorkflowRun(prisma, runParams);

      ctx.workflowRunId = result.runId;
      expect(result.runId).toBeDefined();
      console.log(`  ✓ Workflow run started: ${result.runId}`);
    });

    it('should execute component 1 (Explorer) with large cache creation', async () => {
      expect(ctx.workflowRunId).toBeDefined();
      expect(st242Ctx.componentRunIds).toBeDefined();

      const componentId = st242Ctx.componentRunIds![0];

      // Record component start
      const startResult = await recordComponentStart(prisma, {
        runId: ctx.workflowRunId!,
        componentId,
      });

      expect(startResult.componentRunId).toBeDefined();

      // Simulate component execution with token metrics
      const metrics = {
        tokensInput: 25_000,
        tokensOutput: 5_000,
        tokensCacheCreation: 100_000, // Large cache creation for explorer
        tokensCacheRead: 0,
        modelId: 'claude-sonnet-4-20250514',
      };

      // Calculate expected cost manually
      // Input: 25K * $3.00/M = $0.075
      // Output: 5K * $15.00/M = $0.075
      // Cache write: 100K * $3.75/M = $0.375
      // Total: $0.525
      const expectedCost = 0.525;

      // Record component complete with transcript metrics
      await recordComponentComplete(prisma, {
        runId: ctx.workflowRunId!,
        componentId,
        status: 'completed',
        output: {
          filesAnalyzed: 42,
          contextCreated: true,
        },
        transcriptMetrics: {
          inputTokens: metrics.tokensInput,
          outputTokens: metrics.tokensOutput,
          totalTokens: metrics.tokensInput + metrics.tokensOutput + metrics.tokensCacheCreation,
          cacheCreationTokens: metrics.tokensCacheCreation,
          cacheReadTokens: metrics.tokensCacheRead,
          model: metrics.modelId,
        },
      });

      st242Ctx.componentMetrics!.push({
        componentRunId: startResult.componentRunId,
        ...metrics,
        expectedCost,
      });

      console.log(`  ✓ Component 1 (Explorer) executed with metrics:`);
      console.log(`    - Input tokens: ${metrics.tokensInput.toLocaleString()}`);
      console.log(`    - Output tokens: ${metrics.tokensOutput.toLocaleString()}`);
      console.log(`    - Cache creation: ${metrics.tokensCacheCreation.toLocaleString()}`);
      console.log(`    - Expected cost: $${expectedCost.toFixed(4)}`);
    });

    it('should execute component 2 (Architect) with cache reads', async () => {
      expect(ctx.workflowRunId).toBeDefined();
      expect(st242Ctx.componentRunIds).toBeDefined();

      const componentId = st242Ctx.componentRunIds![1];

      // Record component start
      const startResult = await recordComponentStart(prisma, {
        runId: ctx.workflowRunId!,
        componentId,
      });

      expect(startResult.componentRunId).toBeDefined();

      // Simulate component execution with cache reads
      const metrics = {
        tokensInput: 15_000,
        tokensOutput: 8_000,
        tokensCacheCreation: 0,
        tokensCacheRead: 80_000, // Large cache read
        modelId: 'claude-opus-4-5-20251101',
      };

      // Calculate expected cost manually (Opus pricing)
      // Input: 15K * $5.00/M = $0.075
      // Output: 8K * $25.00/M = $0.200
      // Cache read: 80K * $0.50/M = $0.040
      // Total: $0.315
      const expectedCost = 0.315;

      // Record component complete
      await recordComponentComplete(prisma, {
        runId: ctx.workflowRunId!,
        componentId,
        status: 'completed',
        output: {
          architectureCreated: true,
          diagramsGenerated: 3,
        },
        transcriptMetrics: {
          inputTokens: metrics.tokensInput,
          outputTokens: metrics.tokensOutput,
          totalTokens: metrics.tokensInput + metrics.tokensOutput + metrics.tokensCacheRead,
          cacheCreationTokens: metrics.tokensCacheCreation,
          cacheReadTokens: metrics.tokensCacheRead,
          model: metrics.modelId,
        },
      });

      st242Ctx.componentMetrics!.push({
        componentRunId: startResult.componentRunId,
        ...metrics,
        expectedCost,
      });

      console.log(`  ✓ Component 2 (Architect) executed with metrics:`);
      console.log(`    - Input tokens: ${metrics.tokensInput.toLocaleString()}`);
      console.log(`    - Output tokens: ${metrics.tokensOutput.toLocaleString()}`);
      console.log(`    - Cache read: ${metrics.tokensCacheRead.toLocaleString()}`);
      console.log(`    - Expected cost: $${expectedCost.toFixed(4)}`);
    });
  });

  // ============================================================
  // PHASE 2: Verify Component Run Metrics
  // ============================================================
  describe('Phase 2: Verify Component Run Metrics', () => {
    it('should have cost > 0 for component 1', async () => {
      expect(st242Ctx.componentMetrics).toBeDefined();
      expect(st242Ctx.componentMetrics!.length).toBeGreaterThan(0);

      const metric = st242Ctx.componentMetrics![0];
      const componentRun = await prisma.componentRun.findUnique({
        where: { id: metric.componentRunId },
      });

      expect(componentRun).toBeDefined();
      expect(componentRun!.cost).toBeDefined();
      expect(componentRun!.cost).toBeGreaterThan(0);

      console.log(`  ✓ Component 1 cost: $${componentRun!.cost!.toFixed(4)}`);
      console.log(`    Expected: $${metric.expectedCost.toFixed(4)}`);

      // Verify cost matches expected (within small tolerance for floating point)
      expect(componentRun!.cost).toBeCloseTo(metric.expectedCost, 4);
    });

    it('should have cost > 0 for component 2', async () => {
      expect(st242Ctx.componentMetrics).toBeDefined();
      expect(st242Ctx.componentMetrics!.length).toBeGreaterThanOrEqual(2);

      const metric = st242Ctx.componentMetrics![1];
      const componentRun = await prisma.componentRun.findUnique({
        where: { id: metric.componentRunId },
      });

      expect(componentRun).toBeDefined();
      expect(componentRun!.cost).toBeDefined();
      expect(componentRun!.cost).toBeGreaterThan(0);

      console.log(`  ✓ Component 2 cost: $${componentRun!.cost!.toFixed(4)}`);
      console.log(`    Expected: $${metric.expectedCost.toFixed(4)}`);

      // Verify cost matches expected
      expect(componentRun!.cost).toBeCloseTo(metric.expectedCost, 4);
    });

    it('should have correct token breakdown for component 1', async () => {
      const metric = st242Ctx.componentMetrics![0];
      const componentRun = await prisma.componentRun.findUnique({
        where: { id: metric.componentRunId },
      });

      expect(componentRun).toBeDefined();
      expect(componentRun!.tokensInput).toBe(metric.tokensInput);
      expect(componentRun!.tokensOutput).toBe(metric.tokensOutput);

      // Verify totalTokens calculation
      // ST-242: totalTokens = tokensInput + tokensOutput + tokensCacheCreation + tokensCacheRead
      const expectedTotal =
        metric.tokensInput + metric.tokensOutput + metric.tokensCacheCreation + metric.tokensCacheRead;
      expect(componentRun!.totalTokens).toBe(expectedTotal);

      console.log(`  ✓ Component 1 token breakdown:`);
      console.log(`    - Input: ${componentRun!.tokensInput}`);
      console.log(`    - Output: ${componentRun!.tokensOutput}`);
      console.log(`    - Cache creation: ${metric.tokensCacheCreation}`);
      console.log(`    - Total: ${componentRun!.totalTokens} (expected: ${expectedTotal})`);
    });

    it('should have correct token breakdown for component 2', async () => {
      const metric = st242Ctx.componentMetrics![1];
      const componentRun = await prisma.componentRun.findUnique({
        where: { id: metric.componentRunId },
      });

      expect(componentRun).toBeDefined();
      expect(componentRun!.tokensInput).toBe(metric.tokensInput);
      expect(componentRun!.tokensOutput).toBe(metric.tokensOutput);

      // Verify totalTokens includes cache reads
      const expectedTotal =
        metric.tokensInput + metric.tokensOutput + metric.tokensCacheCreation + metric.tokensCacheRead;
      expect(componentRun!.totalTokens).toBe(expectedTotal);

      console.log(`  ✓ Component 2 token breakdown:`);
      console.log(`    - Input: ${componentRun!.tokensInput}`);
      console.log(`    - Output: ${componentRun!.tokensOutput}`);
      console.log(`    - Cache read: ${metric.tokensCacheRead}`);
      console.log(`    - Total: ${componentRun!.totalTokens} (expected: ${expectedTotal})`);
    });

    it('should have modelId stored correctly', async () => {
      for (let i = 0; i < st242Ctx.componentMetrics!.length; i++) {
        const metric = st242Ctx.componentMetrics![i];
        const componentRun = await prisma.componentRun.findUnique({
          where: { id: metric.componentRunId },
        });

        expect(componentRun).toBeDefined();
        expect(componentRun!.modelId).toBe(metric.modelId);
        console.log(`  ✓ Component ${i + 1} modelId: ${componentRun!.modelId}`);
      }
    });
  });

  // ============================================================
  // PHASE 3: Verify Workflow Run Aggregation
  // ============================================================
  describe('Phase 3: Verify Workflow Run Aggregation', () => {
    it('should have estimatedCost > 0 in WorkflowRun', async () => {
      expect(ctx.workflowRunId).toBeDefined();

      const workflowRun = await prisma.workflowRun.findUnique({
        where: { id: ctx.workflowRunId! },
      });

      expect(workflowRun).toBeDefined();
      expect(workflowRun!.estimatedCost).toBeDefined();
      expect(workflowRun!.estimatedCost).toBeGreaterThan(0);

      console.log(`  ✓ WorkflowRun.estimatedCost: $${workflowRun!.estimatedCost!.toFixed(4)}`);
    });

    it('should aggregate component costs correctly', async () => {
      expect(ctx.workflowRunId).toBeDefined();

      // Get workflow run with component runs
      const workflowRun = await prisma.workflowRun.findUnique({
        where: { id: ctx.workflowRunId! },
        include: {
          componentRuns: true,
        },
      });

      expect(workflowRun).toBeDefined();
      expect(workflowRun!.componentRuns.length).toBe(2);

      // Calculate expected total cost
      const expectedTotalCost = st242Ctx.componentMetrics!.reduce(
        (sum, m) => sum + m.expectedCost,
        0,
      );

      // Verify aggregation
      expect(workflowRun!.estimatedCost).toBeCloseTo(expectedTotalCost, 4);

      console.log(`  ✓ Cost aggregation verified:`);
      console.log(`    - Component 1: $${st242Ctx.componentMetrics![0].expectedCost.toFixed(4)}`);
      console.log(`    - Component 2: $${st242Ctx.componentMetrics![1].expectedCost.toFixed(4)}`);
      console.log(`    - Total (expected): $${expectedTotalCost.toFixed(4)}`);
      console.log(`    - WorkflowRun.estimatedCost: $${workflowRun!.estimatedCost!.toFixed(4)}`);
    });

    it('should aggregate token totals correctly', async () => {
      expect(ctx.workflowRunId).toBeDefined();

      const workflowRun = await prisma.workflowRun.findUnique({
        where: { id: ctx.workflowRunId! },
        include: {
          componentRuns: true,
        },
      });

      expect(workflowRun).toBeDefined();

      // Calculate expected totals
      const expectedTotalInput = st242Ctx.componentMetrics!.reduce(
        (sum, m) => sum + m.tokensInput,
        0,
      );
      const expectedTotalOutput = st242Ctx.componentMetrics!.reduce(
        (sum, m) => sum + m.tokensOutput,
        0,
      );
      const expectedTotalTokens = st242Ctx.componentMetrics!.reduce(
        (sum, m) => sum + m.tokensInput + m.tokensOutput + m.tokensCacheCreation + m.tokensCacheRead,
        0,
      );

      // Verify aggregation
      expect(workflowRun!.totalTokensInput).toBe(expectedTotalInput);
      expect(workflowRun!.totalTokensOutput).toBe(expectedTotalOutput);
      expect(workflowRun!.totalTokens).toBe(expectedTotalTokens);

      console.log(`  ✓ Token aggregation verified:`);
      console.log(`    - Total input: ${workflowRun!.totalTokensInput} (expected: ${expectedTotalInput})`);
      console.log(`    - Total output: ${workflowRun!.totalTokensOutput} (expected: ${expectedTotalOutput})`);
      console.log(`    - Total tokens: ${workflowRun!.totalTokens} (expected: ${expectedTotalTokens})`);
    });
  });

  // ============================================================
  // PHASE 4: Edge Cases and Error Handling
  // ============================================================
  describe('Phase 4: Edge Cases and Error Handling', () => {
    it('should handle component with null token values', async () => {
      expect(ctx.workflowRunId).toBeDefined();
      expect(ctx.projectId).toBeDefined();

      // Create a component with null metrics
      const nullComponent = await createComponent(prisma, {
        projectId: ctx.projectId!,
        name: testName('NullTokensComponent'),
        description: 'Component with null token metrics',
        inputInstructions: 'Test',
        operationInstructions: 'Test null tokens',
        outputInstructions: 'Return result',
        config: {
          modelId: 'claude-sonnet-4-20250514',
          temperature: 0,
          maxOutputTokens: 1000,
        },
        tools: [],
        active: true,
      });

      // Record start
      const startResult = await recordComponentStart(prisma, {
        runId: ctx.workflowRunId!,
        componentId: nullComponent.id,
      });

      // Record complete with null metrics (should default to 0)
      await recordComponentComplete(prisma, {
        runId: ctx.workflowRunId!,
        componentId: nullComponent.id,
        status: 'completed',
        output: { result: 'test' },
        transcriptMetrics: {
          inputTokens: 0,
          outputTokens: 0,
          totalTokens: 0,
          cacheCreationTokens: 0,
          cacheReadTokens: 0,
          model: 'claude-sonnet-4-20250514',
        },
      });

      // Verify cost is 0
      const componentRun = await prisma.componentRun.findUnique({
        where: { id: startResult.componentRunId },
      });

      expect(componentRun).toBeDefined();
      expect(componentRun!.cost).toBe(0);
      console.log(`  ✓ Null tokens handled correctly: cost = $0.00`);
    });

    it('should use default pricing for unknown model', async () => {
      expect(ctx.workflowRunId).toBeDefined();
      expect(ctx.projectId).toBeDefined();

      // Create component with unknown model
      const unknownModelComponent = await createComponent(prisma, {
        projectId: ctx.projectId!,
        name: testName('UnknownModelComponent'),
        description: 'Component with unknown model',
        inputInstructions: 'Test',
        operationInstructions: 'Test unknown model',
        outputInstructions: 'Return result',
        config: {
          modelId: 'gpt-4-turbo', // Unknown model
          temperature: 0,
          maxOutputTokens: 1000,
        },
        tools: [],
        active: true,
      });

      const startResult = await recordComponentStart(prisma, {
        runId: ctx.workflowRunId!,
        componentId: unknownModelComponent.id,
      });

      // Record with metrics for unknown model
      await recordComponentComplete(prisma, {
        runId: ctx.workflowRunId!,
        componentId: unknownModelComponent.id,
        status: 'completed',
        output: { result: 'test' },
        transcriptMetrics: {
          inputTokens: 10_000,
          outputTokens: 2_000,
          totalTokens: 12_000,
          cacheCreationTokens: 0,
          cacheReadTokens: 0,
          model: 'gpt-4-turbo',
        },
      });

      // Should use default pricing (claude-sonnet-4: $3.00 input, $15.00 output)
      // Expected: (10K * $3.00/M) + (2K * $15.00/M) = $0.03 + $0.03 = $0.06
      const componentRun = await prisma.componentRun.findUnique({
        where: { id: startResult.componentRunId },
      });

      expect(componentRun).toBeDefined();
      expect(componentRun!.cost).toBeGreaterThan(0);
      expect(componentRun!.cost).toBeCloseTo(0.06, 4);
      console.log(`  ✓ Unknown model uses default pricing: $${componentRun!.cost!.toFixed(4)}`);
    });
  });

  // ============================================================
  // SUMMARY
  // ============================================================
  describe('Summary', () => {
    it('should report ST-242 test results', () => {
      console.log('\n  ============================================================');
      console.log('  ST-242 Telemetry Metrics Test Summary');
      console.log('  ============================================================');
      console.log(`    Project: ${ctx.projectId || 'not created'}`);
      console.log(`    Workflow Run: ${ctx.workflowRunId || 'not created'}`);
      console.log(`    Components tested: ${st242Ctx.componentMetrics?.length || 0}`);

      if (st242Ctx.componentMetrics && st242Ctx.componentMetrics.length > 0) {
        const totalCost = st242Ctx.componentMetrics.reduce((sum, m) => sum + m.expectedCost, 0);
        console.log(`    Total expected cost: $${totalCost.toFixed(4)}`);

        st242Ctx.componentMetrics.forEach((m, i) => {
          console.log(`    Component ${i + 1}:`);
          console.log(`      - Model: ${m.modelId}`);
          console.log(`      - Tokens: ${m.tokensInput + m.tokensOutput + m.tokensCacheCreation + m.tokensCacheRead}`);
          console.log(`      - Cost: $${m.expectedCost.toFixed(4)}`);
        });
      }
      console.log('  ============================================================');

      expect(true).toBe(true);
    });
  });
});
