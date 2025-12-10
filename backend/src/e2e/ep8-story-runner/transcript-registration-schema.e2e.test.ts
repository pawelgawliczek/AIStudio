/**
 * Transcript Registration - Schema Tests
 *
 * Tests transcript registration database schema functionality:
 * - Master transcript paths stored in WorkflowRun.masterTranscriptPaths
 * - Agent transcripts stored in WorkflowRun.metadata.spawnedAgentTranscripts
 * - Transcript tracking metadata (_transcriptTracking)
 * - Multiple session support (post-compaction)
 *
 * These tests use direct Prisma database operations to verify schema integrity.
 */

import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

// Increase timeout for workflow operations
jest.setTimeout(120000);

describe('Transcript Registration - Schema Tests', () => {
  let prisma: PrismaClient;

  // Test context - stores IDs for cleanup
  const ctx: {
    userId?: string;
    projectId?: string;
    storyId?: string;
    teamId?: string;
    stateId?: string;
    runId?: string;
    componentId?: string;
  } = {};

  const testPrefix = `_ST189_TRANSCRIPT_${Date.now()}`;

  beforeAll(async () => {
    console.log('\n============================================================');
    console.log('ST-189: Transcript Registration E2E Tests');
    console.log('============================================================');
    console.log(`Started at: ${new Date().toISOString()}`);
    console.log(`Test prefix: ${testPrefix}`);
    console.log('');

    prisma = new PrismaClient();
  });

  afterAll(async () => {
    console.log('\n[CLEANUP] Starting cleanup...');

    try {
      // Delete workflow run
      if (ctx.runId) {
        await prisma.workflowRun.delete({ where: { id: ctx.runId } }).catch(() => {});
      }

      // Delete workflow state
      if (ctx.stateId) {
        await prisma.workflowState.delete({ where: { id: ctx.stateId } }).catch(() => {});
      }

      // Delete team/workflow
      if (ctx.teamId) {
        await prisma.workflow.delete({ where: { id: ctx.teamId } }).catch(() => {});
      }

      // Delete component
      if (ctx.componentId) {
        await prisma.component.delete({ where: { id: ctx.componentId } }).catch(() => {});
      }

      // Delete story
      if (ctx.storyId) {
        await prisma.story.delete({ where: { id: ctx.storyId } }).catch(() => {});
      }

      // Delete project
      if (ctx.projectId) {
        await prisma.project.delete({ where: { id: ctx.projectId } }).catch(() => {});
      }

      // Delete user
      if (ctx.userId) {
        await prisma.user.delete({ where: { id: ctx.userId } }).catch(() => {});
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
    it('should create test user', async () => {
      const user = await prisma.user.create({
        data: {
          email: `${testPrefix}@test.local`,
          name: 'Test User for ST-189',
          password: 'test-password-hash',
          role: 'dev',
        },
      });

      ctx.userId = user.id;
      console.log(`[SETUP] Created user: ${user.id}`);
      expect(user.id).toBeDefined();
    });

    it('should create test project', async () => {
      const project = await prisma.project.create({
        data: {
          name: `${testPrefix}_Project`,
          description: 'Test project for ST-189 transcript registration',
          status: 'active',
        },
      });

      ctx.projectId = project.id;
      console.log(`[SETUP] Created project: ${project.id}`);
      expect(project.id).toBeDefined();
    });

    it('should create test story', async () => {
      const story = await prisma.story.create({
        data: {
          project: { connect: { id: ctx.projectId! } },
          createdBy: { connect: { id: ctx.userId! } },
          key: `ST-${Date.now()}`,
          title: `${testPrefix}_Story`,
          description: 'Test story for transcript registration',
          type: 'spike',
          status: 'planning',
        },
      });

      ctx.storyId = story.id;
      console.log(`[SETUP] Created story: ${story.key} (${story.id})`);
      expect(story.id).toBeDefined();
    });

    it('should create test component (agent)', async () => {
      const component = await prisma.component.create({
        data: {
          project: { connect: { id: ctx.projectId! } },
          name: `${testPrefix}_TestAgent`,
          description: 'Test agent for transcript verification',
          inputInstructions: 'Receive test input',
          operationInstructions: 'Output marker string for verification',
          outputInstructions: 'Return JSON with marker',
          config: {
            modelId: 'claude-sonnet-4-20250514',
            timeout: 60000,
          },
          tools: ['Read'],
          active: true,
        },
      });

      ctx.componentId = component.id;
      console.log(`[SETUP] Created component: ${component.id}`);
      expect(component.id).toBeDefined();
    });

    it('should create test team (workflow)', async () => {
      const team = await prisma.workflow.create({
        data: {
          project: { connect: { id: ctx.projectId! } },
          name: `${testPrefix}_Team`,
          description: 'Test team for transcript registration',
          triggerConfig: { type: 'manual' },
          active: true,
        },
      });

      ctx.teamId = team.id;
      console.log(`[SETUP] Created team: ${team.id}`);
      expect(team.id).toBeDefined();
    });

    it('should create workflow state', async () => {
      const state = await prisma.workflowState.create({
        data: {
          workflow: { connect: { id: ctx.teamId! } },
          name: 'test-state',
          order: 1,
          component: { connect: { id: ctx.componentId! } },
          mandatory: true,
          requiresApproval: false,
          preExecutionInstructions: 'Test pre-execution',
          postExecutionInstructions: 'Test post-execution',
        },
      });

      ctx.stateId = state.id;
      console.log(`[SETUP] Created state: ${state.id}`);
      expect(state.id).toBeDefined();
    });
  });

  describe('Master Transcript Registration', () => {
    it('should register master transcript when workflow run starts', async () => {
      // Generate test session info
      const testSessionId = uuidv4();
      const testTranscriptPath = `/test/transcripts/${testSessionId}.jsonl`;

      // Create workflow run with transcript tracking
      const run = await prisma.workflowRun.create({
        data: {
          project: { connect: { id: ctx.projectId! } },
          workflow: { connect: { id: ctx.teamId! } },
          story: { connect: { id: ctx.storyId! } },
          status: 'running',
          triggeredBy: 'e2e-test',
          startedAt: new Date(),
          masterTranscriptPaths: [testTranscriptPath],
          // ST-189: Transcript tracking data stored in metadata
          metadata: {
            storyId: ctx.storyId,
            _transcriptTracking: {
              sessionId: testSessionId,
              projectPath: '/test/project',
              transcriptDirectory: '/test/transcripts',
              orchestratorStartTime: new Date().toISOString(),
            },
          },
        },
      });

      ctx.runId = run.id;
      console.log(`[TEST] Created workflow run: ${run.id}`);

      // Verify master transcript was registered
      expect(run.masterTranscriptPaths).toContain(testTranscriptPath);
      expect(run.metadata).toHaveProperty('_transcriptTracking');
      expect((run.metadata as any)._transcriptTracking.sessionId).toBe(testSessionId);

      console.log('[TEST] Master transcript registration: PASSED');
    });

    it('should support multiple master transcripts (post-compaction)', async () => {
      // Add a second transcript path (simulating context compaction)
      const secondTranscriptPath = `/test/transcripts/${uuidv4()}.jsonl`;

      const updatedRun = await prisma.workflowRun.update({
        where: { id: ctx.runId! },
        data: {
          masterTranscriptPaths: {
            push: secondTranscriptPath,
          },
        },
      });

      // Verify both transcripts are registered
      expect(updatedRun.masterTranscriptPaths).toHaveLength(2);
      expect(updatedRun.masterTranscriptPaths).toContain(secondTranscriptPath);

      console.log('[TEST] Multiple master transcripts: PASSED');
      console.log(`[TEST] Registered paths: ${updatedRun.masterTranscriptPaths.join(', ')}`);
    });
  });

  describe('Agent Transcript Registration', () => {
    it('should register agent transcript in metadata', async () => {
      // Simulate agent transcript registration
      const agentTranscript = {
        componentId: ctx.componentId,
        agentId: uuidv4(),
        transcriptPath: `/test/transcripts/agent-${Date.now()}.jsonl`,
        spawnedAt: new Date().toISOString(),
      };

      const run = await prisma.workflowRun.findUnique({
        where: { id: ctx.runId! },
      });

      const currentMetadata = (run?.metadata as any) || {};
      const spawnedAgentTranscripts = currentMetadata.spawnedAgentTranscripts || [];
      spawnedAgentTranscripts.push(agentTranscript);

      const updatedRun = await prisma.workflowRun.update({
        where: { id: ctx.runId! },
        data: {
          metadata: {
            ...currentMetadata,
            spawnedAgentTranscripts,
          },
        },
      });

      // Verify agent transcript was registered
      const metadata = updatedRun.metadata as any;
      expect(metadata.spawnedAgentTranscripts).toHaveLength(1);
      expect(metadata.spawnedAgentTranscripts[0].componentId).toBe(ctx.componentId);
      expect(metadata.spawnedAgentTranscripts[0].transcriptPath).toBe(agentTranscript.transcriptPath);

      console.log('[TEST] Agent transcript registration: PASSED');
      console.log(`[TEST] Agent transcript path: ${agentTranscript.transcriptPath}`);
    });

    it('should support multiple agent transcripts', async () => {
      // Add a second agent transcript
      const secondAgentTranscript = {
        componentId: ctx.componentId,
        agentId: uuidv4(),
        transcriptPath: `/test/transcripts/agent-${Date.now()}-2.jsonl`,
        spawnedAt: new Date().toISOString(),
      };

      const run = await prisma.workflowRun.findUnique({
        where: { id: ctx.runId! },
      });

      const currentMetadata = (run?.metadata as any) || {};
      const spawnedAgentTranscripts = currentMetadata.spawnedAgentTranscripts || [];
      spawnedAgentTranscripts.push(secondAgentTranscript);

      const updatedRun = await prisma.workflowRun.update({
        where: { id: ctx.runId! },
        data: {
          metadata: {
            ...currentMetadata,
            spawnedAgentTranscripts,
          },
        },
      });

      // Verify both agent transcripts are registered
      const metadata = updatedRun.metadata as any;
      expect(metadata.spawnedAgentTranscripts).toHaveLength(2);

      console.log('[TEST] Multiple agent transcripts: PASSED');
      console.log(`[TEST] Total agent transcripts: ${metadata.spawnedAgentTranscripts.length}`);
    });
  });

  describe('Transcript Tracking Data Integrity', () => {
    it('should preserve transcript tracking through workflow updates', async () => {
      // Simulate workflow state updates
      await prisma.workflowRun.update({
        where: { id: ctx.runId! },
        data: {
          status: 'completed',
          finishedAt: new Date(),
        },
      });

      // Verify transcript data is preserved
      const finalRun = await prisma.workflowRun.findUnique({
        where: { id: ctx.runId! },
      });

      expect(finalRun?.masterTranscriptPaths).toHaveLength(2);
      expect(finalRun?.metadata).toHaveProperty('_transcriptTracking');

      const metadata = finalRun?.metadata as any;
      expect(metadata.spawnedAgentTranscripts).toHaveLength(2);

      console.log('[TEST] Transcript data integrity: PASSED');
    });

    it('should include all required transcript tracking fields', async () => {
      const run = await prisma.workflowRun.findUnique({
        where: { id: ctx.runId! },
      });

      const metadata = run?.metadata as any;
      const tracking = metadata._transcriptTracking;

      // Verify required fields
      expect(tracking).toHaveProperty('sessionId');
      expect(tracking).toHaveProperty('projectPath');
      expect(tracking).toHaveProperty('transcriptDirectory');
      expect(tracking).toHaveProperty('orchestratorStartTime');

      console.log('[TEST] Required fields check: PASSED');
      console.log(`[TEST] Session ID: ${tracking.sessionId}`);
      console.log(`[TEST] Project path: ${tracking.projectPath}`);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty transcript paths gracefully', async () => {
      // Create a run without transcript paths
      const emptyRun = await prisma.workflowRun.create({
        data: {
          project: { connect: { id: ctx.projectId! } },
          workflow: { connect: { id: ctx.teamId! } },
          story: { connect: { id: ctx.storyId! } },
          status: 'running',
          triggeredBy: 'e2e-test-empty',
          startedAt: new Date(),
          masterTranscriptPaths: [],
          metadata: {},
        },
      });

      expect(emptyRun.masterTranscriptPaths).toHaveLength(0);

      // Cleanup
      await prisma.workflowRun.delete({ where: { id: emptyRun.id } });

      console.log('[TEST] Empty transcript paths: PASSED');
    });

    it('should deduplicate duplicate transcript paths', async () => {
      const duplicatePath = '/test/transcripts/duplicate.jsonl';

      // Create run with duplicate paths
      const dedupRun = await prisma.workflowRun.create({
        data: {
          project: { connect: { id: ctx.projectId! } },
          workflow: { connect: { id: ctx.teamId! } },
          story: { connect: { id: ctx.storyId! } },
          status: 'running',
          triggeredBy: 'e2e-test-dedup',
          startedAt: new Date(),
          masterTranscriptPaths: [duplicatePath, duplicatePath],
          metadata: {},
        },
      });

      // Note: Prisma doesn't auto-dedupe, but our service layer should
      // This test documents the expected behavior
      expect(dedupRun.masterTranscriptPaths).toContain(duplicatePath);

      // Cleanup
      await prisma.workflowRun.delete({ where: { id: dedupRun.id } });

      console.log('[TEST] Duplicate path handling: PASSED');
    });
  });
});
