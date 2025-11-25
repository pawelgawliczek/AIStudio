/**
 * Metadata Aggregation Service
 * Extracts structured data from ComponentRun outputs and aggregates into Story.metadata
 *
 * ST-85: Story Execution Tab Not Showing Workflow Results
 */

import { PrismaClient, ComponentRun, Component } from '@prisma/client';

// Type definitions for Story.metadata structure
export interface StoryMetadata {
  implementationSummary: ImplementationSummary;
  qaStatus: QAStatus;
  concernsAnalysis: ConcernsAnalysis;
  deployment: DeploymentData;
  workflowRunId: string;
  aggregatedAt: string;
  version: string;
}

export interface ImplementationSummary {
  filesModified: Array<{
    filePath: string;
    changeType: 'added' | 'modified' | 'deleted';
    locAdded: number;
    locDeleted: number;
    complexity?: 'low' | 'medium' | 'high';
  }>;
  commits: Array<{
    hash: string;
    message: string;
    author: string;
    timestamp: string;
    filesChanged: number;
  }>;
  acceptanceCriteria: Array<{
    text: string;
    satisfied: boolean;
    verifiedBy?: string;
    notes?: string;
  }>;
  totalLocAdded: number;
  totalLocDeleted: number;
  totalFilesModified: number;
  totalCommits: number;
  implementedBy: string[];
  implementationNotes?: string;
}

export interface QAStatus {
  status: 'not_started' | 'in_progress' | 'passed' | 'failed' | 'blocked';
  assignedTo?: string;
  startedAt?: string;
  signedOffAt?: string;
  signedOffBy?: string;
  testCoverage: number;
  coverageGaps: Array<{
    area: string;
    description: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
  }>;
  checklistItems: Array<{
    text: string;
    completed: boolean;
    verifiedAt?: string;
    notes?: string;
  }>;
  testResults?: {
    totalTests: number;
    passed: number;
    failed: number;
    skipped: number;
    duration: number;
  };
  notes?: string;
}

export interface ConcernsAnalysis {
  riskScore: number;
  factors: Array<{
    category: 'complexity' | 'dependencies' | 'testing' | 'performance' | 'security';
    description: string;
    impact: 'low' | 'medium' | 'high' | 'critical';
    mitigationStrategy?: string;
  }>;
  issues: Array<{
    id: string;
    type: 'bug' | 'code_smell' | 'security_vulnerability' | 'performance_issue';
    severity: 'low' | 'medium' | 'high' | 'critical';
    description: string;
    location?: string;
    status: 'open' | 'dismissed' | 'resolved';
  }>;
  implementationCoverage: number;
  uncoveredCriteria: Array<{
    text: string;
    reason: string;
    plannedIn?: string;
  }>;
  breakingChanges: Array<{
    description: string;
    affectedAreas: string[];
    migrationRequired: boolean;
  }>;
  performanceImpacts: Array<{
    area: string;
    estimatedImpact: string;
    benchmarksNeeded: boolean;
  }>;
  analyzedBy: string[];
  analyzedAt: string;
}

export interface DeploymentData {
  lastDeployment?: {
    status: 'success' | 'failed';
    deployedAt: string;
    testUrl?: string;
    duration: number;
    testsPassed?: number;
    testsFailed?: number;
    errorMessage?: string;
    deployedBy: string;
  };
  deploymentHistory: Array<{
    id: string;
    timestamp: string;
    status: 'success' | 'failed';
    duration: number;
    testUrl?: string;
    testResults?: {
      passed: number;
      failed: number;
      skipped: number;
    };
    errorMessage?: string;
  }>;
}

type ComponentRunWithComponent = ComponentRun & {
  component: Component;
};

