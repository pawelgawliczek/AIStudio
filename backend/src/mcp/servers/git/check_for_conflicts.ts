/**
 * MCP Tool: Check for Conflicts
 *
 * Non-destructive conflict detection using git merge-tree to simulate merge
 * without modifying the worktree. Detects conflicts proactively before deployment.
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { PrismaClient, Prisma } from '@prisma/client';
import {
  NotFoundError,
  ValidationError,
} from '../../types.js';
import {
  validateRequired,
  handlePrismaError,
} from '../../utils.js';
import { execGit, execGitLocationAware, validateWorktreePath } from './git_utils.js';

// Tool definition
export const tool: Tool = {
  name: 'mcp__vibestudio__check_for_conflicts',
  description: 'Check for merge conflicts without modifying worktree. Uses git merge-tree simulation.',
  inputSchema: {
    type: 'object',
    properties: {
      storyId: {
        type: 'string',
        description: 'Story UUID (required)',
      },
      target: {
        type: 'string',
        enum: ['auto', 'laptop', 'kvm'],
        description: 'ST-153: Override target host for git execution (default: auto-detect from worktree hostType)',
      },
    },
    required: ['storyId'],
  },
};

export const metadata = {
  category: 'git',
  domain: 'development',
  tags: ['git', 'conflicts', 'merge', 'testing'],
  version: '1.0.0',
  since: 'sprint-6',
};

// Types
export interface CheckConflictsParams {
  storyId: string;
  target?: 'auto' | 'laptop' | 'kvm';
}

export interface ConflictFile {
  path: string;
  conflictType: 'content' | 'rename' | 'delete' | 'mode' | 'binary';
  details: string;
  stage?: number;
}

export interface CheckConflictsResult {
  hasConflicts: boolean;
  conflictCount: number;
  conflictingFiles: ConflictFile[];
  mergeableWithMain: boolean;
  baseCommit: string;
  headCommit: string;
  detectedAt: string;
  executedOn?: 'kvm' | 'laptop';
}

/**
 * Validate git version meets minimum requirements
 * Git 2.38+ required for merge-tree --write-tree support
 */
function validateGitVersion(): void {
  const versionOutput = execGit('git --version');
  const match = versionOutput.match(/git version (\d+)\.(\d+)/);

  if (!match) {
    throw new ValidationError('Unable to determine git version');
  }

  const major = parseInt(match[1]);
  const minor = parseInt(match[2]);

  if (major < 2 || (major === 2 && minor < 38)) {
    throw new ValidationError(
      `Git 2.38+ required for merge-tree conflict detection. Current version: ${versionOutput.trim()}`
    );
  }
}

/**
 * Execute git merge-tree to simulate merge without modifying working directory
 *
 * @param mainRepoPath - Path to main repository (/opt/stack/AIStudio)
 * @param baseBranch - Base branch to merge into (origin/main)
 * @param headBranch - Branch to merge (worktree branch name)
 * @param timeout - Timeout in milliseconds (default: 30000)
 * @returns Object with stdout, stderr, and exit code
 */
function simulateMerge(
  mainRepoPath: string,
  baseBranch: string,
  headBranch: string,
  timeout: number = 30000
): { stdout: string; stderr: string; exitCode: number } {
  try {
    const stdout = execGit(
      `git merge-tree --write-tree ${baseBranch} ${headBranch}`,
      mainRepoPath,
      timeout
    );
    return { stdout, stderr: '', exitCode: 0 };
  } catch (error: any) {
    // Exit code 1 indicates conflicts (expected outcome)
    // Exit code 128 or other indicates error
    const exitCode = error.status || 1;
    const stdout = error.stdout?.toString() || '';
    const stderr = error.stderr?.toString() || error.message || '';

    // Check if this is a timeout error
    if (error.message?.includes('timeout') || error.killed) {
      throw new Error(`Merge tree operation timed out after ${timeout / 1000} seconds. Retry or check repository size.`);
    }

    // Exit code 1 with conflict markers is expected for conflicts
    if (exitCode === 1 && (stdout.includes('Conflicted file info') || stderr.includes('CONFLICT'))) {
      return { stdout, stderr, exitCode: 1 };
    }

    // Other errors are unexpected
    throw new Error(`Git merge-tree failed: ${stderr || error.message}`);
  }
}

/**
 * Parse git merge-tree output to extract conflicting files
 *
 * Per git documentation: "Do NOT look through the resulting toplevel tree"
 * Instead, parse "Conflicted file info" section from stdout
 *
 * Format example:
 * Conflicted file info:
 * <mode> <object> <stage> <filename>
 * 100644 abc123... 1 backend/src/file.ts
 * 100644 def456... 2 backend/src/file.ts
 * 100644 ghi789... 3 backend/src/file.ts
 *
 * @param output - stdout from git merge-tree command
 * @param exitCode - Exit code from git command
 * @returns Array of conflict files with details
 */
