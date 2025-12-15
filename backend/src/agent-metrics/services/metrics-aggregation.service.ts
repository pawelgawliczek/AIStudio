import { Injectable } from '@nestjs/common';
import { ComprehensiveMetricsCalculator } from '../calculators/comprehensive-metrics.calculator';
import {
  WorkflowMetricsSummaryDto,
  StoryMetricsSummaryDto,
  EpicMetricsSummaryDto,
  AgentMetricsSummaryDto,
  TrendAnalysisDto,
} from '../dto/metrics.dto';
import { determineTrend } from '../utils/metrics.utils';

@Injectable()
export class MetricsAggregationService {
  constructor(
    private readonly comprehensiveMetricsCalculator: ComprehensiveMetricsCalculator,
  ) {}

  /**
   * Group runs by story and calculate story-level metrics
   */
  groupRunsByStory(runs: any[]): Map<string, any> {
    const storyGroups = new Map<string, any>();

    for (const run of runs) {
      if (!run.storyId) continue;

      if (!storyGroups.has(run.storyId)) {
        storyGroups.set(run.storyId, {
          storyId: run.storyId,
          runs: [],
          totalTokens: 0,
          totalLoc: 0,
          totalIterations: 0,
          startedAt: run.startedAt,
          finishedAt: run.finishedAt,
        });
      }

      const story = storyGroups.get(run.storyId);
      story.runs.push(run);
      story.totalTokens +=
        (run.tokensInput || 0) + (run.tokensOutput || 0);
      story.totalLoc += run.locGenerated || 0;
      story.totalIterations += run.iterations || 0;

      if (run.startedAt < story.startedAt) {
        story.startedAt = run.startedAt;
      }
      if (run.finishedAt > story.finishedAt) {
        story.finishedAt = run.finishedAt;
      }
    }

    // Calculate cycle time for each story
    for (const [, story] of storyGroups) {
      const cycleTimeMs = story.finishedAt - story.startedAt;
      story.cycleTimeHours = cycleTimeMs / (1000 * 60 * 60);
    }

    return storyGroups;
  }

  /**
   * Aggregate metrics by workflow
   */
  aggregateByWorkflow(workflowRuns: any[]): WorkflowMetricsSummaryDto[] {
    const workflowGroups = new Map<string, any[]>();

    for (const run of workflowRuns) {
      const wfId = run.workflowId;
      if (!workflowGroups.has(wfId)) {
        workflowGroups.set(wfId, []);
      }
      workflowGroups.get(wfId)!.push(run);
    }

    return Array.from(workflowGroups.entries()).map(([workflowId, runs]) => ({
      workflowId,
      workflowName: runs[0]?.workflow?.name || 'Unknown',
      totalRuns: runs.length,
      metrics: this.comprehensiveMetricsCalculator.calculateComprehensiveMetrics(runs),
    }));
  }

  /**
   * Aggregate metrics by story
   */
  aggregateByStory(workflowRuns: any[]): StoryMetricsSummaryDto[] {
    const storyGroups = new Map<string, any[]>();

    for (const run of workflowRuns) {
      if (!run.storyId) continue;
      if (!storyGroups.has(run.storyId)) {
        storyGroups.set(run.storyId, []);
      }
      storyGroups.get(run.storyId)!.push(run);
    }

    return Array.from(storyGroups.entries()).map(([storyId, runs]) => ({
      storyId,
      storyKey: runs[0]?.story?.key || 'Unknown',
      storyTitle: runs[0]?.story?.title || 'Unknown',
      businessComplexity: runs[0]?.story?.businessComplexity || 3,
      technicalComplexity: runs[0]?.story?.technicalComplexity || 3,
      metrics: this.comprehensiveMetricsCalculator.calculateComprehensiveMetrics(runs),
    }));
  }

  /**
   * Aggregate metrics by epic
   */
  aggregateByEpic(workflowRuns: any[]): EpicMetricsSummaryDto[] {
    const epicGroups = new Map<string, any[]>();

    for (const run of workflowRuns) {
      const epicId = run.story?.epicId;
      if (!epicId) continue;
      if (!epicGroups.has(epicId)) {
        epicGroups.set(epicId, []);
      }
      epicGroups.get(epicId)!.push(run);
    }

    return Array.from(epicGroups.entries()).map(([epicId, runs]) => {
      const uniqueStories = new Set(runs.map((r) => r.storyId));
      return {
        epicId,
        epicKey: runs[0]?.story?.epic?.key || 'Unknown',
        epicTitle: runs[0]?.story?.epic?.title || 'Unknown',
        totalStories: uniqueStories.size,
        metrics: this.comprehensiveMetricsCalculator.calculateComprehensiveMetrics(runs),
      };
    });
  }

