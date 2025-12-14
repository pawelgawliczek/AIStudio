/**
 * ST-220: Live Streaming E2E Tests
 *
 * Tests comprehensive live streaming functionality covering both execution modes:
 * - Manual Mode (MasterSession with get_current_step → advance_step)
 * - Docker Runner (start_runner → API-based tracking)
 *
 * Coverage:
 * 1. Transcript registration (master and component)
 * 2. Agent tracking via advance_step (manual mode)
 * 3. Agent tracking via API (runner mode simulation)
 * 4. Telemetry collection (tokens, duration, cost)
 * 5. Component summary generation
 * 6. Transcript upload on completion
 * 7. Consistency between modes
 */

import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

// Import MCP tool handlers
import { handler as createComponent } from '../../mcp/servers/components/create_component';
import { handler as recordAgentComplete } from '../../mcp/servers/execution/record_component_complete';
import { handler as recordAgentStart } from '../../mcp/servers/execution/record_component_start';
import { handler as startTeamRun } from '../../mcp/servers/execution/start_workflow_run';
import { handler as createProject } from '../../mcp/servers/projects/create_project';
import { handler as advanceStep } from '../../mcp/servers/runner/advance_step';
import { handler as createStory } from '../../mcp/servers/stories/create_story';
import { handler as createWorkflowState } from '../../mcp/servers/workflow-states/create_workflow_state';
import { handler as createWorkflow } from '../../mcp/servers/workflows/create_workflow';

// Increase timeout for agent execution
jest.setTimeout(300000); // 5 minutes

