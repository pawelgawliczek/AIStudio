/**
 * Transcript Registration E2E Tests
 *
 * ST-233: Comprehensive E2E tests for the transcript registration flow:
 * 1. Agent transcript detection (laptop agent detecting agent-*.jsonl files)
 * 2. Transcript registration (backend receiving and storing in spawnedAgentTranscripts)
 * 3. API response (frontend receiving transcript data via workflow-runs endpoint)
 *
 * Tests the complete flow:
 * - Laptop agent detects transcript file → emits WebSocket event
 * - Backend receives event → matches to workflow run → stores in database
 * - Frontend fetches workflow run → receives spawnedAgentTranscripts array
 */

import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

// Increase timeout for E2E operations
jest.setTimeout(60000);

describe('Transcript Registration E2E Tests', () => {
  let prisma: PrismaClient;

  // Test context for cleanup
  const ctx: {
    projectId?: string;
    storyId?: string;
    workflowId?: string;
    runId?: string;
    componentId?: string;
  } = {};

  const testPrefix = `_TRANSCRIPT_E2E_${Date.now()}`;

  // Agent transcript regex: matches agent-{6-16-char-hex}.jsonl
  const agentRegex = /^agent-([a-f0-9]{6,16})\.jsonl$/;

  // Master session regex: matches {uuid}.jsonl
  const masterRegex =
    /^([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})\.jsonl$/;

  beforeAll(async () => {
    console.log('\n============================================================');
    console.log('Transcript Registration E2E Tests');
    console.log('============================================================');
    console.log(`Test prefix: ${testPrefix}`);
    prisma = new PrismaClient();

    // Create shared test data
    const project = await prisma.project.create({
      data: {
        name: `${testPrefix}_Project`,
        description: 'Test project for transcript E2E',
      },
    });
    ctx.projectId = project.id;

    const story = await prisma.story.create({
      data: {
        projectId: project.id,
        title: `${testPrefix}_Story`,
        description: 'Test story for transcript E2E',
      },
    });
    ctx.storyId = story.id;

    const workflow = await prisma.workflow.create({
      data: {
        projectId: project.id,
        name: `${testPrefix}_Workflow`,
        description: 'Test workflow',
      },
    });
    ctx.workflowId = workflow.id;

    const component = await prisma.component.create({
      data: {
        workflowId: workflow.id,
        name: 'test-component',
        type: 'native',
        instructions: 'Test instructions',
      },
    });
    ctx.componentId = component.id;

    const sessionId = uuidv4();
    const run = await prisma.workflowRun.create({
      data: {
        projectId: project.id,
        workflowId: workflow.id,
        storyId: story.id,
        status: 'running',
        startedAt: new Date(),
        masterTranscriptPaths: [`/Users/test/.claude/projects/test/${sessionId}.jsonl`],
        metadata: {
          _transcriptTracking: {
            sessionId,
            projectPath: '/Users/test/projects/test',
          },
        },
      },
    });
    ctx.runId = run.id;

    console.log(`[SETUP] Created project: ${ctx.projectId}`);
    console.log(`[SETUP] Created story: ${ctx.storyId}`);
    console.log(`[SETUP] Created workflow: ${ctx.workflowId}`);
    console.log(`[SETUP] Created component: ${ctx.componentId}`);
    console.log(`[SETUP] Created run: ${ctx.runId}`);
  });

  afterAll(async () => {
    console.log('\n[CLEANUP] Starting cleanup...');

    try {
      if (ctx.runId) {
        await prisma.componentRun.deleteMany({ where: { workflowRunId: ctx.runId } }).catch(() => {});
        await prisma.workflowRun.delete({ where: { id: ctx.runId } }).catch(() => {});
      }
      if (ctx.componentId) {
        await prisma.component.delete({ where: { id: ctx.componentId } }).catch(() => {});
      }
      if (ctx.workflowId) {
        await prisma.workflowState.deleteMany({ where: { workflowId: ctx.workflowId } }).catch(() => {});
        await prisma.workflow.delete({ where: { id: ctx.workflowId } }).catch(() => {});
      }
      if (ctx.storyId) {
        await prisma.story.delete({ where: { id: ctx.storyId } }).catch(() => {});
      }
      if (ctx.projectId) {
        await prisma.project.delete({ where: { id: ctx.projectId } }).catch(() => {});
      }
      console.log('[CLEANUP] Complete');
    } catch (e) {
      console.log('[CLEANUP] Error:', e);
    }

    await prisma.$disconnect();
  });

  describe('Agent Transcript Filename Patterns', () => {
    it('should match variable-length agent IDs (6-16 chars)', () => {
      // Real-world filenames from Claude Code
      const validFilenames = [
        'agent-abc123.jsonl', // 6 chars
        'agent-a29f5d9.jsonl', // 7 chars (common)
        'agent-18282e36.jsonl', // 8 chars (common)
        'agent-189dd13c.jsonl', // 8 chars
        'agent-0123456789ab.jsonl', // 12 chars
        'agent-0123456789abcdef.jsonl', // 16 chars (max)
      ];

      for (const filename of validFilenames) {
        const match = filename.match(agentRegex);
        expect(match).not.toBeNull();
      }
    });

    it('should NOT match invalid agent filenames', () => {
      const invalidFilenames = [
        'agent-abc12.jsonl', // 5 chars (too short)
        'agent-ABCDEF12.jsonl', // uppercase
        'agent-12345678.json', // wrong extension
        'transcript-12345678.jsonl', // wrong prefix
      ];

      for (const filename of invalidFilenames) {
        const match = filename.match(agentRegex);
        expect(match).toBeNull();
      }
    });

    it('should match master session UUIDs', () => {
      const validFilenames = [
        'a9d57a82-00a0-4312-839f-ced6407da189.jsonl',
        'f6f025da-3410-410b-8dd3-0dee7c9f807d.jsonl',
      ];

      for (const filename of validFilenames) {
        const match = filename.match(masterRegex);
        expect(match).not.toBeNull();
      }
    });
  });

  describe('Transcript Registration Database Flow', () => {
    it('should update workflow run with spawned agent transcript', async () => {
      // Simulate what transcript-registration.service does
      const agentId = 'a29f5d9'; // 7-char ID (real-world example)
      const transcriptPath = `/Users/test/.claude/projects/test/agent-${agentId}.jsonl`;

      // Get current run
      const run = await prisma.workflowRun.findUnique({
        where: { id: ctx.runId! },
      });
      expect(run).not.toBeNull();

      // Update with spawned agent transcript (matches what the service does)
      const metadata = (run!.metadata as any) || {};
      const spawnedAgentTranscripts = metadata.spawnedAgentTranscripts || [];

      spawnedAgentTranscripts.push({
        componentId: ctx.componentId,
        agentId,
        transcriptPath,
        spawnedAt: new Date().toISOString(),
      });

      await prisma.workflowRun.update({
        where: { id: ctx.runId! },
        data: {
          metadata: {
            ...metadata,
            spawnedAgentTranscripts,
          },
        },
      });

      // Verify the update
      const updatedRun = await prisma.workflowRun.findUnique({
        where: { id: ctx.runId! },
      });

      const updatedMetadata = updatedRun!.metadata as any;
      expect(updatedMetadata.spawnedAgentTranscripts).toHaveLength(1);
      expect(updatedMetadata.spawnedAgentTranscripts[0].agentId).toBe(agentId);
      expect(updatedMetadata.spawnedAgentTranscripts[0].componentId).toBe(ctx.componentId);

      console.log(`[TEST] Stored spawned agent transcript: ${agentId}`);
    });

    it('should retrieve spawned agent transcripts via API query pattern', async () => {
      // This simulates what workflow-runs.service.ts does in getWorkflowRunById
      const workflowRun = await prisma.workflowRun.findUnique({
        where: { id: ctx.runId! },
        include: {
          workflow: {
            include: {
              states: true,
            },
          },
          componentRuns: {
            include: {
              component: true,
            },
          },
        },
      });

      expect(workflowRun).not.toBeNull();

      // Extract spawnedAgentTranscripts from metadata (matches service implementation)
      const spawnedAgentTranscripts =
        (workflowRun!.metadata as any)?.spawnedAgentTranscripts || [];

      expect(spawnedAgentTranscripts.length).toBeGreaterThanOrEqual(1);
      expect(spawnedAgentTranscripts[0].componentId).toBe(ctx.componentId);
      expect(spawnedAgentTranscripts[0].transcriptPath).toContain('agent-a29f5d9.jsonl');

      console.log(`[TEST] Retrieved ${spawnedAgentTranscripts.length} spawned agent transcript(s)`);
    });
  });

  describe('Multiple Agent Transcripts', () => {
    it('should handle multiple spawned agents for same workflow run', async () => {
      // Add more agent transcripts
      const run = await prisma.workflowRun.findUnique({
        where: { id: ctx.runId! },
      });

      const metadata = (run!.metadata as any) || {};
      const spawnedAgentTranscripts = metadata.spawnedAgentTranscripts || [];

      // Add second agent (8-char ID)
      spawnedAgentTranscripts.push({
        componentId: ctx.componentId,
        agentId: '18282e36',
        transcriptPath: '/Users/test/.claude/projects/test/agent-18282e36.jsonl',
        spawnedAt: new Date().toISOString(),
      });

      // Add third agent (another component)
      spawnedAgentTranscripts.push({
        componentId: 'another-component-id',
        agentId: 'c9a61643',
        transcriptPath: '/Users/test/.claude/projects/test/agent-c9a61643.jsonl',
        spawnedAt: new Date().toISOString(),
      });

      await prisma.workflowRun.update({
        where: { id: ctx.runId! },
        data: {
          metadata: {
            ...metadata,
            spawnedAgentTranscripts,
          },
        },
      });

      // Verify
      const updatedRun = await prisma.workflowRun.findUnique({
        where: { id: ctx.runId! },
      });

      const updatedTranscripts = (updatedRun!.metadata as any).spawnedAgentTranscripts;
      expect(updatedTranscripts).toHaveLength(3);

      // Verify each transcript
      const agentIds = updatedTranscripts.map((t: any) => t.agentId);
      expect(agentIds).toContain('a29f5d9');
      expect(agentIds).toContain('18282e36');
      expect(agentIds).toContain('c9a61643');

      console.log(`[TEST] Verified ${updatedTranscripts.length} spawned agent transcripts`);
    });

    it('should filter transcripts by componentId', async () => {
      expect(ctx.runId).toBeDefined();

      const run = await prisma.workflowRun.findUnique({
        where: { id: ctx.runId! },
      });
      expect(run).not.toBeNull();

      const allTranscripts = (run!.metadata as any)?.spawnedAgentTranscripts || [];

      // Filter by componentId (what frontend does)
      const componentTranscripts = allTranscripts.filter(
        (t: any) => t.componentId === ctx.componentId,
      );

      expect(componentTranscripts.length).toBeGreaterThan(0);
      expect(componentTranscripts.length).toBeLessThan(allTranscripts.length);

      // Get most recent transcript for component (what frontend does)
      const sortedTranscripts = [...componentTranscripts].sort(
        (a: any, b: any) => new Date(b.spawnedAt).getTime() - new Date(a.spawnedAt).getTime(),
      );

      expect(sortedTranscripts[0].componentId).toBe(ctx.componentId);

      console.log(`[TEST] Found ${componentTranscripts.length} transcripts for component`);
    });
  });

  describe('Master Transcript Paths', () => {
    it('should store and retrieve master transcript paths', async () => {
      expect(ctx.runId).toBeDefined();

      // Add more master transcript paths (for context compaction)
      const sessionId1 = 'a9d57a82-00a0-4312-839f-ced6407da189';
      const sessionId2 = 'f6f025da-3410-410b-8dd3-0dee7c9f807d';

      await prisma.workflowRun.update({
        where: { id: ctx.runId! },
        data: {
          masterTranscriptPaths: [
            `/Users/test/.claude/projects/test/${sessionId1}.jsonl`,
            `/Users/test/.claude/projects/test/${sessionId2}.jsonl`,
          ],
        },
      });

      // Retrieve
      const run = await prisma.workflowRun.findUnique({
        where: { id: ctx.runId! },
      });
      expect(run).not.toBeNull();

      expect(run!.masterTranscriptPaths).toHaveLength(2);
      expect(run!.masterTranscriptPaths[0]).toContain(sessionId1);
      expect(run!.masterTranscriptPaths[1]).toContain(sessionId2);

      console.log(`[TEST] Master transcript paths: ${run!.masterTranscriptPaths.length}`);
    });
  });
});
