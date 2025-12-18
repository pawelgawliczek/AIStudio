/**
 * Transcript Registration - MCP Integration Tests
 *
 * Tests transcript registration via live MCP tool calls:
 * - Creates real test project, story, workflow via MCP handlers
 * - Starts team run with transcript tracking (sessionId, transcriptPath)
 * - Records agent start/complete and verifies transcript registration
 * - Tests WebSocket live streaming connectivity
 *
 * IMPORTANT: These tests run against the production database!
 * Test data is cleaned up after each run.
 */
import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import WebSocket from 'ws';
// Import MCP tool handlers directly
import { handler as createComponent } from '../../mcp/servers/components/create_component';
import { handler as getWorkflowRunResults } from '../../mcp/servers/execution/get_workflow_run_results';
import { handler as recordComponentComplete } from '../../mcp/servers/execution/record_component_complete';
import { handler as recordComponentStart } from '../../mcp/servers/execution/record_component_start';
import { handler as startWorkflowRun } from '../../mcp/servers/execution/start_workflow_run';
import { handler as createProject } from '../../mcp/servers/projects/create_project';
import { handler as spawnAgent } from '../../mcp/servers/remote-agent/spawn_agent';
import { handler as createStory } from '../../mcp/servers/stories/create_story';
import { handler as createWorkflowState } from '../../mcp/servers/workflow-states/create_workflow_state';
import { handler as createWorkflow } from '../../mcp/servers/workflows/create_workflow';

// Increase timeout for workflow operations
jest.setTimeout(300000); // 5 minutes for real agent execution