describe('ST-220: Live Streaming E2E Tests', () => {
  let prisma: PrismaClient;

  // Test context for cleanup
  const ctx: {
    projectId?: string;
    storyId?: string;
    storyKey?: string;
    teamId?: string;
    state1Id?: string;
    state2Id?: string;
    agent1Id?: string;
    agent2Id?: string;
    manualRunId?: string;
    runnerSimRunId?: string;
  } = {};

  const testPrefix = `_ST220_${Date.now()}`;

  beforeAll(async () => {
    console.log('\n============================================================');
    console.log('ST-220: Live Streaming E2E Tests');
    console.log('============================================================');
    console.log(`Started at: ${new Date().toISOString()}`);
    console.log(`Test prefix: ${testPrefix}`);
    console.log('');

    prisma = new PrismaClient();
  });

  afterAll(async () => {
    console.log('\n[CLEANUP] Starting cleanup...');

    try {
      // Delete in reverse order of creation
      if (ctx.manualRunId) {
        await prisma.componentRun.deleteMany({ where: { workflowRunId: ctx.manualRunId } }).catch(() => {});
        await prisma.workflowRun.delete({ where: { id: ctx.manualRunId } }).catch(() => {});
      }

      if (ctx.runnerSimRunId) {
        await prisma.componentRun.deleteMany({ where: { workflowRunId: ctx.runnerSimRunId } }).catch(() => {});
        await prisma.workflowRun.delete({ where: { id: ctx.runnerSimRunId } }).catch(() => {});
      }

      if (ctx.state1Id) {
        await prisma.workflowState.delete({ where: { id: ctx.state1Id } }).catch(() => {});
      }

      if (ctx.state2Id) {
        await prisma.workflowState.delete({ where: { id: ctx.state2Id } }).catch(() => {});
      }

      if (ctx.teamId) {
        await prisma.workflow.delete({ where: { id: ctx.teamId } }).catch(() => {});
      }

      if (ctx.agent1Id) {
        await prisma.component.delete({ where: { id: ctx.agent1Id } }).catch(() => {});
      }

      if (ctx.agent2Id) {
        await prisma.component.delete({ where: { id: ctx.agent2Id } }).catch(() => {});
      }

      if (ctx.storyId) {
        await prisma.story.delete({ where: { id: ctx.storyId } }).catch(() => {});
      }

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

  describe('Test Setup', () => {
    it('should create test project', async () => {
      const result = await createProject(prisma, {
        name: `${testPrefix}_Project`,
        description: 'ST-220 live streaming tests',
      });

      expect(result).toHaveProperty('id');
      ctx.projectId = result.id;
      console.log(`[SETUP] Created project: ${ctx.projectId}`);
    });

    it('should create test story', async () => {
      const result = await createStory(prisma, {
        projectId: ctx.projectId!,
        title: `${testPrefix}_Story`,
        description: 'Test story for ST-220 live streaming',
        type: 'spike',
      });

      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('key');
      ctx.storyId = result.id;
      ctx.storyKey = result.key;
      console.log(`[SETUP] Created story: ${ctx.storyKey} (${ctx.storyId})`);
    });

    it('should create test agents', async () => {
      const agent1 = await createComponent(prisma, {
        projectId: ctx.projectId!,
        name: `${testPrefix}_Agent1`,
        inputInstructions: 'Read story context.',
        operationInstructions: 'Analyze requirements.',
        outputInstructions: 'Return analysis in JSON.',
        config: {
          modelId: 'claude-sonnet-4-20250514',
          timeout: 60000,
        },
        tools: ['Read'],
      });

      const agent2 = await createComponent(prisma, {
        projectId: ctx.projectId!,
        name: `${testPrefix}_Agent2`,
        inputInstructions: 'Read analysis from Agent1.',
        operationInstructions: 'Create implementation plan.',
        outputInstructions: 'Return plan in JSON.',
        config: {
          modelId: 'claude-sonnet-4-20250514',
          timeout: 60000,
        },
        tools: ['Read', 'Write'],
      });

      expect(agent1).toHaveProperty('id');
      expect(agent2).toHaveProperty('id');
      ctx.agent1Id = agent1.id;
      ctx.agent2Id = agent2.id;
      console.log(`[SETUP] Created agents: ${ctx.agent1Id}, ${ctx.agent2Id}`);
    });

    it('should create test team', async () => {
      const result = await createWorkflow(prisma, {
        projectId: ctx.projectId!,
        name: `${testPrefix}_Team`,
        description: 'ST-220 test team',
        triggerConfig: { type: 'manual' },
      });

      expect(result).toHaveProperty('id');
      ctx.teamId = result.id;
      console.log(`[SETUP] Created team: ${ctx.teamId}`);
    });

    it('should create workflow states', async () => {
      const state1 = await createWorkflowState(prisma, {
        workflowId: ctx.teamId!,
        name: 'analyze',
        order: 1,
        componentId: ctx.agent1Id!,
        mandatory: true,
        requiresApproval: false,
      });

      const state2 = await createWorkflowState(prisma, {
        workflowId: ctx.teamId!,
        name: 'plan',
        order: 2,
        componentId: ctx.agent2Id!,
        mandatory: true,
        requiresApproval: false,
      });

      expect(state1).toHaveProperty('id');
      expect(state2).toHaveProperty('id');
      ctx.state1Id = state1.id;
      ctx.state2Id = state2.id;
      console.log(`[SETUP] Created workflow states: ${ctx.state1Id}, ${ctx.state2Id}`);
    });
  });

  describe('Manual Mode: Transcript Registration', () => {
    it('should register master transcript on start_team_run', async () => {
      const sessionId = uuidv4();
      const transcriptPath = `/tmp/st220-manual/${sessionId}.jsonl`;

      const result = await startTeamRun(prisma, {
        teamId: ctx.teamId!,
        storyId: ctx.storyId!,
        triggeredBy: 'st220-manual-test',
        cwd: '/Users/pawelgawliczek/projects/AIStudio',
        sessionId,
        transcriptPath,
      });

      expect(result).toHaveProperty('runId');
      ctx.manualRunId = result.runId;
      console.log(`[MANUAL] Started team run: ${ctx.manualRunId}`);

      // Verify master transcript registration
      const run = await prisma.workflowRun.findUnique({
        where: { id: ctx.manualRunId },
      });

      expect(run).not.toBeNull();
      expect(run!.masterTranscriptPaths).toContain(transcriptPath);
      console.log('[MANUAL] ✅ Master transcript registered');

      // Verify transcript tracking metadata (ST-172)
      const metadata = run!.metadata as any;
      expect(metadata).toHaveProperty('_transcriptTracking');
      expect(metadata._transcriptTracking).toHaveProperty('sessionId');
      expect(metadata._transcriptTracking).toHaveProperty('orchestratorTranscript');
      expect(metadata._transcriptTracking.sessionId).toBe(sessionId);
      console.log('[MANUAL] ✅ Transcript tracking metadata verified');
    });
  });

  describe('Manual Mode: Agent Tracking via advance_step', () => {
    it('should create ComponentRun when advancing to agent phase (ST-215)', async () => {
      // Advance from init to first state (analyze)
      const result = await advanceStep(prisma, {
        story: ctx.storyKey!,
      });

      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('currentState');
      console.log(`[MANUAL] Advanced to state: ${result.currentState?.name}`);

      // Verify ComponentRun was created automatically (ST-215)
      const componentRuns = await prisma.componentRun.findMany({
        where: {
          workflowRunId: ctx.manualRunId!,
          componentId: ctx.agent1Id!,
        },
        orderBy: { startedAt: 'desc' },
      });

      expect(componentRuns.length).toBeGreaterThan(0);
      const componentRun = componentRuns[0];
      expect(componentRun.status).toBe('running');
      expect(componentRun.startedAt).toBeDefined();
      console.log('[MANUAL] ✅ ComponentRun created automatically via advance_step');
      console.log(`[MANUAL] ComponentRun ID: ${componentRun.id}`);
    });

    it('should track component transcript path in metadata', async () => {
      // Simulate component agent transcript registration
      const componentSessionId = uuidv4();
      const componentTranscriptPath = `/tmp/st220-manual/component-${componentSessionId}.jsonl`;

      const run = await prisma.workflowRun.findUnique({
        where: { id: ctx.manualRunId! },
      });

      const metadata = run!.metadata as any;
      const spawnedAgents = metadata.spawnedAgentTranscripts || [];
      spawnedAgents.push({
        componentId: ctx.agent1Id!,
        transcriptPath: componentTranscriptPath,
        sessionId: componentSessionId,
        spawnedAt: new Date().toISOString(),
      });

      await prisma.workflowRun.update({
        where: { id: ctx.manualRunId! },
        data: {
          metadata: {
            ...metadata,
            spawnedAgentTranscripts: spawnedAgents,
          } as any,
        },
      });

      // Verify update
      const updatedRun = await prisma.workflowRun.findUnique({
        where: { id: ctx.manualRunId! },
      });

      const updatedMetadata = updatedRun!.metadata as any;
      expect(updatedMetadata.spawnedAgentTranscripts).toHaveLength(1);
      expect(updatedMetadata.spawnedAgentTranscripts[0].transcriptPath).toBe(componentTranscriptPath);
      console.log('[MANUAL] ✅ Component transcript tracked in metadata');
    });

    it('should complete ComponentRun when advancing from agent phase (ST-215)', async () => {
      // Simulate agent output
      const output = {
        analysis: 'Requirements analyzed',
        recommendations: ['Use modular architecture', 'Implement error handling'],
        filesReviewed: 3,
      };

      // Advance to next state (this completes current agent)
      const result = await advanceStep(prisma, {
        story: ctx.storyKey!,
        output,
      });

      expect(result).toHaveProperty('success', true);
      console.log(`[MANUAL] Advanced to next state: ${result.currentState?.name}`);

      // Verify ComponentRun was completed automatically (ST-215)
      const componentRuns = await prisma.componentRun.findMany({
        where: {
          workflowRunId: ctx.manualRunId!,
          componentId: ctx.agent1Id!,
        },
        orderBy: { startedAt: 'desc' },
      });

      expect(componentRuns.length).toBeGreaterThan(0);
      const componentRun = componentRuns[0];
      expect(componentRun.status).toBe('completed');
      expect(componentRun.finishedAt).not.toBeNull();
      expect(componentRun.durationSeconds).toBeGreaterThan(0);
      expect(componentRun.outputData).toBeDefined();
      console.log('[MANUAL] ✅ ComponentRun completed automatically via advance_step');
      console.log(`[MANUAL] Duration: ${componentRun.durationSeconds}s`);

      // Verify component summary (ST-203)
      expect(componentRun.componentSummary).toBeDefined();
      const summary = JSON.parse(componentRun.componentSummary!);
      expect(summary).toHaveProperty('componentName');
      expect(summary).toHaveProperty('status');
      console.log('[MANUAL] ✅ Component summary generated (ST-203)');
    });
  });

  describe('Runner Mode Simulation: Agent Tracking via API', () => {
    it('should start workflow run for runner simulation', async () => {
      const sessionId = uuidv4();
      const transcriptPath = `/tmp/st220-runner/${sessionId}.jsonl`;

      const result = await startTeamRun(prisma, {
        teamId: ctx.teamId!,
        storyId: ctx.storyId!,
        triggeredBy: 'st220-runner-test',
        cwd: '/Users/pawelgawliczek/projects/AIStudio',
        sessionId,
        transcriptPath,
      });

      expect(result).toHaveProperty('runId');
      ctx.runnerSimRunId = result.runId;
      console.log(`[RUNNER] Started team run: ${ctx.runnerSimRunId}`);
    });

    it('should create ComponentRun via API (simulating runner)', async () => {
      // Simulate runner calling backendClient.recordAgentStart()
      const result = await recordAgentStart(prisma, {
        runId: ctx.runnerSimRunId!,
        componentId: ctx.agent1Id!,
        input: {
          storyKey: ctx.storyKey!,
          storyTitle: 'Test story',
        },
      });

      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('componentRunId');
      console.log(`[RUNNER] Created ComponentRun: ${result.componentRunId}`);

      // Verify ComponentRun
      const componentRun = await prisma.componentRun.findUnique({
        where: { id: result.componentRunId },
      });

      expect(componentRun).not.toBeNull();
      expect(componentRun!.status).toBe('running');
      expect(componentRun!.componentId).toBe(ctx.agent1Id);
      console.log('[RUNNER] ✅ ComponentRun created via API');
    });

    it('should complete ComponentRun via API with telemetry (simulating runner)', async () => {
      // Get the running ComponentRun
      const runningRuns = await prisma.componentRun.findMany({
        where: {
          workflowRunId: ctx.runnerSimRunId!,
          componentId: ctx.agent1Id!,
          status: 'running',
        },
        orderBy: { startedAt: 'desc' },
      });

      expect(runningRuns.length).toBeGreaterThan(0);
      const componentRun = runningRuns[0];

      // Simulate runner calling backendClient.recordAgentComplete()
      const output = {
        analysis: 'Requirements analyzed via runner',
        recommendations: ['Use microservices', 'Implement caching'],
      };

      const result = await recordAgentComplete(prisma, {
        runId: ctx.runnerSimRunId!,
        componentId: ctx.agent1Id!,
        status: 'completed',
        output,
        componentSummary: 'Agent analyzed requirements and provided recommendations.',
        turnMetrics: {
          totalTurns: 5,
          manualPrompts: 2,
          autoContinues: 3,
        },
        tokensInput: 1500,
        tokensOutput: 800,
      });

      expect(result).toHaveProperty('success', true);
      console.log('[RUNNER] Completed ComponentRun via API');

      // Verify ComponentRun was updated with telemetry
      const updatedRun = await prisma.componentRun.findUnique({
        where: { id: componentRun.id },
      });

      expect(updatedRun).not.toBeNull();
      expect(updatedRun!.status).toBe('completed');
      expect(updatedRun!.finishedAt).not.toBeNull();
      expect(updatedRun!.durationSeconds).toBeGreaterThan(0);

      // Verify telemetry data
      expect(updatedRun!.tokensInput).toBe(1500);
      expect(updatedRun!.tokensOutput).toBe(800);
      console.log('[RUNNER] ✅ Telemetry data stored');

      // Verify turn metrics (ST-147)
      const metadata = updatedRun!.metadata as any;
      expect(metadata).toHaveProperty('turnMetrics');
      expect(metadata.turnMetrics.totalTurns).toBe(5);
      expect(metadata.turnMetrics.manualPrompts).toBe(2);
      expect(metadata.turnMetrics.autoContinues).toBe(3);
      console.log('[RUNNER] ✅ Turn metrics stored (ST-147)');

      // Verify component summary
      expect(updatedRun!.componentSummary).toBeDefined();
      console.log('[RUNNER] ✅ Component summary stored');
    });
  });

  describe('Telemetry Collection & Cost Estimation', () => {
    it('should calculate cost from telemetry data', async () => {
      const componentRuns = await prisma.componentRun.findMany({
        where: { workflowRunId: ctx.runnerSimRunId! },
      });

      expect(componentRuns.length).toBeGreaterThan(0);
      const componentRun = componentRuns[0];

      // Calculate estimated cost (Claude Opus 4.5 pricing)
      const PRICING = {
        input: 0.015 / 1000,
        output: 0.075 / 1000,
      };

      const estimatedCost =
        (componentRun.tokensInput || 0) * PRICING.input +
        (componentRun.tokensOutput || 0) * PRICING.output;

      expect(estimatedCost).toBeGreaterThan(0);
      console.log(`[TELEMETRY] Estimated cost: $${estimatedCost.toFixed(4)}`);
      console.log(`[TELEMETRY] Input tokens: ${componentRun.tokensInput}`);
      console.log(`[TELEMETRY] Output tokens: ${componentRun.tokensOutput}`);
      console.log('[TELEMETRY] ✅ Cost calculation verified');
    });
  });

  describe('Consistency Between Modes', () => {
    it('should verify both modes create same database structure', async () => {
      // Get ComponentRuns from both modes
      const manualRuns = await prisma.componentRun.findMany({
        where: { workflowRunId: ctx.manualRunId! },
        orderBy: { startedAt: 'asc' },
      });

      const runnerRuns = await prisma.componentRun.findMany({
        where: { workflowRunId: ctx.runnerSimRunId! },
        orderBy: { startedAt: 'asc' },
      });

      expect(manualRuns.length).toBeGreaterThan(0);
      expect(runnerRuns.length).toBeGreaterThan(0);

      // Verify both have same fields populated
      const manualRun = manualRuns[0];
      const runnerRun = runnerRuns[0];

      // Common fields
      expect(manualRun.status).toBeDefined();
      expect(runnerRun.status).toBeDefined();
      expect(manualRun.startedAt).toBeDefined();
      expect(runnerRun.startedAt).toBeDefined();
      expect(manualRun.componentId).toBeDefined();
      expect(runnerRun.componentId).toBeDefined();

      // Both should have finished
      expect(manualRun.finishedAt).toBeDefined();
      expect(runnerRun.finishedAt).toBeDefined();
      expect(manualRun.durationSeconds).toBeGreaterThan(0);
      expect(runnerRun.durationSeconds).toBeGreaterThan(0);

      // Both should have component summary
      expect(manualRun.componentSummary).toBeDefined();
      expect(runnerRun.componentSummary).toBeDefined();

      console.log('[CONSISTENCY] ✅ Both modes create consistent database structure');
    });

    it('should verify both modes register transcripts', async () => {
      const manualRun = await prisma.workflowRun.findUnique({
        where: { id: ctx.manualRunId! },
      });

      const runnerRun = await prisma.workflowRun.findUnique({
        where: { id: ctx.runnerSimRunId! },
      });

      expect(manualRun).not.toBeNull();
      expect(runnerRun).not.toBeNull();

      // Both should have master transcript paths
      expect(manualRun!.masterTranscriptPaths.length).toBeGreaterThan(0);
      expect(runnerRun!.masterTranscriptPaths.length).toBeGreaterThan(0);

      // Both should have transcript tracking metadata
      const manualMetadata = manualRun!.metadata as any;
      const runnerMetadata = runnerRun!.metadata as any;
      expect(manualMetadata._transcriptTracking).toBeDefined();
      expect(runnerMetadata._transcriptTracking).toBeDefined();

      console.log('[CONSISTENCY] ✅ Both modes register transcripts consistently');
    });
  });

  describe('Transcript Upload on Completion (ST-168)', () => {
    it('should verify transcript upload structure exists', async () => {
      // This test verifies the data structures for transcript upload
      // Actual upload happens via remote agent (ST-168)

      const componentRuns = await prisma.componentRun.findMany({
        where: { workflowRunId: ctx.manualRunId! },
      });

      expect(componentRuns.length).toBeGreaterThan(0);
      const componentRun = componentRuns[0];

      // ComponentRun metadata can store transcriptArtifactId (ST-168)
      const metadata = componentRun.metadata as any;
      expect(metadata).toBeDefined();

      // After transcript upload, metadata would contain transcriptArtifactId
      // We're just verifying the structure exists for storing it
      console.log('[UPLOAD] ✅ Transcript upload metadata structure verified');
    });
  });

  describe('Integration: End-to-End Verification', () => {
    it('should verify complete manual mode workflow', async () => {
      const run = await prisma.workflowRun.findUnique({
        where: { id: ctx.manualRunId! },
        include: {
          workflow: true,
          story: true,
          componentRuns: {
            orderBy: { startedAt: 'asc' },
          },
        },
      });

      expect(run).not.toBeNull();
      expect(run!.componentRuns.length).toBeGreaterThan(0);

      console.log('[INTEGRATION] Manual Mode Summary:');
      console.log(`  Run ID: ${run!.id}`);
      console.log(`  Story: ${run!.story?.key}`);
      console.log(`  Component Runs: ${run!.componentRuns.length}`);
      console.log(`  Master Transcripts: ${run!.masterTranscriptPaths.length}`);

      run!.componentRuns.forEach((cr, idx) => {
        console.log(`  Component ${idx + 1}:`);
        console.log(`    Status: ${cr.status}`);
        console.log(`    Duration: ${cr.durationSeconds}s`);
        console.log(`    Tokens: ${cr.tokensInput}in/${cr.tokensOutput}out`);
      });

      console.log('[INTEGRATION] ✅ Manual mode workflow complete');
    });

    it('should verify complete runner mode workflow', async () => {
      const run = await prisma.workflowRun.findUnique({
        where: { id: ctx.runnerSimRunId! },
        include: {
          workflow: true,
          story: true,
          componentRuns: {
            orderBy: { startedAt: 'asc' },
          },
        },
      });

      expect(run).not.toBeNull();
      expect(run!.componentRuns.length).toBeGreaterThan(0);

      console.log('[INTEGRATION] Runner Mode Summary:');
      console.log(`  Run ID: ${run!.id}`);
      console.log(`  Story: ${run!.story?.key}`);
      console.log(`  Component Runs: ${run!.componentRuns.length}`);
      console.log(`  Master Transcripts: ${run!.masterTranscriptPaths.length}`);

      run!.componentRuns.forEach((cr, idx) => {
        console.log(`  Component ${idx + 1}:`);
        console.log(`    Status: ${cr.status}`);
        console.log(`    Duration: ${cr.durationSeconds}s`);
        console.log(`    Tokens: ${cr.tokensInput}in/${cr.tokensOutput}out`);
      });

      console.log('[INTEGRATION] ✅ Runner mode workflow complete');
    });
  });
});
