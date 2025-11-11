import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { PrismaService } from '../../prisma/prisma.service';
import { QUEUE_NAMES } from '../workers.module';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * CodeAnalysisProcessor
 *
 * Responsibilities:
 * - Parse git commits and analyze code changes
 * - Calculate complexity metrics (cyclomatic, cognitive)
 * - Detect code smells and quality issues
 * - Update quality snapshots organized by layer/component/file/function
 * - Support MCP queries for architecture agent (UC-ARCH-002, UC-ARCH-004)
 *
 * Architecture Alignment:
 * - Metrics organized by: Project → Layer → Component → File → Function
 * - Supports drill-down queries via MCP tools
 */
@Processor(QUEUE_NAMES.CODE_ANALYSIS)
export class CodeAnalysisProcessor {
  private readonly logger = new Logger(CodeAnalysisProcessor.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Analyze a single commit
   * Triggered by: post-commit hook via MCP link_commit
   */
  @Process('analyze-commit')
  async analyzeCommit(job: Job<{
    commitHash: string;
    projectId: string;
    storyId?: string;
  }>) {
    const { commitHash, projectId, storyId } = job.data;
    this.logger.log(`Analyzing commit ${commitHash} for project ${projectId}`);

    try {
      // 1. Get project details
      const project = await this.prisma.project.findUnique({
        where: { id: projectId },
        select: { repositoryUrl: true, localPath: true },
      });

      if (!project?.localPath) {
        throw new Error(`Project ${projectId} has no local repository path`);
      }

      // 2. Get commit details from git
      const commitDetails = await this.getCommitDetails(
        project.localPath,
        commitHash,
      );
      this.logger.debug(`Analyzing commit by ${commitDetails.author}: ${commitDetails.message}`);

      // 3. Get list of changed files
      const changedFiles = await this.getChangedFiles(
        project.localPath,
        commitHash,
      );

      // 4. Analyze each file
      const fileMetrics = await Promise.all(
        changedFiles.map((file: string) =>
          this.analyzeFile(project.localPath!, file, commitHash),
        ),
      );

      // 5. Calculate file-level metrics and determine layer/component
      for (const fileMetric of fileMetrics) {
        await this.saveFileMetrics(projectId, fileMetric, storyId);
      }

      // 6. Aggregate to component level
      await this.aggregateComponentMetrics(projectId);

      // 7. Aggregate to layer level
      await this.aggregateLayerMetrics(projectId);

      // 8. Update project-level health score
      await this.updateProjectHealth(projectId);

      this.logger.log(`Completed analysis for commit ${commitHash}`);
      return { success: true, filesAnalyzed: changedFiles.length };
    } catch (error) {
      this.logger.error(`Failed to analyze commit ${commitHash}:`, error);
      throw error;
    }
  }

  /**
   * Analyze entire project (initial scan or full rescan)
   */
  @Process('analyze-project')
  async analyzeProject(job: Job<{ projectId: string }>) {
    const { projectId } = job.data;
    this.logger.log(`Starting full project analysis for ${projectId}`);

    try {
      const project = await this.prisma.project.findUnique({
        where: { id: projectId },
        select: { localPath: true },
      });

      if (!project?.localPath) {
        throw new Error(`Project ${projectId} has no local repository path`);
      }

      // Get all files in repository
      const allFiles = await this.getAllSourceFiles(project.localPath);
      this.logger.log(`Found ${allFiles.length} source files to analyze`);

      // Analyze in batches to avoid overwhelming the system
      const batchSize = 10;
      for (let i = 0; i < allFiles.length; i += batchSize) {
        const batch = allFiles.slice(i, i + batchSize);
        await job.progress((i / allFiles.length) * 100);

        const fileMetrics = await Promise.all(
          batch.map((file: string) => this.analyzeFile(project.localPath!, file)),
        );

        for (const fileMetric of fileMetrics) {
          await this.saveFileMetrics(projectId, fileMetric);
        }
      }

      // Aggregate metrics
      await this.aggregateComponentMetrics(projectId);
      await this.aggregateLayerMetrics(projectId);
      await this.updateProjectHealth(projectId);

      this.logger.log(`Completed full project analysis for ${projectId}`);
      return { success: true, filesAnalyzed: allFiles.length };
    } catch (error) {
      this.logger.error(`Failed to analyze project ${projectId}:`, error);
      throw error;
    }
  }

  /**
   * Get commit details from git
   */
  private async getCommitDetails(repoPath: string, commitHash: string) {
    const { stdout } = await execAsync(
      `cd "${repoPath}" && git show --format="%H%n%an%n%ae%n%at%n%s" --no-patch ${commitHash}`,
    );
    const [hash, author, email, timestamp, message] = stdout.trim().split('\n');
    return { hash, author, email, timestamp: new Date(parseInt(timestamp) * 1000), message };
  }

  /**
   * Get list of files changed in a commit
   */
  private async getChangedFiles(repoPath: string, commitHash: string): Promise<string[]> {
    const { stdout } = await execAsync(
      `cd "${repoPath}" && git diff-tree --no-commit-id --name-only -r ${commitHash}`,
    );
    return stdout
      .trim()
      .split('\n')
      .filter((file) => this.isSourceFile(file));
  }

  /**
   * Get all source files in repository
   */
  private async getAllSourceFiles(repoPath: string): Promise<string[]> {
    const { stdout } = await execAsync(
      `cd "${repoPath}" && git ls-files`,
    );
    return stdout
      .trim()
      .split('\n')
      .filter((file) => this.isSourceFile(file));
  }

  /**
   * Check if file is a source file we should analyze
   */
  private isSourceFile(filePath: string): boolean {
    const extensions = ['.ts', '.tsx', '.js', '.jsx', '.py', '.java', '.go', '.rs'];
    return extensions.some((ext) => filePath.endsWith(ext)) &&
           !filePath.includes('node_modules/') &&
           !filePath.includes('dist/') &&
           !filePath.includes('.test.') &&
           !filePath.includes('.spec.');
  }

  /**
   * Analyze a single file and calculate metrics
   */
  private async analyzeFile(
    repoPath: string,
    filePath: string,
    commitHash?: string,
  ): Promise<FileMetrics> {
    this.logger.debug(`Analyzing file: ${filePath}`);

    try {
      // Get file content
      const fileContent = await this.getFileContent(repoPath, filePath, commitHash);

      // Calculate lines of code
      const loc = this.calculateLOC(fileContent);

      // Determine layer and component from file path
      const { layer, component } = this.inferLayerAndComponent(filePath);

      // Calculate complexity metrics
      const complexity = await this.calculateComplexity(fileContent, filePath);

      // Detect code smells
      const codeSmells = await this.detectCodeSmells(fileContent, filePath);

      // Calculate churn (number of times file was modified in last 90 days)
      const churn = await this.calculateChurn(repoPath, filePath);

      // Calculate maintainability index
      const maintainability = this.calculateMaintainability(complexity, loc, codeSmells.length);

      return {
        filePath,
        layer,
        component,
        loc,
        complexity,
        codeSmells,
        churn,
        maintainability,
        lastModified: new Date(),
      };
    } catch (error) {
      this.logger.error(`Failed to analyze file ${filePath}:`, error);
      // Return default metrics on error
      return {
        filePath,
        layer: 'unknown',
        component: 'unknown',
        loc: 0,
        complexity: { cyclomatic: 0, cognitive: 0, maxComplexity: 0 },
        codeSmells: [],
        churn: 0,
        maintainability: 0,
        lastModified: new Date(),
      };
    }
  }

  /**
   * Get file content from git
   */
  private async getFileContent(
    repoPath: string,
    filePath: string,
    commitHash?: string,
  ): Promise<string> {
    const ref = commitHash || 'HEAD';
    const { stdout } = await execAsync(
      `cd "${repoPath}" && git show ${ref}:"${filePath}"`,
    );
    return stdout;
  }

  /**
   * Calculate lines of code (excluding comments and blank lines)
   */
  private calculateLOC(content: string): number {
    const lines = content.split('\n');
    let loc = 0;
    let inMultiLineComment = false;

    for (const line of lines) {
      const trimmed = line.trim();

      // Skip blank lines
      if (trimmed === '') continue;

      // Handle multi-line comments
      if (trimmed.startsWith('/*')) inMultiLineComment = true;
      if (trimmed.includes('*/')) {
        inMultiLineComment = false;
        continue;
      }
      if (inMultiLineComment) continue;

      // Skip single-line comments
      if (trimmed.startsWith('//') || trimmed.startsWith('#')) continue;

      loc++;
    }

    return loc;
  }

  /**
   * Infer layer and component from file path
   * Based on project structure conventions
   */
  private inferLayerAndComponent(filePath: string): {
    layer: string;
    component: string;
  } {
    // Determine layer
    let layer = 'unknown';
    if (filePath.includes('frontend/') || filePath.includes('ui/')) {
      layer = 'frontend';
    } else if (filePath.includes('backend/') || filePath.includes('api/') || filePath.includes('server/')) {
      layer = 'backend';
    } else if (filePath.includes('infrastructure/') || filePath.includes('infra/')) {
      layer = 'infrastructure';
    } else if (filePath.includes('test/') || filePath.includes('tests/')) {
      layer = 'tests';
    } else if (filePath.includes('docs/') || filePath.endsWith('.md')) {
      layer = 'documentation';
    }

    // Determine component (directory name after layer)
    let component = 'core';
    if (filePath.includes('/auth/') || filePath.includes('auth.')) {
      component = 'authentication';
    } else if (filePath.includes('/api/')) {
      component = 'api-gateway';
    } else if (filePath.includes('/db/') || filePath.includes('/database/')) {
      component = 'database';
    } else if (filePath.includes('/mcp/')) {
      component = 'mcp-server';
    } else if (filePath.includes('/websocket/')) {
      component = 'websocket';
    } else if (filePath.includes('/stories/')) {
      component = 'stories';
    } else if (filePath.includes('/projects/')) {
      component = 'projects';
    } else if (filePath.includes('/use-cases/')) {
      component = 'use-cases';
    }

    return { layer, component };
  }

  /**
   * Calculate complexity metrics
   * Simplified version - in production, use proper parsers like typescript-eslint
   */
  private async calculateComplexity(
    content: string,
    _filePath: string,
  ): Promise<ComplexityMetrics> {
    // Simplified cyclomatic complexity calculation
    // Count decision points: if, else, for, while, case, catch, &&, ||, ?
    const decisionPoints = (content.match(/\b(if|else|for|while|case|catch)\b|\&\&|\|\||\?/g) || []).length;
    const cyclomatic = decisionPoints + 1;

    // Simplified cognitive complexity (nesting depth weighted)
    const nestingDepth = this.calculateMaxNesting(content);
    const cognitive = cyclomatic + nestingDepth * 2;

    // Find max complexity in any single function
    const functions = this.extractFunctions(content);
    const maxComplexity = Math.max(
      cyclomatic,
      ...functions.map((f) => f.complexity),
    );

    return {
      cyclomatic,
      cognitive,
      maxComplexity,
      functions,
    };
  }

  /**
   * Calculate maximum nesting depth
   */
  private calculateMaxNesting(content: string): number {
    let maxDepth = 0;
    let currentDepth = 0;

    for (const char of content) {
      if (char === '{') {
        currentDepth++;
        maxDepth = Math.max(maxDepth, currentDepth);
      } else if (char === '}') {
        currentDepth--;
      }
    }

    return maxDepth;
  }

  /**
   * Extract functions and their complexity
   * Simplified - in production, use proper AST parser
   */
  private extractFunctions(content: string): FunctionMetric[] {
    const functions: FunctionMetric[] = [];
    const functionRegex = /(?:function|const|let|var)\s+(\w+)\s*(?:=\s*)?(?:\([^)]*\)|async)/g;

    let match;
    while ((match = functionRegex.exec(content)) !== null) {
      const functionName = match[1];
      // Simplified complexity for each function
      const functionContent = content.substring(match.index);
      const decisions = (functionContent.match(/\b(if|else|for|while|case|catch)\b/g) || []).length;

      functions.push({
        name: functionName,
        complexity: decisions + 1,
        loc: functionContent.split('\n').length,
      });
    }

    return functions;
  }