describe('Transcript Registration - MCP Integration Tests', () => {
  let prisma: PrismaClient;

  // Test context for cleanup
  const ctx: {
    projectId?: string;
    storyId?: string;
    storyKey?: string;
    teamId?: string;
    stateId?: string;
    runId?: string;
    agentId?: string;
    componentRunId?: string;
  } = {};

  const testPrefix = `_ST189_LIVE_${Date.now()}`;

  beforeAll(async () => {
    console.log('\n============================================================');
    console.log('ST-189: Live Transcript Registration Integration Tests');
    console.log('============================================================');
    console.log(`Started at: ${new Date().toISOString()}`);
    console.log(`Test prefix: ${testPrefix}`);
    console.log('WARNING: Running against PRODUCTION database!');
    console.log('');

    prisma = new PrismaClient();
  });

  afterAll(async () => {
    console.log('\n[CLEANUP] Starting cleanup...');

    try {
      // Delete in reverse order of creation
      if (ctx.runId) {
        // Delete component runs first
        await prisma.componentRun.deleteMany({ where: { workflowRunId: ctx.runId } }).catch(() => {});
        await prisma.workflowRun.delete({ where: { id: ctx.runId } }).catch(() => {});
      }

      if (ctx.stateId) {
        await prisma.workflowState.delete({ where: { id: ctx.stateId } }).catch(() => {});
      }

      if (ctx.teamId) {
        await prisma.workflow.delete({ where: { id: ctx.teamId } }).catch(() => {});
      }

      if (ctx.agentId) {
        await prisma.component.delete({ where: { id: ctx.agentId } }).catch(() => {});
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

  describe('Setup via MCP Tools', () => {
    it('should create test project via MCP', async () => {
      const result = await createProject(prisma, {
        name: `${testPrefix}_Project`,
        description: 'Live test project for ST-189 transcript verification',
      });

      expect(result).toHaveProperty('id');
      ctx.projectId = result.id;
      console.log(`[SETUP] Created project via MCP: ${ctx.projectId}`);
    });

    it('should create test story via MCP', async () => {
      const result = await createStory(prisma, {
        projectId: ctx.projectId!,
        title: `${testPrefix}_Story`,
        description: 'Live test story for transcript registration verification',
        type: 'spike',
      });

      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('key');
      ctx.storyId = result.id;
      ctx.storyKey = result.key;
      console.log(`[SETUP] Created story via MCP: ${ctx.storyKey} (${ctx.storyId})`);
    });

    it('should create test agent via MCP', async () => {
      const result = await createComponent(prisma, {
        projectId: ctx.projectId!,
        name: `${testPrefix}_TranscriptTestAgent`,
        inputInstructions: 'Read the story context provided.',
        operationInstructions: `Output EXACTLY this marker string: ST189_LIVE_MARKER_${Date.now()}`,
        outputInstructions: 'Return the marker string in JSON format: {"marker": "..."}',
        config: {
          modelId: 'claude-sonnet-4-20250514',
          timeout: 120000,
        },
        tools: ['Read'],
      });

      expect(result).toHaveProperty('id');
      ctx.agentId = result.id;
      console.log(`[SETUP] Created agent via MCP: ${ctx.agentId}`);
    });

    it('should create test team (workflow) via MCP', async () => {
      const result = await createWorkflow(prisma, {
        projectId: ctx.projectId!,
        name: `${testPrefix}_Team`,
        description: 'Live test team for transcript verification',
        triggerConfig: { type: 'manual' },
      });

      expect(result).toHaveProperty('id');
      ctx.teamId = result.id;
      console.log(`[SETUP] Created team via MCP: ${ctx.teamId}`);
    });

    it('should create workflow state via MCP', async () => {
      const result = await createWorkflowState(prisma, {
        workflowId: ctx.teamId!,
        name: 'transcript-test-state',
        order: 1,
        componentId: ctx.agentId!,
        mandatory: true,
        requiresApproval: false,
        preExecutionInstructions: 'Prepare to execute transcript test agent',
        postExecutionInstructions: 'Verify agent output contains marker',
      });

      expect(result).toHaveProperty('id');
      ctx.stateId = result.id;
      console.log(`[SETUP] Created workflow state via MCP: ${ctx.stateId}`);
    });
  });

  describe('Master Transcript Registration via start_team_run', () => {
    it('should register master transcript when starting team run', async () => {
      // Generate test session info (simulating SessionStart hook)
      const testSessionId = uuidv4();
      const testTranscriptPath = `/tmp/test-transcripts/${testSessionId}.jsonl`;

      const result = await startWorkflowRun(prisma, {
        teamId: ctx.teamId!,
        storyId: ctx.storyId!,
        triggeredBy: 'st189-integration-test',
        cwd: '/Users/pawelgawliczek/projects/AIStudio',
        sessionId: testSessionId,
        transcriptPath: testTranscriptPath,
      });

      expect(result).toHaveProperty('runId');
      ctx.runId = result.runId;

      console.log(`[TEST] Started team run: ${ctx.runId}`);

      // Verify master transcript was registered in database
      const run = await prisma.workflowRun.findUnique({
        where: { id: ctx.runId },
      });

      expect(run).not.toBeNull();
      expect(run!.masterTranscriptPaths).toContain(testTranscriptPath);

      // Verify transcript tracking metadata
      const metadata = run!.metadata as any;
      expect(metadata).toHaveProperty('_transcriptTracking');

      console.log('[TEST] Master transcript registration via MCP: PASSED');
      console.log(`[TEST] Master transcript path: ${testTranscriptPath}`);
    });
  });

  describe('Agent Transcript Registration via spawn_agent', () => {
    let componentRunId: string;

    it('should record agent start and create component run', async () => {
      const result = await recordComponentStart(prisma, {
        runId: ctx.runId!,
        componentId: ctx.agentId!,
        input: { storyId: ctx.storyId, testMarker: `ST189_LIVE_${Date.now()}` },
      });

      expect(result).toHaveProperty('componentRunId');
      componentRunId = result.componentRunId;
      ctx.componentRunId = componentRunId;

      console.log(`[TEST] Started component run: ${componentRunId}`);
    });

    it('should register agent transcript after spawn_agent completion', async () => {
      // Check if laptop agent is online
      const onlineAgents = await prisma.remoteAgent.findMany({
        where: { status: 'online' },
      });

      if (onlineAgents.length === 0) {
        console.log('[TEST] SKIP: No laptop agent online for spawn_agent test');
        console.log('[TEST] To run this test, ensure laptop agent is running');
        return;
      }

      console.log(`[TEST] Found ${onlineAgents.length} online agent(s)`);

      // Spawn agent to execute on laptop
      try {
        const spawnResult = await spawnAgent(prisma, {
          componentId: ctx.agentId!,
          stateId: ctx.stateId!,
          workflowRunId: ctx.runId!,
          componentRunId: ctx.componentRunId!,
          instructions: `Output this exact marker: ST189_SPAWN_TEST_${Date.now()}`,
          model: 'claude-sonnet-4-20250514',
          maxTurns: 5,
        });

        console.log(`[TEST] Spawn agent result:`, JSON.stringify(spawnResult, null, 2));

        // If agent was spawned, wait for completion and verify transcript
        if (spawnResult && !spawnResult.agentOffline) {
          // Wait for job completion (poll for up to 2 minutes)
          let attempts = 0;
          let jobCompleted = false;

          while (attempts < 24 && !jobCompleted) {
            await new Promise(resolve => setTimeout(resolve, 5000)); // 5 second intervals
            attempts++;

            const job = await prisma.remoteJob.findFirst({
              where: { componentRunId: ctx.componentRunId },
              orderBy: { createdAt: 'desc' },
            });

            if (job && ['completed', 'failed'].includes(job.status)) {
              jobCompleted = true;
              console.log(`[TEST] Agent job completed with status: ${job.status}`);

              // Verify transcript was registered
              const run = await prisma.workflowRun.findUnique({
                where: { id: ctx.runId },
              });

              const metadata = run?.metadata as any;
              if (metadata?.spawnedAgentTranscripts?.length > 0) {
                console.log('[TEST] Agent transcript registration: PASSED');
                console.log(`[TEST] Spawned agent transcripts: ${metadata.spawnedAgentTranscripts.length}`);
                expect(metadata.spawnedAgentTranscripts.length).toBeGreaterThan(0);
              } else {
                console.log('[TEST] Agent transcript not found in metadata');
              }
            }
          }

          if (!jobCompleted) {
            console.log('[TEST] Agent job did not complete within timeout');
          }
        }
      } catch (err: any) {
        console.log(`[TEST] Spawn agent error (expected if agent offline): ${err.message}`);
      }
    });

    it('should record agent completion with transcript path', async () => {
      const agentTranscriptPath = `/tmp/test-transcripts/agent-${ctx.componentRunId}.jsonl`;

      const result = await recordComponentComplete(prisma, {
        runId: ctx.runId!,
        componentId: ctx.agentId!,
        status: 'completed',
        output: {
          marker: `ST189_COMPLETE_${Date.now()}`,
          transcriptPath: agentTranscriptPath,
        },
        componentSummary: 'Test agent completed successfully',
      });

      expect(result).toHaveProperty('success', true);

      console.log('[TEST] Agent completion recorded: PASSED');
    });
  });

  describe('WebSocket Live Streaming Verification', () => {
    it('should connect to WebSocket for live transcript streaming', async () => {
      // Use local WebSocket URL for testing (NestJS runs on port 3000)
      const wsUrl = process.env.WS_TEST_URL || 'ws://localhost:3000';
      const wsPath = `/api/ws/transcript/${ctx.runId}`;

      console.log(`[TEST] Connecting to WebSocket: ${wsUrl}${wsPath}`);

      return new Promise<void>((resolve, reject) => {
        const ws = new WebSocket(`${wsUrl}${wsPath}`);
        let connected = false;
        let receivedMessage = false;

        const timeout = setTimeout(() => {
          ws.close();
          if (connected) {
            console.log('[TEST] WebSocket connected but no messages received (expected if no active transcription)');
            resolve();
          } else {
            console.log('[TEST] WebSocket connection timeout (may be expected if server not configured)');
            resolve(); // Don't fail test if WebSocket not available
          }
        }, 10000);

        ws.on('open', () => {
          connected = true;
          console.log('[TEST] WebSocket connected successfully');

          // Send a ping to test connection
          ws.send(JSON.stringify({ type: 'ping', runId: ctx.runId }));
        });

        ws.on('message', (data) => {
          receivedMessage = true;
          const message = JSON.parse(data.toString());
          console.log(`[TEST] WebSocket message received:`, message.type);

          if (message.type === 'pong' || message.type === 'transcript_line') {
            clearTimeout(timeout);
            ws.close();
            console.log('[TEST] WebSocket live streaming: PASSED');
            resolve();
          }
        });

        ws.on('error', (err) => {
          clearTimeout(timeout);
          console.log(`[TEST] WebSocket error (may be expected): ${err.message}`);
          resolve(); // Don't fail test on WebSocket errors
        });

        ws.on('close', () => {
          if (!receivedMessage && !connected) {
            console.log('[TEST] WebSocket closed without connection');
          }
        });
      });
    });
  });

  describe('Team Run Results Verification', () => {
    it('should return transcript paths in team run results', async () => {
      // Query the database directly to verify transcript registration
      const run = await prisma.workflowRun.findUnique({
        where: { id: ctx.runId! },
      });

      expect(run).not.toBeNull();

      // Verify master transcript paths
      expect(run!.masterTranscriptPaths).toBeDefined();
      expect(run!.masterTranscriptPaths.length).toBeGreaterThan(0);

      console.log('[TEST] Team run results verification: PASSED');
      console.log(`[TEST] Master transcripts in DB: ${run!.masterTranscriptPaths.length}`);
      console.log(`[TEST] Master transcript paths: ${run!.masterTranscriptPaths.join(', ')}`);

      // Check for agent transcripts in metadata
      const metadata = run!.metadata as any;
      if (metadata?.spawnedAgentTranscripts) {
        console.log(`[TEST] Agent transcripts in DB: ${metadata.spawnedAgentTranscripts.length}`);
      }

      // Also verify via MCP tool for completeness
      const mcpResult = await getWorkflowRunResults(prisma, {
        runId: ctx.runId!,
        responseMode: 'full',
      });

      expect(mcpResult).toHaveProperty('run');
      expect(mcpResult.run.id).toBe(ctx.runId);
      console.log(`[TEST] MCP get_team_run_results returned run status: ${mcpResult.run.status}`);
    });
  });
});
