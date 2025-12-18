import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { RunStatus } from '@prisma/client';
import { getErrorMessage } from '../common';
import { WorkflowStateService } from '../execution/workflow-state.service';
import { PrismaService } from '../prisma/prisma.service';
import { parseComponentSummary } from '../types/component-summary.types';
import { AppWebSocketGateway } from '../websocket/websocket.gateway';
import {
  CreateWorkflowRunDto,
  UpdateWorkflowRunDto,
  WorkflowRunResponseDto,
  ComponentRunSummaryDto,
} from './dto';

@Injectable()
export class WorkflowRunsService {
  constructor(
    private prisma: PrismaService,
    private workflowStateService: WorkflowStateService,
    private websocketGateway: AppWebSocketGateway,
  ) {}

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
        status: createDto.status || RunStatus.pending,
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

    // ST-108: Broadcast workflow started event
    if (workflowRun.story) {
      this.websocketGateway.broadcastWorkflowStarted(workflowRun.id, projectId, {
        runId: workflowRun.id,
        storyId: workflowRun.storyId,
        storyKey: workflowRun.story.key,
        storyTitle: workflowRun.story.title,
        triggeredBy: createDto.status || 'system',
        startedAt: workflowRun.startedAt.toISOString(),
        projectId,
      });
    }

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
                states: {
                  select: {
                    id: true,
                    name: true,
                    order: true,
                    componentId: true,
                    preExecutionInstructions: true,
                    postExecutionInstructions: true,
                    mandatory: true,
                    requiresApproval: true,
                    runLocation: true,
                    offlineFallback: true,
                  },
                  orderBy: {
                    order: 'asc',
                  },
                },
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

    // ST-108: Broadcast workflow status update (completed/failed)
    if (updateDto.status && workflowRun.story &&
        (updateDto.status === RunStatus.completed || updateDto.status === RunStatus.failed)) {
      this.websocketGateway.broadcastWorkflowStatusUpdated(workflowRun.id, existingRun.projectId, {
        runId: workflowRun.id,
        storyId: workflowRun.storyId,
        storyKey: workflowRun.story.key,
        status: updateDto.status,
        completedAt: workflowRun.finishedAt?.toISOString(),
        error: updateDto.errorMessage,
        projectId: existingRun.projectId,
      });
    }

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