  /**
   * Detect code smells
   * Simplified - in production, integrate with ESLint, SonarQube, etc.
   */
  private async detectCodeSmells(
    content: string,
    _filePath: string,
  ): Promise<CodeSmell[]> {
    const smells: CodeSmell[] = [];

    // Check for long functions (>50 LOC)
    const functions = this.extractFunctions(content);
    functions.forEach((func: FunctionMetric) => {
      if (func.loc > 50) {
        smells.push({
          type: 'long-function',
          severity: 'major',
          message: `Function ${func.name} is too long (${func.loc} lines)`,
          line: 0, // Would need proper parsing to get line number
        });
      }
    });

    // Check for high complexity
    functions.forEach((func: FunctionMetric) => {
      if (func.complexity > 10) {
        smells.push({
          type: 'high-complexity',
          severity: 'major',
          message: `Function ${func.name} has high complexity (${func.complexity})`,
          line: 0,
        });
      }
    });

    // Check for TODO comments
    const todos = content.match(/\/\/\s*TODO:/gi) || [];
    if (todos.length > 0) {
      smells.push({
        type: 'todo-comment',
        severity: 'minor',
        message: `File contains ${todos.length} TODO comments`,
        line: 0,
      });
    }

    // Check for console.log (potential debugging code left in)
    const consoleLogs = content.match(/console\.(log|debug|info|warn|error)/g) || [];
    if (consoleLogs.length > 0) {
      smells.push({
        type: 'console-log',
        severity: 'minor',
        message: `File contains ${consoleLogs.length} console statements`,
        line: 0,
      });
    }

    return smells;
  }

