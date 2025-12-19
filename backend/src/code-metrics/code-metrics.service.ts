import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WorkersService } from '../workers/workers.service';
import {
  ProjectMetricsDto,
  FileHotspotDto,
  FileDetailDto,
  CodeIssueDto,
  TrendDataPointDto,
  FolderNodeDto,
  CoverageGapDto,
} from './dto';
import { QueryMetricsDto, GetHotspotsDto } from './dto/query-metrics.dto';
import { RecentAnalysesResponseDto } from './dto/recent-analysis.dto';
import { AnalysisService } from './services/analysis.service';
import { FileDetailService } from './services/file-detail.service';
import { MetricsService } from './services/metrics.service';
import { TestCoverageService } from './services/test-coverage.service';

/**
 * ST-284: Refactored Code Metrics Service (Facade)
 * Delegates to specialized sub-services for maintainability
 */
@Injectable()
export class CodeMetricsService {
  constructor(
    private prisma: PrismaService,
    private workersService: WorkersService,
    private metricsService: MetricsService,
    private fileDetailService: FileDetailService,
    private analysisService: AnalysisService,
    private testCoverageService: TestCoverageService,
  ) {}

  /**
   * Get project-level code quality metrics
   */
  async getProjectMetrics(
    projectId: string,
    query: QueryMetricsDto,
  ): Promise<ProjectMetricsDto> {
    return this.metricsService.getProjectMetrics(projectId, query.timeRangeDays || 30);
  }

  /**
   * Get file hotspots (high-risk files)
   */
  async getFileHotspots(
    projectId: string,
    query: GetHotspotsDto,
  ): Promise<FileHotspotDto[]> {
    return this.metricsService.getFileHotspots(projectId, query);
  }

  /**
   * Get detailed metrics for a specific file
   */
  async getFileDetail(projectId: string, filePath: string): Promise<FileDetailDto> {
    return this.fileDetailService.getFileDetail(projectId, filePath);
  }

  /**
   * Get trend data from historical snapshots
   */
  async getTrendData(
    projectId: string,
    days: number = 30,
  ): Promise<TrendDataPointDto[]> {
    return this.metricsService.getTrendData(projectId, days);
  }

  /**
   * Get code quality issues summary
   */
  async getCodeIssues(projectId: string): Promise<CodeIssueDto[]> {
    return this.metricsService.getCodeIssues(projectId);
  }

  /**
   * Trigger full code analysis for project
   */
  async triggerAnalysis(projectId: string): Promise<{
    jobId: string;
    status: string;
    message: string;
  }> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      throw new NotFoundException(`Project ${projectId} not found`);
    }

    if (!project.repositoryUrl && !project.localPath) {
      throw new NotFoundException('Project has no repository configured');
    }

    const job = await this.workersService.analyzeProject(projectId);

    return {
      jobId: String(job.id),
      status: 'queued',
      message: 'Code analysis job started',
    };
  }

  /**
   * Get hierarchical folder structure with aggregated metrics
   */
  async getFolderHierarchy(projectId: string): Promise<FolderNodeDto> {
    return this.analysisService.getFolderHierarchy(projectId);
  }

  /**
   * Get coverage gaps - files that need testing
   */
  async getCoverageGaps(projectId: string, limit: number = 20): Promise<CoverageGapDto[]> {
    return this.analysisService.getCoverageGaps(projectId, limit);
  }

  /**
   * Get status of ongoing or recent code analysis job
   */
  async getAnalysisStatus(projectId: string): Promise<{
    status: 'queued' | 'running' | 'completed' | 'failed' | 'not_found';
    progress?: number;
    message?: string;
    startedAt?: Date;
    completedAt?: Date;
  }> {
    return this.analysisService.getAnalysisStatus(projectId);
  }

  /**
   * Get comparison between current and previous analysis
   */
  async getAnalysisComparison(projectId: string): Promise<{
    healthScoreChange: number;
    newTests: number;
    coverageChange: number;
    complexityChange: number;
    newFiles: number;
    deletedFiles: number;
    qualityImprovement: boolean;
    lastAnalysis?: Date;
  }> {
    return this.metricsService.getAnalysisComparison(projectId);
  }

  /**
   * Get test execution summary
   */
  async getTestSummary(projectId: string): Promise<{
    totalTests: number;
    passing: number;
    failing: number;
    skipped: number;
    lastExecution?: Date;
    coveragePercentage?: number;
  }> {
    return this.testCoverageService.getTestSummary(projectId);
  }

  /**
   * Get unified test summary (TestExecution table + coverage fallback)
   */
  async getTestSummaryUnified(projectId: string): Promise<{
    totalTests: number;
    passing: number;
    failing: number;
    skipped: number;
    lastExecution?: Date;
    coveragePercentage?: number;
  }> {
    return this.testCoverageService.getTestSummaryUnified(projectId);
  }

  /**
   * Get detailed file-level changes between analyses
   */
  async getFileChanges(projectId: string): Promise<any> {
    return this.fileDetailService.getFileChanges(projectId);
  }

  /**
   * Get test summary from coverage file
   */
  async getTestSummaryFromCoverage(projectId: string): Promise<{
    totalTests: number;
    passing: number;
    failing: number;
    skipped: number;
    lastExecution?: Date;
    coveragePercentage?: number;
  }> {
    return this.testCoverageService.getTestSummaryFromCoverage(projectId);
  }

  /**
   * Get recent code analysis runs
   */
  async getRecentAnalyses(
    projectId: string,
    limit: number = 7,
  ): Promise<RecentAnalysesResponseDto> {
    return this.analysisService.getRecentAnalyses(projectId, limit);
  }
}
