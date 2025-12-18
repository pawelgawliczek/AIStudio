import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
// eslint-disable-next-line import/no-unresolved
import { InsightsGenerationService } from '../insights-generation.service';

/**
 * Test suite for Insights Generation Service (ST-27)
 * Generates actionable insights from metrics data
 */
describe('InsightsGenerationService', () => {
  let service: InsightsGenerationService;
  let prisma: PrismaClient;
  let testProjectId: string;
  let testWorkflowId: string;

  beforeAll(async () => {
    prisma = new PrismaClient();
    service = new InsightsGenerationService(prisma);

    // Create test project
    const project = await prisma.project.create({
      data: {
        name: `Test Project ${Date.now()}`,
        description: 'Test project for insights generation'
      }
    });
    testProjectId = project.id;

    // Create workflow with components
    const coordinator = await prisma.coordinatorAgent.create({
      data: {
        projectId: testProjectId,
        name: 'Test Coordinator',
        domain: 'software-development',
        description: 'Test',
        coordinatorInstructions: 'Test',
        config: { modelId: 'claude-3-opus-20240229', temperature: 0.7 },
        tools: []
      }
    });

    const components = await Promise.all([
      prisma.component.create({
        data: {
          projectId: testProjectId,
          name: 'Context Explore',
          description: 'Explore context',
          inputInstructions: 'Test',
          operationInstructions: 'Test',
          outputInstructions: 'Test',
          config: { modelId: 'claude-3-opus-20240229' },
          tools: ['Read', 'Grep']
        }
      }),
      prisma.component.create({
        data: {
          projectId: testProjectId,
          name: 'BA Analysis',
          description: 'Business analysis',
          inputInstructions: 'Test',
          operationInstructions: 'Test',
          outputInstructions: 'Test',
          config: { modelId: 'claude-3-sonnet-20240229' },
          tools: ['get_story']
        }
      })
    ]);

    const workflow = await prisma.workflow.create({
      data: {
        projectId: testProjectId,
        coordinatorId: coordinator.id,
        name: 'Test Workflow',
        triggerConfig: { type: 'manual' }
      }
    });
    testWorkflowId = workflow.id;
  });

  afterAll(async () => {
    await prisma.project.delete({ where: { id: testProjectId } });
    await prisma.$disconnect();
  });

  describe('generateComponentInsights', () => {
    it('should identify high-error-rate components', async () => {
      const componentId = uuidv4();

      // Create workflow runs with component runs
      const runs = await Promise.all(
        Array.from({ length: 5 }, async () => {
          const workflowRun = await prisma.workflowRun.create({
            data: {
              projectId: testProjectId,
              workflowId: testWorkflowId,
              triggeredBy: 'test-user',
              status: 'completed'
            }
          });

          return prisma.componentRun.create({
            data: {
              workflowRunId: workflowRun.id,
              componentId,
              status: Math.random() > 0.7 ? 'failed' : 'completed', // 30% failure rate
              startedAt: new Date(),
              finishedAt: new Date(),
              tokensInput: 10000,
              tokensOutput: 2000,
              cost: 0.75,
              errorRate: Math.random() > 0.7 ? 0.3 : 0.05,
              retryCount: Math.random() > 0.7 ? 3 : 0
            }
          });
        })
      );

      const insights = await service.generateComponentInsights(componentId);

      expect(insights).toEqual({
        componentId,
        componentName: expect.any(String),
        performanceScore: expect.any(Number), // 0-100
        insights: expect.arrayContaining([
          expect.objectContaining({
            type: expect.stringMatching(/error_rate|retry_pattern|cost_outlier|efficiency/),
            severity: expect.stringMatching(/low|medium|high|critical/),
            message: expect.any(String),
            recommendation: expect.any(String),
            impact: expect.objectContaining({
              costImpact: expect.any(Number),
              timeImpact: expect.any(Number),
              qualityImpact: expect.any(Number)
            })
          })
        ]),
        metrics: {
          averageErrorRate: expect.any(Number),
          averageRetries: expect.any(Number),
          averageCost: expect.any(Number),
          averageDuration: expect.any(Number),
          successRate: expect.any(Number)
        }
      });
    });

    it('should detect inefficient exploration patterns', async () => {
      const componentId = uuidv4();
      const workflowRun = await prisma.workflowRun.create({
        data: {
          projectId: testProjectId,
          workflowId: testWorkflowId,
          triggeredBy: 'test-user',
          status: 'completed'
        }
      });

      await prisma.componentRun.create({
        data: {
          workflowRunId: workflowRun.id,
          componentId,
          status: 'completed',
          startedAt: new Date(),
          finishedAt: new Date(),
          tokensInput: 50000, // Very high
          tokensOutput: 500, // Very low output
          explorationDepth: 100, // Analyzed too many files
          contextSwitches: 50, // Too many context switches
          filesModified: [],
          linesAdded: 0,
          cost: 3.75
        }
      });

      const insights = await service.generateComponentInsights(componentId);

      const explorationInsight = insights.insights.find(i =>
        i.type === 'inefficient_exploration'
      );

      expect(explorationInsight).toBeDefined();
      expect(explorationInsight?.severity).toBe('high');
      expect(explorationInsight?.recommendation).toContain('focus');
    });

    it('should identify cost outliers', async () => {
      const componentId = uuidv4();

      // Create runs with varying costs
      const costs = [0.10, 0.12, 0.11, 0.09, 2.50]; // Last one is outlier

      await Promise.all(
        costs.map(async (cost) => {
          const workflowRun = await prisma.workflowRun.create({
            data: {
              projectId: testProjectId,
              workflowId: testWorkflowId,
              triggeredBy: 'test-user',
              status: 'completed'
            }
          });

          return prisma.componentRun.create({
            data: {
              workflowRunId: workflowRun.id,
              componentId,
              status: 'completed',
              startedAt: new Date(),
              finishedAt: new Date(),
              tokensInput: cost * 10000,
              tokensOutput: cost * 2000,
              cost
            }
          });
        })
      );

      const insights = await service.generateComponentInsights(componentId);

      const costOutlierInsight = insights.insights.find(i =>
        i.type === 'cost_outlier'
      );

      expect(costOutlierInsight).toBeDefined();
      expect(costOutlierInsight?.severity).toMatch(/high|critical/);
      expect(costOutlierInsight?.recommendation).toContain('temperature');
    });
  });

  describe('generateWorkflowInsights', () => {
    it('should identify bottleneck components', async () => {
      const workflowRun = await prisma.workflowRun.create({
        data: {
          projectId: testProjectId,
          workflowId: testWorkflowId,
          triggeredBy: 'test-user',
          status: 'completed'
        }
      });

      // Create component runs with varying durations
      await Promise.all([
        prisma.componentRun.create({
          data: {
            workflowRunId: workflowRun.id,
            componentId: uuidv4(),
            status: 'completed',
            startedAt: new Date('2025-01-01T10:00:00'),
            finishedAt: new Date('2025-01-01T10:01:00'), // 1 minute
            tokensInput: 1000,
            cost: 0.05
          }
        }),
        prisma.componentRun.create({
          data: {
            workflowRunId: workflowRun.id,
            componentId: uuidv4(),
            status: 'completed',
            startedAt: new Date('2025-01-01T10:01:00'),
            finishedAt: new Date('2025-01-01T10:21:00'), // 20 minutes - bottleneck!
            tokensInput: 50000,
            cost: 2.50
          }
        }),
        prisma.componentRun.create({
          data: {
            workflowRunId: workflowRun.id,
            componentId: uuidv4(),
            status: 'completed',
            startedAt: new Date('2025-01-01T10:21:00'),
            finishedAt: new Date('2025-01-01T10:23:00'), // 2 minutes
            tokensInput: 2000,
            cost: 0.10
          }
        })
      ]);

      const insights = await service.generateWorkflowInsights(workflowRun.id);

      expect(insights).toEqual({
        workflowRunId: workflowRun.id,
        workflowName: 'Test Workflow',
        insights: expect.arrayContaining([
          expect.objectContaining({
            type: 'bottleneck_component',
            severity: expect.any(String),
            componentId: expect.any(String),
            message: expect.stringContaining('bottleneck'),
            recommendation: expect.any(String)
          })
        ]),
        optimizationOpportunities: expect.arrayContaining([
          expect.objectContaining({
            type: expect.any(String),
            potentialSavings: expect.objectContaining({
              cost: expect.any(Number),
              time: expect.any(Number),
              tokens: expect.any(Number)
            }),
            implementation: expect.any(String)
          })
        ])
      });
    });

    it('should suggest parallel execution opportunities', async () => {
      const workflowRun = await prisma.workflowRun.create({
        data: {
          projectId: testProjectId,
          workflowId: testWorkflowId,
          triggeredBy: 'test-user',
          status: 'completed'
        }
      });

      // Create independent component runs that could run in parallel
      await Promise.all([
        prisma.componentRun.create({
          data: {
            workflowRunId: workflowRun.id,
            componentId: uuidv4(),
            executionOrder: 1,
            status: 'completed',
            startedAt: new Date('2025-01-01T10:00:00'),
            finishedAt: new Date('2025-01-01T10:05:00'),
            inputData: { storyId: 'test' },
            outputData: { analysis: 'context' }
          }
        }),
        prisma.componentRun.create({
          data: {
            workflowRunId: workflowRun.id,
            componentId: uuidv4(),
            executionOrder: 2,
            status: 'completed',
            startedAt: new Date('2025-01-01T10:05:00'),
            finishedAt: new Date('2025-01-01T10:10:00'),
            inputData: { storyId: 'test' }, // Same input, no dependency
            outputData: { analysis: 'business' }
          }
        }),
        prisma.componentRun.create({
          data: {
            workflowRunId: workflowRun.id,
            componentId: uuidv4(),
            executionOrder: 3,
            status: 'completed',
            startedAt: new Date('2025-01-01T10:10:00'),
            finishedAt: new Date('2025-01-01T10:15:00'),
            inputData: { storyId: 'test' }, // Same input, no dependency
            outputData: { analysis: 'design' }
          }
        })
      ]);

      const insights = await service.generateWorkflowInsights(workflowRun.id);

      const parallelInsight = insights.optimizationOpportunities.find(o =>
        o.type === 'parallel_execution'
      );

      expect(parallelInsight).toBeDefined();
      expect(parallelInsight?.potentialSavings.time).toBeGreaterThan(0);
    });
  });

  describe('generateProjectInsights', () => {
    it('should provide project-level recommendations', async () => {
      // Create diverse workflow runs
      await Promise.all(
        Array.from({ length: 10 }, async () => {
          const workflowRun = await prisma.workflowRun.create({
            data: {
              projectId: testProjectId,
              workflowId: testWorkflowId,
              triggeredBy: 'test-user',
              status: Math.random() > 0.8 ? 'failed' : 'completed'
            }
          });

          return prisma.componentRun.create({
            data: {
              workflowRunId: workflowRun.id,
              componentId: uuidv4(),
              status: Math.random() > 0.8 ? 'failed' : 'completed',
              startedAt: new Date(),
              finishedAt: new Date(),
              tokensInput: Math.floor(Math.random() * 50000),
              tokensOutput: Math.floor(Math.random() * 5000),
              cost: Math.random() * 5,
              modelId: Math.random() > 0.5 ? 'claude-3-opus-20240229' : 'claude-3-sonnet-20240229'
            }
          });
        })
      );

      const insights = await service.generateProjectInsights(testProjectId);

      expect(insights).toEqual({
        projectId: testProjectId,
        projectName: expect.any(String),
        overallHealth: expect.stringMatching(/excellent|good|fair|poor/),
        healthScore: expect.any(Number), // 0-100
        insights: expect.arrayContaining([
          expect.objectContaining({
            category: expect.stringMatching(/cost|performance|quality|efficiency/),
            type: expect.any(String),
            severity: expect.any(String),
            message: expect.any(String),
            recommendation: expect.any(String)
          })
        ]),
        trends: {
          costTrend: expect.stringMatching(/increasing|decreasing|stable/),
          efficiencyTrend: expect.stringMatching(/improving|declining|stable/),
          qualityTrend: expect.stringMatching(/improving|declining|stable/)
        },
        recommendations: expect.arrayContaining([
          expect.objectContaining({
            priority: expect.stringMatching(/low|medium|high|critical/),
            category: expect.any(String),
            action: expect.any(String),
            expectedImpact: expect.any(String),
            effort: expect.stringMatching(/low|medium|high/)
          })
        ])
      });
    });

    it('should detect model optimization opportunities', async () => {
      // Create runs with expensive model usage for simple tasks
      await Promise.all(
        Array.from({ length: 5 }, async () => {
          const workflowRun = await prisma.workflowRun.create({
            data: {
              projectId: testProjectId,
              workflowId: testWorkflowId,
              triggeredBy: 'test-user',
              status: 'completed'
            }
          });

          return prisma.componentRun.create({
            data: {
              workflowRunId: workflowRun.id,
              componentId: uuidv4(),
              status: 'completed',
              startedAt: new Date(),
              finishedAt: new Date(),
              tokensInput: 500, // Small input
              tokensOutput: 100, // Small output
              cost: 0.05, // But using expensive model
              modelId: 'claude-3-opus-20240229', // Expensive for simple task
              linesAdded: 5 // Simple task
            }
          });
        })
      );

      const insights = await service.generateProjectInsights(testProjectId);

      const modelOptimization = insights.recommendations.find(r =>
        r.category === 'model_optimization'
      );

      expect(modelOptimization).toBeDefined();
      expect(modelOptimization?.action).toContain('Haiku');
    });
  });

  describe('generateCacheInsights', () => {
    it('should analyze cache effectiveness', async () => {
      const workflowRun = await prisma.workflowRun.create({
        data: {
          projectId: testProjectId,
          workflowId: testWorkflowId,
          triggeredBy: 'test-user',
          status: 'completed'
        }
      });

      await Promise.all([
        prisma.componentRun.create({
          data: {
            workflowRunId: workflowRun.id,
            componentId: uuidv4(),
            status: 'completed',
            startedAt: new Date(),
            finishedAt: new Date(),
            tokensInput: 10000,
            tokensCacheRead: 8000, // 80% cache hit
            cacheHits: 4,
            cacheMisses: 1,
            cacheHitRate: 0.8,
            cost: 0.10 // Low cost due to cache
          }
        }),
        prisma.componentRun.create({
          data: {
            workflowRunId: workflowRun.id,
            componentId: uuidv4(),
            status: 'completed',
            startedAt: new Date(),
            finishedAt: new Date(),
            tokensInput: 10000,
            tokensCacheRead: 0, // No cache usage
            cacheHits: 0,
            cacheMisses: 10,
            cacheHitRate: 0,
            cost: 0.60 // High cost, no cache
          }
        })
      ]);

      const insights = await service.generateCacheInsights(workflowRun.id);

      expect(insights).toEqual({
        workflowRunId: workflowRun.id,
        overallCacheHitRate: 0.333, // 4 hits / (4 + 8) total
        tokensSaved: 8000,
        costSaved: expect.any(Number),
        insights: expect.arrayContaining([
          expect.objectContaining({
            type: 'cache_opportunity',
            componentId: expect.any(String),
            message: expect.any(String),
            recommendation: expect.stringContaining('prompt')
          })
        ])
      });
    });
  });
});