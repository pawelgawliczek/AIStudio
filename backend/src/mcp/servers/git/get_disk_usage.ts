/**
 * Get Disk Usage Tool
 *
 * Provides on-demand disk space monitoring with comprehensive worktree analysis:
 * - System disk space metrics (total, used, available, percent)
 * - Worktree count and disk usage statistics
 * - Stale worktree detection (active but updatedAt > 14 days)
 * - Actionable recommendations for cleanup
 *
 * Business Requirements (from baAnalysis - ST-54):
 * - AC6: On-demand disk usage check via MCP tool
 * - AC7: Returns comprehensive disk usage metrics
 * - AC8: Provides actionable cleanup recommendations
 *
 * Architecture (from architectAnalysis - ST-54):
 * - Uses df command for system disk space (fast, subsecond)
 * - Optionally calculates per-worktree usage with du command (slower)
 * - 5-minute cache to prevent filesystem hammering
 * - Supports project-level filtering
 * - Identifies stale worktrees via database query
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { PrismaClient } from '@prisma/client';
import { handlePrismaError } from '../../utils';
import { getDiskUsageMB } from './git_utils';
import { execSync } from 'child_process';

export const tool: Tool = {
  name: 'get_disk_usage',
  description:
    'Get current disk usage metrics including system disk space, worktree count, and stalled worktree list. Use this for on-demand disk space checks and capacity planning.',
  inputSchema: {
    type: 'object',
    properties: {
      projectId: {
        type: 'string',
        description: 'Optional: Filter worktrees by project UUID (via story relationship)',
      },
      includeWorktreeDetails: {
        type: 'boolean',
        description:
          'Include detailed size calculation for each worktree (default: true). Set to false for faster execution.',
      },
      includeStalledOnly: {
        type: 'boolean',
        description:
          'Return only stalled worktrees (updatedAt > 14 days) in details (default: false)',
      },
    },
    required: [],
  },
};

export const metadata = {
  category: 'git',
  domain: 'operations',
  tags: ['disk', 'monitoring', 'worktree', 'cleanup', 'alerts'],
  version: '1.0.0',
  since: 'sprint-7',
  story: 'ST-54',
};

// ============================================================================
// Types
// ============================================================================

interface GetDiskUsageParams {
  projectId?: string;
  includeWorktreeDetails?: boolean;
  includeStalledOnly?: boolean;
}

interface StalledWorktreeInfo {
  id: string;
  storyId: string;
  storyKey: string;
  branchName: string;
  worktreePath: string;
  diskUsageMB: number | null;
  lastUpdated: string;
  daysStale: number;
}

interface WorktreeDetail {
  id: string;
  storyKey: string;
  branchName: string;
  status: string;
  diskUsageMB: number | null;
  createdAt: string;
  updatedAt: string;
  ageInDays: number;
  isStalled: boolean;
}

interface GetDiskUsageResponse {
  timestamp: string;
  systemDiskSpace: {
    totalSpaceGB: number;
    usedSpaceGB: number;
    availableSpaceGB: number;
    percentUsed: number;
    mountPoint: string;
  };
  worktrees: {
    totalCount: number;
    activeCount: number;
    totalUsageMB: number;
    averageUsageMB: number;
    stalledCount: number;
    details?: WorktreeDetail[];
  };
  stalledWorktrees: StalledWorktreeInfo[];
  alertStatus: {
    isCritical: boolean; // < 2GB
    isWarning: boolean; // < 5GB
    availableSpaceGB: number;
  };
  recommendations: string[];
}

// ============================================================================
// Cache Implementation (5-minute TTL)
// ============================================================================

interface CacheEntry {
  data: GetDiskUsageResponse;
  timestamp: number;
}

const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function getCacheKey(params: GetDiskUsageParams): string {
  const { projectId = 'all', includeWorktreeDetails = true, includeStalledOnly = false } = params;
  return `disk-usage:${projectId}:${includeWorktreeDetails}:${includeStalledOnly}`;
}

function getCached(key: string): GetDiskUsageResponse | null {
  const entry = cache.get(key);
  if (entry && Date.now() - entry.timestamp < CACHE_TTL_MS) {
    return entry.data;
  }
  cache.delete(key); // Expired
  return null;
}

function setCache(key: string, data: GetDiskUsageResponse): void {
  cache.set(key, { data, timestamp: Date.now() });
}

// ============================================================================
// Handler
// ============================================================================

export async function handler(
  prisma: PrismaClient,
  params: GetDiskUsageParams
): Promise<GetDiskUsageResponse> {
  const { projectId, includeWorktreeDetails = true, includeStalledOnly = false } = params;

  // 1. Check cache
  const cacheKey = getCacheKey(params);
  const cached = getCached(cacheKey);
  if (cached) {
    return cached;
  }

  try {
    // 2. Validate projectId if provided
    if (projectId) {
      const project = await prisma.project.findUnique({
        where: { id: projectId },
      });
      if (!project) {
        throw new Error(`Project ${projectId} not found`);
      }
    }

    // 3. Get system disk space (df command)
    const worktreeRoot = process.env.DISK_WORKTREE_ROOT_PATH || '/opt/stack/worktrees';
    const dfOutput = execSync(`df -BG ${worktreeRoot} | tail -1`, {
      encoding: 'utf-8',
      timeout: 10000,
    });

    // Parse df output: Filesystem Total Used Avail Use% Mounted
    const parts = dfOutput.trim().split(/\s+/);
    if (parts.length < 6) {
      throw new Error(`Invalid df output: ${dfOutput}`);
    }

    const totalSpaceGB = parseInt(parts[1].replace('G', ''), 10);
    const usedSpaceGB = parseInt(parts[2].replace('G', ''), 10);
    const availableSpaceGB = parseInt(parts[3].replace('G', ''), 10);
    const percentUsed = parseInt(parts[4].replace('%', ''), 10);
    const mountPoint = parts[5];

    // 4. Calculate stale threshold
    const staleThresholdDays = parseInt(process.env.DISK_STALE_WORKTREE_DAYS || '14', 10);
    const staleDate = new Date(Date.now() - staleThresholdDays * 24 * 60 * 60 * 1000);

    // 5. Query worktrees from database
    const worktreeWhere: any = { status: 'active' };
    if (projectId) {
      worktreeWhere.story = { projectId };
    }

    const worktrees = await prisma.worktree.findMany({
      where: worktreeWhere,
      include: {
        story: {
          select: { key: true, projectId: true },
        },
      },
      orderBy: { updatedAt: 'asc' },
    });

    // 6. Calculate per-worktree disk usage (parallel) if requested
    let worktreeDetails: WorktreeDetail[] | undefined;
    let totalWorktreeUsageMB = 0;

    if (includeWorktreeDetails) {
      const usagePromises = worktrees.map(async (wt) => {
        const isStalled = wt.updatedAt < staleDate;

        // Skip non-stalled if includeStalledOnly=true
        if (includeStalledOnly && !isStalled) {
          return null;
        }

        const diskUsageMB = getDiskUsageMB(wt.worktreePath) ?? null;
        const ageInDays = Math.floor((Date.now() - wt.createdAt.getTime()) / (24 * 60 * 60 * 1000));

        return {
          id: wt.id,
          storyKey: wt.story.key,
          branchName: wt.branchName,
          status: wt.status as string,
          diskUsageMB,
          createdAt: wt.createdAt.toISOString(),
          updatedAt: wt.updatedAt.toISOString(),
          ageInDays,
          isStalled,
        };
      });

      const results = await Promise.allSettled(usagePromises);
      worktreeDetails = results
        .filter(
          (r) => r.status === 'fulfilled' && r.value !== null
        )
        .map((r) => (r as PromiseFulfilledResult<WorktreeDetail | null>).value as WorktreeDetail);

      totalWorktreeUsageMB = worktreeDetails.reduce((sum, wt) => sum + (wt.diskUsageMB || 0), 0);
    }

    // 7. Identify stalled worktrees
    const stalledWorktrees: StalledWorktreeInfo[] = worktrees
      .filter((wt) => wt.updatedAt < staleDate)
      .map((wt) => {
        const diskUsageMB = worktreeDetails?.find((d) => d.id === wt.id)?.diskUsageMB || null;
        const daysStale = Math.floor((Date.now() - wt.updatedAt.getTime()) / (24 * 60 * 60 * 1000));

        return {
          id: wt.id,
          storyId: wt.storyId,
          storyKey: wt.story.key,
          branchName: wt.branchName,
          worktreePath: wt.worktreePath,
          diskUsageMB,
          lastUpdated: wt.updatedAt.toISOString(),
          daysStale,
        };
      })
      .sort((a, b) => (b.diskUsageMB || 0) - (a.diskUsageMB || 0)); // Sort by size DESC

    // 8. Generate recommendations
    const warningThresholdGB = parseInt(process.env.DISK_ALERT_WARNING_GB || '5', 10);
    const criticalThresholdGB = parseInt(process.env.DISK_ALERT_CRITICAL_GB || '2', 10);

    const recommendations: string[] = [];
    if (availableSpaceGB < criticalThresholdGB) {
      recommendations.push(
        `CRITICAL: Only ${availableSpaceGB}GB available. Immediately cleanup stalled worktrees to prevent system failure.`
      );
    } else if (availableSpaceGB < warningThresholdGB) {
      recommendations.push(
        `WARNING: ${availableSpaceGB}GB available. Review and cleanup stalled worktrees soon.`
      );
    }

    if (stalledWorktrees.length > 0) {
      const potentialRecoveryMB = stalledWorktrees.reduce(
        (sum, wt) => sum + (wt.diskUsageMB || 0),
        0
      );
      const potentialRecoveryGB = (potentialRecoveryMB / 1024).toFixed(2);
      recommendations.push(
        `${stalledWorktrees.length} stalled worktrees found. Cleanup potential: ${potentialRecoveryGB}GB`
      );

      // Top 5 largest stalled worktrees
      stalledWorktrees.slice(0, 5).forEach((wt, idx) => {
        const sizeGB = ((wt.diskUsageMB || 0) / 1024).toFixed(2);
        recommendations.push(
          `${idx + 1}. ${wt.storyKey} (${wt.branchName}): ${sizeGB}GB, ${wt.daysStale} days old`
        );
      });
    }

    // 9. Build response
    const response: GetDiskUsageResponse = {
      timestamp: new Date().toISOString(),
      systemDiskSpace: {
        totalSpaceGB,
        usedSpaceGB,
        availableSpaceGB,
        percentUsed,
        mountPoint,
      },
      worktrees: {
        totalCount: worktrees.length,
        activeCount: worktrees.filter((wt) => wt.updatedAt >= staleDate).length,
        totalUsageMB: totalWorktreeUsageMB,
        averageUsageMB: worktrees.length > 0 ? totalWorktreeUsageMB / worktrees.length : 0,
        stalledCount: stalledWorktrees.length,
        details: worktreeDetails,
      },
      stalledWorktrees,
      alertStatus: {
        isCritical: availableSpaceGB < criticalThresholdGB,
        isWarning: availableSpaceGB < warningThresholdGB,
        availableSpaceGB,
      },
      recommendations,
    };

    // 10. Cache result
    setCache(cacheKey, response);

    return response;
  } catch (error) {
    // Handle known errors
    if (error instanceof Error) {
      throw error;
    }
    handlePrismaError(error, 'get_disk_usage');
    throw error;
  }
}