  /**
   * Aggregate metrics by agent/component
   */
  aggregateByAgent(workflowRuns: any[]): AgentMetricsSummaryDto[] {
    const agentGroups = new Map<string, any[]>();

    for (const run of workflowRuns) {
      for (const cr of run.componentRuns) {
        const componentId = cr.componentId;
        if (!agentGroups.has(componentId)) {
          agentGroups.set(componentId, []);
        }
        // Create a fake workflow run with just this component for metrics calculation
        agentGroups.get(componentId)!.push({
          ...run,
          componentRuns: [cr],
        });
      }
    }

    return Array.from(agentGroups.entries()).map(([componentId, runs]) => ({
      agentName: runs[0]?.componentRuns[0]?.component?.name || 'Unknown Agent',
      componentId,
      totalExecutions: runs.length,
      metrics: this.comprehensiveMetricsCalculator.calculateComprehensiveMetrics(runs),
    }));
  }

  /**
   * Calculate daily metrics for trends
   */
  calculateDailyMetrics(workflowRuns: any[]): Record<string, {
    storiesImplemented: number;
    tokensPerLOC: number;
    promptsPerStory: number;
    timePerLOC: number;
  }> {
    const dailyGroups = new Map<string, any[]>();

    for (const run of workflowRuns) {
      const date = new Date(run.startedAt).toISOString().split('T')[0];
      if (!dailyGroups.has(date)) {
        dailyGroups.set(date, []);
      }
      dailyGroups.get(date)!.push(run);
    }

    const result: Record<string, any> = {};

    for (const [date, runs] of dailyGroups.entries()) {
      const uniqueStories = new Set(runs.map(r => r.storyId).filter(Boolean)).size;
      const allComponentRuns = runs.flatMap(r => r.componentRuns);

      const totalTokens = allComponentRuns.reduce((sum, cr) => sum + (cr.tokensInput || 0) + (cr.tokensOutput || 0), 0);
      const linesAdded = allComponentRuns.reduce((sum, cr) => sum + (cr.linesAdded || 0), 0);
      const linesModified = allComponentRuns.reduce((sum, cr) => sum + (cr.linesModified || 0), 0);
      const totalLOC = linesAdded + linesModified;
      const totalPrompts = allComponentRuns.reduce((sum, cr) => sum + (cr.userPrompts || 0), 0);
      const totalDuration = allComponentRuns.reduce((sum, cr) => sum + (cr.durationSeconds || 0), 0);

      result[date] = {
        storiesImplemented: uniqueStories,
        tokensPerLOC: totalLOC > 0 ? totalTokens / totalLOC : 0,
        promptsPerStory: uniqueStories > 0 ? totalPrompts / uniqueStories : 0,
        timePerLOC: totalLOC > 0 ? totalDuration / totalLOC / 60 : 0, // in minutes
      };
    }

    return result;
  }

  /**
   * Calculate trends over time
   */
  calculateWorkflowTrends(
    workflowRuns: any[],
    startDate: Date,
    endDate: Date,
  ): TrendAnalysisDto[] {
    // Group runs by day
    const dailyGroups = new Map<string, any[]>();

    for (const run of workflowRuns) {
      const date = new Date(run.startedAt).toISOString().split('T')[0];
      if (!dailyGroups.has(date)) {
        dailyGroups.set(date, []);
      }
      dailyGroups.get(date)!.push(run);
    }

    // Calculate daily metrics
    const sortedDates = Array.from(dailyGroups.keys()).sort();
    const tokensPerLOCData: { date: string; value: number }[] = [];
    const costData: { date: string; value: number }[] = [];

    for (const date of sortedDates) {
      const runs = dailyGroups.get(date)!;
      const metrics = this.comprehensiveMetricsCalculator.calculateComprehensiveMetrics(runs);
      tokensPerLOCData.push({ date, value: metrics.efficiency.tokensPerLOC || 0 });
      costData.push({ date, value: metrics.costValue.costPerStory });
    }

    // Determine trends
    const tokensPerLOCTrend = determineTrend(tokensPerLOCData.map((d) => d.value));
    const costTrend = determineTrend(costData.map((d) => d.value));

    return [
      {
        metricName: 'Tokens per LOC',
        data: tokensPerLOCData,
        trend: tokensPerLOCTrend.trend,
        changePercent: tokensPerLOCTrend.changePercent,
      },
      {
        metricName: 'Cost per Story',
        data: costData,
        trend: costTrend.trend,
        changePercent: costTrend.changePercent,
      },
    ];
  }
}
