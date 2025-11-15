import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

/**
 * Test suite for comprehensive agent metrics tracking schema (ST-27)
 * Tests for new fields in ComponentRun and new OtelEvent model
 */
describe('Comprehensive Agent Metrics Schema', () => {
  let prisma: PrismaClient;
  let testProjectId: string;
  let testWorkflowId: string;
  let testComponentId: string;
  let testWorkflowRunId: string;

  beforeAll(async () => {
    prisma = new PrismaClient();

    // Create test fixtures
    const project = await prisma.project.create({
      data: {
        name: `Test Project ${Date.now()}`,
        description: 'Test project for metrics schema'
      }
    });
    testProjectId = project.id;

    // Create test coordinator
    const coordinator = await prisma.coordinatorAgent.create({
      data: {
        projectId: testProjectId,
        name: 'Test Coordinator',
        domain: 'software-development',
        description: 'Test coordinator',
        coordinatorInstructions: 'Test instructions',
        config: {
          modelId: 'claude-3-opus-20240229',
          temperature: 0.7,
          maxInputTokens: 100000,
          maxOutputTokens: 4000
        },
        tools: ['get_story', 'update_story']
      }
    });

    // Create test component
    const component = await prisma.component.create({
      data: {
        projectId: testProjectId,
        name: 'Test Component',
        description: 'Test component',
        inputInstructions: 'Test input',
        operationInstructions: 'Test operation',
        outputInstructions: 'Test output',
        config: {
          modelId: 'claude-3-opus-20240229',
          temperature: 0.7
        },
        tools: ['Read', 'Write']
      }
    });
    testComponentId = component.id;

    // Create test workflow
    const workflow = await prisma.workflow.create({
      data: {
        projectId: testProjectId,
        coordinatorId: coordinator.id,
        name: 'Test Workflow',
        description: 'Test workflow',
        triggerConfig: {
          type: 'manual'
        }
      }
    });
    testWorkflowId = workflow.id;

    // Create test workflow run
    const workflowRun = await prisma.workflowRun.create({
      data: {
        projectId: testProjectId,
        workflowId: testWorkflowId,
        triggeredBy: 'test-user',
        status: 'running'
      }
    });
    testWorkflowRunId = workflowRun.id;
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.project.delete({ where: { id: testProjectId } });
    await prisma.$disconnect();
  });

  describe('ComponentRun Extended Metrics', () => {
    it('should store session ID for Claude Code mapping', async () => {
      const componentRun = await prisma.componentRun.create({
        data: {
          workflowRunId: testWorkflowRunId,
          componentId: testComponentId,
          status: 'running',
          startedAt: new Date(),
          sessionId: 'claude-code-session-12345' // NEW FIELD
        }
      });

      expect(componentRun.sessionId).toBe('claude-code-session-12345');
    });

    it('should store cache token metrics', async () => {
      const componentRun = await prisma.componentRun.create({
        data: {
          workflowRunId: testWorkflowRunId,
          componentId: testComponentId,
          status: 'completed',
          startedAt: new Date(),
          finishedAt: new Date(),
          tokensInput: 1000,
          tokensOutput: 500,
          tokensCacheRead: 300,  // NEW FIELD
          tokensCacheWrite: 200  // NEW FIELD
        }
      });

      expect(componentRun.tokensCacheRead).toBe(300);
      expect(componentRun.tokensCacheWrite).toBe(200);
    });

    it('should store code impact metrics', async () => {
      const componentRun = await prisma.componentRun.create({
        data: {
          workflowRunId: testWorkflowRunId,
          componentId: testComponentId,
          status: 'completed',
          startedAt: new Date(),
          finishedAt: new Date(),
          filesModified: ['file1.ts', 'file2.ts'],
          linesAdded: 150,         // NEW FIELD
          linesDeleted: 50,        // NEW FIELD
          linesModified: 30,       // NEW FIELD
          complexityBefore: 25.5,  // NEW FIELD
          complexityAfter: 22.3,   // NEW FIELD
          coverageBefore: 85.2,    // NEW FIELD
          coverageAfter: 91.5      // NEW FIELD
        }
      });

      expect(componentRun.linesAdded).toBe(150);
      expect(componentRun.linesDeleted).toBe(50);
      expect(componentRun.complexityBefore).toBe(25.5);
      expect(componentRun.coverageAfter).toBe(91.5);
    });

    it('should store quality metrics', async () => {
      const componentRun = await prisma.componentRun.create({
        data: {
          workflowRunId: testWorkflowRunId,
          componentId: testComponentId,
          status: 'completed',
          startedAt: new Date(),
          finishedAt: new Date(),
          errorRate: 0.05,        // NEW FIELD (5% error rate)
          successRate: 0.95,      // NEW FIELD
          toolBreakdown: {        // NEW FIELD
            'Read': { calls: 10, errors: 0, avgDuration: 0.5 },
            'Write': { calls: 5, errors: 1, avgDuration: 1.2 },
            'Edit': { calls: 3, errors: 0, avgDuration: 0.8 },
            'get_story': { calls: 1, errors: 0, avgDuration: 0.3 }
          }
        }
      });

      expect(componentRun.errorRate).toBe(0.05);
      expect(componentRun.successRate).toBe(0.95);
      expect(componentRun.toolBreakdown).toHaveProperty('Read');
      expect(componentRun.toolBreakdown.Read.calls).toBe(10);
    });

    it('should store agent behavior metrics', async () => {
      const componentRun = await prisma.componentRun.create({
        data: {
          workflowRunId: testWorkflowRunId,
          componentId: testComponentId,
          status: 'completed',
          startedAt: new Date(),
          finishedAt: new Date(),
          userPrompts: 3,
          humanInterventions: 1,
          systemIterations: 5,
          contextSwitches: 8,      // NEW FIELD
          explorationDepth: 15     // NEW FIELD (files analyzed before implementing)
        }
      });

      expect(componentRun.contextSwitches).toBe(8);
      expect(componentRun.explorationDepth).toBe(15);
    });

    it('should store cost and performance metrics', async () => {
      const componentRun = await prisma.componentRun.create({
        data: {
          workflowRunId: testWorkflowRunId,
          componentId: testComponentId,
          status: 'completed',
          startedAt: new Date(),
          finishedAt: new Date(),
          tokensInput: 10000,
          tokensOutput: 2000,
          cost: 0.75,
          costBreakdown: {         // NEW FIELD
            input: 0.60,
            output: 0.15,
            cache: 0.00
          },
          modelId: 'claude-3-opus-20240229',    // NEW FIELD
          temperature: 0.7,                       // NEW FIELD
          maxTokens: 4000,                       // NEW FIELD
          stopReason: 'end_turn',                // NEW FIELD
          timeToFirstToken: 1.2,                 // NEW FIELD (seconds)
          tokensPerSecond: 45.5                  // NEW FIELD
        }
      });

      expect(componentRun.costBreakdown).toHaveProperty('input');
      expect(componentRun.modelId).toBe('claude-3-opus-20240229');
      expect(componentRun.stopReason).toBe('end_turn');
      expect(componentRun.timeToFirstToken).toBe(1.2);
      expect(componentRun.tokensPerSecond).toBe(45.5);
    });

    it('should store prompt cache effectiveness', async () => {
      const componentRun = await prisma.componentRun.create({
        data: {
          workflowRunId: testWorkflowRunId,
          componentId: testComponentId,
          status: 'completed',
          startedAt: new Date(),
          finishedAt: new Date(),
          cacheHits: 8,           // NEW FIELD
          cacheMisses: 2,         // NEW FIELD
          cacheHitRate: 0.8       // NEW FIELD (80% cache hit rate)
        }
      });

      expect(componentRun.cacheHits).toBe(8);
      expect(componentRun.cacheMisses).toBe(2);
      expect(componentRun.cacheHitRate).toBe(0.8);
    });
  });

  describe('OtelEvent Model', () => {
    it('should create OTEL event with metadata', async () => {
      const otelEvent = await prisma.otelEvent.create({
        data: {
          projectId: testProjectId,
          sessionId: 'claude-code-session-12345',
          workflowRunId: testWorkflowRunId,
          componentRunId: uuidv4(),
          timestamp: new Date(),
          eventType: 'claude_code.api_request',
          eventName: 'API Request',
          metadata: {
            model: 'claude-3-opus-20240229',
            tokens: { input: 1000, output: 500 },
            temperature: 0.7
          },
          attributes: {
            workflowMetadata: '[WORKFLOW_METADATA: runId=xxx, componentRunId=yyy]'
          }
        }
      });

      expect(otelEvent.sessionId).toBe('claude-code-session-12345');
      expect(otelEvent.eventType).toBe('claude_code.api_request');
      expect(otelEvent.metadata).toHaveProperty('model');
    });

    it('should store tool usage events', async () => {
      const otelEvent = await prisma.otelEvent.create({
        data: {
          projectId: testProjectId,
          sessionId: 'claude-code-session-12345',
          workflowRunId: testWorkflowRunId,
          componentRunId: uuidv4(),
          timestamp: new Date(),
          eventType: 'claude_code.tool_use',
          eventName: 'Tool Use',
          toolName: 'Read',
          toolParameters: {
            file_path: '/opt/stack/AIStudio/backend/src/index.ts'
          },
          toolDuration: 0.523,
          toolSuccess: true,
          toolError: null
        }
      });

      expect(otelEvent.toolName).toBe('Read');
      expect(otelEvent.toolDuration).toBe(0.523);
      expect(otelEvent.toolSuccess).toBe(true);
    });

    it('should support indexing for fast queries', async () => {
      // Check that we can query by session ID efficiently
      const events = await prisma.otelEvent.findMany({
        where: {
          sessionId: 'test-session-123',
          workflowRunId: testWorkflowRunId
        },
        orderBy: { timestamp: 'desc' },
        take: 10
      });

      // Should be able to aggregate by component
      const aggregation = await prisma.otelEvent.groupBy({
        by: ['componentRunId'],
        where: {
          workflowRunId: testWorkflowRunId,
          eventType: 'claude_code.api_request'
        },
        _sum: {
          toolDuration: true
        }
      });

      expect(Array.isArray(events)).toBe(true);
      expect(Array.isArray(aggregation)).toBe(true);
    });

    it('should link to workflow and component runs', async () => {
      const componentRun = await prisma.componentRun.create({
        data: {
          workflowRunId: testWorkflowRunId,
          componentId: testComponentId,
          status: 'running',
          startedAt: new Date(),
          sessionId: 'test-session-456'
        }
      });

      const otelEvent = await prisma.otelEvent.create({
        data: {
          projectId: testProjectId,
          sessionId: 'test-session-456',
          workflowRunId: testWorkflowRunId,
          componentRunId: componentRun.id,
          timestamp: new Date(),
          eventType: 'claude_code.user_prompt',
          eventName: 'User Prompt'
        },
        include: {
          componentRun: true,
          workflowRun: true
        }
      });

      expect(otelEvent.componentRun?.id).toBe(componentRun.id);
      expect(otelEvent.workflowRun?.id).toBe(testWorkflowRunId);
    });
  });

  describe('Metrics Aggregation', () => {
    it('should support real-time aggregation triggers', async () => {
      // Simulate creating multiple OTEL events
      const componentRunId = uuidv4();
      const sessionId = 'test-session-789';

      // Create component run
      const componentRun = await prisma.componentRun.create({
        data: {
          id: componentRunId,
          workflowRunId: testWorkflowRunId,
          componentId: testComponentId,
          status: 'running',
          startedAt: new Date(),
          sessionId
        }
      });

      // Create OTEL events
      await prisma.otelEvent.createMany({
        data: [
          {
            projectId: testProjectId,
            sessionId,
            workflowRunId: testWorkflowRunId,
            componentRunId,
            timestamp: new Date(),
            eventType: 'claude_code.api_request',
            eventName: 'API Request',
            metadata: { tokens: { input: 1000, output: 500 } }
          },
          {
            projectId: testProjectId,
            sessionId,
            workflowRunId: testWorkflowRunId,
            componentRunId,
            timestamp: new Date(),
            eventType: 'claude_code.tool_use',
            eventName: 'Tool Use',
            toolName: 'Read',
            toolDuration: 0.5,
            toolSuccess: true
          }
        ]
      });

      // Metrics should be aggregated (this would be done by a trigger/worker)
      const aggregatedMetrics = await prisma.componentRun.findUnique({
        where: { id: componentRunId }
      });

      // These would be updated by aggregation logic
      expect(aggregatedMetrics).toBeDefined();
      expect(aggregatedMetrics?.sessionId).toBe(sessionId);
    });
  });
});