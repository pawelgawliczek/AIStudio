import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

interface KpiHistoryParams {
  workflowId: string;
  kpiName: string;
  days?: number;
  businessComplexity?: [number, number];
  technicalComplexity?: [number, number];
}

interface KpiHistoryResponse {
  dates: string[];
  workflowValues: number[];
  systemAverages: number[];
}

@Injectable()
export class KpiHistoryService {
  private readonly logger = new Logger(KpiHistoryService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * ST-265: Get KPI history for trend charts
   * Returns daily values for a specific KPI over the specified time range
   */
  async getKpiHistory(params: KpiHistoryParams): Promise<KpiHistoryResponse> {
    this.logger.log(`Getting KPI history for workflow ${params.workflowId}, metric: ${params.kpiName}`);

    const days = params.days || 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Verify workflow exists
    const workflow = await this.prisma.workflow.findUnique({
      where: { id: params.workflowId },
    });

    if (!workflow) {
      throw new NotFoundException(`Workflow ${params.workflowId} not found`);
    }

    // Build complexity filter
    const complexityFilter: any = {};
    if (params.businessComplexity) {
      complexityFilter.businessComplexity = {
        gte: params.businessComplexity[0],
        lte: params.businessComplexity[1],
      };
    }
    if (params.technicalComplexity) {
      complexityFilter.technicalComplexity = {
        gte: params.technicalComplexity[0],
        lte: params.technicalComplexity[1],
      };
    }

    // Get workflow runs for the workflow
    const workflowRuns = await this.prisma.workflowRun.findMany({
      where: {
        workflowId: params.workflowId,
        startedAt: { gte: startDate },
        ...(Object.keys(complexityFilter).length > 0 && {
          story: complexityFilter,
        }),
      },
      include: {
        componentRuns: true,
        story: true,
      },
      orderBy: { startedAt: 'asc' },
    });

    // Get system-wide runs for comparison (all workflows)
    const systemRuns = await this.prisma.workflowRun.findMany({
      where: {
        workflow: { projectId: workflow.projectId },
        startedAt: { gte: startDate },
        ...(Object.keys(complexityFilter).length > 0 && {
          story: complexityFilter,
        }),
      },
      include: {
        componentRuns: true,
        story: true,
      },
      orderBy: { startedAt: 'asc' },
    });

    // Group runs by date and calculate daily averages
    const dates: string[] = [];
    const workflowValues: number[] = [];
    const systemAverages: number[] = [];

    // Generate date array
    for (let i = 0; i < days; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      dates.push(date.toISOString().split('T')[0]);
    }

    // Calculate values for each date
    for (const date of dates) {
      const dateObj = new Date(date);
      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);

      // Filter runs for this date
      const workflowDayRuns = workflowRuns.filter(
        (run) =>
          run.startedAt >= dateObj && run.startedAt < nextDate,
      );

      const systemDayRuns = systemRuns.filter(
        (run) =>
          run.startedAt >= dateObj && run.startedAt < nextDate,
      );

      // Calculate metric value for this day
      const workflowValue = this.calculateMetricValue(params.kpiName, workflowDayRuns);
      const systemValue = this.calculateMetricValue(params.kpiName, systemDayRuns);

      workflowValues.push(workflowValue);
      systemAverages.push(systemValue);
    }

    return {
      dates,
      workflowValues,
      systemAverages,
    };
  }

