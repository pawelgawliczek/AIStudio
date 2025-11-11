import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WorkersService } from '../workers/workers.service';
import { LayerType } from '@prisma/client';
import {
  ProjectMetricsDto,
  LayerMetricsDto,
  ComponentMetricsDto,
  FileHotspotDto,
  FileDetailDto,
  CodeIssueDto,
  TrendDataPointDto,
  CodeHealthScoreDto,
} from './dto';
import { QueryMetricsDto, GetHotspotsDto } from './dto/query-metrics.dto';

@Injectable()
export class CodeMetricsService {
  constructor(
    private prisma: PrismaService,
    private workersService: WorkersService,
  ) {}

  /**
   * Get project-level code quality metrics
   */
  async getProjectMetrics(
    projectId: string,
    query: QueryMetricsDto,
  ): Promise<ProjectMetricsDto> {
    const timeRangeDays = query.timeRangeDays || 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - timeRangeDays);

    // Get file metrics with coverage
    const fileMetrics = await this.getFileMetricsWithCoverage(projectId, startDate);

    // Calculate LOC by language
    const locByLanguage: Record<string, number> = {};
    let totalLoc = 0;
    const latestFileMetrics = new Map<string, any>();

    for (const metric of fileMetrics) {
      // Track latest metrics for each file
      if (!latestFileMetrics.has(metric.filePath)) {
        latestFileMetrics.set(metric.filePath, metric);

        // Determine language from file extension
        const ext = metric.filePath.split('.').pop() || 'unknown';
        const language = this.getLanguageFromExtension(ext);

        const fileLoc = metric.loc;
        locByLanguage[language] = (locByLanguage[language] || 0) + fileLoc;
        totalLoc += fileLoc;
      }
    }

    // Calculate health score metrics
    const healthScore = await this.calculateProjectHealthScore(projectId, latestFileMetrics);

    // Mock security issues (in production, integrate with SonarQube or similar)
    const securityIssues = {
      critical: 2,
      high: 5,
      medium: 12,
      low: 23,
    };

