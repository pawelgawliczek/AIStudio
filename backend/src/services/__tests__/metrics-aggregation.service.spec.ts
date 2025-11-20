import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { MetricsAggregationService } from '../metrics-aggregation.service';

/**
 * Test suite for Metrics Aggregation Service (ST-27)
 * Handles aggregation of metrics at multiple levels
 */
describe('MetricsAggregationService', () => {
  let service: MetricsAggregationService;
  let prisma: PrismaClient;
  let testProjectId: string;
  let testEpicId: string;
  let testStoryId: string;
  let testWorkflowId: string;
  let testWorkflowRunId: string;

  beforeAll(async () => {
    prisma = new PrismaClient();
    service = new MetricsAggregationService(prisma);

    // Create test hierarchy
    const project = await prisma.project.create({
      data: {
        name: `Test Project ${Date.now()}`,
        description: 'Test project for metrics aggregation'
      }
    });
    testProjectId = project.id;

    const epic = await prisma.epic.create({
      data: {
        projectId: testProjectId,
        key: 'EP-TEST',
        title: 'Test Epic'
      }
    });
    testEpicId = epic.id;

    const story = await prisma.story.create({
      data: {
        projectId: testProjectId,
        epicId: testEpicId,
        key: 'ST-TEST',
        title: 'Test Story',
        type: 'feature'
      }
    });
    testStoryId = story.id;

    // Create workflow
    const coordinator = await prisma.coordinatorAgent.create({
      data: {
        projectId: testProjectId,
        name: 'Test Coordinator',
        domain: 'software-development',
        description: 'Test',
        coordinatorInstructions: 'Test',
        config: { modelId: 'claude-3-opus-20240229' },
        tools: []
      }
    });

    const workflow = await prisma.workflow.create({
      data: {
        projectId: testProjectId,
        coordinatorId: coordinator.id,
        name: 'Test Workflow',
        triggerConfig: { type: 'manual' }
      }
    });
    testWorkflowId = workflow.id;

    const workflowRun = await prisma.workflowRun.create({
      data: {
        projectId: testProjectId,
        workflowId: testWorkflowId,
        storyId: testStoryId,
        triggeredBy: 'test-user',
        status: 'completed'
      }
    });
    testWorkflowRunId = workflowRun.id;
  });

  afterAll(async () => {
    await prisma.project.delete({ where: { id: testProjectId } });
    await prisma.$disconnect();
  });

  describe('aggregateComponentMetrics', () => {
    it('should aggregate metrics for a single component run', async () => {
      const componentRun = await prisma.componentRun.create({
        data: {
          workflowRunId: testWorkflowRunId,
          componentId: uuidv4(),
          status: 'completed',
          startedAt: new Date('2025-01-01T10:00:00'),
          finishedAt: new Date('2025-01-01T10:05:00'),
          tokensInput: 10000,
          tokensOutput: 2000,
          tokensCacheRead: 500,
          tokensCacheWrite: 300,
          cost: 0.75,
          linesAdded: 150,
          linesDeleted: 50,
          filesModified: ['file1.ts', 'file2.ts'],
          userPrompts: 2,
          systemIterations: 5,
          humanInterventions: 1
        }
      });

      const metrics = await service.aggregateComponentMetrics(componentRun.id);

      expect(metrics).toEqual({
        componentId: componentRun.componentId,
        componentName: expect.any(String),
        duration: 300, // 5 minutes in seconds
        tokens: {
          input: 10000,
          output: 2000,
          cacheRead: 500,
          cacheWrite: 300,
          total: 12800
        },
        cost: 0.75,
        codeImpact: {
          filesModified: 2,
          linesAdded: 150,
          linesDeleted: 50,
          netLinesChanged: 100
        },
        interactions: {
          userPrompts: 2,
          systemIterations: 5,
          humanInterventions: 1
        },
        efficiency: {
          tokensPerSecond: 42.67, // 12800 / 300
          costPerToken: 0.0000586, // 0.75 / 12800
          linesPerToken: 0.0078 // 100 / 12800
        }
      });
    });
  });

  describe('aggregateWorkflowMetrics', () => {
    it('should aggregate metrics across all components in a workflow', async () => {
      // Create multiple component runs
      const componentRuns = await Promise.all([
        prisma.componentRun.create({
          data: {
            workflowRunId: testWorkflowRunId,
            componentId: uuidv4(),
            status: 'completed',
            startedAt: new Date('2025-01-01T10:00:00'),
            finishedAt: new Date('2025-01-01T10:05:00'),
            tokensInput: 5000,
            tokensOutput: 1000,
            cost: 0.30,
            linesAdded: 100,
            linesDeleted: 20
          }
        }),
        prisma.componentRun.create({
          data: {
            workflowRunId: testWorkflowRunId,
            componentId: uuidv4(),
            status: 'completed',
            startedAt: new Date('2025-01-01T10:05:00'),
            finishedAt: new Date('2025-01-01T10:10:00'),
            tokensInput: 8000,
            tokensOutput: 1500,
            cost: 0.45,
            linesAdded: 150,
            linesDeleted: 30
          }
        }),
        prisma.componentRun.create({
          data: {
            workflowRunId: testWorkflowRunId,
            componentId: uuidv4(),
            status: 'failed',
            startedAt: new Date('2025-01-01T10:10:00'),
            finishedAt: new Date('2025-01-01T10:12:00'),
            tokensInput: 2000,
            tokensOutput: 0,
            cost: 0.10,
            errorMessage: 'Test error'
          }
        })
      ]);

      const metrics = await service.aggregateWorkflowMetrics(testWorkflowRunId);

      expect(metrics).toEqual({
        workflowRunId: testWorkflowRunId,
        storyId: testStoryId,
        totalDuration: 720, // 12 minutes
        totalTokens: 17500, // 5000 + 1000 + 8000 + 1500 + 2000
        totalCost: 0.85, // 0.30 + 0.45 + 0.10
        componentsCompleted: 2,
        componentsFailed: 1,
        successRate: 0.667,
        codeImpact: {
          totalFilesModified: 0, // Would need to aggregate unique files
          totalLinesAdded: 250,
          totalLinesDeleted: 50,
          netLinesChanged: 200
        },
        componentBreakdown: expect.arrayContaining([
          expect.objectContaining({
            componentId: expect.any(String),
            status: expect.any(String),
            tokens: expect.any(Number),
            cost: expect.any(Number),
            duration: expect.any(Number)
          })
        ])
      });
    });

    it('should handle workflows with no component runs', async () => {
      const emptyWorkflowRun = await prisma.workflowRun.create({
        data: {
          projectId: testProjectId,
          workflowId: testWorkflowId,
          triggeredBy: 'test-user',
          status: 'pending'
        }
      });

      const metrics = await service.aggregateWorkflowMetrics(emptyWorkflowRun.id);

      expect(metrics.totalTokens).toBe(0);
      expect(metrics.totalCost).toBe(0);
      expect(metrics.componentsCompleted).toBe(0);
    });
  });

  describe('aggregateStoryMetrics', () => {
    it('should aggregate metrics across all workflow runs for a story', async () => {
      // Create additional workflow runs for the same story
      const workflowRun2 = await prisma.workflowRun.create({
        data: {
          projectId: testProjectId,
          workflowId: testWorkflowId,
          storyId: testStoryId,
          triggeredBy: 'test-user',
          status: 'completed'
        }
      });

      await prisma.componentRun.create({
        data: {
          workflowRunId: workflowRun2.id,
          componentId: uuidv4(),
          status: 'completed',
          startedAt: new Date(),
          finishedAt: new Date(),
          tokensInput: 3000,
          tokensOutput: 1000,
          cost: 0.20
        }
      });

      const metrics = await service.aggregateStoryMetrics(testStoryId);

      expect(metrics).toEqual({
        storyId: testStoryId,
        storyKey: 'ST-TEST',
        totalRuns: expect.any(Number), // At least 2
        totalTokens: expect.any(Number),
        totalCost: expect.any(Number),
        averageCostPerRun: expect.any(Number),
        mostEfficientRun: expect.objectContaining({
          runId: expect.any(String),
          cost: expect.any(Number),
          tokens: expect.any(Number)
        }),
        mostExpensiveRun: expect.objectContaining({
          runId: expect.any(String),
          cost: expect.any(Number),
          tokens: expect.any(Number)
        }),
        trends: {
          costTrend: expect.any(String), // 'increasing', 'decreasing', 'stable'
          efficiencyTrend: expect.any(String)
        }
      });
    });
  });

  describe('aggregateEpicMetrics', () => {
    it('should aggregate metrics across all stories in an epic', async () => {
      // Create another story in the epic
      const story2 = await prisma.story.create({
        data: {
          projectId: testProjectId,
          epicId: testEpicId,
          key: 'ST-TEST-2',
          title: 'Test Story 2',
          type: 'feature'
        }
      });

      const workflowRun3 = await prisma.workflowRun.create({
        data: {
          projectId: testProjectId,
          workflowId: testWorkflowId,
          storyId: story2.id,
          triggeredBy: 'test-user',
          status: 'completed'
        }
      });

      await prisma.componentRun.create({
        data: {
          workflowRunId: workflowRun3.id,
          componentId: uuidv4(),
          status: 'completed',
          startedAt: new Date(),
          finishedAt: new Date(),
          tokensInput: 5000,
          tokensOutput: 2000,
          cost: 0.35
        }
      });

      const metrics = await service.aggregateEpicMetrics(testEpicId);

      expect(metrics).toEqual({
        epicId: testEpicId,
        epicKey: 'EP-TEST',
        totalStories: 2,
        storiesWithRuns: expect.any(Number),
        totalTokens: expect.any(Number),
        totalCost: expect.any(Number),
        budget: null, // Not set
        budgetUtilization: null,
        storyBreakdown: expect.arrayContaining([
          expect.objectContaining({
            storyKey: expect.any(String),
            totalRuns: expect.any(Number),
            totalCost: expect.any(Number),
            totalTokens: expect.any(Number)
          })
        ]),
        projectedCost: expect.any(Number), // Based on remaining stories
        costByComponent: expect.any(Object) // Component type -> cost mapping
      });
    });
  });

  describe('calculateCostFromTokens', () => {
    it('should calculate cost based on model and token counts', () => {
      const testCases = [
        {
          model: 'claude-3-opus-20240229',
          tokensInput: 10000,
          tokensOutput: 2000,
          tokensCacheRead: 1000,
          expectedCost: 0.75 // Example calculation
        },
        {
          model: 'claude-3-sonnet-20240229',
          tokensInput: 10000,
          tokensOutput: 2000,
          tokensCacheRead: 1000,
          expectedCost: 0.18 // Cheaper model
        },
        {
          model: 'claude-3-haiku-20240307',
          tokensInput: 10000,
          tokensOutput: 2000,
          tokensCacheRead: 1000,
          expectedCost: 0.035 // Cheapest model
        }
      ];

      testCases.forEach(({ model, tokensInput, tokensOutput, tokensCacheRead, expectedCost }) => {
        const cost = service.calculateCostFromTokens(
          model,
          tokensInput,
          tokensOutput,
          tokensCacheRead
        );

        expect(cost).toBeCloseTo(expectedCost, 3);
      });
    });

    it('should apply cache discount correctly', () => {
      const fullCost = service.calculateCostFromTokens(
        'claude-3-opus-20240229',
        10000,
        2000,
        0
      );

      const cachedCost = service.calculateCostFromTokens(
        'claude-3-opus-20240229',
        10000,
        2000,
        5000 // 50% cached
      );

      expect(cachedCost).toBeLessThan(fullCost);
      expect(cachedCost).toBeGreaterThan(fullCost * 0.5); // Not 50% discount, cache still has a cost
    });
  });

  describe('getMetricsTrends', () => {
    it('should calculate trends over time windows', async () => {
      const trends = await service.getMetricsTrends(testProjectId, {
        window: '7d',
        groupBy: 'day'
      });

      expect(trends).toEqual({
        period: '7d',
        dataPoints: expect.any(Array),
        summary: {
          totalTokens: expect.any(Number),
          totalCost: expect.any(Number),
          averageDailyCost: expect.any(Number),
          peakDay: expect.any(String),
          trend: expect.any(String) // 'increasing', 'decreasing', 'stable'
        }
      });
    });

    it('should support different aggregation windows', async () => {
      const hourlyTrends = await service.getMetricsTrends(testProjectId, {
        window: '24h',
        groupBy: 'hour'
      });

      const dailyTrends = await service.getMetricsTrends(testProjectId, {
        window: '30d',
        groupBy: 'day'
      });

      const weeklyTrends = await service.getMetricsTrends(testProjectId, {
        window: '12w',
        groupBy: 'week'
      });

      expect(hourlyTrends.dataPoints.length).toBeLessThanOrEqual(24);
      expect(dailyTrends.dataPoints.length).toBeLessThanOrEqual(30);
      expect(weeklyTrends.dataPoints.length).toBeLessThanOrEqual(12);
    });
  });
});