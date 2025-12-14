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
    // ST-234: Cache metrics from costBreakdown
    totalCacheCreation?: number;
    totalCacheRead?: number;
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

// New interface matching frontend expectations and actual artifacts table
export interface ArtifactInfo {
  id: string;
  definitionId: string;
  definitionKey: string;
  definitionName: string;
  type: string;
  workflowRunId: string;
  version: number;
  content: string | null;
  contentPreview: string | null;
  contentType: string;
  size: number;
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
}

// Artifact access info for expected artifacts per state
export interface ArtifactAccessInfo {
  definitionKey: string;
  definitionName: string;
  definitionType: string;
  accessType: 'read' | 'write' | 'required';
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

    const componentsCompleted = workflowRun.componentRuns.filter(
      (cr) => cr.status === 'completed' || cr.status === 'failed'
    ).length;
    const componentsTotal = workflowRun.componentRuns.length;
    const percentComplete = componentsTotal > 0
      ? Math.round((componentsCompleted / componentsTotal) * 100)
      : 0;

    // Calculate aggregated ST-27 metrics across all component runs
    // ST-110: Removed cache metrics - now using /context command for token tracking
    const aggregatedMetrics = workflowRun.componentRuns.reduce(
      (acc, cr) => {
        acc.totalInputTokens += cr.tokensInput || 0;
        acc.totalOutputTokens += cr.tokensOutput || 0;
        acc.totalLinesAdded += cr.linesAdded || 0;
        acc.totalLinesDeleted += cr.linesDeleted || 0;
        acc.totalLinesModified += cr.linesModified || 0;
        acc.totalCost += cr.cost ? Number(cr.cost) : 0;
        return acc;
      },
      {
        totalInputTokens: 0,
        totalOutputTokens: 0,
        totalLinesAdded: 0,
        totalLinesDeleted: 0,
        totalLinesModified: 0,
        totalCost: 0,
      }
    );

