import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface WorkflowRunStatus {
  runId: string;
  workflowId: string;
  workflowName: string;
  coordinatorName: string;
  status: string;
  startedAt: string;
  completedAt?: string;
  errorMessage?: string;
  context: any;
  metrics: {
    totalTokens: number | null;
    totalCost: number | null;
    totalDuration: number | null;
    totalUserPrompts: number | null;
    totalIterations: number | null;
    totalInterventions: number | null;
    componentsCompleted: number;
    componentsTotal: number;
    percentComplete: number;
  };
  componentRuns: Array<{
    componentRunId: string;
    componentName: string;
    status: string;
    startedAt: string;
    completedAt?: string;
    durationSeconds?: number;
    tokensUsed?: number;
    userPrompts: number;
    artifacts: string[];
  }>;
}

export interface ArtifactInfo {
  s3Key: string;
  artifactType: string;
  filename: string;
  format: string;
  size: number;
  uploadedAt: string;
  downloadUrl?: string;
  data?: any; // Temporary until S3 is set up
}

@Injectable()
export class WorkflowStateService {
  constructor(private prisma: PrismaService) {}

  /**
   * Get workflow run status with full details
   */
  async getWorkflowRunStatus(runId: string): Promise<WorkflowRunStatus> {
    const workflowRun = await this.prisma.workflowRun.findUnique({
      where: { id: runId },
      include: {
        workflow: true,
        coordinator: true,
        componentRuns: {
          include: {
            component: true,
          },
          orderBy: {
            startedAt: 'asc',
          },
        },
      },
    });

    if (!workflowRun) {
      throw new Error(`Workflow run with ID ${runId} not found`);
    }

    const coordinatorComponentIds = workflowRun.coordinator.componentIds || [];
    const componentsCompleted = workflowRun.componentRuns.filter(
      (cr) => cr.status === 'completed' || cr.status === 'failed'
    ).length;
    const percentComplete = coordinatorComponentIds.length
      ? Math.round((componentsCompleted / coordinatorComponentIds.length) * 100)
      : 0;

    return {
      runId: workflowRun.id,
      workflowId: workflowRun.workflowId,
      workflowName: workflowRun.workflow.name,
      coordinatorName: workflowRun.coordinator.name,
      status: workflowRun.status,
      startedAt: workflowRun.startedAt.toISOString(),
      completedAt: workflowRun.completedAt?.toISOString(),
      errorMessage: workflowRun.errorMessage || undefined,
      context: workflowRun.context,
      metrics: {
        totalTokens: workflowRun.totalTokensUsed,
        totalCost: workflowRun.totalCostUsd ? Number(workflowRun.totalCostUsd) : null,
        totalDuration: workflowRun.totalDurationSeconds,
        totalUserPrompts: workflowRun.totalUserPrompts,
        totalIterations: workflowRun.totalIterations,
        totalInterventions: workflowRun.totalInterventions,
        componentsCompleted,
        componentsTotal: coordinatorComponentIds.length,
        percentComplete,
      },
      componentRuns: workflowRun.componentRuns.map((cr) => ({
        componentRunId: cr.id,
        componentName: cr.component.name,
        status: cr.status,
        startedAt: cr.startedAt.toISOString(),
        completedAt: cr.completedAt?.toISOString(),
        durationSeconds: cr.durationSeconds || undefined,
        tokensUsed: cr.tokensUsed || undefined,
        userPrompts: cr.userPrompts || 0,
        artifacts: (cr.artifactsS3Keys as string[]) || [],
      })),
    };
  }

  /**
   * Get artifacts for a workflow run
   */
  async getWorkflowArtifacts(runId: string): Promise<ArtifactInfo[]> {
    const componentRuns = await this.prisma.componentRun.findMany({
      where: {
        workflowRunId: runId,
      },
      include: {
        component: true,
      },
    });

    const artifacts: ArtifactInfo[] = [];

    for (const cr of componentRuns) {
      // Extract artifacts from output (temporary until S3 is set up)
      const output = cr.output as any;
      if (output?.artifacts && Array.isArray(output.artifacts)) {
        artifacts.push(
          ...output.artifacts.map((artifact: any) => ({
            s3Key: artifact.s3Key,
            artifactType: artifact.artifactType,
            filename: artifact.filename,
            format: artifact.format,
            size: artifact.size,
            uploadedAt: artifact.uploadedAt,
            downloadUrl: artifact.downloadUrl || undefined,
            data: artifact.data, // Temporary
          }))
        );
      }
    }

    return artifacts;
  }