    // ST-147: Aggregate session telemetry across all component runs
    const totalTurns = workflowRun.componentRuns.reduce(
      (sum, cr) => sum + (cr.totalTurns || 0),
      0,
    );
    const totalManualPrompts = workflowRun.componentRuns.reduce(
      (sum, cr) => sum + (cr.manualPrompts || 0),
      0,
    );
    const totalAutoContinues = workflowRun.componentRuns.reduce(
      (sum, cr) => sum + (cr.autoContinues || 0),
      0,
    );
    const automationRate =
      totalTurns > 0 ? Math.round((totalAutoContinues / totalTurns) * 100) : 0;

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
      // ST-147: Session telemetry aggregates
      totalTurns,
      totalManualPrompts,
      totalAutoContinues,
      automationRate,
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
        // ST-147: Session telemetry per component
        totalTurns: run.totalTurns,
        manualPrompts: run.manualPrompts,
        autoContinues: run.autoContinues,
      })),
      summary,
      efficiency,
      coordinatorDecisions: workflowRun.coordinatorDecisions,
    };
  }

  /**
   * Get execution status with full details (for real-time monitoring)
   */
  async getStatus(id: string): Promise<any> {
    try {
      return await this.workflowStateService.getWorkflowRunStatus(id);
    } catch (error) {
      throw new NotFoundException(getErrorMessage(error));
    }
  }

  /**
   * Get artifacts for a workflow run
   * ST-168: Returns array directly (not wrapped object) to match frontend expectations
   */
  async getArtifacts(id: string, includeContent = false, definitionKey?: string): Promise<any[]> {
    try {
      const artifacts = await this.workflowStateService.getWorkflowArtifacts(id, includeContent);

      // Filter by definitionKey if provided
      if (definitionKey) {
        return artifacts.filter(a => a.definitionKey === definitionKey);
      }

      return artifacts;
    } catch (error) {
      throw new NotFoundException(getErrorMessage(error));
    }
  }

  /**
   * Get artifact access rules (expected artifacts per state)
   * ST-168: Returns what artifacts each state should read/write
   */
  async getArtifactAccess(id: string): Promise<Record<string, any[]>> {
    try {
      return await this.workflowStateService.getArtifactAccess(id);
    } catch (error) {
      throw new NotFoundException(getErrorMessage(error));
    }
  }

  /**
   * Get workflow context (for coordinator decisions)
   */
  async getContext(id: string): Promise<any> {
    try {
      return await this.workflowStateService.getWorkflowContext(id);
    } catch (error) {
      throw new NotFoundException(getErrorMessage(error));
    }
  }

  /**
   * Get active workflow run for a project (for global tracking bar)
   * Returns null if no workflow is currently running
   */
  async getActiveWorkflowForProject(projectId: string): Promise<any | null> {
    // Find the most recent workflow run that is running or pending
    const workflowRun = await this.prisma.workflowRun.findFirst({
      where: {
        projectId,
        status: {
          in: [RunStatus.running, RunStatus.pending],
        },
      },
      include: {
        workflow: true,
        story: {
          select: {
            id: true,
            key: true,
            title: true,
            type: true,
          },
        },
        epic: {
          select: {
            id: true,
            key: true,
            title: true,
          },
        },
        componentRuns: {
          include: {
            component: {
              select: {
                id: true,
                name: true,
              },
            },
          },
          orderBy: {
            executionOrder: 'asc',
          },
        },
      },
      orderBy: {
        startedAt: 'desc',
      },
    });

    if (!workflowRun) {
      return null;
    }

    // Calculate progress
    const totalComponents = await this.prisma.componentRun.count({
      where: {
        workflowRunId: workflowRun.id,
      },
    });

    const completedComponents = workflowRun.componentRuns.filter(
      (run) => run.status === RunStatus.completed,
    ).length;

    // Find currently running component
    const activeComponent = workflowRun.componentRuns.find(
      (run) => run.status === RunStatus.running,
    );

    const percentComplete =
      totalComponents > 0 ? Math.round((completedComponents / totalComponents) * 100) : 0;

    // Determine story key and title (could be from story or epic)
    const storyKey = workflowRun.story?.key || workflowRun.epic?.key || null;
    const storyTitle = workflowRun.story?.title || workflowRun.epic?.title || null;

    return {
      runId: workflowRun.id,
      status: workflowRun.status,
      storyKey,
      storyTitle,
      activeComponentName: activeComponent?.component?.name || null,
      progress: {
        completed: completedComponents,
        total: totalComponents,
        percentage: percentComplete,
      },
      startedAt: workflowRun.startedAt?.toISOString(),
      estimatedCost: workflowRun.estimatedCost,
    };
  }

  /**
   * ST-217: Update artifact content with version history
   */
  async updateArtifactContent(
    artifactId: string,
    content: string,
    workflowRunId?: string,
  ): Promise<any> {
    const artifact = await this.prisma.artifact.findUnique({
      where: { id: artifactId },
      include: { definition: true },
    });

    if (!artifact) {
      throw new NotFoundException(`Artifact not found: ${artifactId}`);
    }

    // Calculate new hash to check for duplicate content
    const crypto = await import('crypto');
    const contentHash = crypto.createHash('sha256').update(content, 'utf8').digest('hex');

    // Skip update if content hasn't changed
    if (artifact.contentHash === contentHash) {
      return {
        id: artifact.id,
        definitionId: artifact.definitionId,
        definitionKey: artifact.definition.key,
        definitionName: artifact.definition.name,
        type: artifact.definition.type,
        workflowRunId: artifact.workflowRunId,
        version: artifact.currentVersion,
        content: artifact.content,
        contentPreview: artifact.content?.substring(0, 500) || null,
        contentType: artifact.contentType,
        size: artifact.size,
        createdAt: artifact.createdAt.toISOString(),
        updatedAt: artifact.updatedAt.toISOString(),
        createdBy: null,
        skipped: true,
        message: 'Content unchanged, no new version created',
      };
    }

    const size = Buffer.byteLength(content, 'utf8');
    const newVersion = artifact.currentVersion + 1;

    // Use transaction for atomic update
    const updatedArtifact = await this.prisma.$transaction(async (tx) => {
      // Update the artifact
      const updated = await tx.artifact.update({
        where: { id: artifactId },
        data: {
          content,
          contentHash,
          size,
          currentVersion: newVersion,
          lastUpdatedRunId: workflowRunId,
        },
        include: { definition: true },
      });

      // Create version history entry
      await tx.artifactVersion.create({
        data: {
          artifactId,
          version: newVersion,
          workflowRunId,
          content,
          contentHash,
          contentType: artifact.contentType,
          size,
        },
      });

      return updated;
    });

    return {
      id: updatedArtifact.id,
      definitionId: updatedArtifact.definitionId,
      definitionKey: updatedArtifact.definition.key,
      definitionName: updatedArtifact.definition.name,
      type: updatedArtifact.definition.type,
      workflowRunId: updatedArtifact.workflowRunId,
      version: updatedArtifact.currentVersion,
      content: updatedArtifact.content,
      contentPreview: updatedArtifact.content?.substring(0, 500) || null,
      contentType: updatedArtifact.contentType,
      size: updatedArtifact.size,
      createdAt: updatedArtifact.createdAt.toISOString(),
      updatedAt: updatedArtifact.updatedAt.toISOString(),
      createdBy: null,
    };
  }

  // ==========================================================================
  // ST-173: Validation Helpers for Transcript Endpoints
  // ==========================================================================

  /**
   * Find project and verify user has access to it
   * Used by transcript endpoints for IDOR protection
   */
  async findProjectWithAccess(projectId: string, userId: string): Promise<{ id: string } | null> {
    // For now, we just verify the project exists
    // In a full implementation, this would check user permissions via ProjectMember table
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true },
    });

    return project;
  }

  /**
   * Find workflow run and return with projectId for validation
   * Used by transcript endpoints for IDOR protection
   */
  async findRunWithProject(runId: string): Promise<{ id: string; projectId: string } | null> {
    const run = await this.prisma.workflowRun.findUnique({
      where: { id: runId },
      select: { id: true, projectId: true },
    });

    return run;
  }

  /**
   * Find artifact and return with workflowRunId for validation
   * Used by transcript endpoints for IDOR protection
   */
  async findArtifactWithRun(artifactId: string): Promise<{ id: string; workflowRunId: string } | null> {
    const artifact = await this.prisma.artifact.findUnique({
      where: { id: artifactId },
      select: { id: true, workflowRunId: true },
    });

    return artifact;
  }

  private mapToResponseDto(workflowRun: any): WorkflowRunResponseDto {
    return {
      id: workflowRun.id,
      projectId: workflowRun.projectId,
      workflowId: workflowRun.workflowId,
      storyId: workflowRun.storyId,
      epicId: workflowRun.epicId,
      startedAt: workflowRun.startedAt?.toISOString() || new Date().toISOString(),
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
      coordinatorMetrics: workflowRun.coordinatorMetrics,
      createdAt: workflowRun.createdAt?.toISOString() || workflowRun.startedAt?.toISOString() || new Date().toISOString(),
      updatedAt: workflowRun.updatedAt?.toISOString() || workflowRun.finishedAt?.toISOString() || new Date().toISOString(),
      workflow: workflowRun.workflow,
      story: workflowRun.story,
      // Expose states at top level for frontend workflow-viz components
      states: workflowRun.workflow?.states || [],
      // ST-182: Master transcript paths for live streaming
      masterTranscriptPaths: workflowRun.masterTranscriptPaths || [],
      // ST-182: Spawned agent transcripts for live streaming
      spawnedAgentTranscripts: (workflowRun.metadata as any)?.spawnedAgentTranscripts || [],
      // ST-182: Currently executing agent ID
      executingAgentId: (workflowRun.metadata as any)?.executingAgentId,
      componentRuns: workflowRun.componentRuns?.map((run: any) => ({
        id: run.id,
        componentId: run.componentId,
        componentName: run.component?.name,
        executionOrder: run.executionOrder, // ST-57: 0 for orchestrator, 1+ for components
        startedAt: run.startedAt?.toISOString() || new Date().toISOString(),
        finishedAt: run.finishedAt?.toISOString(),
        durationSeconds: run.durationSeconds,
        tokensInput: run.tokensInput, // ST-57: Input tokens
        tokensOutput: run.tokensOutput, // ST-57: Output tokens
        totalTokens: run.totalTokens,
        cost: run.cost, // ST-57: Cost in USD
        toolCalls: run.toolCalls, // ST-57: Number of tool calls
        locGenerated: run.locGenerated,
        status: run.status,
        success: run.success,
        // ST-195: Add output, componentSummary, and errorMessage for Results Summary view
        output: run.outputData,
        // ST-203: Parse componentSummary JSON to structured object
        componentSummary: run.componentSummary ? parseComponentSummary(run.componentSummary) : null,
        errorMessage: run.errorMessage,
      })),
    };
  }
}
