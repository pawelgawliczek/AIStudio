/**
 * List Backups Tool - ST-78
 * List all available backups with metadata
 *
 * Features:
 * - Read backup directories (production, development, legacy)
 * - Parse manifest files for metadata
 * - Calculate file sizes and ages
 * - Sort by timestamp (newest first)
 * - Support filtering by environment
 * - Support limit parameter
 */

import { readdir, readFile, stat } from 'fs/promises';
import path from 'path';
import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { PrismaClient } from '@prisma/client';

export const tool: Tool = {
  name: 'mcp__vibestudio__list_backups',
  description:
    'List all available backups with metadata. Supports filtering by environment and limiting results. Returns sorted list (newest first).',
  inputSchema: {
    type: 'object',
    properties: {
      environment: {
        type: 'string',
        enum: ['production', 'development', 'legacy', 'all'],
        description:
          "Filter by environment: 'production', 'development', 'legacy' (root backups), or 'all' (default: all)",
      },
      limit: {
        type: 'number',
        description: 'Maximum number of backups to return (default: 50)',
        minimum: 1,
        maximum: 500,
      },
    },
  },
};

export const metadata = {
  category: 'operations',
  domain: 'database',
  tags: ['backup', 'database', 'list', 'monitoring'],
  version: '1.0.0',
  since: 'ST-78',
};

/**
 * Input parameters for list_backups
 */
export interface ListBackupsParams {
  environment?: 'production' | 'development' | 'legacy' | 'all';
  limit?: number;
}

/**
 * Backup metadata
 */
export interface BackupInfo {
  filename: string;
  environment: string;
  timestamp: string;
  size: number;
  sizeMB: number;
  age: string;
  ageHours: number;
  checksum: string | null;
  fullPath: string;
  createdAt: string | null;
}

/**
 * Response type for list_backups
 */
export interface ListBackupsResponse {
  backups: BackupInfo[];
  total: number;
  byEnvironment: {
    production: number;
    development: number;
    legacy: number;
  };
}

/**
 * Parse manifest file for backup metadata
 */
async function parseManifest(manifestPath: string): Promise<Map<string, any>> {
  const manifestMap = new Map<string, any>();

  try {
    const content = await readFile(manifestPath, 'utf-8');
    const manifest = JSON.parse(content);

    if (manifest.backups && Array.isArray(manifest.backups)) {
      for (const backup of manifest.backups) {
        manifestMap.set(backup.filename, backup);
      }
    }
  } catch (error) {
    // Manifest doesn't exist or is invalid - not an error
    console.log(`[list_backups] No manifest at ${manifestPath}`);
  }

  return manifestMap;
}

/**
 * Calculate human-readable age (e.g., "2 hours ago", "3 days ago")
 */
function calculateAge(modifiedTime: Date): { age: string; ageHours: number } {
  const now = new Date();
  const diffMs = now.getTime() - modifiedTime.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);
  const diffDays = diffHours / 24;

  let age: string;
  if (diffHours < 1) {
    const diffMinutes = Math.round(diffHours * 60);
    age = `${diffMinutes} minute${diffMinutes !== 1 ? 's' : ''} ago`;
  } else if (diffHours < 24) {
    const hours = Math.round(diffHours);
    age = `${hours} hour${hours !== 1 ? 's' : ''} ago`;
  } else {
    const days = Math.round(diffDays);
    age = `${days} day${days !== 1 ? 's' : ''} ago`;
  }

  return { age, ageHours: Math.round(diffHours * 10) / 10 };
}

/**
 * Scan directory for backup files
 */
