import { exec } from 'child_process';
import { promisify } from 'util';
import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { getErrorMessage } from '../../common';
import { PrismaService } from '../../prisma/prisma.service';
import { QUEUE_NAMES } from '../constants';
import { SkottAnalyzer } from './skott-analyzer';

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
  private readonly skottAnalyzer = new SkottAnalyzer();

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
        changedFiles.map((file) =>
          this.analyzeFile(projectId, project.localPath!, file, commitHash),
        ),
      );

      // 5. Save file-level metrics
      for (const fileMetric of fileMetrics) {
        await this.saveFileMetrics(projectId, fileMetric, storyId);
      }

      // 6. Update project-level health score
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

      // Load previous analysis baseline for delta comparison
      const baseline = await this.loadBaseline(projectId);
      this.logger.log(`Baseline: ${baseline.totalFiles} files, ${baseline.totalLOC} LOC, ${baseline.avgCoverage.toFixed(2)}% coverage`);

      // Load coverage data if available
      const { coverageMap, totalCoverage } = await this.loadCoverageData(project.localPath);
      if (coverageMap.size > 0) {
        this.logger.log(`Loaded coverage data for ${coverageMap.size} files`);
      }

      // Get all files in repository (including test files)
      const allFiles = await this.getAllSourceFiles(project.localPath);
      this.logger.log(`Found ${allFiles.length} source files to analyze (including test files)`);

      // Build test-source correlation map
      const testCorrelation = await this.buildTestSourceCorrelation(allFiles, project.localPath);
      this.logger.log(`Built test correlations for ${testCorrelation.size} source files`);

      // Track analysis results for baseline comparison
      const analysisResults: FileMetrics[] = [];

      // Analyze in batches to avoid overwhelming the system
      const batchSize = 10;
      for (let i = 0; i < allFiles.length; i += batchSize) {
        const batch = allFiles.slice(i, i + batchSize);
        await job.progress((i / allFiles.length) * 100);

        const fileMetrics = await Promise.all(
          batch.map((file) => this.analyzeFile(projectId, project.localPath!, file)),
        );

        for (const fileMetric of fileMetrics) {
          // Add coverage if available (only for non-test files)
          let coverage = 0;
          if (!this.isTestFile(fileMetric.filePath)) {
            coverage = coverageMap.get(fileMetric.filePath) || 0;
            if (coverage > 0) {
              this.logger.debug(`Applying ${coverage}% coverage to ${fileMetric.filePath}`);
            }
          }

          // Add test file correlation
          const testFiles = testCorrelation.get(fileMetric.filePath) || [];

          await this.saveFileMetrics(projectId, fileMetric, undefined, coverage, testFiles);
          analysisResults.push(fileMetric);
        }
      }

      // Calculate deltas from baseline
      const deltas = await this.calculateDeltas(projectId, baseline, analysisResults);
      this.logger.log(`Delta analysis: ${deltas.filesChanged} files changed, ${deltas.locDelta} LOC delta, ${deltas.coverageDelta.toFixed(2)}% coverage delta`);

      // Update project-level metrics with delta information
      await this.updateProjectHealth(projectId, deltas, totalCoverage);

      this.logger.log(`Completed full project analysis for ${projectId}`);
      return {
        success: true,
        filesAnalyzed: allFiles.length,
        totalLOC: analysisResults.reduce((sum, f) => sum + f.loc, 0),
        testFiles: allFiles.filter(f => this.isTestFile(f)).length,
        sourceFiles: allFiles.filter(f => !this.isTestFile(f)).length,
        deltas
      };
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
   * Now includes test files (.test., .spec.) for complete codebase analysis
   */
  private isSourceFile(filePath: string): boolean {
    const extensions = ['.ts', '.tsx', '.js', '.jsx', '.py', '.java', '.go', '.rs', '.sql', '.json'];
    return extensions.some((ext) => filePath.endsWith(ext)) &&
           !filePath.includes('node_modules/') &&
           !filePath.includes('dist/') &&
           !filePath.includes('build/') &&
           !filePath.includes('coverage/') &&
           !filePath.includes('package.json') &&
           !filePath.includes('package-lock.json') &&
           !filePath.includes('tsconfig.json');
  }

  /**
   * Check if file is a test file
   */
  private isTestFile(filePath: string): boolean {
    return filePath.includes('.test.') ||
           filePath.includes('.spec.') ||
           filePath.includes('__tests__/');
  }

  /**
   * Analyze a single file and calculate metrics
   */
  private async analyzeFile(
    projectId: string,
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

      // Calculate complexity metrics
      const complexity = await this.calculateComplexity(fileContent, filePath);

      // Detect code smells
      const codeSmells = await this.detectCodeSmells(fileContent, filePath);

      // Calculate churn (number of times file was modified in last 90 days)
      const churn = await this.calculateChurn(repoPath, filePath);

      // Calculate maintainability index
      const maintainability = this.calculateMaintainability(complexity, loc, codeSmells.length);

      // ST-196: Analyze dependencies
      const dependencies = await this.skottAnalyzer.analyzeFile(fileContent, filePath);

      return {
        filePath,
        loc,
        complexity,
        codeSmells,
        churn,
        maintainability,
        lastModified: new Date(),
        dependencies, // ST-196: Add dependency data
      };
    } catch (error) {
      this.logger.error(`Failed to analyze file ${filePath}:`, error);
      // Return default metrics on error
      return {
        filePath,
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
   * Calculate complexity metrics
   * Simplified version - in production, use proper parsers like typescript-eslint
   */
  private async calculateComplexity(
    content: string,
    _filePath: string,
  ): Promise<ComplexityMetrics> {
    // Simplified cyclomatic complexity calculation
    // Count decision points: if, else, for, while, case, catch, &&, ||, ?
    const decisionPoints = (content.match(/\b(if|else|for|while|case|catch)\b|&&|\|\||\?/g) || []).length;
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
   * ST-196: Now includes dependency analysis data
   */
  private async saveFileMetrics(
    projectId: string,
    metrics: FileMetrics,
    _storyId?: string,
    testCoverage?: number,
    correlatedTestFiles?: string[],
  ) {
    // Calculate risk score using canonical formula (ST-28)
    // Formula: round((complexity / 10) × churn × (100 - maintainability))
    // This matches the MCP tool formula for consistency across the system
    // Implements BR-1 (Formula Standardization) from baAnalysis
    const rawRiskScore = Math.round(
      (metrics.complexity.cyclomatic / 10) *
      metrics.churn *
      (100 - metrics.maintainability)
    );

    // Ensure bounded to 0-100 scale (BR-CALC-001)
    // Cap at 100 for extremely high-risk files
    const riskScore = Math.max(0, Math.min(100, rawRiskScore));

    // Determine if this is a test file
    const isTest = this.isTestFile(metrics.filePath);

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
        linesOfCode: metrics.loc,
        cyclomaticComplexity: metrics.complexity.cyclomatic,
        cognitiveComplexity: metrics.complexity.cognitive,
        maintainabilityIndex: metrics.maintainability,
        churnRate: metrics.churn,
        churnCount: metrics.churn,
        codeSmellCount: metrics.codeSmells.length,
        riskScore,
        testCoverage: testCoverage || 0,
        lastAnalyzedAt: new Date(),
        metadata: {
          codeSmells: metrics.codeSmells,
          functions: metrics.complexity.functions,
          isTestFile: isTest,
          correlatedTestFiles: correlatedTestFiles || [],
          // ST-196: Add dependency data
          dependencies: metrics.dependencies ? {
            imports: metrics.dependencies.imports,
            externalDependencies: metrics.dependencies.externalDependencies,
            internalDependencies: metrics.dependencies.internalDependencies,
            importedBy: metrics.dependencies.importedBy,
          } : undefined,
        } as any,
      },
      update: {
        linesOfCode: metrics.loc,
        cyclomaticComplexity: metrics.complexity.cyclomatic,
        cognitiveComplexity: metrics.complexity.cognitive,
        maintainabilityIndex: metrics.maintainability,
        churnRate: metrics.churn,
        churnCount: metrics.churn,
        codeSmellCount: metrics.codeSmells.length,
        riskScore,
        testCoverage: testCoverage || 0,
        lastAnalyzedAt: new Date(),
        metadata: {
          codeSmells: metrics.codeSmells,
          functions: metrics.complexity.functions,
          isTestFile: isTest,
          correlatedTestFiles: correlatedTestFiles || [],
          // ST-196: Add dependency data
          dependencies: metrics.dependencies ? {
            imports: metrics.dependencies.imports,
            externalDependencies: metrics.dependencies.externalDependencies,
            internalDependencies: metrics.dependencies.internalDependencies,
            importedBy: metrics.dependencies.importedBy,
          } : undefined,
        } as any,
      },
    });
  }

  /**
   * Update project-level health score
   */
  private async updateProjectHealth(projectId: string, deltas?: DeltaMetrics, totalCoverage?: number) {
    const stats = await this.prisma.codeMetrics.aggregate({
      where: { projectId },
      _avg: {
        maintainabilityIndex: true,
        cyclomaticComplexity: true,
        testCoverage: true,
      },
      _sum: {
        codeSmellCount: true,
        linesOfCode: true,
      },
      _count: {
        filePath: true,
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

    // Log comprehensive metrics
    this.logger.log(`Project ${projectId} metrics:`);
    this.logger.log(`  - Files analyzed: ${stats._count.filePath}`);
    this.logger.log(`  - Total LOC: ${stats._sum.linesOfCode}`);
    if (totalCoverage !== undefined && totalCoverage > 0) {
      this.logger.log(`  - Total coverage (from coverage file): ${totalCoverage.toFixed(2)}%`);
      this.logger.log(`  - File-level average coverage: ${(stats._avg.testCoverage || 0).toFixed(2)}%`);
    } else {
      this.logger.log(`  - Average coverage: ${(stats._avg.testCoverage || 0).toFixed(2)}%`);
    }
    this.logger.log(`  - Health score: ${healthScore.toFixed(1)}`);

    if (deltas) {
      this.logger.log(`  - Delta: ${deltas.filesChanged} files changed`);
      this.logger.log(`  - LOC delta: ${deltas.locDelta}`);
      this.logger.log(`  - Coverage delta: ${deltas.coverageDelta.toFixed(2)}%`);
      this.logger.log(`  - New tests: ${deltas.newTestCount}`);
    }

    // ST-18: Create historical snapshot after analysis
    // ST-37 Issue #1: Use total coverage from coverage file if available (more accurate than file-level average)
    const coverageToStore = totalCoverage !== undefined && totalCoverage > 0 ? totalCoverage : (stats._avg.testCoverage || 0);
    await this.createSnapshot(projectId, stats, healthScore, coverageToStore);
  }

  /**
   * ST-18: Create historical snapshot of code metrics
   * Stores aggregated project metrics for trend analysis
   */
  private async createSnapshot(
    projectId: string,
    stats: {
      _avg: {
        maintainabilityIndex: number | null;
        cyclomaticComplexity: number | null;
        testCoverage: number | null;
      };
      _sum: {
        linesOfCode: number | null;
        codeSmellCount: number | null;
      };
      _count: {
        filePath: number;
      };
    },
    healthScore: number,
    avgCoverage?: number,
  ): Promise<void> {
    try {
      // Calculate tech debt ratio from maintainability index
      const techDebtRatio = 100 - (stats._avg.maintainabilityIndex || 0);

      // ST-37 Issue #1: Use provided coverage (from total in coverage file) if available
      const coverageValue = avgCoverage !== undefined ? avgCoverage : (stats._avg.testCoverage || 0);

      // Create snapshot with current date/time
      await this.prisma.codeMetricsSnapshot.create({
        data: {
          projectId,
          snapshotDate: new Date(),
          totalFiles: stats._count.filePath || 0,
          totalLOC: stats._sum.linesOfCode || 0,
          avgComplexity: stats._avg.cyclomaticComplexity || 0,
          avgCoverage: coverageValue,
          healthScore,
          techDebtRatio,
        },
      });

      this.logger.log(`Created code metrics snapshot for project ${projectId}`);
    } catch (error) {
      // Log error but don't fail the analysis if snapshot creation fails
      this.logger.error(`Failed to create code metrics snapshot for project ${projectId}:`, error);
    }
  }

  /**
   * Load baseline metrics from previous analysis
   */
  private async loadBaseline(projectId: string): Promise<BaselineMetrics> {
    const stats = await this.prisma.codeMetrics.aggregate({
      where: { projectId },
      _sum: {
        linesOfCode: true,
      },
      _avg: {
        testCoverage: true,
      },
      _count: {
        filePath: true,
      },
    });

    // Load individual file checksums for delta detection
    const files = await this.prisma.codeMetrics.findMany({
      where: { projectId },
      select: {
        filePath: true,
        linesOfCode: true,
        cyclomaticComplexity: true,
        testCoverage: true,
        lastAnalyzedAt: true,
      },
    });

    const fileMap = new Map<string, {
      loc: number;
      complexity: number;
      coverage: number;
      lastAnalyzed: Date;
    }>();

    for (const file of files) {
      fileMap.set(file.filePath, {
        loc: file.linesOfCode,
        complexity: file.cyclomaticComplexity,
        coverage: file.testCoverage || 0,
        lastAnalyzed: file.lastAnalyzedAt,
      });
    }

    return {
      totalFiles: stats._count.filePath || 0,
      totalLOC: stats._sum.linesOfCode || 0,
      avgCoverage: stats._avg.testCoverage || 0,
      fileMap,
    };
  }

  /**
   * Calculate deltas between current analysis and baseline
   */
  private async calculateDeltas(
    projectId: string,
    baseline: BaselineMetrics,
    currentResults: FileMetrics[],
  ): Promise<DeltaMetrics> {
    let filesChanged = 0;
    let locDelta = 0;
    let newTestCount = 0;

    // Track current totals
    const currentTotalLOC = currentResults.reduce((sum, f) => sum + f.loc, 0);
    const currentTestFiles = currentResults.filter(f => this.isTestFile(f.filePath)).length;

    // Compare each file with baseline
    for (const file of currentResults) {
      const baselineFile = baseline.fileMap.get(file.filePath);

      if (!baselineFile) {
        // New file
        filesChanged++;
        locDelta += file.loc;
        if (this.isTestFile(file.filePath)) {
          newTestCount++;
        }
      } else {
        // Existing file - check for changes
        if (
          baselineFile.loc !== file.loc ||
          baselineFile.complexity !== file.complexity.cyclomatic
        ) {
          filesChanged++;
          locDelta += file.loc - baselineFile.loc;
        }
      }
    }

    // Check for deleted files
    for (const [filePath, data] of baseline.fileMap) {
      const stillExists = currentResults.some(f => f.filePath === filePath);
      if (!stillExists) {
        filesChanged++;
        locDelta -= data.loc;
      }
    }

    // Calculate coverage delta
    const currentCoverage = await this.prisma.codeMetrics.aggregate({
      where: { projectId },
      _avg: {
        testCoverage: true,
      },
    });

    const coverageDelta = (currentCoverage._avg.testCoverage || 0) - baseline.avgCoverage;

    return {
      filesChanged,
      locDelta,
      coverageDelta,
      newTestCount,
      totalFiles: currentResults.length,
      totalLOC: currentTotalLOC,
      testFileCount: currentTestFiles,
    };
  }

  /**
   * Build correlation map between source files and their test files
   *
   * BR-2 (Accurate Test Coverage): Fixed to properly handle compound test file extensions
   * like .integration.test.tsx, .e2e.test.ts, .unit.spec.ts (ST-16 Issue #2 fix)
   */
  private async buildTestSourceCorrelation(
    allFiles: string[],
    repoPath: string,
  ): Promise<Map<string, string[]>> {
    const correlation = new Map<string, string[]>();

    const testFiles = allFiles.filter(f => this.isTestFile(f));
    const sourceFiles = allFiles.filter(f => !this.isTestFile(f));

    // Common patterns for test file naming:
    // 1. foo.spec.ts tests foo.ts
    // 2. foo.test.ts tests foo.ts
    // 3. __tests__/foo.test.ts tests foo.ts (same dir)
    // 4. __tests__/foo.integration.test.tsx tests foo.tsx (compound extension)
    // 5. foo.service.spec.ts tests foo.service.ts
    for (const testFile of testFiles) {
      // Extract potential source file names
      const testFileName = testFile.split('/').pop() || '';

      // Extract base name by removing ALL test-related patterns
      // This handles compound extensions like .integration.test.tsx → .tsx
      const baseNames: string[] = [];

      // Strategy 1: Remove .test.* or .spec.* and everything before the final extension
      // Example: "Foo.integration.test.tsx" → "Foo.tsx"
      const extensionMatch = testFileName.match(/\.(tsx?|jsx?|mjs|cjs)$/);
      if (extensionMatch) {
        const extension = extensionMatch[0]; // e.g., ".tsx"
        const nameWithoutExt = testFileName.slice(0, -extension.length); // "Foo.integration.test"

        // Remove all test/spec patterns and get the core name
        const coreName = nameWithoutExt
          .replace(/\.(test|spec)$/, '')           // Remove trailing .test or .spec
          .replace(/\.(unit|integration|e2e)$/, '') // Remove test type qualifiers
          .replace(/\.(test|spec)$/, '');          // Remove again in case of multiple patterns

        baseNames.push(coreName + extension); // "Foo.tsx"
      }

      // Strategy 2: Simple replace for backward compatibility
      if (testFileName.includes('.test.')) {
        baseNames.push(testFileName.replace('.test.', '.'));
      }
      if (testFileName.includes('.spec.')) {
        baseNames.push(testFileName.replace('.spec.', '.'));
      }

      // Try to match with source files using filename-based matching
      for (const baseName of baseNames) {
        for (const sourceFile of sourceFiles) {
          const sourceName = sourceFile.split('/').pop() || '';

          if (sourceName === baseName) {
            // Found correlation
            if (!correlation.has(sourceFile)) {
              correlation.set(sourceFile, []);
            }
            if (!correlation.get(sourceFile)!.includes(testFile)) {
              correlation.get(sourceFile)!.push(testFile);
            }
          }
        }
      }

      // Strategy 3: Directory-based matching for __tests__ folders
      // Example: pages/__tests__/Foo.integration.test.tsx tests pages/Foo.tsx
      if (testFile.includes('__tests__/')) {
        const testDir = testFile.substring(0, testFile.indexOf('__tests__/'));

        for (const sourceFile of sourceFiles) {
          // Source must be in same parent directory (not subdirectory)
          if (sourceFile.startsWith(testDir) && !sourceFile.includes('__tests__/')) {
            const sourceName = sourceFile.split('/').pop() || '';

            // Use the cleaned base names from Strategy 1
            for (const baseName of baseNames) {
              if (sourceName === baseName) {
                if (!correlation.has(sourceFile)) {
                  correlation.set(sourceFile, []);
                }
                if (!correlation.get(sourceFile)!.includes(testFile)) {
                  correlation.get(sourceFile)!.push(testFile);
                }
              }
            }
          }
        }
      }
    }

    return correlation;
  }

  /**
   * Load test coverage data from Jest coverage JSON
   * Returns a map of file paths to coverage percentages and total project coverage
   */
  private async loadCoverageData(repoPath: string): Promise<{ coverageMap: Map<string, number>; totalCoverage: number }> {
    const coverageMap = new Map<string, number>();
    let totalCoverage = 0;

    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const fs = require('fs').promises;
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const path = require('path');

      // Try common coverage file locations (try coverage-final.json first as it's always generated)
      const coveragePaths = [
        { path: path.join(repoPath, 'coverage', 'coverage-final.json'), type: 'final' },
        { path: path.join(repoPath, 'backend', 'coverage', 'coverage-final.json'), type: 'final' },
        { path: path.join(repoPath, 'frontend', 'coverage', 'coverage-final.json'), type: 'final' },
        { path: path.join(repoPath, 'coverage', 'coverage-summary.json'), type: 'summary' },
        { path: path.join(repoPath, 'backend', 'coverage', 'coverage-summary.json'), type: 'summary' },
        { path: path.join(repoPath, 'frontend', 'coverage', 'coverage-summary.json'), type: 'summary' },
      ];

      for (const { path: coveragePath, type } of coveragePaths) {
        try {
          const content = await fs.readFile(coveragePath, 'utf8');
          const coverageData = JSON.parse(content);
          let filesLoaded = 0;

          // Extract total project coverage first (from 'total' field)
          if (coverageData.total && type === 'summary') {
            totalCoverage = coverageData.total.lines?.pct || coverageData.total.statements?.pct || 0;
            this.logger.log(`Extracted total project coverage: ${totalCoverage}%`);
          }

          // Parse coverage based on file type
          for (const [filePath, data] of Object.entries(coverageData)) {
            if (filePath === 'total') continue;

            const fileData = data as Record<string, unknown>;
            let coverage = 0;

            if (type === 'summary') {
              // Parse coverage-summary.json format (has .statements.pct)
              const statements = fileData.statements as { pct?: number } | undefined;
              coverage = statements?.pct || 0;
            } else {
              // Parse coverage-final.json format (has .s, .b, .f objects)
              const statements = (fileData.s as Record<string, number>) || {};
              const branches = (fileData.b as Record<string, number[]>) || {};
              const functions = (fileData.f as Record<string, number>) || {};

              const stmtTotal = Object.keys(statements).length;
              const stmtCovered = Object.values(statements).filter((v) => v > 0).length;
              const stmtPercent = stmtTotal > 0 ? (stmtCovered / stmtTotal) * 100 : 100;

              const branchTotal = Object.keys(branches).length;
              let branchCovered = 0;
              for (const branchArray of Object.values(branches)) {
                if (Array.isArray(branchArray)) {
                  branchCovered += branchArray.filter((v) => v > 0).length;
                }
              }
              const branchPercent = branchTotal > 0 ? (branchCovered / (branchTotal * 2)) * 100 : 100;

              const funcTotal = Object.keys(functions).length;
              const funcCovered = Object.values(functions).filter((v) => v > 0).length;
              const funcPercent = funcTotal > 0 ? (funcCovered / funcTotal) * 100 : 100;

              // Average of statement, branch, and function coverage
              coverage = Math.round((stmtPercent + branchPercent + funcPercent) / 3);
            }

            // Normalize file path to be relative to repo root
            // Handle multiple path formats:
            // 1. Container paths: /app/backend/...
            // 2. Host paths: /opt/stack/AIStudio/backend/...
            // 3. Already relative: backend/...
            let relativePath = filePath;

            // Remove known absolute path prefixes
            const pathPrefixes = [
              repoPath + '/',                    // /app/ (container)
              '/opt/stack/AIStudio/',            // /opt/stack/AIStudio/ (host)
              '/app/',                           // /app/ (alternative format)
            ];

            for (const prefix of pathPrefixes) {
              if (relativePath.startsWith(prefix)) {
                relativePath = relativePath.substring(prefix.length);
                break;
              }
            }

            // If still absolute, try to extract relative path from common patterns
            if (relativePath.startsWith('/')) {
              const parts = relativePath.split('/');
              const markers = ['backend', 'frontend', 'shared'];
              for (const marker of markers) {
                const index = parts.indexOf(marker);
                if (index >= 0) {
                  relativePath = parts.slice(index).join('/');
                  break;
                }
              }
            }

            // Only add to map if we successfully normalized the path AND not already present
            // This allows merging coverage from multiple locations (frontend + backend)
            if (!relativePath.startsWith('/') && relativePath.includes('/') && !coverageMap.has(relativePath)) {
              coverageMap.set(relativePath, coverage);
              filesLoaded++;
              this.logger.debug(`Mapped coverage: ${filePath} -> ${relativePath} (${coverage}%)`);
            } else if (coverageMap.has(relativePath)) {
              this.logger.debug(`Skipping duplicate coverage: ${relativePath}`);
            } else {
              this.logger.warn(`Failed to normalize coverage path: ${filePath}`);
            }
          }
          // Log what was loaded from this file, but continue to load from other locations
          if (filesLoaded > 0) {
            this.logger.log(`Loaded coverage from ${coveragePath} (${type} format) - ${filesLoaded} files`);
          } else {
            this.logger.debug(`Coverage file ${coveragePath} is empty or has no valid entries, trying next location`);
          }
        } catch (err) {
          // File doesn't exist, try next location
          continue;
        }
      }

      this.logger.log(`Total coverage data loaded for ${coverageMap.size} files`);

      return { coverageMap, totalCoverage };
    } catch (error) {
      this.logger.debug(`No coverage data found: ${getErrorMessage(error)}`);
      return { coverageMap, totalCoverage };
    }
  }
}

// Type definitions
interface FileMetrics {
  filePath: string;
  loc: number;
  complexity: ComplexityMetrics;
  codeSmells: CodeSmell[];
  churn: number;
  maintainability: number;
  lastModified: Date;
  dependencies?: {
    imports: string[];
    externalDependencies: string[];
    internalDependencies: string[];
    importedBy: string[];
  }; // ST-196: Dependency analysis data
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

interface BaselineMetrics {
  totalFiles: number;
  totalLOC: number;
  avgCoverage: number;
  fileMap: Map<string, {
    loc: number;
    complexity: number;
    coverage: number;
    lastAnalyzed: Date;
  }>;
}

interface DeltaMetrics {
  filesChanged: number;
  locDelta: number;
  coverageDelta: number;
  newTestCount: number;
  totalFiles: number;
  totalLOC: number;
  testFileCount: number;
}
