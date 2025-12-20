/**
 * E2E Tests for Transcript Line DB Persistence (ST-348 Feature 2)
 *
 * Tests the complete transcript line persistence flow:
 * 1. Laptop agent connects via WebSocket
 * 2. Sends upload:batch with transcript_line items
 * 3. Verifies lines are saved to transcript_lines table
 * 4. Verifies ACK is returned to the agent
 *
 * This tests the ST-329 gap fix where transcript_line uploads were NOT being
 * saved to the transcript_lines table. The fix added routing in handleUploadBatch
 * to detect transcript_line items and call handleTranscriptLines.
 */

import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { Server, Socket } from 'socket.io';
import { PrismaService } from '../prisma/prisma.service';
import { TelemetryService } from '../telemetry/telemetry.service';
import { AppWebSocketGateway } from '../websocket/websocket.gateway';
import { ArtifactHandler } from '../remote-agent/handlers/artifact.handler';
import { ClaudeCodeHandler } from '../remote-agent/handlers/claude-code.handler';
import { GitJobHandler } from '../remote-agent/handlers/git-job.handler';
import { TranscriptHandler } from '../remote-agent/handlers/transcript.handler';
import { RemoteAgentGateway } from '../remote-agent/remote-agent.gateway';
import { StreamEventService } from '../remote-agent/stream-event.service';
import { TranscriptRegistrationService } from '../remote-agent/transcript-registration.service';
import { TranscriptLinesPayload } from '../remote-agent/types';

