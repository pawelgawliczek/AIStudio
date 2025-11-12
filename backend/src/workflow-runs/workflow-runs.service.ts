import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateWorkflowRunDto,
  UpdateWorkflowRunDto,
  WorkflowRunResponseDto,
  ComponentRunSummaryDto,
  RunStatus,
} from './dto';

@Injectable()
export class WorkflowRunsService {
  constructor(private prisma: PrismaService) {}

  async create(
    projectId: string,
    createDto: CreateWorkflowRunDto,
  ): Promise<WorkflowRunResponseDto> {
    // Verify workflow exists and belongs to project
    const workflow = await this.prisma.workflow.findFirst({
      where: {
        id: createDto.workflowId,
        projectId,
      },
    });

    if (!workflow) {
      throw new BadRequestException('Workflow not found or does not belong to this project');
    }

    // Create workflow run
    const workflowRun = await this.prisma.workflowRun.create({
      data: {
        projectId,
        workflowId: createDto.workflowId,
        storyId: createDto.storyId,
        epicId: createDto.epicId,
        startedAt: new Date(createDto.startedAt),
        finishedAt: createDto.finishedAt ? new Date(createDto.finishedAt) : null,
        durationSeconds: createDto.durationSeconds,
        totalUserPrompts: createDto.totalUserPrompts,
        totalIterations: createDto.totalIterations,
        totalInterventions: createDto.totalInterventions,
        avgPromptsPerComponent: createDto.avgPromptsPerComponent,
        totalTokensInput: createDto.totalTokensInput,
        totalTokensOutput: createDto.totalTokensOutput,
        totalTokens: createDto.totalTokens,
        totalLocGenerated: createDto.totalLocGenerated,
        estimatedCost: createDto.estimatedCost,
        status: createDto.status || RunStatus.PENDING,
        errorMessage: createDto.errorMessage,
        coordinatorDecisions: createDto.coordinatorDecisions,
      },
      include: {
        workflow: {
          select: {
            id: true,
            name: true,
            version: true,
          },
        },
        story: {
          select: {
            id: true,
            key: true,
            title: true,
          },
        },
      },
    });

    return this.mapToResponseDto(workflowRun);
  }

