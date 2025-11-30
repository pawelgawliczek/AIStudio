/**
 * Build Decision Service - ST-115 Intelligent Change Detection
 *
 * Analyzes git diff to determine which services need rebuilding,
 * enabling significant build time reduction by skipping unchanged services.
 *
 * File Classification:
 * - Backend: backend/, shared/, prisma/
 * - Frontend: frontend/, shared/
 * - Docs: *.md, docs/, .github/
 * - Both: shared/ (affects both services)
 */

import { execSync } from 'child_process';
import { PrismaClient } from '@prisma/client';

// ============================================================================
// Types
// ============================================================================

export enum ChangeType {
  BACKEND_ONLY = 'backend_only',
  FRONTEND_ONLY = 'frontend_only',
  BOTH = 'both',
  DOCS_ONLY = 'docs_only',
  NONE = 'none',
}

export interface ChangeAnalysis {
  changeType: ChangeType;
  backendFiles: string[];
  frontendFiles: string[];
  sharedFiles: string[];
  docsFiles: string[];
  totalChangedFiles: number;
  reason: string;
  skipBackendBuild: boolean;
  skipFrontendBuild: boolean;
}

export interface BuildDecision {
  skipBackendBuild: boolean;
  skipFrontendBuild: boolean;
  reason: string;
  analysis: ChangeAnalysis;
}

// ============================================================================
// Service Implementation
// ============================================================================

export class BuildDecisionService {
  private prisma: PrismaClient;
  private projectRoot: string;

  // File patterns for classification
  private readonly backendPatterns = ['backend/', 'prisma/', 'shared/'];
  private readonly frontendPatterns = ['frontend/', 'shared/'];
  private readonly docsPatterns = ['.md', 'docs/', '.github/', 'README', 'LICENSE'];

  constructor(prisma: PrismaClient, projectRoot: string) {
    this.prisma = prisma;
    this.projectRoot = projectRoot;
  }

  /**
   * Analyze git diff to determine what services need rebuilding
   */
  async analyzeChanges(fromCommit: string, toCommit: string = 'HEAD'): Promise<ChangeAnalysis> {
    console.log(`[BuildDecisionService] Analyzing changes from ${fromCommit.substring(0, 7)} to ${toCommit.substring(0, 7)}`);

    // Get changed files
    const changedFiles = this.getChangedFiles(fromCommit, toCommit);

    if (changedFiles.length === 0) {
      return {
        changeType: ChangeType.NONE,
        backendFiles: [],
        frontendFiles: [],
        sharedFiles: [],
        docsFiles: [],
        totalChangedFiles: 0,
        reason: 'No files changed between commits',
        skipBackendBuild: true,
        skipFrontendBuild: true,
      };
    }

    // Classify files
    const backendFiles = changedFiles.filter(f => this.isBackendFile(f));
    const frontendFiles = changedFiles.filter(f => this.isFrontendFile(f));
    const sharedFiles = changedFiles.filter(f => this.isSharedFile(f));
    const docsFiles = changedFiles.filter(f => this.isDocsFile(f));

    // Determine change type
    const hasBackendChanges = backendFiles.length > 0 || sharedFiles.length > 0;
    const hasFrontendChanges = frontendFiles.length > 0 || sharedFiles.length > 0;
    const onlyDocsChanged = changedFiles.every(f => this.isDocsFile(f));

    let changeType: ChangeType;
    let reason: string;
    let skipBackendBuild = false;
    let skipFrontendBuild = false;

    if (onlyDocsChanged) {
      changeType = ChangeType.DOCS_ONLY;
      reason = `Only documentation files changed (${docsFiles.length} files)`;
      skipBackendBuild = true;
      skipFrontendBuild = true;
    } else if (hasBackendChanges && !hasFrontendChanges) {
      changeType = ChangeType.BACKEND_ONLY;
      reason = `Backend-only changes detected (${backendFiles.length} backend + ${sharedFiles.length} shared files)`;
      skipFrontendBuild = true;
    } else if (hasFrontendChanges && !hasBackendChanges) {
      changeType = ChangeType.FRONTEND_ONLY;
      reason = `Frontend-only changes detected (${frontendFiles.length} frontend + ${sharedFiles.length} shared files)`;
      skipBackendBuild = true;
    } else if (hasBackendChanges && hasFrontendChanges) {
      changeType = ChangeType.BOTH;
      reason = `Changes affect both services (${backendFiles.length} backend, ${frontendFiles.length} frontend, ${sharedFiles.length} shared)`;
    } else {
      changeType = ChangeType.NONE;
      reason = 'No relevant service files changed';
      skipBackendBuild = true;
      skipFrontendBuild = true;
    }

    console.log(`[BuildDecisionService] Change type: ${changeType}`);
    console.log(`[BuildDecisionService] ${reason}`);

    return {
      changeType,
      backendFiles,
      frontendFiles,
      sharedFiles,
      docsFiles,
      totalChangedFiles: changedFiles.length,
      reason,
      skipBackendBuild,
      skipFrontendBuild,
    };
  }