  /**
   * Calculate file churn (number of times modified in last 90 days)
   */
  private async calculateChurn(repoPath: string, filePath: string): Promise<number> {
    try {
      const since = new Date();
      since.setDate(since.getDate() - 90);
      const sinceStr = since.toISOString().split('T')[0];

      const { stdout } = await execAsync(
        `cd "${repoPath}" && git log --since="${sinceStr}" --oneline -- "${filePath}" | wc -l`,
      );
      return parseInt(stdout.trim()) || 0;
    } catch {
      return 0;
    }
  }

  /**
   * Calculate maintainability index
   * Formula: MAX(0, (171 - 5.2 * ln(V) - 0.23 * G - 16.2 * ln(LOC)) * 100 / 171)
   * Simplified version
   */
  private calculateMaintainability(
    complexity: ComplexityMetrics,
    loc: number,
    codeSmellCount: number,
  ): number {
    if (loc === 0) return 100;

    const V = loc; // Volume (simplified)
    const G = complexity.cyclomatic; // Complexity
    const LOC = loc;

    const rawIndex = 171 - 5.2 * Math.log(V) - 0.23 * G - 16.2 * Math.log(LOC);
    const normalized = Math.max(0, (rawIndex * 100) / 171);

    // Penalize for code smells
    const penalty = codeSmellCount * 2;
    return Math.max(0, Math.min(100, normalized - penalty));
  }

