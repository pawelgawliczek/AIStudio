/**
 * E2E Tests for Complete Upload Flow
 *
 * Tests the full upload cycle from laptop agent:
 * 1. Laptop agent queues items
 * 2. Laptop agent sends upload:batch event
 * 3. Backend processes batch and creates artifacts
 * 4. Backend sends individual ACKs for each item
 * 5. Backend sends batch ACK with successful IDs
 * 6. Laptop agent clears queue based on ACKs
 *
 * @see ST-323 Upload ACK Requirements
 */

import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { Server, Socket } from 'socket.io';
import { PrismaService } from '../../prisma/prisma.service';
import { TelemetryService } from '../../telemetry/telemetry.service';
import { AppWebSocketGateway } from '../../websocket/websocket.gateway';
import { ClaudeCodeHandler } from '../handlers/claude-code.handler';
import { GitJobHandler } from '../handlers/git-job.handler';
import { TranscriptHandler } from '../handlers/transcript.handler';
import { RemoteAgentGateway } from '../remote-agent.gateway';
import { StreamEventService } from '../stream-event.service';
import { TranscriptRegistrationService } from '../transcript-registration.service';
import { UploadBatchPayload, ItemAckPayload, UploadAckPayload } from '../types';

describe('Upload Flow E2E', () => {
  let gateway: RemoteAgentGateway;
  let prisma: PrismaService;
  let mockClient: Partial<Socket>;
  let emittedEvents: Array<{ event: string; data: unknown }>;

  // Test data setup
  let testWorkflowId: string;
  let testStoryId: string;
  let testWorkflowRunId: string;
  let testComponentId: string;
  let testComponentRunId: string;
  let testArtifactDefId: string;

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
      id: 'socket-e2e-123',
      emit: jest.fn((event: string, data: unknown) => {
        emittedEvents.push({ event, data });
      }),
      data: { agentId: 'test-agent-e2e' },
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
        name: 'E2E Test Project',
        key: 'E2E',
        description: 'Test project for E2E upload tests',
      },
    });

    // Create test story
    const story = await prisma.story.create({
      data: {
        title: 'E2E Test Story',
        projectId: project.id,
        type: 'feature',
        status: 'impl',
      },
    });
    testStoryId = story.id;

    // Create test workflow
    const workflow = await prisma.workflow.create({
      data: {
        name: 'E2E Test Workflow',
        projectId: project.id,
        triggerType: 'manual',
        isActive: true,
      },
    });
    testWorkflowId = workflow.id;

    // Create artifact definition
    const artifactDef = await prisma.artifactDefinition.create({
      data: {
        workflowId: workflow.id,
        key: 'TRANSCRIPT',
        name: 'Transcript',
        type: 'code',
        description: 'Agent transcript',
      },
    });
    testArtifactDefId = artifactDef.id;

    // Create test component
    const component = await prisma.component.create({
      data: {
        workflowId: workflow.id,
        name: 'E2E Test Component',
        type: 'coordinator',
        model: 'claude-sonnet-4-20250514',
        instructions: 'Test instructions',
        order: 1,
      },
    });
    testComponentId = component.id;

    // Create workflow run
    const workflowRun = await prisma.workflowRun.create({
      data: {
        workflowId: workflow.id,
        storyId: story.id,
        status: 'running',
        triggeredBy: 'e2e-test',
        context: {} as Prisma.InputJsonValue,
      },
    });
    testWorkflowRunId = workflowRun.id;

    // Create component run
    const componentRun = await prisma.componentRun.create({
      data: {
        componentId: component.id,
        workflowRunId: workflowRun.id,
        status: 'running',
        startedAt: new Date(),
      },
    });
    testComponentRunId = componentRun.id;
  }

  async function cleanupTestData() {
    // Delete in reverse order of foreign key dependencies
    await prisma.artifact.deleteMany({ where: { storyId: testStoryId } });
    await prisma.componentRun.deleteMany({ where: { id: testComponentRunId } });
    await prisma.workflowRun.deleteMany({ where: { id: testWorkflowRunId } });
    await prisma.component.deleteMany({ where: { id: testComponentId } });
    await prisma.artifactDefinition.deleteMany({ where: { id: testArtifactDefId } });
    await prisma.workflow.deleteMany({ where: { id: testWorkflowId } });
    await prisma.story.deleteMany({ where: { id: testStoryId } });
    await prisma.project.deleteMany({ where: { key: 'E2E' } });
  }

  describe('Complete Upload Flow', () => {
    it('should process batch upload, create artifacts, and send ACKs', async () => {
      const payload: UploadBatchPayload = {
        agentId: 'test-agent-e2e',
        items: [
          {
            queueId: 100,
            workflowRunId: testWorkflowRunId,
            componentRunId: testComponentRunId,
            transcriptPath: '/test/transcript1.jsonl',
            content: '{"message":"test line 1","timestamp":"2025-01-01T00:00:00Z"}',
            sequenceNumber: 1,
            metadata: { source: 'e2e-test' },
          },
          {
            queueId: 101,
            workflowRunId: testWorkflowRunId,
            componentRunId: testComponentRunId,
            transcriptPath: '/test/transcript2.jsonl',
            content: '{"message":"test line 2","timestamp":"2025-01-01T00:00:01Z"}',
            sequenceNumber: 2,
            metadata: { source: 'e2e-test' },
          },
        ],
      };

      // Execute the upload batch
      await gateway.handleUploadBatch(mockClient as Socket, payload);

      // Verify individual ACKs were sent
      const itemAcks = emittedEvents.filter(e => e.event === 'upload:ack:item');
      expect(itemAcks).toHaveLength(2);
      expect(itemAcks[0].data).toEqual({ success: true, id: 100 });
      expect(itemAcks[1].data).toEqual({ success: true, id: 101 });

      // Verify batch ACK was sent
      const batchAcks = emittedEvents.filter(e => e.event === 'upload:ack');
      expect(batchAcks).toHaveLength(1);
      expect(batchAcks[0].data).toEqual({ ids: [100, 101] });

      // Verify artifacts were created in database
      const artifacts = await prisma.artifact.findMany({
        where: {
          storyId: testStoryId,
          workflowRunId: testWorkflowRunId,
        },
        orderBy: { createdAt: 'asc' },
      });

      expect(artifacts).toHaveLength(2);
      expect(artifacts[0].content).toContain('test line 1');
      expect(artifacts[1].content).toContain('test line 2');
      expect(artifacts[0].contentType).toBe('application/x-jsonlines');
      expect(artifacts[1].contentType).toBe('application/x-jsonlines');

      // Verify component run metadata was updated
      const componentRun = await prisma.componentRun.findUnique({
        where: { id: testComponentRunId },
      });

      const metadata = componentRun?.metadata as Record<string, unknown>;
      expect(metadata).toHaveProperty('transcriptArtifactId');
      expect(metadata).toHaveProperty('transcriptPath', '/test/transcript2.jsonl');
      expect(metadata).toHaveProperty('sequenceNumber', 2);
    });

    it('should handle duplicate detection in full flow', async () => {
      const duplicateContent = '{"message":"duplicate test","timestamp":"2025-01-01T00:00:00Z"}';

      // First upload - should succeed
      const firstPayload: UploadBatchPayload = {
        agentId: 'test-agent-e2e',
        items: [
          {
            queueId: 200,
            workflowRunId: testWorkflowRunId,
            componentRunId: testComponentRunId,
            transcriptPath: '/test/duplicate.jsonl',
            content: duplicateContent,
            sequenceNumber: 1,
          },
        ],
      };

      await gateway.handleUploadBatch(mockClient as Socket, firstPayload);

      // Verify first upload succeeded
      let itemAcks = emittedEvents.filter(e => e.event === 'upload:ack:item');
      expect(itemAcks[0].data).toEqual({ success: true, id: 200 });

      // Clear events
      emittedEvents = [];

      // Second upload with same content - should detect duplicate
      const secondPayload: UploadBatchPayload = {
        agentId: 'test-agent-e2e',
        items: [
          {
            queueId: 201,
            workflowRunId: testWorkflowRunId,
            componentRunId: testComponentRunId,
            transcriptPath: '/test/duplicate.jsonl',
            content: duplicateContent,
            sequenceNumber: 2,
          },
        ],
      };

      await gateway.handleUploadBatch(mockClient as Socket, secondPayload);

      // Verify duplicate was detected
      itemAcks = emittedEvents.filter(e => e.event === 'upload:ack:item');
      expect(itemAcks[0].data).toEqual({
        success: true,
        id: 201,
        isDuplicate: true,
      });

      // Verify batch ACK does not include duplicate
      const batchAcks = emittedEvents.filter(e => e.event === 'upload:ack');
      expect(batchAcks[0].data).toEqual({ ids: [] });

      // Verify only one artifact exists
      const artifacts = await prisma.artifact.findMany({
        where: {
          storyId: testStoryId,
          content: duplicateContent,
        },
      });
      expect(artifacts).toHaveLength(1);
    });

    it('should handle errors and send failure ACKs', async () => {
      const payload: UploadBatchPayload = {
        agentId: 'test-agent-e2e',
        items: [
          {
            queueId: 300,
            workflowRunId: 'non-existent-run-id',
            componentRunId: testComponentRunId,
            transcriptPath: '/test/error.jsonl',
            content: '{"error":"test"}',
            sequenceNumber: 1,
          },
        ],
      };

      await gateway.handleUploadBatch(mockClient as Socket, payload);

      // Verify error ACK was sent
      const itemAcks = emittedEvents.filter(e => e.event === 'upload:ack:item');
      expect(itemAcks).toHaveLength(1);
      expect(itemAcks[0].data).toMatchObject({
        success: false,
        id: 300,
        error: expect.any(String),
      });

      // Verify batch ACK is empty
      const batchAcks = emittedEvents.filter(e => e.event === 'upload:ack');
      expect(batchAcks[0].data).toEqual({ ids: [] });

      // Verify no artifact was created
      const artifacts = await prisma.artifact.findMany({
        where: {
          content: '{"error":"test"}',
        },
      });
      expect(artifacts).toHaveLength(0);
    });

    it('should handle mixed batch with success, duplicate, and failure', async () => {
      const payload: UploadBatchPayload = {
        agentId: 'test-agent-e2e',
        items: [
          {
            queueId: 400,
            workflowRunId: testWorkflowRunId,
            componentRunId: testComponentRunId,
            transcriptPath: '/test/success.jsonl',
            content: '{"status":"success","id":400}',
            sequenceNumber: 1,
          },
          {
            queueId: 401,
            workflowRunId: testWorkflowRunId,
            componentRunId: testComponentRunId,
            transcriptPath: '/test/duplicate.jsonl',
            content: '{"message":"duplicate test","timestamp":"2025-01-01T00:00:00Z"}', // Duplicate from earlier test
            sequenceNumber: 2,
          },
          {
            queueId: 402,
            workflowRunId: 'invalid-run',
            componentRunId: testComponentRunId,
            transcriptPath: '/test/fail.jsonl',
            content: '{"status":"fail"}',
            sequenceNumber: 3,
          },
        ],
      };

      await gateway.handleUploadBatch(mockClient as Socket, payload);

      // Verify all ACKs were sent
      const itemAcks = emittedEvents.filter(e => e.event === 'upload:ack:item');
      expect(itemAcks).toHaveLength(3);

      // Success ACK
      expect(itemAcks[0].data).toEqual({ success: true, id: 400 });

      // Duplicate ACK
      expect(itemAcks[1].data).toEqual({ success: true, id: 401, isDuplicate: true });

      // Failure ACK
      expect(itemAcks[2].data).toMatchObject({
        success: false,
        id: 402,
        error: expect.any(String),
      });

      // Verify batch ACK only contains successful non-duplicate ID
      const batchAcks = emittedEvents.filter(e => e.event === 'upload:ack');
      expect(batchAcks[0].data).toEqual({ ids: [400] });
    });
  });

  describe('Queue Clearing Simulation', () => {
    it('should simulate laptop agent queue clearing based on ACKs', async () => {
      // Simulate laptop agent queue
      const queue = [
        { id: 500, content: '{"test":1}' },
        { id: 501, content: '{"test":2}' },
        { id: 502, content: '{"test":3}' },
      ];

      const payload: UploadBatchPayload = {
        agentId: 'test-agent-e2e',
        items: queue.map((item, index) => ({
          queueId: item.id,
          workflowRunId: testWorkflowRunId,
          componentRunId: testComponentRunId,
          transcriptPath: `/test/queue${item.id}.jsonl`,
          content: item.content,
          sequenceNumber: index + 1,
        })),
      };

      await gateway.handleUploadBatch(mockClient as Socket, payload);

      // Extract batch ACK
      const batchAcks = emittedEvents.filter(e => e.event === 'upload:ack');
      const ackData = batchAcks[0].data as UploadAckPayload;

      // Simulate queue clearing: remove items with IDs in batch ACK
      const remainingQueue = queue.filter(item => !ackData.ids.includes(item.id));

      // All items should be removed (all succeeded)
      expect(remainingQueue).toHaveLength(0);
      expect(ackData.ids).toEqual([500, 501, 502]);
    });
  });
});