describe('Transcript Line DB Persistence E2E', () => {
  let gateway: RemoteAgentGateway;
  let prisma: PrismaService;
  let mockClient: Partial<Socket>;
  let emittedEvents: Array<{ event: string; data: unknown }>;

  // Test data setup
  let testWorkflowId: string;
  let testStoryId: string;
  let testWorkflowRunId: string;
  let testProjectId: string;

  const mockJwtService = {
    signAsync: jest.fn(),
    verify: jest.fn(),
  };

  const mockStreamEventService = {
    recordEvent: jest.fn(),
  };

  const mockTranscriptRegistrationService = {
    handleTranscriptDetected: jest.fn(),
  };

  const mockTelemetryService = {
    withSpan: jest.fn((name, fn) => fn({ setAttribute: jest.fn(), recordException: jest.fn() })),
  };

  const mockAppWebSocketGateway = {
    server: {} as Server,
  };

  const mockArtifactHandler = {
    handleArtifactUpload: jest.fn(),
  };

  const mockClaudeCodeHandler = {
    emitClaudeCodeJob: jest.fn(),
  };

  const mockGitJobHandler = {
    emitGitJob: jest.fn(),
  };

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RemoteAgentGateway,
        TranscriptHandler,
        PrismaService,
        { provide: JwtService, useValue: mockJwtService },
        { provide: StreamEventService, useValue: mockStreamEventService },
        { provide: TranscriptRegistrationService, useValue: mockTranscriptRegistrationService },
        { provide: TelemetryService, useValue: mockTelemetryService },
        { provide: AppWebSocketGateway, useValue: mockAppWebSocketGateway },
        { provide: ArtifactHandler, useValue: mockArtifactHandler },
        { provide: ClaudeCodeHandler, useValue: mockClaudeCodeHandler },
        { provide: GitJobHandler, useValue: mockGitJobHandler },
      ],
    }).compile();

    gateway = module.get<RemoteAgentGateway>(RemoteAgentGateway);
    prisma = module.get<PrismaService>(PrismaService);

    // Suppress logger output during tests
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();

    // Setup test data in database
    await setupTestData();
  });

  beforeEach(() => {
    emittedEvents = [];
    mockClient = {
      id: 'socket-e2e-tl-123',
      emit: jest.fn((event: string, data: unknown) => {
        emittedEvents.push({ event, data });
        return true;
      }),
      data: { agentId: 'test-agent-transcript-line' },
      join: jest.fn(),
      leave: jest.fn(),
    };
  });

  afterAll(async () => {
    await cleanupTestData();
    await prisma.$disconnect();
  });

  async function setupTestData() {
    // Create test project
    const project = await prisma.project.create({
      data: {
        name: 'E2E Test Project Transcript Lines',
        description: 'Test project for E2E transcript line persistence tests',
      },
    });
    testProjectId = project.id;

    // Create test story
    const story = await prisma.story.create({
      data: {
        key: 'E2E-TL-1',
        title: 'E2E Test Story Transcript Lines',
        projectId: project.id,
        type: 'feature',
        status: 'implementation',
        createdById: '00000000-0000-0000-0000-000000000001', // System user
      },
    });
    testStoryId = story.id;

    // Create test workflow
    const workflow = await prisma.workflow.create({
      data: {
        name: 'E2E Test Workflow TL',
        projectId: project.id,
        triggerConfig: { type: 'manual' },
      },
    });
    testWorkflowId = workflow.id;

    // Create workflow run
    const workflowRun = await prisma.workflowRun.create({
      data: {
        projectId: project.id,
        workflowId: workflow.id,
        storyId: story.id,
        status: 'running',
        triggeredBy: 'e2e-test-tl',
        startedAt: new Date(),
      },
    });
    testWorkflowRunId = workflowRun.id;
  }

  async function cleanupTestData() {
    // Delete in reverse order of foreign key dependencies
    await prisma.transcriptLine.deleteMany({ where: { workflowRunId: testWorkflowRunId } });
    await prisma.workflowRun.deleteMany({ where: { id: testWorkflowRunId } });
    await prisma.workflow.deleteMany({ where: { id: testWorkflowId } });
    await prisma.story.deleteMany({ where: { id: testStoryId } });
    await prisma.project.deleteMany({ where: { id: testProjectId } });
  }

  describe('Transcript Line Upload via upload:batch', () => {
    it('should persist transcript_line items to transcript_lines table and send ACK', async () => {
      // Create transcript_line payload (format from TranscriptTailer.queueUpload('transcript_line', ...))
      const payload = {
        agentId: 'test-agent-transcript-line',
        items: [
          {
            queueId: 5001,
            runId: testWorkflowRunId,
            sessionIndex: 0,
            lines: [
              { line: 'Test transcript line 1', sequenceNumber: 1 },
              { line: 'Test transcript line 2', sequenceNumber: 2 },
              { line: 'Test transcript line 3', sequenceNumber: 3 },
            ],
            isHistorical: true,
            timestamp: new Date().toISOString(),
          },
        ],
      };

      // Execute the upload batch
      await gateway.handleUploadBatch(mockClient as Socket, payload);

      // Verify individual ACK was sent (ItemAckPayload format: id, success, error?)
      const itemAcks = emittedEvents.filter(e => e.event === 'upload:ack:item');
      expect(itemAcks).toHaveLength(1);
      expect(itemAcks[0].data).toEqual({
        success: true,
        id: 5001,
        error: undefined,
      });

      // Verify batch ACK was sent
      const batchAcks = emittedEvents.filter(e => e.event === 'upload:ack');
      expect(batchAcks).toHaveLength(1);
      expect(batchAcks[0].data).toEqual({ ids: [5001] });

      // Verify transcript lines were saved to database
      const transcriptLines = await prisma.transcriptLine.findMany({
        where: {
          workflowRunId: testWorkflowRunId,
          sessionIndex: 0,
        },
        orderBy: { lineNumber: 'asc' },
      });

      expect(transcriptLines).toHaveLength(3);
      expect(transcriptLines[0].lineNumber).toBe(1);
      expect(transcriptLines[0].content).toBe('Test transcript line 1');
      expect(transcriptLines[1].lineNumber).toBe(2);
      expect(transcriptLines[1].content).toBe('Test transcript line 2');
      expect(transcriptLines[2].lineNumber).toBe(3);
      expect(transcriptLines[2].content).toBe('Test transcript line 3');
    });

    it('should handle multiple batches of transcript lines', async () => {
      // First batch
      const payload1 = {
        agentId: 'test-agent-transcript-line',
        items: [
          {
            queueId: 5002,
            runId: testWorkflowRunId,
            sessionIndex: 1,
            lines: [
              { line: 'Batch 1 line 1', sequenceNumber: 1 },
              { line: 'Batch 1 line 2', sequenceNumber: 2 },
            ],
            isHistorical: false,
            timestamp: new Date().toISOString(),
          },
        ],
      };

      await gateway.handleUploadBatch(mockClient as Socket, payload1);

      // Second batch with different sessionIndex
      emittedEvents = []; // Clear events
      const payload2 = {
        agentId: 'test-agent-transcript-line',
        items: [
          {
            queueId: 5003,
            runId: testWorkflowRunId,
            sessionIndex: 2,
            lines: [
              { line: 'Batch 2 line 1', sequenceNumber: 1 },
              { line: 'Batch 2 line 2', sequenceNumber: 2 },
            ],
            isHistorical: false,
            timestamp: new Date().toISOString(),
          },
        ],
      };

      await gateway.handleUploadBatch(mockClient as Socket, payload2);

      // Verify ACKs for second batch
      const itemAcks = emittedEvents.filter(e => e.event === 'upload:ack:item');
      expect(itemAcks).toHaveLength(1);
      expect(itemAcks[0].data).toEqual({
        success: true,
        id: 5003,
        error: undefined,
      });

      // Verify both sessions exist in database
      const session1Lines = await prisma.transcriptLine.findMany({
        where: { workflowRunId: testWorkflowRunId, sessionIndex: 1 },
      });
      const session2Lines = await prisma.transcriptLine.findMany({
        where: { workflowRunId: testWorkflowRunId, sessionIndex: 2 },
      });

      expect(session1Lines).toHaveLength(2);
      expect(session2Lines).toHaveLength(2);
    });

    it('should handle empty lines array gracefully', async () => {
      const payload = {
        agentId: 'test-agent-transcript-line',
        items: [
          {
            queueId: 5004,
            runId: testWorkflowRunId,
            sessionIndex: 3,
            lines: [],
            isHistorical: false,
            timestamp: new Date().toISOString(),
          },
        ],
      };

      await gateway.handleUploadBatch(mockClient as Socket, payload);

      // Verify ACK was sent
      const itemAcks = emittedEvents.filter(e => e.event === 'upload:ack:item');
      expect(itemAcks).toHaveLength(1);
      expect(itemAcks[0].data).toEqual({
        success: true,
        id: 5004,
        error: undefined,
      });

      // Verify no lines were added to database
      const lines = await prisma.transcriptLine.findMany({
        where: { workflowRunId: testWorkflowRunId, sessionIndex: 3 },
      });
      expect(lines).toHaveLength(0);
    });

    it('should handle database errors gracefully and return error ACK', async () => {
      // Use invalid runId to trigger database error
      const payload = {
        agentId: 'test-agent-transcript-line',
        items: [
          {
            queueId: 5005,
            runId: 'invalid-run-id-not-a-uuid',
            sessionIndex: 4,
            lines: [
              { line: 'Error test line', sequenceNumber: 1 },
            ],
            isHistorical: false,
            timestamp: new Date().toISOString(),
          },
        ],
      };

      await gateway.handleUploadBatch(mockClient as Socket, payload);

      // Verify error ACK was sent
      const itemAcks = emittedEvents.filter(e => e.event === 'upload:ack:item');
      expect(itemAcks).toHaveLength(1);
      const ack = itemAcks[0].data as any;
      expect(ack.success).toBe(false);
      expect(ack.id).toBe(5005);
      expect(ack.error).toBeDefined();

      // Verify batch ACK is empty
      const batchAcks = emittedEvents.filter(e => e.event === 'upload:ack');
      expect(batchAcks[0].data).toEqual({ ids: [] });
    });

    it('should skip duplicate transcript lines using unique constraint', async () => {
      // The transcript_lines table has a unique constraint on (workflowRunId, sessionIndex, lineNumber).
      // Prisma's skipDuplicates will prevent duplicate lines from being inserted.

      // First upload
      const payload1 = {
        agentId: 'test-agent-transcript-line',
        items: [
          {
            queueId: 5006,
            runId: testWorkflowRunId,
            sessionIndex: 5,
            lines: [
              { line: 'Duplicate test line', sequenceNumber: 1 },
            ],
            isHistorical: false,
            timestamp: new Date().toISOString(),
          },
        ],
      };

      await gateway.handleUploadBatch(mockClient as Socket, payload1);

      // Verify first upload succeeded
      let itemAcks = emittedEvents.filter(e => e.event === 'upload:ack:item');
      expect(itemAcks[0].data).toEqual({
        success: true,
        id: 5006,
        error: undefined,
      });

      // Clear events
      emittedEvents = [];

      // Second upload with same line (will be skipped by skipDuplicates)
      const payload2 = {
        agentId: 'test-agent-transcript-line',
        items: [
          {
            queueId: 5007,
            runId: testWorkflowRunId,
            sessionIndex: 5,
            lines: [
              { line: 'Duplicate test line', sequenceNumber: 1 }, // Same line
            ],
            isHistorical: false,
            timestamp: new Date().toISOString(),
          },
        ],
      };

      await gateway.handleUploadBatch(mockClient as Socket, payload2);

      // Verify second upload also succeeded (skipDuplicates prevents error)
      itemAcks = emittedEvents.filter(e => e.event === 'upload:ack:item');
      expect(itemAcks[0].data).toEqual({
        success: true,
        id: 5007,
        error: undefined,
      });

      // Only one line exists in database (duplicate was skipped)
      const lines = await prisma.transcriptLine.findMany({
        where: { workflowRunId: testWorkflowRunId, sessionIndex: 5 },
      });
      expect(lines).toHaveLength(1);
    });

    it('should correctly route transcript_line vs full transcript items in mixed batch', async () => {
      // Create a component and component run for full transcript upload
      const component = await prisma.component.create({
        data: {
          projectId: testProjectId,
          name: 'E2E Test Component Mixed',
          inputInstructions: 'Test input',
          operationInstructions: 'Test operation',
          outputInstructions: 'Test output',
          config: { modelId: 'claude-sonnet-4-20250514' },
          tools: [],
        },
      });

      const componentRun = await prisma.componentRun.create({
        data: {
          componentId: component.id,
          workflowRunId: testWorkflowRunId,
          status: 'running',
          startedAt: new Date(),
        },
      });

      // Create artifact definition for transcript
      const artifactDef = await prisma.artifactDefinition.create({
        data: {
          workflowId: testWorkflowId,
          key: 'TRANSCRIPT',
          name: 'Transcript',
          type: 'code',
          description: 'Agent transcript',
        },
      });

      // Mixed batch: transcript_line item + full transcript item
      const payload = {
        agentId: 'test-agent-transcript-line',
        items: [
          // transcript_line item (has runId, lines, sessionIndex)
          {
            queueId: 5008,
            runId: testWorkflowRunId,
            sessionIndex: 6,
            lines: [
              { line: 'Mixed batch line 1', sequenceNumber: 1 },
            ],
            isHistorical: false,
            timestamp: new Date().toISOString(),
          },
          // Full transcript artifact item (has workflowRunId, componentRunId, content)
          {
            queueId: 5009,
            workflowRunId: testWorkflowRunId,
            componentRunId: componentRun.id,
            transcriptPath: '/test/mixed.jsonl',
            content: '{"message":"mixed test","timestamp":"2025-01-01T00:00:00Z"}',
            sequenceNumber: 1,
            metadata: { source: 'e2e-test-mixed' },
          },
        ],
      };

      await gateway.handleUploadBatch(mockClient as Socket, payload);

      // Verify both ACKs were sent
      const itemAcks = emittedEvents.filter(e => e.event === 'upload:ack:item');
      expect(itemAcks).toHaveLength(2);
      expect(itemAcks[0].data).toEqual({
        success: true,
        id: 5008,
        error: undefined,
      });
      expect(itemAcks[1].data).toEqual({
        success: true,
        id: 5009,
        error: undefined,
      });

      // Verify transcript_line was saved to transcript_lines table
      const transcriptLines = await prisma.transcriptLine.findMany({
        where: { workflowRunId: testWorkflowRunId, sessionIndex: 6 },
      });
      expect(transcriptLines).toHaveLength(1);
      expect(transcriptLines[0].content).toBe('Mixed batch line 1');

      // Verify full transcript was saved to artifacts table
      const artifacts = await prisma.artifact.findMany({
        where: {
          storyId: testStoryId,
          definitionId: artifactDef.id,
        },
      });
      expect(artifacts.length).toBeGreaterThan(0);
      expect(artifacts[0].content).toContain('mixed test');

      // Cleanup
      await prisma.artifact.deleteMany({ where: { definitionId: artifactDef.id } });
      await prisma.componentRun.deleteMany({ where: { id: componentRun.id } });
      await prisma.component.deleteMany({ where: { id: component.id } });
      await prisma.artifactDefinition.deleteMany({ where: { id: artifactDef.id } });
    });
  });
});