  /**
   * Save file metrics to database
   */
  private async saveFileMetrics(
    projectId: string,
    metrics: FileMetrics,
    _storyId?: string,
  ) {
    // Store in code_metrics table (or create new table structure)
    await this.prisma.codeMetrics.upsert({
      where: {
        projectId_filePath: {
          projectId,
          filePath: metrics.filePath,
        },
      },
      create: {
        projectId,
        filePath: metrics.filePath,
        layer: metrics.layer,
        component: metrics.component,
        linesOfCode: metrics.loc,
        cyclomaticComplexity: metrics.complexity.cyclomatic,
        cognitiveComplexity: metrics.complexity.cognitive,
        maintainabilityIndex: metrics.maintainability,
        churnRate: metrics.churn,
        codeSmellCount: metrics.codeSmells.length,
        lastAnalyzedAt: new Date(),
        metadata: {
          codeSmells: metrics.codeSmells,
          functions: metrics.complexity.functions,
        },
      },
      update: {
        layer: metrics.layer,
        component: metrics.component,
        linesOfCode: metrics.loc,
        cyclomaticComplexity: metrics.complexity.cyclomatic,
        cognitiveComplexity: metrics.complexity.cognitive,
        maintainabilityIndex: metrics.maintainability,
        churnRate: metrics.churn,
        codeSmellCount: metrics.codeSmells.length,
        lastAnalyzedAt: new Date(),
        metadata: {
          codeSmells: metrics.codeSmells,
          functions: metrics.complexity.functions,
        },
      },
    });
  }

