/**
 * File system utilities for migration safety
 */

import { promises as fs } from 'fs';
import * as path from 'path';

/**
 * Ensure directory exists, create if not
 */
export async function ensureDirectory(dirPath: string): Promise<void> {
  try {
    await fs.access(dirPath);
  } catch {
    await fs.mkdir(dirPath, { recursive: true });
  }
}

/**
 * Get file size in bytes
 */
export async function getFileSize(filepath: string): Promise<number> {
  try {
    const stats = await fs.stat(filepath);
    return stats.size;
  } catch {
    return 0;
  }
}

/**
 * Check if file exists
 */
export async function fileExists(filepath: string): Promise<boolean> {
  try {
    await fs.access(filepath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get files in directory matching pattern
 */
export async function getFilesInDirectory(
  dirPath: string,
  pattern?: RegExp
): Promise<string[]> {
  try {
    await ensureDirectory(dirPath);
    const files = await fs.readdir(dirPath);

    if (pattern) {
      return files
        .filter((f) => pattern.test(f))
        .map((f) => path.join(dirPath, f));
    }

    return files.map((f) => path.join(dirPath, f));
  } catch {
    return [];
  }
}

/**
 * Delete file safely
 */
export async function deleteFile(filepath: string): Promise<boolean> {
  try {
    await fs.unlink(filepath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get file age in days
 */
export async function getFileAgeDays(filepath: string): Promise<number> {
  try {
    const stats = await fs.stat(filepath);
    const ageMs = Date.now() - stats.mtimeMs;
    return Math.floor(ageMs / (1000 * 60 * 60 * 24));
  } catch {
    return -1;
  }
}

/**
 * Format bytes to human-readable string
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

/**
 * Generate timestamped filename
 */
export function generateTimestampedFilename(
  prefix: string,
  extension: string,
  context?: string
): string {
  const timestamp = new Date()
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\..+/, '')
    .replace('T', '_');

  if (context) {
    return `${prefix}_${timestamp}_${context}.${extension}`;
  }

  return `${prefix}_${timestamp}.${extension}`;
}