function parseMergeTreeOutput(output: string, exitCode: number): ConflictFile[] {
  const conflicts: ConflictFile[] = [];

  // No conflicts if exit code is 0
  if (exitCode === 0) {
    return conflicts;
  }

  // Find "Conflicted file info" section
  const conflictSectionMatch = output.match(/Conflicted file info:([\s\S]*?)(?=\n\n|$)/);
  if (!conflictSectionMatch) {
    // No conflict section found, but exit code 1 - check stderr for conflict types
    return parseConflictFromStderr(output);
  }

  const conflictSection = conflictSectionMatch[1];
  const lines = conflictSection.trim().split('\n');

  // Track unique files (stages 1,2,3 represent same file)
  const fileMap = new Map<string, ConflictFile>();

  for (const line of lines) {
    if (!line.trim()) continue;

    // Parse line: <mode> <object> <stage> <filename>
    const parts = line.trim().split(/\s+/);
    if (parts.length < 4) continue;

    const stage = parseInt(parts[2]);
    const filePath = parts.slice(3).join(' '); // Handle paths with spaces

    if (!fileMap.has(filePath)) {
      // Detect conflict type
      const conflictType = detectConflictType(output, filePath);

      fileMap.set(filePath, {
        path: filePath,
        conflictType,
        details: generateConflictDetails(conflictType, filePath),
        stage,
      });
    }
  }

  return Array.from(fileMap.values());
}

/**
 * Parse conflict information from stderr when "Conflicted file info" section not present
 */
function parseConflictFromStderr(output: string): ConflictFile[] {
  const conflicts: ConflictFile[] = [];

  // Look for CONFLICT markers in output
  const conflictLines = output.split('\n').filter(line => line.includes('CONFLICT'));

  for (const line of conflictLines) {
    // Parse different conflict types
    // CONFLICT (content): Merge conflict in <file>
    // CONFLICT (modify/delete): <file> deleted in HEAD and modified in branch
    // CONFLICT (rename/delete): <file> deleted in HEAD and renamed in branch

    const contentMatch = line.match(/CONFLICT \(content\): Merge conflict in (.+)/);
    const modifyDeleteMatch = line.match(/CONFLICT \(modify\/delete\): (.+?) deleted/);
    const renameMatch = line.match(/CONFLICT \(rename\/\w+\): (.+?) renamed/);
    const modeMatch = line.match(/CONFLICT \(file\/directory\): (.+)/);

    if (contentMatch) {
      conflicts.push({
        path: contentMatch[1].trim(),
        conflictType: 'content',
        details: 'Content conflict: file modified in both branches',
      });
    } else if (modifyDeleteMatch) {
      conflicts.push({
        path: modifyDeleteMatch[1].trim(),
        conflictType: 'delete',
        details: 'Modify/delete conflict: file modified in one branch and deleted in another',
      });
    } else if (renameMatch) {
      conflicts.push({
        path: renameMatch[1].trim(),
        conflictType: 'rename',
        details: 'Rename conflict: file renamed differently in both branches',
      });
    } else if (modeMatch) {
      conflicts.push({
        path: modeMatch[1].trim(),
        conflictType: 'mode',
        details: 'File/directory conflict: file and directory with same name',
      });
    }
  }

  return conflicts;
}

/**
 * Detect conflict type from merge-tree output
 */
function detectConflictType(output: string, filePath: string): ConflictFile['conflictType'] {
  const lowerOutput = output.toLowerCase();

  // Check for specific conflict types mentioned in output
  if (lowerOutput.includes(`rename`) && lowerOutput.includes(filePath.toLowerCase())) {
    return 'rename';
  }
  if (lowerOutput.includes(`delete`) && lowerOutput.includes(filePath.toLowerCase())) {
    return 'delete';
  }
  if (lowerOutput.includes(`mode change`) && lowerOutput.includes(filePath.toLowerCase())) {
    return 'mode';
  }
  if (lowerOutput.includes(`binary`) && lowerOutput.includes(filePath.toLowerCase())) {
    return 'binary';
  }

  // Default to content conflict
  return 'content';
}

/**
 * Generate human-readable conflict details
 */
function generateConflictDetails(conflictType: ConflictFile['conflictType'], filePath: string): string {
  switch (conflictType) {
    case 'content':
      return `Content conflict: file modified in both branches`;
    case 'rename':
      return `Rename conflict: file renamed differently in both branches`;
    case 'delete':
      return `Modify/delete conflict: file modified in one branch and deleted in another`;
    case 'mode':
      return `Mode conflict: file permissions or type changed`;
    case 'binary':
      return `Binary file conflict: binary file modified in both branches`;
    default:
      return `Merge conflict detected`;
  }
}

/**
 * Retry operation with exponential backoff
 */
