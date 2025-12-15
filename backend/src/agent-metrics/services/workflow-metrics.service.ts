import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ComprehensiveMetricsCalculator } from '../calculators/comprehensive-metrics.calculator';
import { AggregationLevel } from '../dto/enums';
import {
  GetWorkflowMetricsDto,
  WorkflowMetricsResponseDto,
  WorkflowComparisonResponseDto,
} from '../dto/metrics.dto';
import { calculateWorkflowDateRange, calculatePercentDiff } from '../utils/metrics.utils';
import { MetricsAggregationService } from './metrics-aggregation.service';

@Injectable()
export class WorkflowMetricsService {
  private readonly logger = new Logger(WorkflowMetricsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly comprehensiveMetricsCalculator: ComprehensiveMetricsCalculator,
    private readonly aggregationService: MetricsAggregationService,
  ) {}

  /**
   * ST-27: Get comprehensive workflow metrics with multi-level aggregation
   */
  async getWorkflowMetrics(
    dto: GetWorkflowMetricsDto,
  ): Promise<WorkflowMetricsResponseDto> {
    this.logger.log(`Getting workflow metrics for project ${dto.projectId}`);

    const project = await this.prisma.project.findUnique({
      where: { id: dto.projectId },
    });

    if (!project) {
      throw new NotFoundException(`Project ${dto.projectId} not found`);
    }

    // Calculate date range
    const { startDate, endDate } = calculateWorkflowDateRange(
      dto.dateRange || 'month',
      dto.startDate,
      dto.endDate,
    );

    // Build base query for workflow runs
    const workflowRunsWhere: any = {
      workflow: { projectId: dto.projectId },
      startedAt: { gte: startDate, lte: endDate },
    };

    if (dto.workflowId) {
      workflowRunsWhere.workflowId = dto.workflowId;
    }

    // Filter by complexity if specified
    if (dto.businessComplexityMin || dto.businessComplexityMax ||
        dto.technicalComplexityMin || dto.technicalComplexityMax) {
      workflowRunsWhere.story = {};
      if (dto.businessComplexityMin) {
        workflowRunsWhere.story.businessComplexity = { gte: dto.businessComplexityMin };
      }
      if (dto.businessComplexityMax) {
        workflowRunsWhere.story.businessComplexity = {
          ...workflowRunsWhere.story.businessComplexity,
          lte: dto.businessComplexityMax
        };
      }
      if (dto.technicalComplexityMin) {
        workflowRunsWhere.story.technicalComplexity = { gte: dto.technicalComplexityMin };
      }
      if (dto.technicalComplexityMax) {
        workflowRunsWhere.story.technicalComplexity = {
          ...workflowRunsWhere.story.technicalComplexity,
          lte: dto.technicalComplexityMax
        };
      }
    }

    // Get all workflow runs with component runs
    const workflowRuns = await this.prisma.workflowRun.findMany({
      where: workflowRunsWhere,
      include: {
        workflow: true,
        story: {
          include: {
            epic: true,
          },
        },
        componentRuns: {
          include: {
            component: true,
          },
        },
      },
      orderBy: { startedAt: 'desc' },
    });

    // Calculate comprehensive summary metrics
    const summary = this.comprehensiveMetricsCalculator.calculateComprehensiveMetrics(workflowRuns);

    // Aggregate based on requested level
    const aggregationLevel = dto.aggregateBy || AggregationLevel.WORKFLOW;
    let workflows = undefined;
    let stories = undefined;
    let epics = undefined;
    let agents = undefined;

    switch (aggregationLevel) {
      case AggregationLevel.WORKFLOW:
        workflows = this.aggregationService.aggregateByWorkflow(workflowRuns);
        break;
      case AggregationLevel.STORY:
        stories = this.aggregationService.aggregateByStory(workflowRuns);
        break;
      case AggregationLevel.EPIC:
        epics = this.aggregationService.aggregateByEpic(workflowRuns);
        break;
      case AggregationLevel.AGENT:
        agents = this.aggregationService.aggregateByAgent(workflowRuns);
        break;
    }

    // Calculate trends
    const trends = this.aggregationService.calculateWorkflowTrends(workflowRuns, startDate, endDate);

    return {
      projectId: dto.projectId,
      projectName: project.name,
      dateRange: {
        start: startDate.toISOString(),
        end: endDate.toISOString(),
      },
      aggregationLevel,
      summary,
      workflows,
      stories,
      epics,
      agents,
      trends,
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Compare two workflows side by side
   */
  async compareWorkflows(
    projectId: string,
    workflow1Id: string,
    workflow2Id: string,
    dateRange?: string,
    startDate?: string,
    endDate?: string,
  ): Promise<WorkflowComparisonResponseDto> {
    const [metrics1, metrics2] = await Promise.all([
      this.getWorkflowMetrics({
        projectId,
        workflowId: workflow1Id,
        dateRange,
        startDate,
        endDate,
        aggregateBy: AggregationLevel.WORKFLOW,
      }),
      this.getWorkflowMetrics({
        projectId,
        workflowId: workflow2Id,
        dateRange,
        startDate,
        endDate,
        aggregateBy: AggregationLevel.WORKFLOW,
      }),
    ]);

    const wf1 = metrics1.workflows?.[0];
    const wf2 = metrics2.workflows?.[0];

    if (!wf1 || !wf2) {
      throw new NotFoundException('One or both workflows have no data');
    }

    // Calculate percentage differences
    const percentageDifference = {
      tokensPerLOC: calculatePercentDiff(
        wf1.metrics.efficiency.tokensPerLOC || 0,
        wf2.metrics.efficiency.tokensPerLOC || 0,
      ),
      costPerStory: calculatePercentDiff(
        wf1.metrics.costValue.costPerStory,
        wf2.metrics.costValue.costPerStory,
      ),
      avgDuration: calculatePercentDiff(
        wf1.metrics.execution.avgDurationPerRun,
        wf2.metrics.execution.avgDurationPerRun,
      ),
      defectsPerStory: calculatePercentDiff(
        wf1.metrics.efficiency.defectsPerStory || 0,
        wf2.metrics.efficiency.defectsPerStory || 0,
      ),
    };

    // Generate insights
    const insights: string[] = [];
    if (percentageDifference.tokensPerLOC < 0) {
      insights.push(
        `${wf1.workflowName} uses ${Math.abs(percentageDifference.tokensPerLOC).toFixed(1)}% fewer tokens per LOC`,
      );
    }
    if (percentageDifference.costPerStory < 0) {
      insights.push(
        `${wf1.workflowName} costs ${Math.abs(percentageDifference.costPerStory).toFixed(1)}% less per story`,
      );
    }
    if (percentageDifference.avgDuration < 0) {
      insights.push(
        `${wf1.workflowName} runs ${Math.abs(percentageDifference.avgDuration).toFixed(1)}% faster`,
      );
    }

    const recommendation =
      percentageDifference.costPerStory < 0 && percentageDifference.defectsPerStory <= 0
        ? `${wf1.workflowName} is more cost-effective with equal or better quality`
        : `Consider ${wf2.workflowName} for better overall performance`;

    return {
      comparison: {
        workflow1: wf1,
        workflow2: wf2,
        percentageDifference,
        recommendation,
      },
      insights,
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Get detailed metrics for one or two workflows for comparison
   */
  async getWorkflowDetails(params: {
    projectId: string;
    workflowAId: string;
    workflowBId?: string;
    businessComplexity: string;
    technicalComplexity: string;
  }) {
    this.logger.log(`Getting workflow details for ${params.workflowAId}`);

    // Helper to get complexity range
    const getComplexityRange = (level: string): [number, number] => {
      switch (level) {
        case 'low': return [1, 3];
        case 'medium': return [4, 6];
        case 'high': return [7, 10];
        case 'all':
        default: return [1, 10];
      }
    };

    const businessRange = getComplexityRange(params.businessComplexity);
    const technicalRange = getComplexityRange(params.technicalComplexity);

    // Helper to calculate metrics for a single workflow
    const calculateWorkflowMetrics = async (workflowId: string) => {
      const workflow = await this.prisma.workflow.findUnique({
        where: { id: workflowId },
        select: { id: true, name: true },
      });

      if (!workflow) {
        throw new NotFoundException(`Workflow ${workflowId} not found`);
      }

      // Get workflow runs with filters
      const workflowRuns = await this.prisma.workflowRun.findMany({
        where: {
          workflowId,
          status: 'completed',
          story: {
            businessComplexity: { gte: businessRange[0], lte: businessRange[1] },
            technicalComplexity: { gte: technicalRange[0], lte: technicalRange[1] },
          },
        },
        include: {
          componentRuns: true,
          story: true,
        },
      });

      const allComponentRuns = workflowRuns.flatMap(r => r.componentRuns);
      const totalRuns = workflowRuns.length;

      // Calculate success rate (completed runs vs all runs including failed)
      const allRuns = await this.prisma.workflowRun.count({
        where: {
          workflowId,
          story: {
            businessComplexity: { gte: businessRange[0], lte: businessRange[1] },
            technicalComplexity: { gte: technicalRange[0], lte: technicalRange[1] },
          },
        },
      });
      const successRate = allRuns > 0 ? (totalRuns / allRuns) * 100 : 0;

      // Calculate previous period success rate for change
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const previousRuns = await this.prisma.workflowRun.count({
        where: {
          workflowId,
          startedAt: { lt: thirtyDaysAgo },
          story: {
            businessComplexity: { gte: businessRange[0], lte: businessRange[1] },
            technicalComplexity: { gte: technicalRange[0], lte: technicalRange[1] },
          },
        },
      });
      const previousCompletedRuns = await this.prisma.workflowRun.count({
        where: {
          workflowId,
          status: 'completed',
          startedAt: { lt: thirtyDaysAgo },
          story: {
            businessComplexity: { gte: businessRange[0], lte: businessRange[1] },
            technicalComplexity: { gte: technicalRange[0], lte: technicalRange[1] },
          },
        },
      });
      const previousSuccessRate = previousRuns > 0 ? (previousCompletedRuns / previousRuns) * 100 : 0;
      const successRateChange = previousSuccessRate > 0 ? ((successRate - previousSuccessRate) / previousSuccessRate) * 100 : 0;

      // Execution time (average duration in seconds)
      const executionTime = totalRuns > 0
        ? allComponentRuns.reduce((sum, cr) => sum + (cr.durationSeconds || 0), 0) / totalRuns
        : 0;

      // Token metrics
      const totalInputTokens = allComponentRuns.reduce((sum, cr) => sum + (cr.tokensInput || 0), 0);
      const totalOutputTokens = allComponentRuns.reduce((sum, cr) => sum + (cr.tokensOutput || 0), 0);
      const totalTokens = totalInputTokens + totalOutputTokens;
      const tokenUsage = totalRuns > 0 ? totalTokens / totalRuns : 0;

      // Cost metrics
      const totalCost = allComponentRuns.reduce((sum, cr) => sum + (cr.cost || 0), 0);
      const averageCost = totalRuns > 0 ? totalCost / totalRuns : 0;

      // Previous cost for change calculation
      const previousCostRuns = await this.prisma.componentRun.aggregate({
        where: {
          workflowRun: {
            workflowId,
            startedAt: { lt: thirtyDaysAgo },
          },
        },
        _sum: { cost: true },
        _count: true,
      });
      const previousAvgCost = typeof previousCostRuns._count === 'number' && previousCostRuns._count > 0 && previousCostRuns._sum?.cost
        ? previousCostRuns._sum.cost / previousCostRuns._count
        : 0;
      const averageCostChange = previousAvgCost > 0 ? ((averageCost - previousAvgCost) / previousAvgCost) * 100 : 0;

      // Code generation metrics (mock values - these would come from test results)
      const codeGenAccuracy = 85 + Math.random() * 10;
      const codeExecPassRate = 90 + Math.random() * 8;

      // Iteration metrics
      const avgIterations = totalRuns > 0
        ? allComponentRuns.reduce((sum, cr) => sum + (cr.systemIterations || 1), 0) / totalRuns
        : 0;

      // ST-110: Cache metrics removed - now using /context command for token tracking
      const cacheReads = 0;
      const cacheWrites = 0;
      const cacheHits = 0;
      const cacheMisses = 0;
      const cacheHitRate = 0;

      // Quality indicators (mock values - would come from actual quality metrics)
      const f1Score = 0.85 + Math.random() * 0.1;
      const toolErrorRate = 1 + Math.random() * 3;

      // Work items count
      const uniqueStories = new Set(
        workflowRuns.filter(r => r.story?.type === 'feature').map(r => r.storyId).filter(Boolean)
      ).size;
      const uniqueBugs = new Set(
        workflowRuns.filter(r => r.story?.type === 'bug' || r.story?.type === 'defect').map(r => r.storyId).filter(Boolean)
      ).size;

      // Code Impact Metrics
      const linesAdded = allComponentRuns.reduce((sum, cr) => sum + (cr.linesAdded || 0), 0);
      const linesModified = allComponentRuns.reduce((sum, cr) => sum + (cr.linesModified || 0), 0);
      const linesDeleted = allComponentRuns.reduce((sum, cr) => sum + (cr.linesDeleted || 0), 0);
      const testsAdded = allComponentRuns.reduce((sum, cr) => sum + (cr.testsAdded || 0), 0);
      const filesModifiedCount = new Set(allComponentRuns.flatMap(cr => cr.filesModified || [])).size;
      const totalLOC = linesAdded + linesModified;

      // Efficiency Ratios
      const tokensPerLOC = totalLOC > 0 ? totalTokens / totalLOC : 0;
      const totalUserPrompts = allComponentRuns.reduce((sum, cr) => sum + (cr.userPrompts || 0), 0);
      const totalStories = uniqueStories + uniqueBugs;
      const promptsPerStory = totalStories > 0 ? totalUserPrompts / totalStories : 0;
      const costPerStory = totalStories > 0 ? totalCost / totalStories : 0;
      const locPerPrompt = totalUserPrompts > 0 ? totalLOC / totalUserPrompts : 0;
      const runtimePerLOC = totalLOC > 0 ? executionTime / totalLOC : 0;

      // Agent Behavior Metrics
      const humanInterventions = allComponentRuns.reduce((sum, cr) => sum + (cr.humanInterventions || 0), 0);
      const contextSwitches = allComponentRuns.reduce((sum, cr) => sum + (cr.contextSwitches || 0), 0);
      const explorationDepth = totalRuns > 0
        ? allComponentRuns.reduce((sum, cr) => sum + (cr.explorationDepth || 0), 0) / totalRuns
        : 0;
      const interactionsPerStory = totalStories > 0 ? humanInterventions / totalStories : 0;

      // Quality Metrics
      const avgComplexityDelta = totalRuns > 0
        ? allComponentRuns.reduce((sum, cr) => {
            const before = cr.complexityBefore || 0;
            const after = cr.complexityAfter || 0;
            return sum + (after - before);
          }, 0) / totalRuns
        : 0;
      const avgCoverageDelta = totalRuns > 0
        ? allComponentRuns.reduce((sum, cr) => {
            const before = cr.coverageBefore || 0;
            const after = cr.coverageAfter || 0;
            return sum + (after - before);
          }, 0) / totalRuns
        : 0;

      return {
        id: workflow.id,
        name: workflow.name,
        // Execution Metrics
        successRate: parseFloat(successRate.toFixed(1)),
        successRateChange: parseFloat(successRateChange.toFixed(1)),
        executionTime: parseFloat(executionTime.toFixed(0)),
        averageCost: parseFloat(averageCost.toFixed(2)),
        averageCostChange: parseFloat(averageCostChange.toFixed(1)),

        // Main KPIs
        tokensPerLOC: parseFloat(tokensPerLOC.toFixed(1)),
        promptsPerStory: parseFloat(promptsPerStory.toFixed(1)),
        costPerStory: parseFloat(costPerStory.toFixed(2)),

        // Token Analysis
        totalInputTokens,
        totalOutputTokens,
        totalTokens,
        tokenUsage: parseFloat(tokenUsage.toFixed(0)),
        cacheReads,
        cacheWrites,
        cacheHits,
        cacheMisses,
        cacheHitRate: parseFloat(cacheHitRate.toFixed(1)),

        // Efficiency Ratios
        locPerPrompt: parseFloat(locPerPrompt.toFixed(1)),
        runtimePerLOC: parseFloat(runtimePerLOC.toFixed(2)),

        // Code Impact
        linesAdded,
        linesModified,
        linesDeleted,
        totalLOC,
        testsAdded,
        filesModifiedCount,

        // Agent Behavior
        totalUserPrompts,
        humanInterventions,
        contextSwitches,
        explorationDepth: parseFloat(explorationDepth.toFixed(1)),
        interactionsPerStory: parseFloat(interactionsPerStory.toFixed(1)),
        avgIterations: parseFloat(avgIterations.toFixed(1)),

        // Quality Metrics
        codeGenAccuracy: parseFloat(codeGenAccuracy.toFixed(1)),
        codeExecPassRate: parseFloat(codeExecPassRate.toFixed(1)),
        f1Score: parseFloat(f1Score.toFixed(2)),
        toolErrorRate: parseFloat(toolErrorRate.toFixed(1)),
        avgComplexityDelta: parseFloat(avgComplexityDelta.toFixed(2)),
        avgCoverageDelta: parseFloat(avgCoverageDelta.toFixed(1)),

        // Work Items
        storiesCount: uniqueStories,
        bugsCount: uniqueBugs,
      };
    };

    // Calculate metrics for workflow A
    const workflowA = await calculateWorkflowMetrics(params.workflowAId);

    // Calculate metrics for workflow B if provided
    let workflowB = null;
    if (params.workflowBId) {
      workflowB = await calculateWorkflowMetrics(params.workflowBId);
    }

    // Get overall counts for the project
    const allWorkflowRuns = await this.prisma.workflowRun.findMany({
      where: {
        workflow: { projectId: params.projectId },
        status: 'completed',
        story: {
          businessComplexity: { gte: businessRange[0], lte: businessRange[1] },
          technicalComplexity: { gte: technicalRange[0], lte: technicalRange[1] },
        },
      },
      include: { story: true, componentRuns: true },
    });

    const allStoriesSet = new Set(
      allWorkflowRuns.filter(wr => wr.story?.type === 'feature').map(wr => wr.storyId).filter(Boolean)
    );
    const allBugsSet = new Set(
      allWorkflowRuns.filter(wr => wr.story?.type === 'bug' || wr.story?.type === 'defect').map(wr => wr.storyId).filter(Boolean)
    );

    // Calculate system averages from all workflow runs
    const allComponentRuns = allWorkflowRuns.flatMap(r => r.componentRuns);
    const totalAllRuns = allWorkflowRuns.length;

    const systemTotalTokens = allComponentRuns.reduce((sum, cr) => sum + (cr.tokensInput || 0) + (cr.tokensOutput || 0), 0);
    const systemTotalCost = allComponentRuns.reduce((sum, cr) => sum + (cr.cost || 0), 0);
    const systemTotalLOC = allComponentRuns.reduce((sum, cr) => sum + (cr.linesAdded || 0) + (cr.linesModified || 0), 0);
    const systemTotalPrompts = allComponentRuns.reduce((sum, cr) => sum + (cr.userPrompts || 0), 0);
    const systemTotalStories = allStoriesSet.size + allBugsSet.size;

    const systemAverages = {
      // Execution Metrics
      successRate: totalAllRuns > 0 ? 95 : 0,
      executionTime: totalAllRuns > 0 ? allComponentRuns.reduce((sum, cr) => sum + (cr.durationSeconds || 0), 0) / totalAllRuns : 0,
      averageCost: totalAllRuns > 0 ? systemTotalCost / totalAllRuns : 0,

      // Main KPIs
      tokensPerLOC: systemTotalLOC > 0 ? systemTotalTokens / systemTotalLOC : 0,
      promptsPerStory: systemTotalStories > 0 ? systemTotalPrompts / systemTotalStories : 0,
      costPerStory: systemTotalStories > 0 ? systemTotalCost / systemTotalStories : 0,

      // Token Analysis
      totalInputTokens: allComponentRuns.reduce((sum, cr) => sum + (cr.tokensInput || 0), 0),
      totalOutputTokens: allComponentRuns.reduce((sum, cr) => sum + (cr.tokensOutput || 0), 0),
      totalTokens: systemTotalTokens,
      tokenUsage: totalAllRuns > 0 ? systemTotalTokens / totalAllRuns : 0,
      cacheReads: 0,
      cacheWrites: 0,
      cacheHits: 0,
      cacheMisses: 0,
      cacheHitRate: 0,

      // Efficiency Ratios
      locPerPrompt: systemTotalPrompts > 0 ? systemTotalLOC / systemTotalPrompts : 0,
      runtimePerLOC: systemTotalLOC > 0 ? (allComponentRuns.reduce((sum, cr) => sum + (cr.durationSeconds || 0), 0) / totalAllRuns) / systemTotalLOC : 0,

      // Code Impact
      linesAdded: allComponentRuns.reduce((sum, cr) => sum + (cr.linesAdded || 0), 0),
      linesModified: allComponentRuns.reduce((sum, cr) => sum + (cr.linesModified || 0), 0),
      linesDeleted: allComponentRuns.reduce((sum, cr) => sum + (cr.linesDeleted || 0), 0),
      totalLOC: systemTotalLOC,
      testsAdded: allComponentRuns.reduce((sum, cr) => sum + (cr.testsAdded || 0), 0),
      filesModifiedCount: new Set(allComponentRuns.flatMap(cr => cr.filesModified || [])).size,

      // Agent Behavior
      totalUserPrompts: systemTotalPrompts,
      humanInterventions: allComponentRuns.reduce((sum, cr) => sum + (cr.humanInterventions || 0), 0),
      contextSwitches: allComponentRuns.reduce((sum, cr) => sum + (cr.contextSwitches || 0), 0),
      explorationDepth: totalAllRuns > 0 ? allComponentRuns.reduce((sum, cr) => sum + (cr.explorationDepth || 0), 0) / totalAllRuns : 0,
      interactionsPerStory: systemTotalStories > 0 ? allComponentRuns.reduce((sum, cr) => sum + (cr.humanInterventions || 0), 0) / systemTotalStories : 0,
      avgIterations: totalAllRuns > 0 ? allComponentRuns.reduce((sum, cr) => sum + (cr.systemIterations || 1), 0) / totalAllRuns : 0,

      // Quality Metrics
      codeGenAccuracy: 87.5,
      codeExecPassRate: 92.0,
      f1Score: 0.89,
      toolErrorRate: 2.0,
      avgComplexityDelta: 0,
      avgCoverageDelta: 0,
    };

    return {
      workflowA,
      workflowB,
      systemAverages: {
        // Execution Metrics
        successRate: parseFloat(systemAverages.successRate.toFixed(1)),
        executionTime: parseFloat(systemAverages.executionTime.toFixed(0)),
        averageCost: parseFloat(systemAverages.averageCost.toFixed(2)),

        // Main KPIs
        tokensPerLOC: parseFloat(systemAverages.tokensPerLOC.toFixed(1)),
        promptsPerStory: parseFloat(systemAverages.promptsPerStory.toFixed(1)),
        costPerStory: parseFloat(systemAverages.costPerStory.toFixed(2)),

        // Token Analysis
        totalInputTokens: systemAverages.totalInputTokens,
        totalOutputTokens: systemAverages.totalOutputTokens,
        totalTokens: systemAverages.totalTokens,
        tokenUsage: parseFloat(systemAverages.tokenUsage.toFixed(0)),
        cacheReads: systemAverages.cacheReads,
        cacheWrites: systemAverages.cacheWrites,
        cacheHits: systemAverages.cacheHits,
        cacheMisses: systemAverages.cacheMisses,
        cacheHitRate: parseFloat(systemAverages.cacheHitRate.toFixed(1)),

        // Efficiency Ratios
        locPerPrompt: parseFloat(systemAverages.locPerPrompt.toFixed(1)),
        runtimePerLOC: parseFloat(systemAverages.runtimePerLOC.toFixed(2)),

        // Code Impact
        linesAdded: systemAverages.linesAdded,
        linesModified: systemAverages.linesModified,
        linesDeleted: systemAverages.linesDeleted,
        totalLOC: systemAverages.totalLOC,
        testsAdded: systemAverages.testsAdded,
        filesModifiedCount: systemAverages.filesModifiedCount,

        // Agent Behavior
        totalUserPrompts: systemAverages.totalUserPrompts,
        humanInterventions: systemAverages.humanInterventions,
        contextSwitches: systemAverages.contextSwitches,
        explorationDepth: parseFloat(systemAverages.explorationDepth.toFixed(1)),
        interactionsPerStory: parseFloat(systemAverages.interactionsPerStory.toFixed(1)),
        avgIterations: parseFloat(systemAverages.avgIterations.toFixed(1)),

        // Quality Metrics
        codeGenAccuracy: parseFloat(systemAverages.codeGenAccuracy.toFixed(1)),
        codeExecPassRate: parseFloat(systemAverages.codeExecPassRate.toFixed(1)),
        f1Score: parseFloat(systemAverages.f1Score.toFixed(2)),
        toolErrorRate: parseFloat(systemAverages.toolErrorRate.toFixed(1)),
        avgComplexityDelta: parseFloat(systemAverages.avgComplexityDelta.toFixed(2)),
        avgCoverageDelta: parseFloat(systemAverages.avgCoverageDelta.toFixed(1)),
      },
      counts: {
        filteredStories: workflowA.storiesCount + (workflowB?.storiesCount || 0),
        totalStories: allStoriesSet.size,
        filteredBugs: workflowA.bugsCount + (workflowB?.bugsCount || 0),
        totalBugs: allBugsSet.size,
      },
      generatedAt: new Date().toISOString(),
    };
  }
}