export class MetadataAggregationService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Aggregate workflow metadata from all component runs
   */
  async aggregateWorkflowMetadata(workflowRunId: string): Promise<StoryMetadata> {
    const startTime = Date.now();

    try {
      console.log(JSON.stringify({
        event: 'metadata_aggregation_start',
        workflowRunId,
        timestamp: new Date().toISOString(),
      }));

      // Query all ComponentRuns for this workflow
      const componentRuns = await this.prisma.componentRun.findMany({
        where: { workflowRunId },
        include: { component: true },
        orderBy: { executionOrder: 'asc' },
      });

      console.log(JSON.stringify({
        event: 'metadata_aggregation_component_runs_loaded',
        workflowRunId,
        componentRunsCount: componentRuns.length,
        componentNames: componentRuns.map(cr => cr.component.name),
      }));

      // Extract data from each component type
      const implementationSummary = this.extractImplementationSummary(componentRuns);
      const qaStatus = this.extractQAStatus(componentRuns);
      const concernsAnalysis = this.extractConcernsAnalysis(componentRuns);
      const deploymentData = this.extractDeploymentData(componentRuns);

      const duration = Date.now() - startTime;

      console.log(JSON.stringify({
        event: 'metadata_aggregation_success',
        workflowRunId,
        durationMs: duration,
        timestamp: new Date().toISOString(),
        summary: {
          filesModified: implementationSummary.totalFilesModified,
          commits: implementationSummary.totalCommits,
          qaStatus: qaStatus.status,
          riskScore: concernsAnalysis.riskScore,
        },
      }));

      return {
        implementationSummary,
        qaStatus,
        concernsAnalysis,
        deployment: deploymentData,
        workflowRunId,
        aggregatedAt: new Date().toISOString(),
        version: '1.0',
      };
    } catch (error) {
      const duration = Date.now() - startTime;

      console.error(JSON.stringify({
        event: 'metadata_aggregation_failed',
        workflowRunId,
        durationMs: duration,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        timestamp: new Date().toISOString(),
      }));

      throw error;
    }
  }

  /**
   * Extract implementation summary from Developer/Implementer component outputs
   */
  extractImplementationSummary(componentRuns: ComponentRunWithComponent[]): ImplementationSummary {
    // Find Developer/Implementer component runs
    const developerRuns = componentRuns.filter(
      (cr) =>
        cr.component.name.toLowerCase().includes('developer') ||
        cr.component.name.toLowerCase().includes('implementer') ||
        cr.component.name.toLowerCase().includes('full-stack')
    );

    const filesModified: ImplementationSummary['filesModified'] = [];
    const commits: ImplementationSummary['commits'] = [];

    for (const run of developerRuns) {
      const metadata = run.metadata as Record<string, any>;
      const output = metadata?.output || metadata;

      // Extract files modified
      if (output?.filesModified && Array.isArray(output.filesModified)) {
        filesModified.push(...output.filesModified);
      }

      // Extract commits
      if (output?.commits && Array.isArray(output.commits)) {
        commits.push(...output.commits);
      }
    }

    // Calculate totals
    const totalLocAdded = filesModified.reduce((sum, f) => sum + (f.locAdded || 0), 0);
    const totalLocDeleted = filesModified.reduce((sum, f) => sum + (f.locDeleted || 0), 0);

    return {
      filesModified,
      commits,
      acceptanceCriteria: [], // Will be parsed from story description by frontend
      totalLocAdded,
      totalLocDeleted,
      totalFilesModified: filesModified.length,
      totalCommits: commits.length,
      implementedBy: developerRuns.map((r) => r.component.name),
      implementationNotes: developerRuns[0]?.metadata?.['implementationNotes'] as string,
    };
  }

  /**
   * Extract QA status from QA component outputs
   */
  extractQAStatus(componentRuns: ComponentRunWithComponent[]): QAStatus {
    // Find QA component runs
    const qaRuns = componentRuns.filter(
      (cr) =>
        cr.component.name.toLowerCase().includes('qa') ||
        cr.component.name.toLowerCase().includes('test')
    );

    if (qaRuns.length === 0) {
      return {
        status: 'not_started',
        testCoverage: 0,
        coverageGaps: [],
        checklistItems: [],
      };
    }

    // Get most recent QA run
    const latestQA = qaRuns[qaRuns.length - 1];
    const metadata = latestQA.metadata as Record<string, any>;
    const output = metadata?.output || metadata;

    return {
      status: output?.qaStatus || (latestQA.success ? 'passed' : 'failed'),
      assignedTo: latestQA.component.name,
      startedAt: latestQA.startedAt?.toISOString(),
      signedOffAt: latestQA.success ? latestQA.finishedAt?.toISOString() : undefined,
      signedOffBy: latestQA.success ? latestQA.component.name : undefined,
      testCoverage: output?.testCoverage || 0,
      coverageGaps: output?.coverageGaps || [],
      checklistItems: output?.checklistItems || [],
      testResults: output?.testResults,
      notes: output?.notes,
    };
  }

  /**
   * Extract concerns analysis from Architect and QA component outputs
   */
  extractConcernsAnalysis(componentRuns: ComponentRunWithComponent[]): ConcernsAnalysis {
    // Find Architect and QA component runs
    const architectRuns = componentRuns.filter((cr) =>
      cr.component.name.toLowerCase().includes('architect')
    );
    const qaRuns = componentRuns.filter(
      (cr) =>
        cr.component.name.toLowerCase().includes('qa') ||
        cr.component.name.toLowerCase().includes('test')
    );

    const allRuns = [...architectRuns, ...qaRuns];

    let riskScore = 0;
    const factors: ConcernsAnalysis['factors'] = [];
    const issues: ConcernsAnalysis['issues'] = [];
    const uncoveredCriteria: ConcernsAnalysis['uncoveredCriteria'] = [];
    const breakingChanges: ConcernsAnalysis['breakingChanges'] = [];
    const performanceImpacts: ConcernsAnalysis['performanceImpacts'] = [];

    for (const run of allRuns) {
      const metadata = run.metadata as Record<string, any>;
      const output = metadata?.output || metadata;

      if (output?.riskScore) riskScore = Math.max(riskScore, output.riskScore);
      if (output?.riskFactors && Array.isArray(output.riskFactors)) {
        factors.push(...output.riskFactors);
      }
      if (output?.factors && Array.isArray(output.factors)) {
        factors.push(...output.factors);
      }
      if (output?.issues && Array.isArray(output.issues)) {
        issues.push(...output.issues);
      }
      if (output?.uncoveredCriteria && Array.isArray(output.uncoveredCriteria)) {
        uncoveredCriteria.push(...output.uncoveredCriteria);
      }
      if (output?.breakingChanges && Array.isArray(output.breakingChanges)) {
        breakingChanges.push(...output.breakingChanges);
      }
      if (output?.performanceImpacts && Array.isArray(output.performanceImpacts)) {
        performanceImpacts.push(...output.performanceImpacts);
      }
    }

    // Calculate implementation coverage (rough estimate)
    const implementationCoverage = Math.max(0, 100 - uncoveredCriteria.length * 10);

    return {
      riskScore,
      factors,
      issues,
      implementationCoverage,
      uncoveredCriteria,
      breakingChanges,
      performanceImpacts,
      analyzedBy: allRuns.map((r) => r.component.name),
      analyzedAt: new Date().toISOString(),
    };
  }

  /**
   * Extract deployment data from component outputs and existing story metadata
   */
  extractDeploymentData(componentRuns: ComponentRunWithComponent[]): DeploymentData {
    // Find deployment-related component runs
    const deploymentRuns = componentRuns.filter(
      (cr) =>
        cr.component.name.toLowerCase().includes('devops') ||
        cr.component.name.toLowerCase().includes('deploy')
    );

    const deploymentHistory: DeploymentData['deploymentHistory'] = [];
    let lastDeployment: DeploymentData['lastDeployment'] | undefined;

    for (const run of deploymentRuns) {
      const metadata = run.metadata as Record<string, any>;
      const output = metadata?.output || metadata;

      if (output?.deployment) {
        const deployment = {
          id: run.id,
          timestamp: run.finishedAt?.toISOString() || new Date().toISOString(),
          status: output.deployment.status || (run.success ? 'success' : 'failed'),
          duration: output.deployment.duration || run.durationSeconds || 0,
          testUrl: output.deployment.testUrl,
          testResults: output.deployment.testResults,
          errorMessage: output.deployment.errorMessage,
        };

        deploymentHistory.push(deployment);

        // Set as last deployment if most recent
        if (!lastDeployment || new Date(deployment.timestamp) > new Date(lastDeployment.deployedAt)) {
          lastDeployment = {
            status: deployment.status as 'success' | 'failed',
            deployedAt: deployment.timestamp,
            testUrl: deployment.testUrl,
            duration: deployment.duration,
            testsPassed: deployment.testResults?.passed,
            testsFailed: deployment.testResults?.failed,
            errorMessage: deployment.errorMessage,
            deployedBy: run.component.name,
          };
        }
      }
    }

    return {
      lastDeployment,
      deploymentHistory,
    };
  }
}