  /**
   * Get last deployed commit for a service
   */
  async getLastDeployedCommit(service: 'backend' | 'frontend'): Promise<string | null> {
    const state = await this.prisma.serviceDeploymentState.findUnique({
      where: { service },
    });
    return state?.lastDeployedCommit ?? null;
  }

  /**
   * Update deployment state after successful deploy
   */
  async recordDeployment(
    service: 'backend' | 'frontend',
    commitHash: string,
    filesChanged: string[] = [],
    metadata?: Record<string, any>
  ): Promise<void> {
    console.log(`[BuildDecisionService] Recording deployment for ${service} at ${commitHash.substring(0, 7)}`);

    await this.prisma.serviceDeploymentState.upsert({
      where: { service },
      update: {
        lastDeployedCommit: commitHash,
        lastDeployedAt: new Date(),
        filesChanged,
        metadata: metadata ?? {},
      },
      create: {
        service,
        lastDeployedCommit: commitHash,
        lastDeployedAt: new Date(),
        filesChanged,
        metadata: metadata ?? {},
      },
    });
  }

  /**
   * Make a build decision based on current state and target commit
   */
  async makeBuildDecision(targetCommit: string = 'HEAD'): Promise<BuildDecision> {
    // Get current commit if HEAD (with error handling)
    let currentCommit: string;
    try {
      currentCommit = targetCommit === 'HEAD'
        ? this.getCurrentCommit()
        : targetCommit;
    } catch (error: any) {
      console.error(`[BuildDecisionService] Failed to get current commit: ${error.message}`);
      // Return safe "no changes" decision on error
      return {
        skipBackendBuild: true,
        skipFrontendBuild: true,
        reason: 'Git error - unable to determine changes',
        analysis: {
          changeType: ChangeType.NONE,
          backendFiles: [],
          frontendFiles: [],
          sharedFiles: [],
          docsFiles: [],
          totalChangedFiles: 0,
          reason: 'Git command failed',
          skipBackendBuild: true,
          skipFrontendBuild: true,
        },
      };
    }

    // Get last deployed commits for both services
    const [lastBackendCommit, lastFrontendCommit] = await Promise.all([
      this.getLastDeployedCommit('backend'),
      this.getLastDeployedCommit('frontend'),
    ]);

    // If no deployment history, build both
    if (!lastBackendCommit && !lastFrontendCommit) {
      return {
        skipBackendBuild: false,
        skipFrontendBuild: false,
        reason: 'No deployment history found - building both services',
        analysis: {
          changeType: ChangeType.BOTH,
          backendFiles: [],
          frontendFiles: [],
          sharedFiles: [],
          docsFiles: [],
          totalChangedFiles: 0,
          reason: 'Initial deployment',
          skipBackendBuild: false,
          skipFrontendBuild: false,
        },
      };
    }

    // Use the oldest deployed commit as base for comparison
    const baseCommit = this.getOldestCommit(lastBackendCommit, lastFrontendCommit);

    // Analyze changes
    const analysis = await this.analyzeChanges(baseCommit!, currentCommit);

    return {
      skipBackendBuild: analysis.skipBackendBuild,
      skipFrontendBuild: analysis.skipFrontendBuild,
      reason: analysis.reason,
      analysis,
    };
  }

  // ==========================================================================
  // Private Helpers
  // ==========================================================================

  private getChangedFiles(fromCommit: string, toCommit: string): string[] {
    try {
      const output = execSync(`git diff --name-only ${fromCommit}..${toCommit}`, {
        cwd: this.projectRoot,
        encoding: 'utf-8',
      }).trim();

      if (!output) return [];

      return output.split('\n').filter(f => f.length > 0);
    } catch (error: any) {
      console.error(`[BuildDecisionService] Failed to get changed files: ${error.message}`);
      return [];
    }
  }

  private getCurrentCommit(): string {
    return execSync('git rev-parse HEAD', {
      cwd: this.projectRoot,
      encoding: 'utf-8',
    }).trim();
  }

  private getOldestCommit(commit1: string | null, commit2: string | null): string | null {
    if (!commit1) return commit2;
    if (!commit2) return commit1;

    // Use git to determine which commit is older (has more ancestors)
    try {
      const result = execSync(`git merge-base ${commit1} ${commit2}`, {
        cwd: this.projectRoot,
        encoding: 'utf-8',
      }).trim();

      // Return the one that equals the merge-base (it's older)
      if (result === commit1) return commit1;
      if (result === commit2) return commit2;

      // If neither, return merge-base
      return result;
    } catch {
      // Fallback: return first commit
      return commit1;
    }
  }

  private isBackendFile(file: string): boolean {
    return file.startsWith('backend/') || file.startsWith('prisma/');
  }

  private isFrontendFile(file: string): boolean {
    return file.startsWith('frontend/');
  }

  private isSharedFile(file: string): boolean {
    return file.startsWith('shared/');
  }

  private isDocsFile(file: string): boolean {
    return this.docsPatterns.some(pattern => {
      // Handle file extensions (e.g., .md)
      if (pattern.startsWith('.') && !pattern.includes('/')) {
        return file.endsWith(pattern);
      }
      // Handle directory patterns (e.g., docs/, .github/)
      return file.startsWith(pattern) || file.includes(`/${pattern}`);
    });
  }
}
