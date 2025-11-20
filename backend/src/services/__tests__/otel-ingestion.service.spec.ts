import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { OtelIngestionService } from '../otel-ingestion.service';

/**
 * Test suite for OTEL Ingestion Service (ST-27)
 * Handles ingestion of Claude Code telemetry events
 */
describe('OtelIngestionService', () => {
  let service: OtelIngestionService;
  let prisma: PrismaClient;
  let testProjectId: string;
  let testWorkflowRunId: string;
  let testComponentRunId: string;

  beforeAll(async () => {
    prisma = new PrismaClient();
    service = new OtelIngestionService(prisma);

    // Create test fixtures
    const project = await prisma.project.create({
      data: {
        name: `Test Project ${Date.now()}`,
        description: 'Test project for OTEL ingestion'
      }
    });
    testProjectId = project.id;

    // Create minimal workflow run
    const workflowRun = await prisma.workflowRun.create({
      data: {
        projectId: testProjectId,
        workflowId: uuidv4(),
        triggeredBy: 'test-user',
        status: 'running'
      }
    });
    testWorkflowRunId = workflowRun.id;

    testComponentRunId = uuidv4();
  });

  afterAll(async () => {
    await prisma.project.delete({ where: { id: testProjectId } });
    await prisma.$disconnect();
  });

  describe('parseMetadata', () => {
    it('should extract workflow metadata from event attributes', () => {
      const attributes = {
        message: 'Some log message [WORKFLOW_METADATA: runId=abc123, componentRunId=def456, componentId=ghi789]',
        otherField: 'value'
      };

      const metadata = service.parseMetadata(attributes);

      expect(metadata).toEqual({
        runId: 'abc123',
        componentRunId: 'def456',
        componentId: 'ghi789'
      });
    });

    it('should handle missing metadata gracefully', () => {
      const attributes = {
        message: 'Regular log message without metadata'
      };

      const metadata = service.parseMetadata(attributes);

      expect(metadata).toEqual({});
    });

    it('should extract metadata from nested structures', () => {
      const attributes = {
        prompt: {
          content: '[WORKFLOW_METADATA: runId=xyz, componentRunId=123] Execute component'
        }
      };

      const metadata = service.parseMetadata(attributes);

      expect(metadata).toEqual({
        runId: 'xyz',
        componentRunId: '123'
      });
    });
  });

  describe('ingestEvent', () => {
    it('should create OTEL event with parsed metadata', async () => {
      const eventData = {
        sessionId: 'claude-session-123',
        timestamp: new Date(),
        eventType: 'claude_code.api_request',
        eventName: 'API Request',
        attributes: {
          message: '[WORKFLOW_METADATA: runId=' + testWorkflowRunId + ', componentRunId=' + testComponentRunId + ']',
          model: 'claude-3-opus-20240229',
          tokens: { input: 1000, output: 500 }
        }
      };

      const event = await service.ingestEvent(eventData);

      expect(event.sessionId).toBe('claude-session-123');
      expect(event.workflowRunId).toBe(testWorkflowRunId);
      expect(event.componentRunId).toBe(testComponentRunId);
      expect(event.metadata).toHaveProperty('model');
    });

    it('should handle tool usage events', async () => {
      const eventData = {
        sessionId: 'claude-session-456',
        timestamp: new Date(),
        eventType: 'claude_code.tool_use',
        eventName: 'Tool Use',
        attributes: {
          message: '[WORKFLOW_METADATA: runId=' + testWorkflowRunId + ', componentRunId=' + testComponentRunId + ']',
          toolName: 'Read',
          parameters: { file_path: '/path/to/file.ts' },
          duration: 523,
          success: true
        }
      };

      const event = await service.ingestEvent(eventData);

      expect(event.toolName).toBe('Read');
      expect(event.toolDuration).toBe(0.523); // milliseconds to seconds
      expect(event.toolSuccess).toBe(true);
      expect(event.toolParameters).toEqual({ file_path: '/path/to/file.ts' });
    });

    it('should link event to component run by session ID', async () => {
      // Create component run with session ID
      const componentRun = await prisma.componentRun.create({
        data: {
          id: uuidv4(),
          workflowRunId: testWorkflowRunId,
          componentId: uuidv4(),
          status: 'running',
          startedAt: new Date(),
          sessionId: 'session-to-link'
        }
      });

      const eventData = {
        sessionId: 'session-to-link',
        timestamp: new Date(),
        eventType: 'claude_code.user_prompt',
        eventName: 'User Prompt',
        attributes: {}
      };

      const event = await service.ingestEvent(eventData);

      expect(event.componentRunId).toBe(componentRun.id);
      expect(event.workflowRunId).toBe(testWorkflowRunId);
    });

    it('should update component run metrics in real-time', async () => {
      const componentRunId = uuidv4();
      const sessionId = 'metrics-session';

      // Create component run
      const componentRun = await prisma.componentRun.create({
        data: {
          id: componentRunId,
          workflowRunId: testWorkflowRunId,
          componentId: uuidv4(),
          status: 'running',
          startedAt: new Date(),
          sessionId
        }
      });

      // Ingest multiple events
      await service.ingestEvent({
        sessionId,
        timestamp: new Date(),
        eventType: 'claude_code.api_request',
        eventName: 'API Request',
        attributes: {
          tokens: { input: 1000, output: 500, cache_read: 200 }
        }
      });

      await service.ingestEvent({
        sessionId,
        timestamp: new Date(),
        eventType: 'claude_code.tool_use',
        eventName: 'Tool Use',
        attributes: {
          toolName: 'Read',
          success: true
        }
      });

      // Fetch updated component run
      const updatedRun = await prisma.componentRun.findUnique({
        where: { id: componentRunId }
      });

      // Metrics should be aggregated
      expect(updatedRun?.tokensInput).toBeGreaterThanOrEqual(1000);
      expect(updatedRun?.tokensOutput).toBeGreaterThanOrEqual(500);
      expect(updatedRun?.tokensCacheRead).toBeGreaterThanOrEqual(200);
    });
  });

  describe('aggregateMetrics', () => {
    it('should aggregate token metrics from OTEL events', async () => {
      const sessionId = 'aggregate-session';
      const componentRunId = uuidv4();

      // Create component run
      await prisma.componentRun.create({
        data: {
          id: componentRunId,
          workflowRunId: testWorkflowRunId,
          componentId: uuidv4(),
          status: 'running',
          startedAt: new Date(),
          sessionId
        }
      });

      // Create multiple OTEL events
      await prisma.otelEvent.createMany({
        data: [
          {
            projectId: testProjectId,
            sessionId,
            workflowRunId: testWorkflowRunId,
            componentRunId,
            timestamp: new Date(),
            eventType: 'claude_code.api_request',
            metadata: { tokens: { input: 1000, output: 500 } }
          },
          {
            projectId: testProjectId,
            sessionId,
            workflowRunId: testWorkflowRunId,
            componentRunId,
            timestamp: new Date(),
            eventType: 'claude_code.api_request',
            metadata: { tokens: { input: 2000, output: 1000, cache_read: 500 } }
          }
        ]
      });

      const metrics = await service.aggregateMetrics(componentRunId);

      expect(metrics.tokensInput).toBe(3000);
      expect(metrics.tokensOutput).toBe(1500);
      expect(metrics.tokensCacheRead).toBe(500);
      expect(metrics.totalTokens).toBe(5000);
    });

    it('should calculate tool usage statistics', async () => {
      const componentRunId = uuidv4();
      const sessionId = 'tool-stats-session';

      await prisma.componentRun.create({
        data: {
          id: componentRunId,
          workflowRunId: testWorkflowRunId,
          componentId: uuidv4(),
          status: 'running',
          startedAt: new Date(),
          sessionId
        }
      });

      // Create tool usage events
      await prisma.otelEvent.createMany({
        data: [
          {
            projectId: testProjectId,
            sessionId,
            componentRunId,
            timestamp: new Date(),
            eventType: 'claude_code.tool_use',
            toolName: 'Read',
            toolDuration: 0.5,
            toolSuccess: true
          },
          {
            projectId: testProjectId,
            sessionId,
            componentRunId,
            timestamp: new Date(),
            eventType: 'claude_code.tool_use',
            toolName: 'Read',
            toolDuration: 0.3,
            toolSuccess: true
          },
          {
            projectId: testProjectId,
            sessionId,
            componentRunId,
            timestamp: new Date(),
            eventType: 'claude_code.tool_use',
            toolName: 'Write',
            toolDuration: 1.2,
            toolSuccess: false,
            toolError: 'Permission denied'
          }
        ]
      });

      const metrics = await service.aggregateMetrics(componentRunId);

      expect(metrics.toolBreakdown).toEqual({
        'Read': { calls: 2, errors: 0, avgDuration: 0.4, totalDuration: 0.8 },
        'Write': { calls: 1, errors: 1, avgDuration: 1.2, totalDuration: 1.2 }
      });
      expect(metrics.errorRate).toBe(0.333); // 1/3 failed
      expect(metrics.successRate).toBe(0.667); // 2/3 succeeded
    });

    it('should calculate cache effectiveness', async () => {
      const componentRunId = uuidv4();

      await prisma.componentRun.create({
        data: {
          id: componentRunId,
          workflowRunId: testWorkflowRunId,
          componentId: uuidv4(),
          status: 'running',
          startedAt: new Date(),
          sessionId: 'cache-test'
        }
      });

      await prisma.otelEvent.createMany({
        data: [
          {
            projectId: testProjectId,
            sessionId: 'cache-test',
            componentRunId,
            timestamp: new Date(),
            eventType: 'claude_code.cache_hit',
            metadata: { prompt_tokens_saved: 500 }
          },
          {
            projectId: testProjectId,
            sessionId: 'cache-test',
            componentRunId,
            timestamp: new Date(),
            eventType: 'claude_code.cache_hit',
            metadata: { prompt_tokens_saved: 800 }
          },
          {
            projectId: testProjectId,
            sessionId: 'cache-test',
            componentRunId,
            timestamp: new Date(),
            eventType: 'claude_code.cache_miss',
            metadata: {}
          }
        ]
      });

      const metrics = await service.aggregateMetrics(componentRunId);

      expect(metrics.cacheHits).toBe(2);
      expect(metrics.cacheMisses).toBe(1);
      expect(metrics.cacheHitRate).toBe(0.667); // 2/3
      expect(metrics.tokensCacheRead).toBe(1300); // 500 + 800
    });
  });

  describe('mapSessionToComponent', () => {
    it('should map Claude Code session to component run', async () => {
      const sessionId = 'new-session-123';
      const componentRunId = uuidv4();

      await service.mapSessionToComponent(sessionId, componentRunId);

      const componentRun = await prisma.componentRun.findUnique({
        where: { id: componentRunId }
      });

      expect(componentRun?.sessionId).toBe(sessionId);
    });

    it('should update existing OTEL events with component run ID', async () => {
      const sessionId = 'retroactive-session';

      // Create OTEL events without component run ID
      await prisma.otelEvent.createMany({
        data: [
          {
            projectId: testProjectId,
            sessionId,
            timestamp: new Date(),
            eventType: 'claude_code.api_request'
          },
          {
            projectId: testProjectId,
            sessionId,
            timestamp: new Date(),
            eventType: 'claude_code.tool_use',
            toolName: 'Read'
          }
        ]
      });

      const componentRunId = uuidv4();
      await service.mapSessionToComponent(sessionId, componentRunId);

      const events = await prisma.otelEvent.findMany({
        where: { sessionId }
      });

      events.forEach(event => {
        expect(event.componentRunId).toBe(componentRunId);
      });
    });
  });
});