import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRunDto, RunResponseDto } from './dto';

@Injectable()
export class RunsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Create a new run (agent execution)
   */
  async create(createRunDto: CreateRunDto): Promise<RunResponseDto> {
    const run = await this.prisma.run.create({
      data: {
        projectId: createRunDto.projectId,
        storyId: createRunDto.storyId,
        subtaskId: createRunDto.subtaskId,
        agentId: createRunDto.agentId,
        frameworkId: createRunDto.frameworkId,
        origin: createRunDto.origin,
        tokensInput: createRunDto.tokensInput,
        tokensOutput: createRunDto.tokensOutput,
        startedAt: new Date(createRunDto.startedAt),
        finishedAt: createRunDto.finishedAt ? new Date(createRunDto.finishedAt) : null,
        success: createRunDto.success ?? true,
        errorType: createRunDto.errorType,
        iterations: createRunDto.iterations ?? 1,
        metadata: createRunDto.metadata,
      },
      include: {
        project: true,
        story: true,
        subtask: true,
        agent: true,
        framework: true,
      },
    });

    return run as RunResponseDto;
  }

  /**
   * Get all runs for a project
   */
  async findByProject(projectId: string, includeRelations = false): Promise<RunResponseDto[]> {
    const runs = await this.prisma.run.findMany({
      where: { projectId },
      include: includeRelations ? {
        project: true,
        story: true,
        subtask: true,
        agent: true,
        framework: true,
      } : undefined,
      orderBy: { startedAt: 'desc' },
    });

    return runs as RunResponseDto[];
  }

  /**
   * Get all runs for a story
   */
  async findByStory(storyId: string, includeRelations = false): Promise<RunResponseDto[]> {
    const runs = await this.prisma.run.findMany({
      where: { storyId },
      include: includeRelations ? {
        project: true,
        story: true,
        subtask: true,
        agent: true,
        framework: true,
      } : undefined,
      orderBy: { startedAt: 'desc' },
    });

    return runs as RunResponseDto[];
  }

  /**
   * Get all runs for a framework
   */
  async findByFramework(frameworkId: string, includeRelations = false): Promise<RunResponseDto[]> {
    const runs = await this.prisma.run.findMany({
      where: { frameworkId },
      include: includeRelations ? {
        project: true,
        story: true,
        subtask: true,
        agent: true,
        framework: true,
      } : undefined,
      orderBy: { startedAt: 'desc' },
    });

    return runs as RunResponseDto[];
  }

  /**
   * Get a single run by ID
   */
  async findOne(id: string): Promise<RunResponseDto> {
    const run = await this.prisma.run.findUnique({
      where: { id },
      include: {
        project: true,
        story: true,
        subtask: true,
        agent: true,
        framework: true,
      },
    });

    if (!run) {
      throw new NotFoundException(`Run with ID ${id} not found`);
    }

    return run as RunResponseDto;
  }

  /**
   * Get run statistics for a project
   */
  async getProjectStatistics(projectId: string) {
    const [totalRuns, successfulRuns, totalTokens, avgIterations] = await Promise.all([
      this.prisma.run.count({ where: { projectId } }),
      this.prisma.run.count({ where: { projectId, success: true } }),
      this.prisma.run.aggregate({
        where: { projectId },
        _sum: {
          tokensInput: true,
          tokensOutput: true,
        },
      }),
      this.prisma.run.aggregate({
        where: { projectId },
        _avg: {
          iterations: true,
        },
      }),
    ]);

    return {
      totalRuns,
      successfulRuns,
      failedRuns: totalRuns - successfulRuns,
      totalTokensInput: totalTokens._sum.tokensInput || 0,
      totalTokensOutput: totalTokens._sum.tokensOutput || 0,
      totalTokens: (totalTokens._sum.tokensInput || 0) + (totalTokens._sum.tokensOutput || 0),
      avgIterations: avgIterations._avg.iterations || 0,
    };
  }

  /**
   * Get run statistics for a story
   */
  async getStoryStatistics(storyId: string) {
    const [totalRuns, successfulRuns, totalTokens, avgIterations, totalDuration] = await Promise.all([
      this.prisma.run.count({ where: { storyId } }),
      this.prisma.run.count({ where: { storyId, success: true } }),
      this.prisma.run.aggregate({
        where: { storyId },
        _sum: {
          tokensInput: true,
          tokensOutput: true,
        },
      }),
      this.prisma.run.aggregate({
        where: { storyId },
        _avg: {
          iterations: true,
        },
      }),
      this.prisma.$queryRaw`
        SELECT SUM(EXTRACT(EPOCH FROM (finished_at - started_at))) as total_seconds
        FROM runs
        WHERE story_id = ${storyId}::uuid AND finished_at IS NOT NULL
      `,
    ]);

    const durationSeconds = (totalDuration as any)?.[0]?.total_seconds || 0;

    return {
      totalRuns,
      successfulRuns,
      failedRuns: totalRuns - successfulRuns,
      totalTokensInput: totalTokens._sum.tokensInput || 0,
      totalTokensOutput: totalTokens._sum.tokensOutput || 0,
      totalTokens: (totalTokens._sum.tokensInput || 0) + (totalTokens._sum.tokensOutput || 0),
      avgIterations: avgIterations._avg.iterations || 0,
      totalDurationMinutes: Math.round(durationSeconds / 60),
    };
  }
}
