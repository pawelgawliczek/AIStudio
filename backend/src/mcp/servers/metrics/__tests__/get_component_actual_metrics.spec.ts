import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { getComponentActualMetrics } from '../get_component_actual_metrics';

/**
 * Test suite for get_component_actual_metrics MCP tool (ST-27)
 * Compares estimated vs actual metrics from OTEL data
 */
describe('get_component_actual_metrics MCP Tool', () => {
  let prisma: PrismaClient;
  let testProjectId: string;
  let testComponentRunId: string;
  let testWorkflowRunId: string;

  beforeAll(async () => {
    prisma = new PrismaClient();

    // Create test fixtures
    const project = await prisma.project.create({
      data: {
        name: `Test Project ${Date.now()}`,
        description: 'Test project for metrics MCP tool'
      }
    });
    testProjectId = project.id;

    const workflowRun = await prisma.workflowRun.create({
      data: {
        projectId: testProjectId,
        workflowId: uuidv4(),
        triggeredBy: 'test-user',
        status: 'completed'
      }
    });
    testWorkflowRunId = workflowRun.id;

    const componentRun = await prisma.componentRun.create({
      data: {
        workflowRunId: testWorkflowRunId,
        componentId: uuidv4(),
        status: 'completed',
        startedAt: new Date('2025-01-01T10:00:00'),
        finishedAt: new Date('2025-01-01T10:05:00'),
        sessionId: 'test-session-123',
        // Estimated metrics (what component reported)
        tokensInput: 10000,
        tokensOutput: 2000,
        cost: 0.75,
        durationSeconds: 300,
        filesModified: ['file1.ts', 'file2.ts'],
        linesAdded: 150,
        linesDeleted: 50,
        userPrompts: 2,
        systemIterations: 5
      }
    });
    testComponentRunId = componentRun.id;

    // Create OTEL events with actual metrics
    await prisma.otelEvent.createMany({
      data: [
        {
          projectId: testProjectId,
          sessionId: 'test-session-123',
          workflowRunId: testWorkflowRunId,
          componentRunId: testComponentRunId,
          timestamp: new Date('2025-01-01T10:01:00'),
          eventType: 'claude_code.api_request',
          metadata: {
            tokens: { input: 5500, output: 1100, cache_read: 2000 }
          }
        },
        {
          projectId: testProjectId,
          sessionId: 'test-session-123',
          workflowRunId: testWorkflowRunId,
          componentRunId: testComponentRunId,
          timestamp: new Date('2025-01-01T10:03:00'),
          eventType: 'claude_code.api_request',
          metadata: {
            tokens: { input: 6000, output: 1200, cache_read: 1000 }
          }
        },
        {
          projectId: testProjectId,
          sessionId: 'test-session-123',
          workflowRunId: testWorkflowRunId,
          componentRunId: testComponentRunId,
          timestamp: new Date('2025-01-01T10:02:00'),
          eventType: 'claude_code.tool_use',
          toolName: 'Read',
          toolDuration: 0.5,
          toolSuccess: true
        },
        {
          projectId: testProjectId,
          sessionId: 'test-session-123',
          workflowRunId: testWorkflowRunId,
          componentRunId: testComponentRunId,
          timestamp: new Date('2025-01-01T10:02:30'),
          eventType: 'claude_code.tool_use',
          toolName: 'Write',
          toolDuration: 1.2,
          toolSuccess: true
        },
        {
          projectId: testProjectId,
          sessionId: 'test-session-123',
          workflowRunId: testWorkflowRunId,
          componentRunId: testComponentRunId,
          timestamp: new Date('2025-01-01T10:04:00'),
          eventType: 'claude_code.tool_use',
          toolName: 'Edit',
          toolDuration: 0.8,
          toolSuccess: false,
          toolError: 'File not found'
        }
      ]
    });
  });

  afterAll(async () => {
    await prisma.project.delete({ where: { id: testProjectId } });
    await prisma.$disconnect();
  });

  describe('Basic Functionality', () => {
    it('should return estimated vs actual metrics comparison', async () => {
      const result = await getComponentActualMetrics({
        componentRunId: testComponentRunId
      });

      expect(result).toEqual({
        success: true,
        componentRunId: testComponentRunId,
        sessionId: 'test-session-123',
        estimated: {
          tokensInput: 10000,
          tokensOutput: 2000,
          totalTokens: 12000,
          cost: 0.75,
          duration: 300,
          filesModified: 2,
          linesAdded: 150,
          linesDeleted: 50,
          userPrompts: 2,
          systemIterations: 5
        },
        actual: {
          tokensInput: 11500, // 5500 + 6000
          tokensOutput: 2300, // 1100 + 1200
          tokensCacheRead: 3000, // 2000 + 1000
          totalTokens: 16800, // Including cache
          cost: expect.any(Number), // Calculated from actual tokens
          duration: 300, // From timestamps
          toolCalls: {
            total: 3,
            successful: 2,
            failed: 1,
            breakdown: {
              'Read': { calls: 1, errors: 0, avgDuration: 0.5 },
              'Write': { calls: 1, errors: 0, avgDuration: 1.2 },
              'Edit': { calls: 1, errors: 1, avgDuration: 0.8 }
            }
          }
        },
        variance: {
          tokensInput: {
            estimated: 10000,
            actual: 11500,
            difference: 1500,
            percentDifference: 15.0
          },
          tokensOutput: {
            estimated: 2000,
            actual: 2300,
            difference: 300,
            percentDifference: 15.0
          },
          totalTokens: {
            estimated: 12000,
            actual: 16800,
            difference: 4800,
            percentDifference: 40.0
          },
          cost: {
            estimated: 0.75,
            actual: expect.any(Number),
            difference: expect.any(Number),
            percentDifference: expect.any(Number)
          }
        },
        accuracy: {
          tokensAccuracy: 71.4, // (12000/16800) * 100
          costAccuracy: expect.any(Number),
          overallAccuracy: expect.any(Number)
        },
        insights: expect.arrayContaining([
          expect.objectContaining({
            type: expect.any(String),
            message: expect.any(String),
            recommendation: expect.any(String)
          })
        ])
      });
    });

    it('should handle component run not found', async () => {
      const result = await getComponentActualMetrics({
        componentRunId: uuidv4()
      });

      expect(result).toEqual({
        success: false,
        error: expect.stringContaining('Component run not found')
      });
    });

    it('should handle missing OTEL events gracefully', async () => {
      const componentRun = await prisma.componentRun.create({
        data: {
          workflowRunId: testWorkflowRunId,
          componentId: uuidv4(),
          status: 'completed',
          startedAt: new Date(),
          finishedAt: new Date(),
          sessionId: 'no-otel-session',
          tokensInput: 5000,
          tokensOutput: 1000,
          cost: 0.30
        }
      });

      const result = await getComponentActualMetrics({
        componentRunId: componentRun.id
      });

      expect(result).toEqual({
        success: true,
        componentRunId: componentRun.id,
        sessionId: 'no-otel-session',
        estimated: expect.any(Object),
        actual: {
          tokensInput: 0,
          tokensOutput: 0,
          tokensCacheRead: 0,
          totalTokens: 0,
          cost: 0,
          duration: expect.any(Number),
          toolCalls: {
            total: 0,
            successful: 0,
            failed: 0,
            breakdown: {}
          }
        },
        variance: expect.any(Object),
        accuracy: {
          tokensAccuracy: 0,
          costAccuracy: 0,
          overallAccuracy: 0
        },
        insights: expect.arrayContaining([
          expect.objectContaining({
            type: 'missing_otel_data',
            message: expect.stringContaining('No OTEL events found')
          })
        ])
      });
    });

    it('should generate insights for significant variances', async () => {
      // Create a component run with large variance
      const componentRun = await prisma.componentRun.create({
        data: {
          workflowRunId: testWorkflowRunId,
          componentId: uuidv4(),
          status: 'completed',
          startedAt: new Date(),
          finishedAt: new Date(),
          sessionId: 'high-variance-session',
          tokensInput: 1000, // Estimated low
          tokensOutput: 500,
          cost: 0.05
        }
      });

      // Create OTEL events with much higher actual usage
      await prisma.otelEvent.create({
        data: {
          projectId: testProjectId,
          sessionId: 'high-variance-session',
          componentRunId: componentRun.id,
          timestamp: new Date(),
          eventType: 'claude_code.api_request',
          metadata: {
            tokens: { input: 50000, output: 10000 } // 50x higher!
          }
        }
      });

      const result = await getComponentActualMetrics({
        componentRunId: componentRun.id
      });

      const underestimationInsight = result.insights.find(i =>
        i.type === 'significant_underestimation'
      );

      expect(underestimationInsight).toBeDefined();
      expect(underestimationInsight?.message).toContain('underestimated');
      expect(underestimationInsight?.recommendation).toContain('estimation logic');
    });
  });

  describe('Cache Metrics', () => {
    it('should track cache effectiveness', async () => {
      const componentRun = await prisma.componentRun.create({
        data: {
          workflowRunId: testWorkflowRunId,
          componentId: uuidv4(),
          status: 'completed',
          startedAt: new Date(),
          finishedAt: new Date(),
          sessionId: 'cache-test-session',
          tokensInput: 10000,
          tokensOutput: 2000
        }
      });

      await prisma.otelEvent.createMany({
        data: [
          {
            projectId: testProjectId,
            sessionId: 'cache-test-session',
            componentRunId: componentRun.id,
            timestamp: new Date(),
            eventType: 'claude_code.cache_hit',
            metadata: { prompt_tokens_saved: 5000 }
          },
          {
            projectId: testProjectId,
            sessionId: 'cache-test-session',
            componentRunId: componentRun.id,
            timestamp: new Date(),
            eventType: 'claude_code.cache_miss',
            metadata: {}
          },
          {
            projectId: testProjectId,
            sessionId: 'cache-test-session',
            componentRunId: componentRun.id,
            timestamp: new Date(),
            eventType: 'claude_code.api_request',
            metadata: {
              tokens: { input: 10000, output: 2000, cache_read: 5000 }
            }
          }
        ]
      });

      const result = await getComponentActualMetrics({
        componentRunId: componentRun.id
      });

      expect(result.actual.tokensCacheRead).toBe(5000);
      expect(result.actual.cacheMetrics).toEqual({
        hits: 1,
        misses: 1,
        hitRate: 0.5,
        tokensSaved: 5000,
        costSaved: expect.any(Number)
      });

      const cacheInsight = result.insights.find(i =>
        i.type === 'cache_effectiveness'
      );
      expect(cacheInsight).toBeDefined();
    });
  });

  describe('Tool Usage Analysis', () => {
    it('should provide detailed tool usage breakdown', async () => {
      const result = await getComponentActualMetrics({
        componentRunId: testComponentRunId
      });

      expect(result.actual.toolCalls).toEqual({
        total: 3,
        successful: 2,
        failed: 1,
        breakdown: {
          'Read': {
            calls: 1,
            errors: 0,
            avgDuration: 0.5,
            totalDuration: 0.5,
            errorRate: 0
          },
          'Write': {
            calls: 1,
            errors: 0,
            avgDuration: 1.2,
            totalDuration: 1.2,
            errorRate: 0
          },
          'Edit': {
            calls: 1,
            errors: 1,
            avgDuration: 0.8,
            totalDuration: 0.8,
            errorRate: 1.0
          }
        },
        errorRate: 0.333,
        avgDuration: 0.833
      });
    });
  });
});