    return {
      healthScore,
      totalLoc,
      locByLanguage,
      securityIssues,
      lastUpdate: new Date(),
    };
  }

  /**
   * Get layer-level metrics - uses actual Layer table from database
   */
  async getLayerMetrics(
    projectId: string,
    query: QueryMetricsDto,
  ): Promise<LayerMetricsDto[]> {
    const timeRangeDays = query.timeRangeDays || 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - timeRangeDays);

    // Get actual layers from database
    const layers = await this.prisma.layer.findMany({
      where: { projectId },
      orderBy: { orderIndex: 'asc' },
    });

    // Get all components with their layer associations
    const components = await this.prisma.component.findMany({
      where: { projectId },
      include: {
        layers: {
          include: {
            layer: true,
          },
        },
      },
    });

    // Get file metrics
    const fileMetrics = await this.getFileMetricsWithCoverage(projectId, startDate);

    const layerMetrics: LayerMetricsDto[] = [];
    let totalLoc = 0;

    // Calculate total LOC
    for (const file of fileMetrics) {
      totalLoc += file.loc;
    }

    // Calculate metrics for each layer
    for (const layer of layers) {
      // Get components in this layer
      const layerComponentIds = components
        .filter(c => c.layers.some(l => l.layer.id === layer.id))
        .map(c => c.name);

      // Get files associated with these components
      const layerFiles = fileMetrics.filter(f =>
        layerComponentIds.includes(f.component || '')
      );

      const loc = layerFiles.reduce((sum, f) => sum + f.loc, 0);
      const avgComplexity = layerFiles.length > 0
        ? layerFiles.reduce((sum, f) => sum + f.complexity, 0) / layerFiles.length
        : 0;
      const coverage = layerFiles.length > 0
        ? layerFiles.reduce((sum, f) => sum + f.coverage, 0) / layerFiles.length
        : 0;

      const churnLevel = this.calculateChurnLevel(layerFiles);
      const healthScore = this.calculateLayerHealthScore(avgComplexity, coverage, churnLevel);

      layerMetrics.push({
        layer: layer.name as any, // Layer name from database
        loc,
        locPercentage: totalLoc > 0 ? Math.round((loc / totalLoc) * 100) : 0,
        healthScore,
        avgComplexity: Math.round(avgComplexity * 10) / 10,
        churnLevel,
        coverage: Math.round(coverage),
        defectCount: Math.floor(Math.random() * 15), // Mock - integrate with defect tracking
      });
    }

    return layerMetrics;
  }

  /**
   * Get component-level metrics - uses actual Component table from database
   */
  async getComponentMetrics(
    projectId: string,
    query: QueryMetricsDto,
  ): Promise<ComponentMetricsDto[]> {
    const timeRangeDays = query.timeRangeDays || 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - timeRangeDays);

    // Get actual components from database with layer associations
    const components = await this.prisma.component.findMany({
      where: { projectId },
      include: {
        layers: {
          include: {
            layer: true,
          },
        },
      },
    });

    // Get file metrics with coverage
    const fileMetrics = await this.getFileMetricsWithCoverage(projectId, startDate);

    const componentMetrics: ComponentMetricsDto[] = [];

    for (const component of components) {
      // Filter files for this component
      const componentFiles = fileMetrics.filter(f => f.component === component.name);

      if (componentFiles.length === 0) {
        // Skip components with no files
        continue;
      }

      const avgComplexity = componentFiles.reduce((sum, f) => sum + f.complexity, 0) / componentFiles.length;
      const coverage = componentFiles.reduce((sum, f) => sum + f.coverage, 0) / componentFiles.length;

      const churnLevel = this.calculateChurnLevel(componentFiles);
      const healthScore = this.calculateComponentHealthScore(avgComplexity, coverage, churnLevel);
      const hotspotCount = componentFiles.filter(f => this.calculateRiskScore(f) > 60).length;

      // Get primary layer (first associated layer)
      const primaryLayer = component.layers[0]?.layer.name || 'other';

      componentMetrics.push({
        name: component.name,
        layer: primaryLayer as any,
        fileCount: componentFiles.length,
        healthScore,
        avgComplexity: Math.round(avgComplexity * 10) / 10,
        churnLevel,
        coverage: Math.round(coverage),
        hotspotCount,
        files: componentFiles.map(f => f.filePath),
      });
    }

    // Sort by health score (worst first)
    return componentMetrics.sort((a, b) => a.healthScore - b.healthScore);
  }

  /**
   * Get file hotspots (high-risk files)
   */
  async getFileHotspots(
    projectId: string,
    query: GetHotspotsDto,
  ): Promise<FileHotspotDto[]> {
    const limit = query.limit || 10;
    const minRiskScore = query.minRiskScore || 50;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);

    // Get all file metrics
    const allFileMetrics = await this.getAllFileMetrics(projectId, startDate);

    // Calculate risk scores and filter
    const hotspots: FileHotspotDto[] = [];

    for (const file of allFileMetrics) {
      const riskScore = this.calculateRiskScore(file);

      if (riskScore >= minRiskScore) {
        // Apply filters
        if (query.layer && file.layer !== query.layer) continue;
        if (query.component && file.component !== query.component) continue;

        hotspots.push({
          filePath: file.filePath,
          component: file.component || 'Unknown',
          layer: file.layer || 'other',
          riskScore,
          complexity: file.complexity,
          churnCount: file.churnCount,
          coverage: file.coverage || 0,
          loc: file.loc,
          lastModified: file.lastModified,
          lastStoryKey: file.lastStoryKey,
          criticalIssues: file.criticalIssues || 0,
        });
      }
    }

    // Sort by risk score (highest first) and limit
    return hotspots.sort((a, b) => b.riskScore - a.riskScore).slice(0, limit);
  }

  /**
   * Get detailed metrics for a specific file
   */
  async getFileDetail(projectId: string, filePath: string): Promise<FileDetailDto> {
    // Get file metrics from CodeMetrics table
    const fileMetric = await this.prisma.codeMetrics.findUnique({
      where: {
        projectId_filePath: { projectId, filePath },
      },
    });

    if (!fileMetric) {
      throw new NotFoundException(`File ${filePath} not found in project metrics`);
    }

    // Get commit history for recent changes
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);
    const commits = await this.prisma.commit.findMany({
      where: {
        projectId,
        timestamp: { gte: startDate },
        files: {
          some: { filePath },
        },
      },
      include: {
        files: { where: { filePath } },
        story: true,
      },
      orderBy: { timestamp: 'desc' },
    });

    // Use metrics from CodeMetrics table
    const complexity = fileMetric.cyclomaticComplexity;
    const cognitiveComplexity = fileMetric.cognitiveComplexity;
    const maintainabilityIndex = fileMetric.maintainabilityIndex;
    const loc = fileMetric.linesOfCode;
    const coverage = 0; // TODO: Integrate with test coverage
    const churnCount = fileMetric.churnRate;

    // Calculate churn metrics from commit history
    const linesChanged = commits.reduce((sum, c) =>
      sum + c.files[0].locAdded + c.files[0].locDeleted, 0
    );
    const churnRate = loc > 0 ? Math.round((linesChanged / loc) * 100) : 0;

    // Recent changes
    const recentChanges = commits.slice(0, 5).map(c => ({
      storyKey: c.story?.key || 'Unknown',
      date: c.timestamp,
      linesChanged: c.files[0].locAdded + c.files[0].locDeleted,
    }));

    // Use component and layer from CodeMetrics
    const component = fileMetric.component || 'Unknown';
    const layer = (fileMetric.layer || 'other') as LayerType;
    const language = this.getLanguageFromPath(filePath);

    // Calculate risk score
    const riskScore = this.calculateRiskScore({
      complexity,
      churnCount,
      coverage,
      loc,
    });

    // Mock code issues (in production, integrate with linter/sonar)
    const issues = this.generateMockIssues(complexity, coverage);

    // Mock dependencies (in production, analyze imports)
    const { importedBy, imports } = this.generateMockDependencies(filePath);
    const couplingScore = this.calculateCouplingScore(importedBy.length, imports.length);

    return {
      filePath,
      component,
      layer,
      language,
      riskScore,
      loc,
      complexity,
      cognitiveComplexity,
      maintainabilityIndex,
      coverage,
      churnCount,
      linesChanged,
      churnRate,
      lastModified: fileMetric.lastAnalyzedAt,
      recentChanges,
      issues,
      importedBy,
      imports,
      couplingScore,
    };
  }

  /**
   * Get trend data for charts
   */
  async getTrendData(
    projectId: string,
    days: number = 30,
  ): Promise<TrendDataPointDto[]> {
    // TODO: Implement historical metrics tracking
    // For now, we return current metrics with slight variation for demo purposes
    // In production, we should:
    // 1. Store daily snapshots of aggregated metrics in a separate table
    // 2. Run a daily worker to capture metrics snapshots
    // 3. Query historical snapshots for true trend data

    // Get current metrics from CodeMetrics table
    const codeMetrics = await this.prisma.codeMetrics.findMany({
      where: { projectId },
    });

    const fileMetrics = new Map<string, any>();
    for (const metric of codeMetrics) {
      fileMetrics.set(metric.filePath, metric);
    }

    const currentHealthScore = await this.calculateProjectHealthScore(projectId, fileMetrics);

    // Generate data points with current metrics (mock trending for demo)
    const dataPoints: TrendDataPointDto[] = [];
    const now = new Date();

    for (let i = days; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);

      // Mock slight variation for demo (in production, use actual historical data)
      const variance = Math.random() * 10 - 5;

      dataPoints.push({
        date,
        healthScore: Math.max(0, Math.min(100, currentHealthScore.overallScore + variance)),
        coverage: Math.max(0, Math.min(100, currentHealthScore.coverage + variance)),
        complexity: Math.max(0, currentHealthScore.complexity + (variance / 10)),
        techDebt: Math.max(0, Math.min(100, currentHealthScore.techDebtRatio + variance)),
      });
    }

    return dataPoints;
  }

  /**
   * Get code issues summary
   */
  async getCodeIssues(projectId: string): Promise<CodeIssueDto[]> {
    // Mock implementation - in production, integrate with SonarQube, ESLint, etc.
    return [
      {
        severity: 'critical',
        type: 'Security Vulnerabilities',
        count: 2,
        filesAffected: 2,
        sampleFiles: ['src/auth/password-reset.ts', 'src/api/gateway/rate-limiter.ts'],
      },
      {
        severity: 'high',
        type: 'Bug Risks',
        count: 5,
        filesAffected: 5,
        sampleFiles: ['src/auth/session-manager.ts', 'src/api/controllers/user.ts'],
      },
      {
        severity: 'high',
        type: 'Performance Issues',
        count: 3,
        filesAffected: 3,
        sampleFiles: ['src/db/query-optimizer.ts'],
      },
      {
        severity: 'medium',
        type: 'Code Duplication',
        count: 12,
        filesAffected: 18,
        sampleFiles: ['src/auth/*.ts', 'src/utils/*.ts'],
      },
      {
        severity: 'medium',
        type: 'Maintainability Issues',
        count: 15,
        filesAffected: 12,
        sampleFiles: ['src/services/email.ts'],
      },
      {
        severity: 'low',
        type: 'Code Style Issues',
        count: 23,
        filesAffected: 20,
        sampleFiles: [],
      },
    ];
  }

  // ========== HELPER METHODS ==========

  private async calculateProjectHealthScore(
    projectId: string,
    latestFileMetrics: Map<string, any>,
  ): Promise<CodeHealthScoreDto> {
    const files = Array.from(latestFileMetrics.values());

    if (files.length === 0) {
      return {
        overallScore: 0,
        coverage: 0,
        complexity: 0,
        techDebtRatio: 0,
        trend: 'stable',
        weeklyChange: 0,
      };
    }

    // Calculate averages (support both CommitFile and CodeMetrics formats)
    const avgComplexity = files.reduce((sum, f) =>
      sum + (f.cyclomaticComplexity || f.complexity || f.complexityAfter || f.complexityBefore || 0), 0
    ) / files.length;

    const avgCoverage = files.reduce((sum, f) =>
      sum + Number(f.coverageAfter || f.coverageBefore || 0), 0
    ) / files.length;

    // Tech debt ratio (% of files with high complexity or low coverage)
    const problematicFiles = files.filter(f => {
      const complexity = f.cyclomaticComplexity || f.complexity || f.complexityAfter || f.complexityBefore || 0;
      const coverage = Number(f.coverageAfter || f.coverageBefore || 0);
      return complexity > 10 || coverage < 70;
    });
    const techDebtRatio = (problematicFiles.length / files.length) * 100;

    // Calculate overall score (0-100)
    // Formula: weight coverage (40%), complexity (30%), tech debt (30%)
    const coverageScore = avgCoverage;
    const complexityScore = Math.max(0, 100 - (avgComplexity * 5)); // Lower is better
    const techDebtScore = Math.max(0, 100 - techDebtRatio);
    const overallScore = Math.round(
      coverageScore * 0.4 + complexityScore * 0.3 + techDebtScore * 0.3
    );

    // Determine trend (mock - in production, compare with previous week)
    const trend: 'improving' | 'stable' | 'declining' = 'improving';
    const weeklyChange = 3;

    return {
      overallScore,
      coverage: Math.round(avgCoverage),
      complexity: Math.round(avgComplexity * 10) / 10,
      techDebtRatio: Math.round(techDebtRatio * 10) / 10,
      trend,
      weeklyChange,
    };
  }

  private calculateLayerHealthScore(
    avgComplexity: number,
    coverage: number,
    churnLevel: string,
  ): number {
    const complexityScore = Math.max(0, 100 - (avgComplexity * 5));
    const coverageScore = coverage;
    const churnScore = churnLevel === 'low' ? 100 : churnLevel === 'medium' ? 70 : 40;

    return Math.round(complexityScore * 0.3 + coverageScore * 0.4 + churnScore * 0.3);
  }

  private calculateComponentHealthScore(
    avgComplexity: number,
    coverage: number,
    churnLevel: string,
  ): number {
    return this.calculateLayerHealthScore(avgComplexity, coverage, churnLevel);
  }

  private calculateRiskScore(file: any): number {
    const complexity = file.complexity || 0;
    const churnCount = file.churnCount || 0;
    const coverage = file.coverage || 0;

    // Risk = (complexity * churn) / (coverage + 1)
    // Normalize to 0-100
    const rawScore = (complexity * churnCount) / (coverage + 1);
    return Math.min(100, Math.round(rawScore));
  }

  private calculateChurnLevel(files: any[]): 'low' | 'medium' | 'high' {
    if (files.length === 0) return 'low';

    const avgChurn = files.reduce((sum, f) => sum + (f.churnCount || 0), 0) / files.length;

    if (avgChurn < 2) return 'low';
    if (avgChurn < 5) return 'medium';
    return 'high';
  }

  private calculateMaintainabilityIndex(complexity: number, loc: number, coverage: number): number {
    // Simplified maintainability index
    // Higher is better (0-100)
    const complexityPenalty = complexity * 2;
    const locPenalty = Math.log(loc) * 5;
    const coverageBonus = coverage;

    return Math.max(0, Math.min(100, Math.round(100 - complexityPenalty - locPenalty + coverageBonus)));
  }

  private calculateCouplingScore(importedByCount: number, importsCount: number): 'low' | 'medium' | 'high' {
    const totalCoupling = importedByCount + importsCount;

    if (totalCoupling < 5) return 'low';
    if (totalCoupling < 12) return 'medium';
    return 'high';
  }

  /**
   * Get file metrics with actual test coverage calculated from TestCase/TestExecution
   * Also maps file paths to actual components and layers from database
   */
  private async getFileMetricsWithCoverage(projectId: string, startDate: Date): Promise<any[]> {
    // Query from CodeMetrics table
    const codeMetrics = await this.prisma.codeMetrics.findMany({
      where: {
        projectId,
        lastAnalyzedAt: { gte: startDate }
      },
    });

    // Get actual components with their file patterns and layer associations
    const components = await this.prisma.component.findMany({
      where: { projectId },
      include: {
        layers: {
          include: {
            layer: true,
          },
        },
      },
    });

    // Build a map of file path patterns to component and layer
    const fileToComponentMap = this.buildFileComponentMap(components);

    // Get test cases and executions to calculate coverage
    const testCases = await this.prisma.testCase.findMany({
      where: { projectId },
      include: {
        executions: {
          where: { executedAt: { gte: startDate } },
          orderBy: { executedAt: 'desc' },
          take: 1,
        },
      },
    });

    // Build a map of file path -> test coverage percentage
    const fileCoverageMap = new Map<string, number>();

    // Simple heuristic: if there are test cases linked to the file/component, calculate coverage
    // based on pass rate of recent executions
    for (const testCase of testCases) {
      const recentExecution = testCase.executions[0];
      if (recentExecution && recentExecution.status === 'pass') {
        const testFilePath = testCase.testFilePath || '';
        fileCoverageMap.set(testFilePath, 100);
      }
    }

    // Calculate coverage estimate based on test existence
    const totalTestCases = testCases.length;
    const passedTestCases = testCases.filter(
      tc => tc.executions[0]?.status === 'pass'
    ).length;
    const globalCoverageEstimate = totalTestCases > 0
      ? Math.round((passedTestCases / totalTestCases) * 100)
      : 0;

    return codeMetrics.map(metric => {
      // Use the component and layer already stored in code_metrics table
      // (populated by code analysis processor using glob patterns)
      const component = metric.component || 'Unknown';
      const layer = metric.layer || 'Unknown';

      // Use specific file coverage if available, otherwise use component-level estimate
      const coverage = fileCoverageMap.get(metric.filePath) || globalCoverageEstimate;

      return {
        filePath: metric.filePath,
        component,
        layer,
        loc: metric.linesOfCode,
        complexity: metric.cyclomaticComplexity,
        coverage,
        churnCount: metric.churnRate,
      };
    });
  }

  /**
   * Build a map from component file patterns to component info
   */
  private buildFileComponentMap(components: any[]): Map<string, { component: string; layer: string }> {
    const map = new Map<string, { component: string; layer: string }>();

    for (const comp of components) {
      const primaryLayer = comp.layers[0]?.layer.name || 'Unknown';

      // Store component info (we'll match by file patterns later)
      map.set(comp.name, {
        component: comp.name,
        layer: primaryLayer,
      });
    }

    return map;
  }

  /**
   * Match file path to component using naming conventions
   */
  private matchFileToComponent(filePath: string, componentMap: Map<string, { component: string; layer: string }>): { component: string; layer: string } {
    const lowerPath = filePath.toLowerCase();

    // Try to match based on file path patterns
    for (const [componentName, info] of componentMap.entries()) {
      const componentKey = componentName.toLowerCase()
        .replace(/ /g, '-')
        .replace(/api|domain|infrastructure|layer/gi, '')
        .trim();

      // Check if file path contains the component name
      if (lowerPath.includes(componentKey) ||
          lowerPath.includes(componentName.toLowerCase().replace(/ /g, '')) ||
          lowerPath.includes(componentName.toLowerCase().replace(/ /g, '-'))) {
        return info;
      }
    }

    // Fallback: infer layer from file path
    let inferredLayer = 'Unknown';
    if (lowerPath.includes('frontend/') || lowerPath.includes('/pages/') || lowerPath.includes('/components/')) {
      inferredLayer = 'Presentation Layer';
    } else if (lowerPath.includes('/api/') || lowerPath.includes('/controllers/') || lowerPath.includes('.controller.')) {
      inferredLayer = 'Application Layer';
    } else if (lowerPath.includes('/domain/') || lowerPath.includes('.service.')) {
      inferredLayer = 'Domain Layer';
    } else if (lowerPath.includes('/infra') || lowerPath.includes('prisma') || lowerPath.includes('database')) {
      inferredLayer = 'Infrastructure Layer';
    }

    return { component: 'Unknown', layer: inferredLayer };
  }

  private async getFileMetricsByLayer(projectId: string, startDate: Date): Promise<Record<string, any[]>> {
    const fileMetrics = await this.getFileMetricsWithCoverage(projectId, startDate);

    // Group by layer
    const result: Record<string, any[]> = {};
    for (const metric of fileMetrics) {
      const layer = metric.layer || 'other';
      if (!result[layer]) result[layer] = [];
      result[layer].push(metric);
    }

    return result;
  }

  private async getFileMetricsByComponent(projectId: string, startDate: Date): Promise<Record<string, any[]>> {
    // Query from CodeMetrics table populated by workers
    const codeMetrics = await this.prisma.codeMetrics.findMany({
      where: {
        projectId,
        lastAnalyzedAt: { gte: startDate }
      },
    });

    // Group by component
    const result: Record<string, any[]> = {};
    for (const metric of codeMetrics) {
      const component = metric.component || 'Unknown';
      if (!result[component]) result[component] = [];

      result[component].push({
        filePath: metric.filePath,
        component: metric.component,
        layer: metric.layer,
        loc: metric.linesOfCode,
        complexity: metric.cyclomaticComplexity,
        coverage: 0, // TODO: Integrate with test coverage
        churnCount: metric.churnRate,
      });
    }

    return result;
  }

  private async getAllFileMetrics(projectId: string, startDate: Date): Promise<any[]> {
    // Query from CodeMetrics table populated by workers
    const codeMetrics = await this.prisma.codeMetrics.findMany({
      where: {
        projectId,
        lastAnalyzedAt: { gte: startDate }
      },
      orderBy: { lastAnalyzedAt: 'desc' },
    });

    // Get latest commit info for each file to populate lastStoryKey
    const fileCommits = await this.prisma.commit.findMany({
      where: { projectId },
      include: { story: true, files: true },
      orderBy: { timestamp: 'desc' },
    });

    const latestCommitByFile = new Map<string, any>();
    for (const commit of fileCommits) {
      for (const file of commit.files) {
        if (!latestCommitByFile.has(file.filePath)) {
          latestCommitByFile.set(file.filePath, {
            timestamp: commit.timestamp,
            storyKey: commit.story?.key,
          });
        }
      }
    }

    return codeMetrics.map(metric => {
      const commitInfo = latestCommitByFile.get(metric.filePath);
      return {
        filePath: metric.filePath,
        component: metric.component,
        layer: metric.layer,
        loc: metric.linesOfCode,
        complexity: metric.cyclomaticComplexity,
        coverage: 0, // TODO: Integrate with test coverage
        churnCount: metric.churnRate,
        lastModified: commitInfo?.timestamp || metric.lastAnalyzedAt,
        lastStoryKey: commitInfo?.storyKey,
        criticalIssues: metric.codeSmellCount, // Use code smell count as critical issues indicator
      };
    });
  }
  private getLayerFromPath(filePath: string): LayerType {
    if (filePath.includes('frontend/') || filePath.includes('/ui/') || filePath.includes('/components/')) {
      return 'frontend';
    }
    if (filePath.includes('backend/') || filePath.includes('/api/') || filePath.includes('/services/')) {
      return 'backend';
    }
    if (filePath.includes('/test') || filePath.endsWith('.test.ts') || filePath.endsWith('.spec.ts')) {
      return 'test';
    }
    if (filePath.includes('infra/') || filePath.includes('docker') || filePath.includes('kubernetes')) {
      return 'infra';
    }
    return 'other';
  }

  private getLayerFromFiles(filePaths: string[]): LayerType {
    const layers = filePaths.map(p => this.getLayerFromPath(p));
    const layerCounts = layers.reduce((acc, layer) => {
      acc[layer] = (acc[layer] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const dominantLayer = Object.entries(layerCounts).sort((a, b) => (b[1] as number) - (a[1] as number))[0];
    return (dominantLayer?.[0] as LayerType) || 'other';
  }

  private extractComponentAndLayer(filePath: string): { component: string; layer: LayerType } {
    const layer = this.getLayerFromPath(filePath);

    // Extract component name from path
    // Examples:
    // src/auth/password-reset.ts -> Authentication
    // src/api/controllers/user.ts -> User Management
    // frontend/components/Dashboard.tsx -> Dashboard

    const parts = filePath.split('/');
    let component = 'Unknown';

    if (parts.includes('auth')) component = 'Authentication';
    else if (parts.includes('user')) component = 'User Management';
    else if (parts.includes('email')) component = 'Email Service';
    else if (parts.includes('api') || parts.includes('gateway')) component = 'API Gateway';
    else if (parts.includes('search')) component = 'Search';
    else if (parts.includes('dashboard')) component = 'Dashboard';
    else if (parts.length > 1) {
      // Use second-to-last directory name
      component = parts[parts.length - 2]
        .split('-')
        .map(w => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
    }

    return { component, layer };
  }

  private getLanguageFromPath(filePath: string): string {
    const ext = filePath.split('.').pop() || '';
    return this.getLanguageFromExtension(ext);
  }

  private getLanguageFromExtension(ext: string): string {
    const langMap: Record<string, string> = {
      ts: 'TypeScript',
      tsx: 'TypeScript',
      js: 'JavaScript',
      jsx: 'JavaScript',
      py: 'Python',
      sql: 'SQL',
      go: 'Go',
      rs: 'Rust',
      java: 'Java',
      kt: 'Kotlin',
      rb: 'Ruby',
      php: 'PHP',
      cs: 'C#',
      cpp: 'C++',
      c: 'C',
    };

    return langMap[ext] || ext.toUpperCase();
  }

  private generateMockIssues(complexity: number, coverage: number): any[] {
    const issues: any[] = [];

    if (complexity > 20) {
      issues.push({
        severity: 'critical',
        type: 'Complexity',
        line: 45,
        message: `Function has complexity ${complexity} (max: 10)`,
      });
    }

    if (coverage < 70) {
      issues.push({
        severity: 'high',
        type: 'Coverage',
        message: `Low test coverage: ${coverage}% (target: 80%)`,
      });
    }

    return issues;
  }

  private generateMockDependencies(filePath: string): { importedBy: string[]; imports: string[] } {
    // Mock implementation
    return {
      importedBy: [
        'src/api/routes/auth-routes.ts',
        'src/services/user-service.ts',
        'src/api/controllers/auth-controller.ts',
      ],
      imports: [
        'express',
        'bcrypt',
        '@nestjs/common',
        './auth-utils',
        './auth-config',
      ],
    };
  }

  /**
   * Trigger full code analysis for a project
   * Enqueues a background job to analyze all source files
   */
  async triggerAnalysis(
    projectId: string,
  ): Promise<{ jobId: string; status: string; message: string }> {
    // Verify project exists
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        name: true,
        localPath: true,
      },
    });

    if (!project) {
      throw new NotFoundException(`Project with ID ${projectId} not found`);
    }

    if (!project.localPath) {
      throw new BadRequestException(
        `Project "${project.name}" has no repository path configured. ` +
        `Please set the localPath field.`,
      );
    }

    // TODO: Check if analysis is already running
    // This would require tracking active jobs, which can be done via Bull queue introspection
    // For now, we'll allow concurrent analyses

    // Enqueue analysis job
    const job = await this.workersService.analyzeProject(projectId);

    return {
      jobId: String(job.id),
      status: 'queued',
      message: `Code analysis started for project "${project.name}"`,
    };
  }
}