  async findAll(
    projectId: string,
    options: {
      workflowId?: string;
      storyId?: string;
      status?: RunStatus;
      includeRelations?: boolean;
    } = {},
  ): Promise<WorkflowRunResponseDto[]> {
    const where: any = { projectId };

    if (options.workflowId) {
      where.workflowId = options.workflowId;
    }

    if (options.storyId) {
      where.storyId = options.storyId;
    }

    if (options.status) {
      where.status = options.status;
    }

    const workflowRuns = await this.prisma.workflowRun.findMany({
      where,
      include: {
        workflow: options.includeRelations
          ? {
              select: {
                id: true,
                name: true,
                version: true,
              },
            }
          : false,
        story: options.includeRelations
          ? {
              select: {
                id: true,
                key: true,
                title: true,
              },
            }
          : false,
        componentRuns: options.includeRelations
          ? {
              include: {
                component: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            }
          : false,
      },
      orderBy: {
        startedAt: 'desc',
      },
    });

    return workflowRuns.map((run) => this.mapToResponseDto(run));
  }

  async findOne(id: string, includeRelations = false): Promise<WorkflowRunResponseDto> {
    const workflowRun = await this.prisma.workflowRun.findUnique({
      where: { id },
      include: {
        workflow: includeRelations
          ? {
              select: {
                id: true,
                name: true,
                version: true,
              },
            }
          : false,
        story: includeRelations
          ? {
              select: {
                id: true,
                key: true,
                title: true,
              },
            }
          : false,
        componentRuns: includeRelations
          ? {
              include: {
                component: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
              orderBy: {
                startedAt: 'asc',
              },
            }
          : false,
      },
    });

    if (!workflowRun) {
      throw new NotFoundException('Workflow run not found');
    }

    return this.mapToResponseDto(workflowRun);
  }

  async update(
    id: string,
    updateDto: UpdateWorkflowRunDto,
  ): Promise<WorkflowRunResponseDto> {
    const existingRun = await this.prisma.workflowRun.findUnique({
      where: { id },
    });

    if (!existingRun) {
      throw new NotFoundException('Workflow run not found');
    }

    const workflowRun = await this.prisma.workflowRun.update({
      where: { id },
      data: {
        finishedAt: updateDto.finishedAt ? new Date(updateDto.finishedAt) : undefined,
        durationSeconds: updateDto.durationSeconds,
        totalUserPrompts: updateDto.totalUserPrompts,
        totalIterations: updateDto.totalIterations,
        totalInterventions: updateDto.totalInterventions,
        avgPromptsPerComponent: updateDto.avgPromptsPerComponent,
        totalTokensInput: updateDto.totalTokensInput,
        totalTokensOutput: updateDto.totalTokensOutput,
        totalTokens: updateDto.totalTokens,
        totalLocGenerated: updateDto.totalLocGenerated,
        estimatedCost: updateDto.estimatedCost,
        status: updateDto.status,
        errorMessage: updateDto.errorMessage,
        coordinatorDecisions: updateDto.coordinatorDecisions,
      },
      include: {
        workflow: {
          select: {
            id: true,
            name: true,
            version: true,
          },
        },
        story: {
          select: {
            id: true,
            key: true,
            title: true,
          },
        },
      },
    });

    return this.mapToResponseDto(workflowRun);
  }

  async remove(id: string): Promise<void> {
    const workflowRun = await this.prisma.workflowRun.findUnique({
      where: { id },
      include: {
        componentRuns: {
          select: { id: true },
        },
      },
    });

    if (!workflowRun) {
      throw new NotFoundException('Workflow run not found');
    }

    // Delete component runs first (cascade)
    if (workflowRun.componentRuns.length > 0) {
      await this.prisma.componentRun.deleteMany({
        where: {
          workflowRunId: id,
        },
      });
    }

    // Delete workflow run
    await this.prisma.workflowRun.delete({
      where: { id },
    });
  }

  /**
   * Get detailed results for a workflow run including all component runs
   */
  async getResults(id: string): Promise<any> {
    const workflowRun = await this.prisma.workflowRun.findUnique({
      where: { id },
      include: {
        workflow: {
          select: {
            id: true,
            name: true,
            version: true,
            description: true,
          },
        },
        story: {
          select: {
            id: true,
            key: true,
            title: true,
            description: true,
          },
        },
        componentRuns: {
          include: {
            component: {
              select: {
                id: true,
                name: true,
                description: true,
                tags: true,
              },
            },
          },
          orderBy: {
            startedAt: 'asc',
          },
        },
      },
    });

    if (!workflowRun) {
      throw new NotFoundException('Workflow run not found');
    }

    // Calculate summary metrics
    const summary = {
      totalComponentRuns: workflowRun.componentRuns.length,
      successfulRuns: workflowRun.componentRuns.filter((r) => r.success).length,
      failedRuns: workflowRun.componentRuns.filter((r) => !r.success).length,
      totalDuration: workflowRun.durationSeconds,
      totalTokens: workflowRun.totalTokens,
      totalLoc: workflowRun.totalLocGenerated,
      totalIterations: workflowRun.totalIterations,
      estimatedCost: workflowRun.estimatedCost,
    };

    // Calculate efficiency metrics
    const efficiency = {
      tokensPerLoc: workflowRun.totalLocGenerated && workflowRun.totalTokens
        ? (workflowRun.totalTokens / workflowRun.totalLocGenerated).toFixed(2)
        : null,
      locPerPrompt: workflowRun.totalLocGenerated && workflowRun.totalIterations
        ? (workflowRun.totalLocGenerated / workflowRun.totalIterations).toFixed(2)
        : null,
      runtimePerLoc: workflowRun.totalLocGenerated && workflowRun.durationSeconds
        ? (workflowRun.durationSeconds / workflowRun.totalLocGenerated).toFixed(2)
        : null,
      runtimePerToken: workflowRun.totalTokens && workflowRun.durationSeconds
        ? (workflowRun.durationSeconds / workflowRun.totalTokens).toFixed(4)
        : null,
    };

    return {
      workflowRun: this.mapToResponseDto(workflowRun),
      componentRuns: workflowRun.componentRuns.map((run) => ({
        id: run.id,
        componentId: run.componentId,
        componentName: run.component.name,
        componentDescription: run.component.description,
        startedAt: run.startedAt.toISOString(),
        finishedAt: run.finishedAt?.toISOString(),
        durationSeconds: run.durationSeconds,
        userPrompts: run.userPrompts,
        systemIterations: run.systemIterations,
        tokensInput: run.tokensInput,
        tokensOutput: run.tokensOutput,
        totalTokens: run.totalTokens,
        locGenerated: run.locGenerated,
        filesModified: run.filesModified,
        commits: run.commits,
        tokensPerLoc: run.tokensPerLoc,
        locPerPrompt: run.locPerPrompt,
        runtimePerLoc: run.runtimePerLoc,
        runtimePerToken: run.runtimePerToken,
        status: run.status,
        success: run.success,
        errorMessage: run.errorMessage,
        output: run.output,
      })),
      summary,
      efficiency,
      coordinatorDecisions: workflowRun.coordinatorDecisions,
    };
  }

  private mapToResponseDto(workflowRun: any): WorkflowRunResponseDto {
    return {
      id: workflowRun.id,
      projectId: workflowRun.projectId,
      workflowId: workflowRun.workflowId,
      storyId: workflowRun.storyId,
      epicId: workflowRun.epicId,
      startedAt: workflowRun.startedAt.toISOString(),
      finishedAt: workflowRun.finishedAt?.toISOString(),
      durationSeconds: workflowRun.durationSeconds,
      totalUserPrompts: workflowRun.totalUserPrompts,
      totalIterations: workflowRun.totalIterations,
      totalInterventions: workflowRun.totalInterventions,
      avgPromptsPerComponent: workflowRun.avgPromptsPerComponent,
      totalTokensInput: workflowRun.totalTokensInput,
      totalTokensOutput: workflowRun.totalTokensOutput,
      totalTokens: workflowRun.totalTokens,
      totalLocGenerated: workflowRun.totalLocGenerated,
      estimatedCost: workflowRun.estimatedCost,
      status: workflowRun.status,
      errorMessage: workflowRun.errorMessage,
      coordinatorDecisions: workflowRun.coordinatorDecisions,
      createdAt: workflowRun.createdAt.toISOString(),
      updatedAt: workflowRun.updatedAt.toISOString(),
      workflow: workflowRun.workflow,
      story: workflowRun.story,
      componentRuns: workflowRun.componentRuns?.map((run: any) => ({
        id: run.id,
        componentId: run.componentId,
        componentName: run.component?.name,
        startedAt: run.startedAt.toISOString(),
        finishedAt: run.finishedAt?.toISOString(),
        durationSeconds: run.durationSeconds,
        totalTokens: run.totalTokens,
        locGenerated: run.locGenerated,
        status: run.status,
        success: run.success,
      })),
    };
  }
}