  /**
   * Aggregate component-level metrics
   */
  private async aggregateComponentMetrics(projectId: string) {
    // Group by component and calculate averages
    const components = await this.prisma.codeMetrics.groupBy({
      by: ['component', 'layer'],
      where: { projectId },
      _avg: {
        cyclomaticComplexity: true,
        cognitiveComplexity: true,
        maintainabilityIndex: true,
        churnRate: true,
      },
      _sum: {
        linesOfCode: true,
        codeSmellCount: true,
      },
      _count: {
        id: true,
      },
    });

    // Store aggregated metrics (could create separate table for this)
    this.logger.debug(`Aggregated ${components.length} components for project ${projectId}`);
  }

  /**
   * Aggregate layer-level metrics
   */
  private async aggregateLayerMetrics(projectId: string) {
    const layers = await this.prisma.codeMetrics.groupBy({
      by: ['layer'],
      where: { projectId },
      _avg: {
        cyclomaticComplexity: true,
        cognitiveComplexity: true,
        maintainabilityIndex: true,
      },
      _sum: {
        linesOfCode: true,
        codeSmellCount: true,
      },
    });

    this.logger.debug(`Aggregated ${layers.length} layers for project ${projectId}`);
  }

  /**
   * Update project-level health score
   */
  private async updateProjectHealth(projectId: string) {
    const stats = await this.prisma.codeMetrics.aggregate({
      where: { projectId },
      _avg: {
        maintainabilityIndex: true,
        cyclomaticComplexity: true,
      },
      _sum: {
        codeSmellCount: true,
      },
    });

    // Calculate overall health score (0-100)
    const maintainability = stats._avg.maintainabilityIndex || 0;
    const complexityPenalty = Math.min(20, (stats._avg.cyclomaticComplexity || 0) - 10);
    const smellPenalty = Math.min(20, (stats._sum.codeSmellCount || 0) / 10);

    const healthScore = Math.max(
      0,
      Math.min(100, maintainability - complexityPenalty - smellPenalty),
    );

    this.logger.log(`Project ${projectId} health score: ${healthScore.toFixed(1)}`);
  }
}

// Type definitions
interface FileMetrics {
  filePath: string;
  layer: string;
  component: string;
  loc: number;
  complexity: ComplexityMetrics;
  codeSmells: CodeSmell[];
  churn: number;
  maintainability: number;
  lastModified: Date;
}

interface ComplexityMetrics {
  cyclomatic: number;
  cognitive: number;
  maxComplexity: number;
  functions?: FunctionMetric[];
}

interface FunctionMetric {
  name: string;
  complexity: number;
  loc: number;
}

interface CodeSmell {
  type: string;
  severity: 'critical' | 'major' | 'minor';
  message: string;
  line: number;
}
