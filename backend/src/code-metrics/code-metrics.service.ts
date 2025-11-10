import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
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
  constructor(private prisma: PrismaService) {}

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

    // Get all commits in time range
    const commits = await this.prisma.commit.findMany({
      where: {
        projectId,
        timestamp: { gte: startDate },
      },
      include: {
        files: true,
      },
      orderBy: { timestamp: 'desc' },
    });

    // Calculate LOC by language
    const locByLanguage: Record<string, number> = {};
    let totalLoc = 0;
    const latestFileMetrics = new Map<string, any>();

    for (const commit of commits) {
      for (const file of commit.files) {
        // Track latest metrics for each file
        if (!latestFileMetrics.has(file.filePath)) {
          latestFileMetrics.set(file.filePath, file);

          // Determine language from file extension
          const ext = file.filePath.split('.').pop() || 'unknown';
          const language = this.getLanguageFromExtension(ext);

          const fileLoc = file.locAdded;
          locByLanguage[language] = (locByLanguage[language] || 0) + fileLoc;
          totalLoc += fileLoc;
        }
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
   * Get layer-level metrics (frontend, backend, infra, test)
   */
  async getLayerMetrics(
    projectId: string,
    query: QueryMetricsDto,
  ): Promise<LayerMetricsDto[]> {
    const timeRangeDays = query.timeRangeDays || 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - timeRangeDays);

    // Get file metrics grouped by layer
    const fileMetrics = await this.getFileMetricsByLayer(projectId, startDate);

    // Calculate metrics for each layer
    const layers: LayerType[] = ['frontend', 'backend', 'infra', 'test'];
    const layerMetrics: LayerMetricsDto[] = [];

    let totalLoc = 0;
    for (const files of Object.values(fileMetrics)) {
      totalLoc += files.reduce((sum, f) => sum + f.loc, 0);
    }

    for (const layer of layers) {
      const files = fileMetrics[layer] || [];
      const loc = files.reduce((sum, f) => sum + f.loc, 0);
      const avgComplexity = files.length > 0
        ? files.reduce((sum, f) => sum + f.complexity, 0) / files.length
        : 0;
      const coverage = files.length > 0
        ? files.reduce((sum, f) => sum + (f.coverage || 0), 0) / files.length
        : 0;

      const churnLevel = this.calculateChurnLevel(files);
      const healthScore = this.calculateLayerHealthScore(avgComplexity, coverage, churnLevel);

      layerMetrics.push({
        layer,
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
   * Get component-level metrics
   */
  async getComponentMetrics(
    projectId: string,
    query: QueryMetricsDto,
  ): Promise<ComponentMetricsDto[]> {
    const timeRangeDays = query.timeRangeDays || 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - timeRangeDays);

    // Get file metrics grouped by component
    const fileMetrics = await this.getFileMetricsByComponent(projectId, startDate);

    const componentMetrics: ComponentMetricsDto[] = [];

    for (const [componentName, files] of Object.entries(fileMetrics)) {
      const avgComplexity = files.length > 0
        ? files.reduce((sum, f) => sum + f.complexity, 0) / files.length
        : 0;
      const coverage = files.length > 0
        ? files.reduce((sum, f) => sum + (f.coverage || 0), 0) / files.length
        : 0;

      const churnLevel = this.calculateChurnLevel(files);
      const healthScore = this.calculateComponentHealthScore(avgComplexity, coverage, churnLevel);
      const hotspotCount = files.filter(f => this.calculateRiskScore(f) > 60).length;

      // Determine layer from file paths
      const layer = this.getLayerFromFiles(files.map(f => f.filePath));

      componentMetrics.push({
        name: componentName,
        layer,
        fileCount: files.length,
        healthScore,
        avgComplexity: Math.round(avgComplexity * 10) / 10,
        churnLevel,
        coverage: Math.round(coverage),
        hotspotCount,
        files: files.map(f => f.filePath),
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

    if (commits.length === 0) {
      throw new NotFoundException(`File ${filePath} not found in project`);
    }

    // Get latest file metrics
    const latestFile = commits[0].files[0];
    const complexity = latestFile.complexityAfter || latestFile.complexityBefore || 0;
    const coverage = Number(latestFile.coverageAfter || latestFile.coverageBefore || 0);

    // Calculate churn metrics
    const churnCount = commits.length;
    const linesChanged = commits.reduce((sum, c) =>
      sum + c.files[0].locAdded + c.files[0].locDeleted, 0
    );
    const loc = latestFile.locAdded;
    const churnRate = loc > 0 ? Math.round((linesChanged / loc) * 100) : 0;

    // Recent changes
    const recentChanges = commits.slice(0, 5).map(c => ({
      storyKey: c.story?.key || 'Unknown',
      date: c.timestamp,
      linesChanged: c.files[0].locAdded + c.files[0].locDeleted,
    }));

    // Determine component and layer from file path
    const { component, layer } = this.extractComponentAndLayer(filePath);
    const language = this.getLanguageFromPath(filePath);

    // Calculate risk score
    const riskScore = this.calculateRiskScore({
      complexity,
      churnCount,
      coverage,
      loc,
    });

    // Calculate other scores
    const cognitiveComplexity = Math.round(complexity * 1.3); // Estimate
    const maintainabilityIndex = this.calculateMaintainabilityIndex(complexity, loc, coverage);

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
      lastModified: commits[0].timestamp,
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
    const dataPoints: TrendDataPointDto[] = [];
    const now = new Date();

    // Generate daily data points
    for (let i = days; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);

      // Get commits up to this date
      const commits = await this.prisma.commit.findMany({
        where: {
          projectId,
          timestamp: { lte: date },
        },
        include: { files: true },
        orderBy: { timestamp: 'asc' },
      });

      // Calculate metrics for this point in time
      const fileMetrics = new Map<string, any>();
      for (const commit of commits) {
        for (const file of commit.files) {
          fileMetrics.set(file.filePath, file);
        }
      }

      const healthScore = await this.calculateProjectHealthScore(projectId, fileMetrics);

      dataPoints.push({
        date,
        healthScore: healthScore.overallScore,
        coverage: healthScore.coverage,
        complexity: healthScore.complexity,
        techDebt: healthScore.techDebtRatio,
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

    // Calculate averages
    const avgComplexity = files.reduce((sum, f) =>
      sum + (f.complexityAfter || f.complexityBefore || 0), 0
    ) / files.length;

    const avgCoverage = files.reduce((sum, f) =>
      sum + Number(f.coverageAfter || f.coverageBefore || 0), 0
    ) / files.length;

    // Tech debt ratio (% of files with high complexity or low coverage)
    const problematicFiles = files.filter(f => {
      const complexity = f.complexityAfter || f.complexityBefore || 0;
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

  private async getFileMetricsByLayer(projectId: string, startDate: Date): Promise<Record<string, any[]>> {
    const commits = await this.prisma.commit.findMany({
      where: { projectId, timestamp: { gte: startDate } },
      include: { files: true },
    });

    const fileMap = new Map<string, any>();
    for (const commit of commits) {
      for (const file of commit.files) {
        if (!fileMap.has(file.filePath)) {
          const layer = this.getLayerFromPath(file.filePath);
          const churnCount = this.countFileChurn(file.filePath, commits);

          fileMap.set(file.filePath, {
            filePath: file.filePath,
            layer,
            loc: file.locAdded,
            complexity: file.complexityAfter || file.complexityBefore || 0,
            coverage: Number(file.coverageAfter || file.coverageBefore || 0),
            churnCount,
          });
        }
      }
    }

    // Group by layer
    const result: Record<string, any[]> = {};
    for (const file of fileMap.values()) {
      const layer = file.layer;
      if (!result[layer]) result[layer] = [];
      result[layer].push(file);
    }

    return result;
  }

  private async getFileMetricsByComponent(projectId: string, startDate: Date): Promise<Record<string, any[]>> {
    const commits = await this.prisma.commit.findMany({
      where: { projectId, timestamp: { gte: startDate } },
      include: { files: true },
    });

    const fileMap = new Map<string, any>();
    for (const commit of commits) {
      for (const file of commit.files) {
        if (!fileMap.has(file.filePath)) {
          const { component } = this.extractComponentAndLayer(file.filePath);
          const churnCount = this.countFileChurn(file.filePath, commits);

          fileMap.set(file.filePath, {
            filePath: file.filePath,
            component: component || 'Unknown',
            loc: file.locAdded,
            complexity: file.complexityAfter || file.complexityBefore || 0,
            coverage: Number(file.coverageAfter || file.coverageBefore || 0),
            churnCount,
          });
        }
      }
    }

    // Group by component
    const result: Record<string, any[]> = {};
    for (const file of fileMap.values()) {
      const component = file.component;
      if (!result[component]) result[component] = [];
      result[component].push(file);
    }

    return result;
  }

  private async getAllFileMetrics(projectId: string, startDate: Date): Promise<any[]> {
    const commits = await this.prisma.commit.findMany({
      where: { projectId, timestamp: { gte: startDate } },
      include: { files: true, story: true },
      orderBy: { timestamp: 'desc' },
    });

    const fileMap = new Map<string, any>();
    for (const commit of commits) {
      for (const file of commit.files) {
        if (!fileMap.has(file.filePath)) {
          const { component, layer } = this.extractComponentAndLayer(file.filePath);
          const churnCount = this.countFileChurn(file.filePath, commits);

          fileMap.set(file.filePath, {
            filePath: file.filePath,
            component,
            layer,
            loc: file.locAdded,
            complexity: file.complexityAfter || file.complexityBefore || 0,
            coverage: Number(file.coverageAfter || file.coverageBefore || 0),
            churnCount,
            lastModified: commit.timestamp,
            lastStoryKey: commit.story?.key,
            criticalIssues: 0, // Mock
          });
        }
      }
    }

    return Array.from(fileMap.values());
  }

  private countFileChurn(filePath: string, commits: any[]): number {
    return commits.filter(c =>
      c.files.some((f: any) => f.filePath === filePath)
    ).length;
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

    const dominantLayer = Object.entries(layerCounts).sort((a, b) => b[1] - a[1])[0];
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
}
