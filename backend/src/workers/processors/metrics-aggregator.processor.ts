import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { PrismaService } from '../../prisma/prisma.service';
import { QUEUE_NAMES } from '../workers.module';

/**
 * MetricsAggregatorProcessor
 *
 * Responsibilities:
 * - Roll up agent execution metrics by story/epic/project
 * - Calculate framework effectiveness comparisons
 * - Generate metrics reports for dashboards
 * - Support MCP queries for metrics (UC-METRICS-001, UC-METRICS-002, UC-METRICS-004)
 *
 * Metrics Calculated:
 * - Total tokens used per story/framework
 * - LOC generated vs tokens used
 * - Iteration count and efficiency
 * - Framework comparison normalized by complexity
 */
@Processor(QUEUE_NAMES.METRICS_AGGREGATION)
export class MetricsAggregatorProcessor {
  private readonly logger = new Logger(MetricsAggregatorProcessor.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Aggregate metrics for a completed story
   * Triggered when story status changes to 'done'
   */
  @Process('aggregate-story')
  async aggregateStoryMetrics(job: Job<{ storyId: string }>) {
    const { storyId } = job.data;
    this.logger.log(`Aggregating metrics for story ${storyId}`);

    try {
      // Get story details
      const story = await this.prisma.story.findUnique({
        where: { id: storyId },
        include: {
          runs: true,
          commits: true,
          subtasks: true,
        },
      });

      if (!story) {
        throw new Error(`Story ${storyId} not found`);
      }

      // Calculate total tokens
      const totalTokensInput = story.runs.reduce((sum: number, run: any) => sum + (run.tokensInput || 0), 0);
      const totalTokensOutput = story.runs.reduce((sum: number, run: any) => sum + (run.tokensOutput || 0), 0);
      const totalTokens = totalTokensInput + totalTokensOutput;

      // Calculate total LOC from commits
      const totalLOC = story.commits.reduce(
        (sum: number, commit: any) => sum + (commit.linesAdded || 0) + Math.abs(commit.linesDeleted || 0),
        0,
      );

      // Calculate total iterations (number of runs)
      const totalIterations = story.runs.length;

      // Calculate total duration
      const durations = story.runs
        .filter((run: any) => run.startedAt && run.finishedAt)
        .map((run: any) => run.finishedAt!.getTime() - run.startedAt!.getTime());
      const totalDuration = durations.reduce((sum: number, d: number) => sum + d, 0);

      // Calculate efficiency metrics
      const tokensPerLOC = totalLOC > 0 ? totalTokens / totalLOC : 0;
      const LOCPerPrompt = totalIterations > 0 ? totalLOC / totalIterations : 0;

      // Estimate cost (rough estimate: $0.03 per 1K tokens for GPT-4)
      const estimatedCost = (totalTokens / 1000) * 0.03;

      // Store aggregated metrics
      await this.prisma.story.update({
        where: { id: storyId },
        data: {
          metadata: {
            ...(story.metadata as object),
            metrics: {
              totalTokens,
              totalTokensInput,
              totalTokensOutput,
              totalLOC,
              totalIterations,
              totalDurationMs: totalDuration,
              tokensPerLOC,
              LOCPerPrompt,
              estimatedCost,
              aggregatedAt: new Date().toISOString(),
            },
          },
        },
      });

      this.logger.log(
        `Story ${storyId} metrics: ${totalTokens} tokens, ${totalLOC} LOC, ${totalIterations} iterations`,
      );

      return {
        success: true,
        metrics: {
          totalTokens,
          totalLOC,
          totalIterations,
          tokensPerLOC,
        },
      };
    } catch (error) {
      this.logger.error(`Failed to aggregate metrics for story ${storyId}:`, error);
      throw error;
    }
  }

  /**
   * Aggregate framework effectiveness metrics
   * Scheduled job or triggered on-demand for dashboard
   */
  @Process('aggregate-framework')
  async aggregateFrameworkMetrics(job: Job<{ projectId: string }>) {
    const { projectId } = job.data;
    this.logger.log(`Aggregating framework metrics for project ${projectId}`);

    try {
      // Get all completed stories with their framework assignments
      const stories = await this.prisma.story.findMany({
        where: {
          projectId,
          status: 'done',
        },
        include: {
          runs: true,
          commits: true,
        },
      });

      // Group stories by framework
      const frameworkGroups = new Map<string, any[]>();

      for (const story of stories) {
        const framework = (story.metadata as any)?.framework || 'unknown';
        if (!frameworkGroups.has(framework)) {
          frameworkGroups.set(framework, []);
        }
        frameworkGroups.get(framework)!.push(story);
      }

      // Calculate metrics per framework
      const frameworkMetrics: any[] = [];

      for (const [framework, frameworkStories] of frameworkGroups.entries()) {
        // Calculate aggregate metrics
        const totalStories = frameworkStories.length;
        let totalTokens = 0;
        let totalLOC = 0;
        let totalIterations = 0;
        let totalDuration = 0;

        for (const story of frameworkStories) {
          const storyMetrics = (story.metadata as any)?.metrics;
          if (storyMetrics) {
            totalTokens += storyMetrics.totalTokens || 0;
            totalLOC += storyMetrics.totalLOC || 0;
            totalIterations += storyMetrics.totalIterations || 0;
            totalDuration += storyMetrics.totalDurationMs || 0;
          }
        }

        // Calculate averages
        const avgTokensPerStory = totalStories > 0 ? totalTokens / totalStories : 0;
        const avgLOCPerStory = totalStories > 0 ? totalLOC / totalStories : 0;
        const avgIterationsPerStory = totalStories > 0 ? totalIterations / totalStories : 0;
        const avgDurationPerStory = totalStories > 0 ? totalDuration / totalStories : 0;
        const avgTokensPerLOC = totalLOC > 0 ? totalTokens / totalLOC : 0;

        frameworkMetrics.push({
          framework,
          totalStories,
          totalTokens,
          totalLOC,
          totalIterations,
          avgTokensPerStory,
          avgLOCPerStory,
          avgIterationsPerStory,
          avgDurationPerStory,
          avgTokensPerLOC,
        });
      }

      // Store framework comparison results (could create dedicated table)
      this.logger.log(`Aggregated metrics for ${frameworkMetrics.length} frameworks`);

      return {
        success: true,
        frameworks: frameworkMetrics,
      };
    } catch (error) {
      this.logger.error(`Failed to aggregate framework metrics for project ${projectId}:`, error);
      throw error;
    }
  }

  /**
   * Calculate weekly trend analysis
   * For UC-METRICS-004: Framework Weekly Comparison
   */
  @Process('weekly-trends')
  async calculateWeeklyTrends(job: Job<{ projectId: string }>) {
    const { projectId } = job.data;
    this.logger.log(`Calculating weekly trends for project ${projectId}`);

    try {
      // Get stories completed in last 12 weeks
      const twelveWeeksAgo = new Date();
      twelveWeeksAgo.setDate(twelveWeeksAgo.getDate() - 84);

      const stories = await this.prisma.story.findMany({
        where: {
          projectId,
          status: 'done',
          updatedAt: {
            gte: twelveWeeksAgo,
          },
        },
        include: {
          runs: true,
          commits: true,
        },
        orderBy: {
          updatedAt: 'asc',
        },
      });

      // Group by week and calculate metrics
      const weeklyMetrics = new Map<string, any>();

      for (const story of stories) {
        const week = this.getWeekKey(story.updatedAt);

        if (!weeklyMetrics.has(week)) {
          weeklyMetrics.set(week, {
            week,
            stories: [],
            totalTokens: 0,
            totalLOC: 0,
            totalIterations: 0,
          });
        }

        const weekData = weeklyMetrics.get(week)!;
        weekData.stories.push(story.id);

        const metrics = (story.metadata as any)?.metrics;
        if (metrics) {
          weekData.totalTokens += metrics.totalTokens || 0;
          weekData.totalLOC += metrics.totalLOC || 0;
          weekData.totalIterations += metrics.totalIterations || 0;
        }
      }

      const trends = Array.from(weeklyMetrics.values());
      this.logger.log(`Calculated trends for ${trends.length} weeks`);

      return {
        success: true,
        trends,
      };
    } catch (error) {
      this.logger.error(`Failed to calculate weekly trends for project ${projectId}:`, error);
      throw error;
    }
  }

  /**
   * Get week key in format YYYY-Www
   */
  private getWeekKey(date: Date): string {
    const year = date.getFullYear();
    const firstDayOfYear = new Date(year, 0, 1);
    const days = Math.floor((date.getTime() - firstDayOfYear.getTime()) / (24 * 60 * 60 * 1000));
    const week = Math.ceil((days + firstDayOfYear.getDay() + 1) / 7);
    return `${year}-W${week.toString().padStart(2, '0')}`;
  }
}
