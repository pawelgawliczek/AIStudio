import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  GetStoryExecutionDetailsDto,
  StoryExecutionDetailsResponseDto,
  GetPerAgentMetricsDto,
  PerAgentAnalyticsResponseDto,
  GetWeeklyMetricsDto,
  WeeklyAnalysisResponseDto,
  AgentExecutionDto,
} from '../dto/metrics.dto';

@Injectable()
export class StoryMetricsService {
  private readonly logger = new Logger(StoryMetricsService.name);
  private readonly TOKEN_COST_PER_1K = 0.01; // $0.01 per 1000 tokens (configurable)

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get per-story execution details
   */
  async getStoryExecutionDetails(
    dto: GetStoryExecutionDetailsDto,
  ): Promise<StoryExecutionDetailsResponseDto> {
    this.logger.log(`Getting execution details for story ${dto.storyId}`);

    // Get story with all runs
    const story = await this.prisma.story.findUnique({
      where: { id: dto.storyId },
      include: {
        epic: true,
        runs: {
          orderBy: { startedAt: 'asc' },
        },
        commits: dto.includeCommits
          ? {
              include: {
                files: dto.includeFileChanges,
              },
            }
          : false,
      },
    });

    if (!story) {
      throw new NotFoundException(`Story ${dto.storyId} not found`);
    }

    // Transform runs to execution DTOs
    const executions: AgentExecutionDto[] = story.runs.map((run, index) => {
      const duration =
        run.finishedAt && run.startedAt
          ? (run.finishedAt.getTime() - run.startedAt.getTime()) / 1000
          : 0;

      const locGenerated = (run.metadata as any)?.locGenerated || 0;

      const metrics = {
        tokensPerLoc:
          locGenerated > 0
            ? (run.tokensInput + run.tokensOutput) / locGenerated
            : undefined,
        locPerPrompt:
          locGenerated && run.iterations
            ? locGenerated / run.iterations
            : undefined,
        runtimePerLoc:
          locGenerated > 0
            ? duration / locGenerated
            : undefined,
        runtimePerToken:
          run.tokensInput + run.tokensOutput > 0
            ? duration / (run.tokensInput + run.tokensOutput)
            : 0,
      };

      return {
        runId: run.id,
        agentRole: run.origin || 'developer',
        agentName: `${run.origin || 'developer'} agent`,
        executionNumber: index + 1,
        startedAt: run.startedAt?.toISOString() || '',
        finishedAt: run.finishedAt?.toISOString() || '',
        duration,
        tokensInput: run.tokensInput || 0,
        tokensOutput: run.tokensOutput || 0,
        tokensTotal: (run.tokensInput || 0) + (run.tokensOutput || 0),
        iterations: run.iterations || 0,
        locGenerated: locGenerated,
        success: run.success || false,
        metrics,
        outputs: {
          description: 'Agent execution completed',
        },
      };
    });

    // Calculate summary
    const totalTokens = executions.reduce((sum, e) => sum + e.tokensTotal, 0);
    const totalLoc = executions.reduce(
      (sum, e) => sum + (e.locGenerated || 0),
      0,
    );
    const totalIterations = executions.reduce(
      (sum, e) => sum + e.iterations,
      0,
    );
    const totalTime = executions.reduce((sum, e) => sum + e.duration, 0);

    const summary = {
      storyId: story.id,
      storyKey: story.key,
      storyTitle: story.title,
      status: story.status,
      complexity: story.technicalComplexity || 3,
      epicId: story.epicId,
      epicKey: story.epic?.key ?? null,
      totalExecutions: executions.length,
      executionsByRole: {
        ba: executions.filter((e) => e.agentRole === 'ba').length,
        architect: executions.filter((e) => e.agentRole === 'architect').length,
        developer: executions.filter((e) => e.agentRole === 'developer').length,
        qa: executions.filter((e) => e.agentRole === 'qa').length,
      },
      totalTime,
      totalTokens,
      tokensInput: executions.reduce((sum, e) => sum + e.tokensInput, 0),
      tokensOutput: executions.reduce((sum, e) => sum + e.tokensOutput, 0),
      totalLoc,
      totalIterations,
      aggregateMetrics: {
        tokensPerLoc: totalLoc > 0 ? totalTokens / totalLoc : 0,
        locPerPrompt: totalIterations > 0 ? totalLoc / totalIterations : 0,
        runtimePerLoc: totalLoc > 0 ? totalTime / totalLoc : 0,
        runtimePerToken: totalTokens > 0 ? totalTime / totalTokens : 0,
      },
      costEstimate: (totalTokens / 1000) * this.TOKEN_COST_PER_1K,
    };

    // Transform commits if included
    const commits = dto.includeCommits
      ? story.commits.map((commit: any) => ({
          hash: commit.hash,
          author: commit.author,
          message: commit.message,
          timestamp: commit.timestamp.toISOString(),
          locAdded: commit.files?.reduce((sum: number, f: any) => sum + (f.locAdded || 0), 0) || 0,
          locDeleted: commit.files?.reduce((sum: number, f: any) => sum + (f.locDeleted || 0), 0) || 0,
          filesChanged: commit.files?.map((f: any) => f.filePath) || [],
        }))
      : undefined;

    return {
      story: {
        id: story.id,
        key: story.key,
        title: story.title,
        status: story.status,
        complexity: story.technicalComplexity || 3,
        epic: story.epic
          ? {
              id: story.epic.id,
              key: story.epic.key,
              name: story.epic.title,
            }
          : null,
      },
      executions,
      summary,
      commits,
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Get per-agent analytics
   */
  async getPerAgentAnalytics(
    dto: GetPerAgentMetricsDto,
  ): Promise<PerAgentAnalyticsResponseDto> {
    this.logger.log(
      `Getting per-agent analytics for project ${dto.projectId}`,
    );

    // Implementation would calculate per-agent metrics
    // For now, returning a structured response
    throw new Error('Per-agent analytics not yet implemented');
  }

  /**
   * Get weekly metrics analysis
   */
  async getWeeklyAnalysis(
    dto: GetWeeklyMetricsDto,
  ): Promise<WeeklyAnalysisResponseDto> {
    this.logger.log(`Getting weekly analysis for project ${dto.projectId}`);

    // Implementation would calculate week-by-week metrics
    // For now, returning a structured response
    throw new Error('Weekly analysis not yet implemented');
  }
}
