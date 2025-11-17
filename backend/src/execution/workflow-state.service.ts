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
  metrics: {
    totalTokens: number | null;
    // ST-27 Token Breakdown
    totalInputTokens: number;
    totalOutputTokens: number;
    totalCacheRead: number;
    totalCacheWrite: number;
    // Cache Performance
    totalCacheHits: number;
    totalCacheMisses: number;
    avgCacheHitRate: number;
    // Cost Metrics
    totalCost: number | null;
    costPerLOC: number;
    // Code Impact
    totalLinesAdded: number;
    totalLinesDeleted: number;
    totalLinesModified: number;
    totalLocGenerated: number | null;
    totalTestsAdded: number | null;
    // Efficiency Ratios
    tokensPerLOC: number;
    // Execution Metrics
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
    // ST-27 Enhanced Metrics
    tokensInput?: number;
    tokensOutput?: number;
    tokensCacheRead?: number;
    tokensCacheWrite?: number;
    cacheHits?: number;
    cacheMisses?: number;
    cacheHitRate?: number;
    // Quality & Behavior
    userPrompts: number;
    systemIterations?: number;
    humanInterventions?: number;
    errorRate?: number;
    successRate?: number;
    // Code Impact
    linesAdded?: number;
    linesDeleted?: number;
    linesModified?: number;
    locGenerated?: number;
    testsAdded?: number;
    filesModified?: string[];
    // Cost & Performance
    cost?: number;
    costBreakdown?: any;
    tokensPerSecond?: number;
    timeToFirstToken?: number;
    modelId?: string;
    temperature?: number;
    // Tool Usage
    toolBreakdown?: any;
    // Artifacts & Content
    artifacts: any[];
    inputData?: any;
    outputData?: any;
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

    const coordinatorComponentIds = workflowRun.coordinator?.componentIds || [];
    const componentsCompleted = workflowRun.componentRuns.filter(
      (cr) => cr.status === 'completed' || cr.status === 'failed'
    ).length;
    const percentComplete = coordinatorComponentIds.length
      ? Math.round((componentsCompleted / coordinatorComponentIds.length) * 100)
      : 0;

    // Calculate aggregated ST-27 metrics across all component runs
    const aggregatedMetrics = workflowRun.componentRuns.reduce(
      (acc, cr) => {
        acc.totalInputTokens += cr.tokensInput || 0;
        acc.totalOutputTokens += cr.tokensOutput || 0;
        acc.totalCacheRead += cr.tokensCacheRead || 0;
        acc.totalCacheWrite += cr.tokensCacheWrite || 0;
        acc.totalCacheHits += cr.cacheHits || 0;
        acc.totalCacheMisses += cr.cacheMisses || 0;
        acc.totalLinesAdded += cr.linesAdded || 0;
        acc.totalLinesDeleted += cr.linesDeleted || 0;
        acc.totalLinesModified += cr.linesModified || 0;
        acc.totalCost += cr.cost ? Number(cr.cost) : 0;
        return acc;
      },
      {
        totalInputTokens: 0,
        totalOutputTokens: 0,
        totalCacheRead: 0,
        totalCacheWrite: 0,
        totalCacheHits: 0,
        totalCacheMisses: 0,
        totalLinesAdded: 0,
        totalLinesDeleted: 0,
        totalLinesModified: 0,
        totalCost: 0,
      }
    );

    // Calculate cache hit rate
    const totalCacheOps = aggregatedMetrics.totalCacheHits + aggregatedMetrics.totalCacheMisses;
    const avgCacheHitRate = totalCacheOps > 0
      ? aggregatedMetrics.totalCacheHits / totalCacheOps
      : 0;

    // Calculate efficiency ratios
    const totalLOC = aggregatedMetrics.totalLinesAdded + aggregatedMetrics.totalLinesModified;
    const tokensPerLOC = totalLOC > 0
      ? (aggregatedMetrics.totalInputTokens + aggregatedMetrics.totalOutputTokens) / totalLOC
      : 0;
    const costPerLOC = totalLOC > 0
      ? aggregatedMetrics.totalCost / totalLOC
      : 0;

    return {
      runId: workflowRun.id,
      workflowId: workflowRun.workflowId,
      workflowName: workflowRun.workflow.name,
      coordinatorName: workflowRun.coordinator?.name || 'Unknown',
      status: workflowRun.status,
      startedAt: workflowRun.startedAt.toISOString(),
      completedAt: workflowRun.finishedAt?.toISOString(),
      errorMessage: workflowRun.errorMessage || undefined,
      metrics: {
        totalTokens: workflowRun.totalTokens,
        // ST-27 Token Breakdown
        totalInputTokens: aggregatedMetrics.totalInputTokens,
        totalOutputTokens: aggregatedMetrics.totalOutputTokens,
        totalCacheRead: aggregatedMetrics.totalCacheRead,
        totalCacheWrite: aggregatedMetrics.totalCacheWrite,
        // Cache Performance
        totalCacheHits: aggregatedMetrics.totalCacheHits,
        totalCacheMisses: aggregatedMetrics.totalCacheMisses,
        avgCacheHitRate,
        // Cost Metrics
        totalCost: aggregatedMetrics.totalCost || (workflowRun.estimatedCost ? Number(workflowRun.estimatedCost) : null),
        costPerLOC,
        // Code Impact
        totalLinesAdded: aggregatedMetrics.totalLinesAdded,
        totalLinesDeleted: aggregatedMetrics.totalLinesDeleted,
        totalLinesModified: aggregatedMetrics.totalLinesModified,
        totalLocGenerated: workflowRun.totalLocGenerated,
        totalTestsAdded: workflowRun.totalTestsAdded,
        // Efficiency Ratios
        tokensPerLOC,
        // Execution Metrics
        totalDuration: workflowRun.durationSeconds,
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
        completedAt: cr.finishedAt?.toISOString(),
        durationSeconds: cr.durationSeconds || undefined,
        tokensUsed: cr.totalTokens || undefined,
        // ST-27 Enhanced Metrics
        tokensInput: cr.tokensInput || undefined,
        tokensOutput: cr.tokensOutput || undefined,
        tokensCacheRead: cr.tokensCacheRead || undefined,
        tokensCacheWrite: cr.tokensCacheWrite || undefined,
        cacheHits: cr.cacheHits || undefined,
        cacheMisses: cr.cacheMisses || undefined,
        cacheHitRate: cr.cacheHitRate || undefined,
        // Quality & Behavior
        userPrompts: cr.userPrompts || 0,
        systemIterations: cr.systemIterations || 1,
        humanInterventions: cr.humanInterventions || 0,
        errorRate: cr.errorRate || undefined,
        successRate: cr.successRate || undefined,
        // Code Impact
        linesAdded: cr.linesAdded || undefined,
        linesDeleted: cr.linesDeleted || undefined,
        linesModified: cr.linesModified || undefined,
        locGenerated: cr.locGenerated || undefined,
        testsAdded: cr.testsAdded || undefined,
        filesModified: cr.filesModified || [],
        // Cost & Performance
        cost: cr.cost ? Number(cr.cost) : undefined,
        costBreakdown: cr.costBreakdown || undefined,
        tokensPerSecond: cr.tokensPerSecond || undefined,
        timeToFirstToken: cr.timeToFirstToken || undefined,
        modelId: cr.modelId || undefined,
        temperature: cr.temperature || undefined,
        // Tool Usage
        toolBreakdown: cr.toolBreakdown || undefined,
        // Artifacts & Content
        artifacts: Array.isArray(cr.artifacts) ? cr.artifacts : [],
        inputData: cr.inputData || undefined,
        outputData: cr.outputData || undefined,
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

    const coordinatorComponentIds = workflowRun.coordinator?.componentIds || [];
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
      coordinatorStrategy: workflowRun.coordinator?.decisionStrategy || 'sequential',
      completedComponents: workflowRun.componentRuns.map((cr) => ({
        componentRunId: cr.id,
        componentId: cr.componentId,
        componentName: cr.component.name,
        status: cr.status,
        output: cr.output,
        startedAt: cr.startedAt.toISOString(),
        completedAt: cr.finishedAt?.toISOString(),
      })),
      remainingComponents: remainingComponents.map((c, index) => ({
        componentId: c.id,
        componentName: c.name,
        description: c.description,
        order: workflowRun.componentRuns.length + index + 1,
      })),
      aggregatedMetrics: {
        totalTokens: workflowRun.totalTokens,
        totalCost: workflowRun.estimatedCost ? Number(workflowRun.estimatedCost) : null,
        totalDuration: workflowRun.durationSeconds,
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
        coordinatorName: run.coordinator?.name || 'Unknown',
        status: run.status,
        startedAt: run.startedAt.toISOString(),
        completedAt: run.finishedAt?.toISOString(),
        totalTokens: run.totalTokens,
        totalCost: run.estimatedCost ? Number(run.estimatedCost) : null,
        componentRunsCount: run._count.componentRuns,
      })),
      total,
      limit: options?.limit || 50,
      offset: options?.offset || 0,
    };
  }
}
