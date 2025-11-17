import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { getWorkflowMetricsBreakdown } from '../get_workflow_metrics_breakdown';

/**
 * Test suite for get_workflow_metrics_breakdown MCP tool (ST-27)
 * Provides component-level metrics breakdown for a workflow run
 */
describe('get_workflow_metrics_breakdown MCP Tool', () => {
  let prisma: PrismaClient;
  let testProjectId: string;
  let testWorkflowRunId: string;
  let testComponentIds: string[];

  beforeAll(async () => {
    prisma = new PrismaClient();

    // Create test fixtures
    const project = await prisma.project.create({
      data: {
        name: `Test Project ${Date.now()}`,
        description: 'Test project for workflow metrics'
      }
    });
    testProjectId = project.id;

    // Create components
    testComponentIds = await Promise.all(
      ['Context Explore', 'BA Analysis', 'Developer'].map(async (name) => {
        const component = await prisma.component.create({
          data: {
            projectId: testProjectId,
            name,
            description: `${name} component`,
            inputInstructions: 'Test',
            operationInstructions: 'Test',
            outputInstructions: 'Test',
            config: { modelId: 'claude-3-opus-20240229' },
            tools: ['Read', 'Write']
          }
        });
        return component.id;
      })
    );

    // Create workflow run
    const workflowRun = await prisma.workflowRun.create({
      data: {
        projectId: testProjectId,
        workflowId: uuidv4(),
        triggeredBy: 'test-user',
        status: 'completed'
      }
    });
    testWorkflowRunId = workflowRun.id;

    // Create component runs with metrics
    await Promise.all([
      prisma.componentRun.create({
        data: {
          workflowRunId: testWorkflowRunId,
          componentId: testComponentIds[0],
          executionOrder: 1,
          status: 'completed',
          startedAt: new Date('2025-01-01T10:00:00'),
          finishedAt: new Date('2025-01-01T10:05:00'),
          sessionId: 'session-1',
          tokensInput: 10000,
          tokensOutput: 2000,
          tokensCacheRead: 1000,
          totalTokens: 13000,
          cost: 0.75,
          durationSeconds: 300,
          filesModified: ['file1.ts', 'file2.ts', 'file3.ts'],
          linesAdded: 150,
          linesDeleted: 50,
          complexityBefore: 25.5,
          complexityAfter: 22.3,
          coverageBefore: 85.2,
          coverageAfter: 91.5,
          userPrompts: 1,
          systemIterations: 3,
          humanInterventions: 0,
          errorRate: 0.05,
          successRate: 0.95,
          cacheHits: 5,
          cacheMisses: 1,
          cacheHitRate: 0.833
        }
      }),
      prisma.componentRun.create({
        data: {
          workflowRunId: testWorkflowRunId,
          componentId: testComponentIds[1],
          executionOrder: 2,
          status: 'completed',
          startedAt: new Date('2025-01-01T10:05:00'),
          finishedAt: new Date('2025-01-01T10:08:00'),
          sessionId: 'session-2',
          tokensInput: 5000,
          tokensOutput: 1500,
          tokensCacheRead: 2000,
          totalTokens: 8500,
          cost: 0.45,
          durationSeconds: 180,
          filesModified: [],
          linesAdded: 0,
          linesDeleted: 0,
          userPrompts: 2,
          systemIterations: 4,
          humanInterventions: 1
        }
      }),
      prisma.componentRun.create({
        data: {
          workflowRunId: testWorkflowRunId,
          componentId: testComponentIds[2],
          executionOrder: 3,
          status: 'failed',
          startedAt: new Date('2025-01-01T10:08:00'),
          finishedAt: new Date('2025-01-01T10:10:00'),
          sessionId: 'session-3',
          tokensInput: 3000,
          tokensOutput: 0,
          totalTokens: 3000,
          cost: 0.15,
          durationSeconds: 120,
          errorMessage: 'Failed to complete implementation',
          retryCount: 2
        }
      })
    ]);
  });

  afterAll(async () => {
    await prisma.project.delete({ where: { id: testProjectId } });
    await prisma.$disconnect();
  });

  describe('Basic Functionality', () => {
    it('should return comprehensive metrics breakdown by component', async () => {
      const result = await getWorkflowMetricsBreakdown({
        workflowRunId: testWorkflowRunId
      });

      expect(result).toEqual({
        success: true,
        workflowRunId: testWorkflowRunId,
        status: 'completed',
        summary: {
          totalComponents: 3,
          completedComponents: 2,
          failedComponents: 1,
          successRate: 0.667,
          totalDuration: 600, // 10 minutes total
          totalTokens: 24500,
          totalCost: 1.35,
          totalLinesAdded: 150,
          totalLinesDeleted: 50,
          netLinesChanged: 100,
          totalFilesModified: 3,
          averageComplexityDelta: -3.2, // 22.3 - 25.5
          averageCoverageDelta: 6.3, // 91.5 - 85.2
          totalUserPrompts: 3,
          totalSystemIterations: 7,
          totalHumanInterventions: 1,
          overallCacheHitRate: expect.any(Number)
        },
        components: [
          {
            componentId: testComponentIds[0],
            componentName: 'Context Explore',
            executionOrder: 1,
            status: 'completed',
            duration: 300,
            tokens: {
              input: 10000,
              output: 2000,
              cacheRead: 1000,
              total: 13000
            },
            cost: 0.75,
            costPerToken: 0.0000577,
            tokensPerSecond: 43.33,
            codeImpact: {
              filesModified: 3,
              linesAdded: 150,
              linesDeleted: 50,
              netLines: 100,
              complexityDelta: -3.2,
              coverageDelta: 6.3
            },
            quality: {
              errorRate: 0.05,
              successRate: 0.95,
              retryCount: 0
            },
            cache: {
              hits: 5,
              misses: 1,
              hitRate: 0.833,
              tokensSaved: 1000
            },
            interactions: {
              userPrompts: 1,
              systemIterations: 3,
              humanInterventions: 0
            }
          },
          {
            componentId: testComponentIds[1],
            componentName: 'BA Analysis',
            executionOrder: 2,
            status: 'completed',
            duration: 180,
            tokens: {
              input: 5000,
              output: 1500,
              cacheRead: 2000,
              total: 8500
            },
            cost: 0.45,
            costPerToken: 0.0000529,
            tokensPerSecond: 47.22,
            codeImpact: {
              filesModified: 0,
              linesAdded: 0,
              linesDeleted: 0,
              netLines: 0,
              complexityDelta: 0,
              coverageDelta: 0
            },
            quality: {
              errorRate: 0,
              successRate: 1.0,
              retryCount: 0
            },
            cache: {
              hits: 0,
              misses: 0,
              hitRate: 0,
              tokensSaved: 2000
            },
            interactions: {
              userPrompts: 2,
              systemIterations: 4,
              humanInterventions: 1
            }
          },
          {
            componentId: testComponentIds[2],
            componentName: 'Developer',
            executionOrder: 3,
            status: 'failed',
            duration: 120,
            tokens: {
              input: 3000,
              output: 0,
              cacheRead: 0,
              total: 3000
            },
            cost: 0.15,
            costPerToken: 0.00005,
            tokensPerSecond: 25,
            errorMessage: 'Failed to complete implementation',
            quality: {
              errorRate: 1.0,
              successRate: 0,
              retryCount: 2
            },
            cache: {
              hits: 0,
              misses: 0,
              hitRate: 0,
              tokensSaved: 0
            },
            interactions: {
              userPrompts: 0,
              systemIterations: 0,
              humanInterventions: 0
            }
          }
        ],
        insights: expect.arrayContaining([
          expect.objectContaining({
            type: expect.any(String),
            severity: expect.any(String),
            message: expect.any(String),
            recommendation: expect.any(String)
          })
        ])
      });
    });

    it('should handle workflow run not found', async () => {
      const result = await getWorkflowMetricsBreakdown({
        workflowRunId: uuidv4()
      });

      expect(result).toEqual({
        success: false,
        error: expect.stringContaining('Workflow run not found')
      });
    });

    it('should handle workflow with no component runs', async () => {
      const emptyWorkflowRun = await prisma.workflowRun.create({
        data: {
          projectId: testProjectId,
          workflowId: uuidv4(),
          triggeredBy: 'test-user',
          status: 'pending'
        }
      });

      const result = await getWorkflowMetricsBreakdown({
        workflowRunId: emptyWorkflowRun.id
      });

      expect(result.success).toBe(true);
      expect(result.summary.totalComponents).toBe(0);
      expect(result.components).toEqual([]);
    });
  });

  describe('Insights Generation', () => {
    it('should identify bottleneck components', async () => {
      const result = await getWorkflowMetricsBreakdown({
        workflowRunId: testWorkflowRunId
      });

      const bottleneckInsight = result.insights.find(i =>
        i.type === 'bottleneck_component'
      );

      expect(bottleneckInsight).toBeDefined();
      expect(bottleneckInsight?.message).toContain('Context Explore');
      expect(bottleneckInsight?.message).toContain('50%'); // 300/600
    });

    it('should identify failed components', async () => {
      const result = await getWorkflowMetricsBreakdown({
        workflowRunId: testWorkflowRunId
      });

      const failureInsight = result.insights.find(i =>
        i.type === 'component_failure'
      );

      expect(failureInsight).toBeDefined();
      expect(failureInsight?.message).toContain('Developer');
      expect(failureInsight?.severity).toBe('high');
    });

    it('should identify cache optimization opportunities', async () => {
      const result = await getWorkflowMetricsBreakdown({
        workflowRunId: testWorkflowRunId
      });

      const cacheInsight = result.insights.find(i =>
        i.type === 'cache_optimization'
      );

      if (cacheInsight) {
        expect(cacheInsight.message).toContain('cache');
        expect(cacheInsight.recommendation).toBeDefined();
      }
    });
  });

  describe('Filtering Options', () => {
    it('should filter by component status', async () => {
      const result = await getWorkflowMetricsBreakdown({
        workflowRunId: testWorkflowRunId,
        status: 'completed'
      });

      expect(result.components.length).toBe(2);
      expect(result.components.every(c => c.status === 'completed')).toBe(true);
    });

    it('should include OTEL metrics when requested', async () => {
      // Create OTEL events for session-1
      await prisma.otelEvent.createMany({
        data: [
          {
            projectId: testProjectId,
            sessionId: 'session-1',
            workflowRunId: testWorkflowRunId,
            componentRunId: testComponentIds[0],
            timestamp: new Date(),
            eventType: 'claude_code.api_request',
            metadata: { tokens: { input: 12000, output: 2500 } }
          }
        ]
      });

      const result = await getWorkflowMetricsBreakdown({
        workflowRunId: testWorkflowRunId,
        includeOtelMetrics: true
      });

      expect(result.components[0].otelMetrics).toBeDefined();
      expect(result.components[0].otelMetrics).toEqual({
        actualTokensInput: 12000,
        actualTokensOutput: 2500,
        variance: expect.any(Object)
      });
    });
  });
});