async function scanBackupDirectory(
  dir: string,
  environment: string,
  manifestMap: Map<string, any>
): Promise<BackupInfo[]> {
  const backups: BackupInfo[] = [];

  try {
    const files = await readdir(dir);

    for (const file of files) {
      // Skip non-backup files
      if (!file.match(/\.(sql|sql\.gz|dump)$/)) {
        continue;
      }

      const fullPath = path.join(dir, file);
      const stats = await stat(fullPath);

      // Extract timestamp from filename (e.g., vibestudio_production_20251122_115533.sql.gz)
      const timestampMatch = file.match(/_(\d{8}_\d{6})/);
      const timestamp = timestampMatch ? timestampMatch[1] : '';

      // Get checksum from manifest or null
      const manifestEntry = manifestMap.get(file);
      const checksum = manifestEntry?.checksum || null;
      const createdAt = manifestEntry?.created_at || null;

      // Calculate age
      const { age, ageHours } = calculateAge(stats.mtime);

      backups.push({
        filename: file,
        environment,
        timestamp,
        size: stats.size,
        sizeMB: Math.round((stats.size / 1024 / 1024) * 100) / 100,
        age,
        ageHours,
        checksum,
        fullPath,
        createdAt,
      });
    }
  } catch (error) {
    // Directory doesn't exist or can't be read - not an error
    console.log(`[list_backups] Could not read directory: ${dir}`);
  }

  return backups;
}

/**
 * Handler for listing backups
 *
 * Scans backup directories and returns sorted list:
 * 1. Scan production, development, and legacy directories
 * 2. Parse manifest files for metadata
 * 3. Calculate file sizes and ages
 * 4. Filter by environment if specified
 * 5. Sort by timestamp (newest first)
 * 6. Limit results if specified
 */
export async function handler(
  prisma: PrismaClient,
  params: ListBackupsParams
): Promise<ListBackupsResponse> {
  const { environment = 'all', limit = 50 } = params;

  try {
    // Base backup directory (absolute path to match BackupMonitorService)
    const backupBaseDir = '/opt/stack/AIStudio/backups';

    const allBackups: BackupInfo[] = [];

    // Scan production backups
    if (environment === 'all' || environment === 'production') {
      const prodDir = path.join(backupBaseDir, 'production');
      const prodManifestPath = path.join(prodDir, 'manifest.json');
      const prodManifest = await parseManifest(prodManifestPath);
      const prodBackups = await scanBackupDirectory(prodDir, 'production', prodManifest);
      allBackups.push(...prodBackups);
    }

    // Scan development backups
    if (environment === 'all' || environment === 'development') {
      const devDir = path.join(backupBaseDir, 'development');
      const devManifestPath = path.join(devDir, 'manifest.json');
      const devManifest = await parseManifest(devManifestPath);
      const devBackups = await scanBackupDirectory(devDir, 'development', devManifest);
      allBackups.push(...devBackups);
    }

    // Scan legacy backups (root directory)
    if (environment === 'all' || environment === 'legacy') {
      const legacyManifest = new Map(); // No manifest for legacy
      const legacyBackups = await scanBackupDirectory(backupBaseDir, 'legacy', legacyManifest);
      allBackups.push(...legacyBackups);
    }

    // Sort by timestamp (newest first)
    allBackups.sort((a, b) => {
      // If timestamps are available, use them
      if (a.timestamp && b.timestamp) {
        return b.timestamp.localeCompare(a.timestamp);
      }
      // Otherwise, use age (lower ageHours = newer)
      return a.ageHours - b.ageHours;
    });

    // Apply limit
    const limitedBackups = allBackups.slice(0, limit);

    // Count by environment
    const byEnvironment = {
      production: allBackups.filter((b) => b.environment === 'production').length,
      development: allBackups.filter((b) => b.environment === 'development').length,
      legacy: allBackups.filter((b) => b.environment === 'legacy').length,
    };

    return {
      backups: limitedBackups,
      total: allBackups.length,
      byEnvironment,
    };
  } catch (error: any) {
    console.error('[list_backups] Error:', error);

    // Return empty result on error
    return {
      backups: [],
      total: 0,
      byEnvironment: {
        production: 0,
        development: 0,
        legacy: 0,
      },
    };
  }
}