async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  maxAttempts: number = 3,
  initialDelay: number = 2000
): Promise<T> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      if (attempt === maxAttempts) throw error;

      const delay = initialDelay * Math.pow(2, attempt - 1);
      console.log(`Retry attempt ${attempt}/${maxAttempts} after ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw new Error('Retry logic failed');
}

/**
 * Main handler for check_for_conflicts tool
 */
export async function handler(
  prisma: PrismaClient,
  params: CheckConflictsParams
): Promise<CheckConflictsResult> {
  try {
    validateRequired(params, ['storyId']);

    // Validate git version
    validateGitVersion();

    let mainRepoPath = '/opt/stack/AIStudio'; // Default KVM path
    const detectedAt = new Date().toISOString();

    // 1. Fetch story and worktree from database
    const story = await prisma.story.findUnique({
      where: { id: params.storyId },
      include: {
        worktrees: {
          where: {
            status: { in: ['active', 'idle'] },
          },
          orderBy: {
            createdAt: 'desc',
          },
          take: 1,
        },
      },
    });

    if (!story) {
      throw new NotFoundError('Story', params.storyId);
    }

    if (!story.worktrees || story.worktrees.length === 0) {
      throw new NotFoundError(
        'Worktree',
        `No active worktree found for story ${story.key}. Use git_create_worktree to create one.`
      );
    }

    const worktree = story.worktrees[0];
    let executedOn: 'kvm' | 'laptop' | undefined;

    // ST-153: Build location-aware options
    const locationOptions = {
      storyId: params.storyId,
      worktreeId: worktree.id,
      target: params.target || 'auto' as const,
      prisma,
    };

    // 2. Validate worktree path (security check) - ST-158: pass hostType for laptop worktrees
    validateWorktreePath(worktree.worktreePath, worktree.hostType || undefined);

    // ST-158: Determine target and get correct repo path
    const effectiveTarget = params.target || (worktree.hostType === 'local' ? 'laptop' : 'kvm');
    if (effectiveTarget === 'laptop') {
      // Query agent config for laptop project path
      const agent = await prisma.remoteAgent.findFirst({
        where: {
          status: 'online',
          capabilities: { has: 'git-execute' },
        },
      });
      if (agent) {
        const agentConfig = (agent.config as Record<string, unknown>) || {};
        mainRepoPath = (agentConfig.projectPath as string) || '/Users/pawelgawliczek/projects/AIStudio';
      } else {
        // Fallback to laptop default if agent offline
        mainRepoPath = '/Users/pawelgawliczek/projects/AIStudio';
      }
      console.log(`[ST-158] Checking conflicts on laptop, using mainRepoPath: ${mainRepoPath}`);
    }

    // 3. Fetch latest origin/main with retry logic (network resilience) - ST-153: location-aware
    console.log('Fetching latest from origin/main...');
    await retryWithBackoff(async () => {
      const fetchResult = await execGitLocationAware('git fetch origin main', mainRepoPath, locationOptions);
      executedOn = fetchResult.executedOn;
      if (!fetchResult.success) {
        throw new Error(fetchResult.error || 'Failed to fetch');
      }
    }, 3, 2000);

    // 4. Get commit hashes for tracking (ST-153: location-aware)
    const baseResult = await execGitLocationAware('git rev-parse origin/main', mainRepoPath, locationOptions);
    const baseCommit = (baseResult.output || '').trim();
    const headResult = await execGitLocationAware(`git rev-parse ${worktree.branchName}`, mainRepoPath, locationOptions);
    const headCommit = (headResult.output || '').trim();

    console.log(`Checking for conflicts: origin/main (${baseCommit.substring(0, 7)}) vs ${worktree.branchName} (${headCommit.substring(0, 7)})`);

    // 5. Execute merge-tree simulation
    const mergeResult = simulateMerge(
      mainRepoPath,
      'origin/main',
      worktree.branchName,
      30000 // 30 second timeout
    );

    // 6. Parse conflict output
    const conflictingFiles = parseMergeTreeOutput(mergeResult.stdout, mergeResult.exitCode);
    const hasConflicts = conflictingFiles.length > 0;

    console.log(hasConflicts
      ? `✗ Conflicts detected: ${conflictingFiles.length} file(s)`
      : '✓ No conflicts detected'
    );

    // 7. Update Story.metadata with conflict details
    const conflictDetails = {
      detectedAt,
      hasConflicts,
      conflictingFiles: conflictingFiles.map(cf => ({
        path: cf.path,
        conflictType: cf.conflictType,
        details: cf.details,
      })),
      baseCommit,
      headCommit,
      resolution: hasConflicts ? 'pending' : 'resolved',
    };

    const currentMetadata = (story.metadata as Prisma.JsonObject) || {};
    await prisma.story.update({
      where: { id: params.storyId },
      data: {
        metadata: {
          ...currentMetadata,
          conflictDetails,
        } as Prisma.InputJsonValue,
      },
    });

    return {
      hasConflicts,
      conflictCount: conflictingFiles.length,
      conflictingFiles,
      mergeableWithMain: !hasConflicts,
      baseCommit,
      headCommit,
      detectedAt,
      executedOn,
    };
  } catch (error: any) {
    if (error.name === 'MCPError') {
      throw error;
    }
    throw handlePrismaError(error, 'check_for_conflicts');
  }
}