  /**
   * Calculate the value for a specific KPI metric from a set of workflow runs
   */
  private calculateMetricValue(kpiName: string, runs: any[]): number {
    if (runs.length === 0) return 0;

    switch (kpiName) {
      case 'tokensPerLOC': {
        const totalTokens = runs.reduce(
          (sum, run) => sum + (run.totalTokens || 0),
          0,
        );
        const totalLOC = runs.reduce((sum, run) => {
          const componentLOC = run.componentRuns.reduce(
            (cSum: number, cr: any) =>
              cSum + (cr.linesAdded || 0) + (cr.linesDeleted || 0),
            0,
          );
          return sum + componentLOC;
        }, 0);
        return totalLOC > 0 ? totalTokens / totalLOC : 0;
      }

      case 'promptsPerStory': {
        const totalPrompts = runs.reduce((sum, run) => {
          const componentPrompts = run.componentRuns.reduce(
            (cSum: number, cr: any) => cSum + (cr.userPrompts || 0),
            0,
          );
          return sum + componentPrompts;
        }, 0);
        return runs.length > 0 ? totalPrompts / runs.length : 0;
      }

      case 'costPerStory': {
        const totalCost = runs.reduce(
          (sum, run) => sum + (Number(run.estimatedCost) || 0),
          0,
        );
        return runs.length > 0 ? totalCost / runs.length : 0;
      }

      case 'humanPromptsPerLOC': {
        const totalPrompts = runs.reduce((sum, run) => {
          const componentPrompts = run.componentRuns.reduce(
            (cSum: number, cr: any) => cSum + (cr.userPrompts || 0),
            0,
          );
          return sum + componentPrompts;
        }, 0);
        const totalLOC = runs.reduce((sum, run) => {
          const componentLOC = run.componentRuns.reduce(
            (cSum: number, cr: any) =>
              cSum + (cr.linesAdded || 0) + (cr.linesDeleted || 0),
            0,
          );
          return sum + componentLOC;
        }, 0);
        return totalLOC > 0 ? totalPrompts / totalLOC : 0;
      }

      case 'successRate': {
        const completed = runs.filter((run) => run.status === 'completed').length;
        return runs.length > 0 ? (completed / runs.length) * 100 : 0;
      }

      case 'executionTime': {
        const totalDuration = runs.reduce(
          (sum, run) => sum + (run.durationSeconds || 0),
          0,
        );
        return runs.length > 0 ? totalDuration / runs.length : 0;
      }

      case 'locPerPrompt': {
        const totalPrompts = runs.reduce((sum, run) => {
          const componentPrompts = run.componentRuns.reduce(
            (cSum: number, cr: any) => cSum + (cr.userPrompts || 0),
            0,
          );
          return sum + componentPrompts;
        }, 0);
        const totalLOC = runs.reduce((sum, run) => {
          const componentLOC = run.componentRuns.reduce(
            (cSum: number, cr: any) =>
              cSum + (cr.linesAdded || 0) + (cr.linesDeleted || 0),
            0,
          );
          return sum + componentLOC;
        }, 0);
        return totalPrompts > 0 ? totalLOC / totalPrompts : 0;
      }

      case 'runtimePerLOC': {
        const totalDuration = runs.reduce(
          (sum, run) => sum + (run.durationSeconds || 0),
          0,
        );
        const totalLOC = runs.reduce((sum, run) => {
          const componentLOC = run.componentRuns.reduce(
            (cSum: number, cr: any) =>
              cSum + (cr.linesAdded || 0) + (cr.linesDeleted || 0),
            0,
          );
          return sum + componentLOC;
        }, 0);
        return totalLOC > 0 ? totalDuration / totalLOC : 0;
      }

      case 'linesAdded': {
        const totalLines = runs.reduce((sum, run) => {
          const componentLines = run.componentRuns.reduce(
            (cSum: number, cr: any) => cSum + (cr.linesAdded || 0),
            0,
          );
          return sum + componentLines;
        }, 0);
        return runs.length > 0 ? totalLines / runs.length : 0;
      }

      case 'linesModified': {
        // Assuming linesModified = linesAdded + linesDeleted
        const totalLines = runs.reduce((sum, run) => {
          const componentLines = run.componentRuns.reduce(
            (cSum: number, cr: any) =>
              cSum + (cr.linesAdded || 0) + (cr.linesDeleted || 0),
            0,
          );
          return sum + componentLines;
        }, 0);
        return runs.length > 0 ? totalLines / runs.length : 0;
      }

      case 'linesDeleted': {
        const totalLines = runs.reduce((sum, run) => {
          const componentLines = run.componentRuns.reduce(
            (cSum: number, cr: any) => cSum + (cr.linesDeleted || 0),
            0,
          );
          return sum + componentLines;
        }, 0);
        return runs.length > 0 ? totalLines / runs.length : 0;
      }

      case 'totalLOC': {
        const totalLines = runs.reduce((sum, run) => {
          const componentLines = run.componentRuns.reduce(
            (cSum: number, cr: any) =>
              cSum + (cr.linesAdded || 0) + (cr.linesDeleted || 0),
            0,
          );
          return sum + componentLines;
        }, 0);
        return runs.length > 0 ? totalLines / runs.length : 0;
      }

      case 'testsAdded': {
        // Placeholder - would need to track this separately
        return 0;
      }

      case 'filesModifiedCount': {
        const totalFiles = runs.reduce((sum, run) => {
          const componentFiles = run.componentRuns.reduce(
            (cSum: number, cr: any) =>
              cSum + (Array.isArray(cr.filesModified) ? cr.filesModified.length : 0),
            0,
          );
          return sum + componentFiles;
        }, 0);
        return runs.length > 0 ? totalFiles / runs.length : 0;
      }

      case 'totalUserPrompts': {
        const totalPrompts = runs.reduce((sum, run) => {
          const componentPrompts = run.componentRuns.reduce(
            (cSum: number, cr: any) => cSum + (cr.userPrompts || 0),
            0,
          );
          return sum + componentPrompts;
        }, 0);
        return runs.length > 0 ? totalPrompts / runs.length : 0;
      }

      case 'humanInterventions': {
        const totalInterventions = runs.reduce((sum, run) => {
          const componentInterventions = run.componentRuns.reduce(
            (cSum: number, cr: any) => cSum + (cr.humanInterventions || 0),
            0,
          );
          return sum + componentInterventions;
        }, 0);
        return runs.length > 0 ? totalInterventions / runs.length : 0;
      }

      case 'contextSwitches': {
        // Placeholder - would need to track this separately
        return 0;
      }

      case 'explorationDepth': {
        // Placeholder - would need to track this separately
        return 0;
      }

      case 'interactionsPerStory': {
        const totalInteractions = runs.reduce((sum, run) => {
          const componentInteractions = run.componentRuns.reduce(
            (cSum: number, cr: any) =>
              cSum + (cr.userPrompts || 0) + (cr.humanInterventions || 0),
            0,
          );
          return sum + componentInteractions;
        }, 0);
        return runs.length > 0 ? totalInteractions / runs.length : 0;
      }

      case 'avgIterations': {
        const totalIterations = runs.reduce((sum, run) => {
          const componentIterations = run.componentRuns.reduce(
            (cSum: number, cr: any) => cSum + (cr.systemIterations || 0),
            0,
          );
          return sum + componentIterations;
        }, 0);
        return runs.length > 0 ? totalIterations / runs.length : 0;
      }

      case 'codeGenAccuracy':
      case 'codeExecPassRate':
      case 'f1Score':
      case 'toolErrorRate':
      case 'avgComplexityDelta':
      case 'avgCoverageDelta': {
        // Placeholders for quality metrics
        return 0;
      }

      case 'stories': {
        return runs.length;
      }

      case 'bugs': {
        const bugRuns = runs.filter(
          (run) => run.story && run.story.type === 'bug',
        );
        return bugRuns.length;
      }

      case 'cacheHitRate': {
        const totalCacheRead = runs.reduce((sum, run) => {
          const componentCache = run.componentRuns.reduce(
            (cSum: number, cr: any) => cSum + (cr.tokensCacheRead || 0),
            0,
          );
          return sum + componentCache;
        }, 0);
        const totalTokens = runs.reduce(
          (sum, run) => sum + (run.totalTokens || 0),
          0,
        );
        return totalTokens > 0 ? (totalCacheRead / totalTokens) * 100 : 0;
      }

      case 'tokenUsage': {
        const totalTokens = runs.reduce(
          (sum, run) => sum + (run.totalTokens || 0),
          0,
        );
        return runs.length > 0 ? totalTokens / runs.length : 0;
      }

      default:
        this.logger.warn(`Unknown KPI metric: ${kpiName}`);
        return 0;
    }
  }
}