    // ST-110: Cache metrics removed - now using /context command
    const avgCacheHitRate = 0;

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
      coordinatorName: 'N/A',
      status: workflowRun.status,
      startedAt: workflowRun.startedAt.toISOString(),
      completedAt: workflowRun.finishedAt?.toISOString(),
      errorMessage: workflowRun.errorMessage || undefined,
      metrics: {
        totalTokens: workflowRun.totalTokens,
        // ST-27 Token Breakdown
        totalInputTokens: aggregatedMetrics.totalInputTokens,
        totalOutputTokens: aggregatedMetrics.totalOutputTokens,
        // ST-234: Cache metrics from costBreakdown
        totalCacheCreation: ((workflowRun as any).costBreakdown as any)?.cacheCreation || 0,
        totalCacheRead: ((workflowRun as any).costBreakdown as any)?.cacheRead || 0,
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
        componentsTotal,
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
        // ST-27 Enhanced Metrics (ST-110: Cache metrics removed)
        tokensInput: cr.tokensInput || undefined,
        tokensOutput: cr.tokensOutput || undefined,
        // ST-110: New token breakdown fields from /context command
        tokensSystemPrompt: cr.tokensSystemPrompt || undefined,
        tokensSystemTools: cr.tokensSystemTools || undefined,
        tokensMcpTools: cr.tokensMcpTools || undefined,
        tokensMemoryFiles: cr.tokensMemoryFiles || undefined,
        tokensMessages: cr.tokensMessages || undefined,
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
   * Get artifacts for a workflow run from the artifacts table
   * ST-168: Query actual artifacts table instead of componentRun.output.artifacts
   * ST-214: Artifacts are now story-scoped, query by storyId from the workflow run
   */
  async getWorkflowArtifacts(runId: string, includeContent = false): Promise<ArtifactInfo[]> {
    // ST-214: Get the workflow run to find storyId (artifacts are story-scoped)
    const workflowRun = await this.prisma.workflowRun.findUnique({
      where: { id: runId },
      select: { storyId: true },
    });

    if (!workflowRun?.storyId) {
      return []; // No story = no artifacts
    }

    const artifacts = await this.prisma.artifact.findMany({
      where: {
        storyId: workflowRun.storyId, // ST-214: Query by storyId instead of workflowRunId
      },
      include: {
        definition: true,
        createdByComponent: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return artifacts.map((artifact) => ({
      id: artifact.id,
      definitionId: artifact.definitionId,
      definitionKey: artifact.definition.key,
      definitionName: artifact.definition.name,
      type: artifact.definition.type,
      workflowRunId: artifact.workflowRunId,
      version: artifact.currentVersion,
      content: includeContent ? artifact.content : null,
      contentPreview: artifact.contentPreview,
      contentType: artifact.contentType,
      size: artifact.size,
      createdAt: artifact.createdAt.toISOString(),
      updatedAt: artifact.updatedAt.toISOString(),
      createdBy: artifact.createdByComponent?.name || null,
    }));
  }

  /**
   * Get artifact access rules (expected artifacts) for a workflow run
   * ST-168: Returns what artifacts each state should read/write
   */
  async getArtifactAccess(runId: string): Promise<Record<string, ArtifactAccessInfo[]>> {
    // Get the workflow run to find the workflow
    const workflowRun = await this.prisma.workflowRun.findUnique({
      where: { id: runId },
      include: {
        workflow: {
          include: {
            states: {
              include: {
                artifactAccess: {
                  include: {
                    definition: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!workflowRun) {
      return {};
    }

    // Build a map of stateId -> artifact access info
    const accessByState: Record<string, ArtifactAccessInfo[]> = {};

    for (const state of workflowRun.workflow.states) {
      if (state.artifactAccess.length > 0) {
        accessByState[state.id] = state.artifactAccess.map((access) => ({
          definitionKey: access.definition.key,
          definitionName: access.definition.name,
          definitionType: access.definition.type,
          accessType: access.accessType as 'read' | 'write' | 'required',
        }));
      }
    }

    return accessByState;
  }

  /**
   * Get artifact by ID or definition key
   * ST-168: Updated to use new artifact table structure
   */
  async getArtifact(runId: string, identifier: string): Promise<ArtifactInfo | null> {
    const artifacts = await this.getWorkflowArtifacts(runId, true);
    // Try to find by ID first, then by definitionKey
    return artifacts.find((a) => a.id === identifier || a.definitionKey === identifier) || null;
  }

  /**
   * Get workflow context (for REST API endpoint)
   */
  async getWorkflowContext(runId: string) {
    const workflowRun = await this.prisma.workflowRun.findUnique({
      where: { id: runId },
      include: {
        workflow: true,
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

    return {
      runId: workflowRun.id,
      workflowId: workflowRun.workflowId,
      workflowName: workflowRun.workflow.name,
      status: workflowRun.status,
      coordinatorStrategy: 'sequential',
      completedComponents: workflowRun.componentRuns.map((cr) => ({
        componentRunId: cr.id,
        componentId: cr.componentId,
        componentName: cr.component.name,
        status: cr.status,
        output: cr.output,
        startedAt: cr.startedAt.toISOString(),
        completedAt: cr.finishedAt?.toISOString(),
      })),
      remainingComponents: [],
      aggregatedMetrics: {
        // ST-240: Calculate totalTokens from component runs instead of reading DB field
        // The DB field (workflowRun.totalTokens) is often not updated when components complete
        totalTokens: workflowRun.componentRuns.reduce(
          (sum, cr) => sum + (cr.totalTokens || 0), 0
        ) || workflowRun.totalTokens || null,
        totalCost: workflowRun.estimatedCost ? Number(workflowRun.estimatedCost) : null,
        totalDuration: workflowRun.durationSeconds,
        componentsCompleted: workflowRun.componentRuns.length,
        componentsTotal: workflowRun.componentRuns.length,
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
        coordinatorName: 'N/A',
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