  /**
   * Get artifact by S3 key
   */
  async getArtifact(runId: string, s3Key: string): Promise<ArtifactInfo | null> {
    const artifacts = await this.getWorkflowArtifacts(runId);
    return artifacts.find((a) => a.s3Key === s3Key) || null;
  }

  /**
   * Get workflow context (for REST API endpoint)
   */
  async getWorkflowContext(runId: string) {
    const workflowRun = await this.prisma.workflowRun.findUnique({
      where: { id: runId },
      include: {
        workflow: true,
        coordinator: true,
        componentRuns: {
          include: {
            component: true,
          },
          where: {
            status: { in: ['completed', 'failed'] },
          },
          orderBy: {
            startedAt: 'asc',
          },
        },
      },
    });

    if (!workflowRun) {
      throw new Error(`Workflow run with ID ${runId} not found`);
    }

    const coordinatorComponentIds = workflowRun.coordinator.componentIds || [];
    const completedComponentIds = workflowRun.componentRuns.map((cr) => cr.componentId);
    const remainingComponentIds = coordinatorComponentIds.filter((id) => !completedComponentIds.includes(id));

    const remainingComponents = await this.prisma.component.findMany({
      where: {
        id: { in: remainingComponentIds },
      },
      select: {
        id: true,
        name: true,
        description: true,
      },
    });

    return {
      runId: workflowRun.id,
      workflowId: workflowRun.workflowId,
      workflowName: workflowRun.workflow.name,
      status: workflowRun.status,
      context: workflowRun.context,
      coordinatorStrategy: workflowRun.coordinator.decisionStrategy,
      completedComponents: workflowRun.componentRuns.map((cr) => ({
        componentRunId: cr.id,
        componentId: cr.componentId,
        componentName: cr.component.name,
        status: cr.status,
        output: cr.output,
        startedAt: cr.startedAt.toISOString(),
        completedAt: cr.completedAt?.toISOString(),
      })),
      remainingComponents: remainingComponents.map((c, index) => ({
        componentId: c.id,
        componentName: c.name,
        description: c.description,
        order: workflowRun.componentRuns.length + index + 1,
      })),
      aggregatedMetrics: {
        totalTokens: workflowRun.totalTokensUsed,
        totalCost: workflowRun.totalCostUsd ? Number(workflowRun.totalCostUsd) : null,
        totalDuration: workflowRun.totalDurationSeconds,
        componentsCompleted: workflowRun.componentRuns.length,
        componentsTotal: coordinatorComponentIds.length,
      },
    };
  }

  /**
   * List workflow runs for a project
   */
  async listWorkflowRuns(projectId: string, options?: { limit?: number; offset?: number; status?: string }) {
    const where: any = { projectId };
    if (options?.status) {
      where.status = options.status;
    }

    const [runs, total] = await Promise.all([
      this.prisma.workflowRun.findMany({
        where,
        include: {
          workflow: true,
          coordinator: true,
          _count: {
            select: {
              componentRuns: true,
            },
          },
        },
        orderBy: {
          startedAt: 'desc',
        },
        take: options?.limit || 50,
        skip: options?.offset || 0,
      }),
      this.prisma.workflowRun.count({ where }),
    ]);

    return {
      runs: runs.map((run) => ({
        runId: run.id,
        workflowId: run.workflowId,
        workflowName: run.workflow.name,
        coordinatorName: run.coordinator.name,
        status: run.status,
        startedAt: run.startedAt.toISOString(),
        completedAt: run.completedAt?.toISOString(),
        totalTokens: run.totalTokensUsed,
        totalCost: run.totalCostUsd ? Number(run.totalCostUsd) : null,
        componentRunsCount: run._count.componentRuns,
      })),
      total,
      limit: options?.limit || 50,
      offset: options?.offset || 0,
    };
  }
}
