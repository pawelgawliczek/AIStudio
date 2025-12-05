#!/usr/bin/env npx tsx
/**
 * ST-173: Read File Script for Remote Agent
 *
 * Securely reads transcript files from the laptop filesystem with strict validation.
 *
 * SECURITY REQUIREMENTS (from SECURITY_REVIEW):
 * - CRITICAL: Path traversal protection (8+ attack vectors)
 * - CRITICAL: File ownership validation (current user only)
 * - HIGH: Size limit enforcement (2MB max)
 * - HIGH: Symlink blocking (outside allowed directory)
 * - MEDIUM: Device file blocking (pipes, sockets, block devices)
 * - MEDIUM: Error message sanitization (no absolute paths, usernames)
 *
 * Usage:
 *   npx tsx scripts/read-file.ts --path=/path/to/transcript.jsonl
 *   npx tsx scripts/read-file.ts --path=/path/to/file.jsonl --encoding=utf-8
 *   npx tsx scripts/read-file.ts --path=/path/to/file.jsonl --max-size=1048576
 *
 * Output (JSON):
 *   { "content": "...", "size": 1234, "path": "/real/path/to/file" }
 *
 * Errors (JSON):
 *   { "error": "Path outside allowed directory" }
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// Security constants
const ALLOWED_BASE_DIR = path.resolve(os.homedir(), '.claude', 'projects');
const DEFAULT_MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB (reduced from 5MB per security review)
const DEFAULT_ENCODING = 'utf-8';

/**
 * Security error class - strips sensitive info from messages
 */
class SecurityError extends Error {
  constructor(message: string) {
    // Sanitize error message - remove absolute paths and usernames
    const sanitizedMessage = sanitizeErrorMessage(message);
    super(sanitizedMessage);
    this.name = 'SecurityError';
  }
}

/**
 * Sanitize error messages to prevent information disclosure
 */
function sanitizeErrorMessage(message: string): string {
  // Remove absolute paths
  let sanitized = message.replace(/\/[^\s'"]+/g, '[PATH]');

  // Remove home directory references
  const homeDir = os.homedir();
  sanitized = sanitized.replace(new RegExp(homeDir, 'g'), '[HOME]');

  // Remove common username patterns
  const username = os.userInfo().username;
  if (username) {
    sanitized = sanitized.replace(new RegExp(username, 'gi'), '[USER]');
  }

  return sanitized;
}

/**
 * Validate and normalize file path with security checks
 *
 * @param inputPath - User-provided file path
 * @returns Validated real path (after symlink resolution)
 * @throws SecurityError if path is invalid or outside allowed directory
 */
function validatePath(inputPath: string): string {
  // 1. Expand ~ to home directory
  let normalizedPath = inputPath;
  if (normalizedPath.startsWith('~')) {
    normalizedPath = path.join(os.homedir(), normalizedPath.slice(1));
  }

  // 2. Normalize the path (resolve . and ..)
  normalizedPath = path.normalize(normalizedPath);

  // 3. Check if path exists (required for realpathSync)
  if (!fs.existsSync(normalizedPath)) {
    throw new SecurityError('File not found');
  }

  // 4. Resolve symlinks and get real path
  // CRITICAL: This must happen BEFORE prefix validation
  let realPath: string;
  try {
    realPath = fs.realpathSync(normalizedPath);
  } catch {
    throw new SecurityError('Unable to resolve path');
  }

  // 5. Validate prefix AFTER normalization and symlink resolution
  // This prevents all path traversal attacks
  if (!realPath.startsWith(ALLOWED_BASE_DIR)) {
    throw new SecurityError('Path outside allowed directory');
  }

  return realPath;
}

/**
 * Validate file stats for security requirements
 *
 * @param filePath - Validated file path
 * @param maxSize - Maximum allowed file size
 * @throws SecurityError if file fails security checks
 */
function validateFileStats(filePath: string, maxSize: number): fs.Stats {
  const stats = fs.statSync(filePath);

  // 1. Must be a regular file (not directory, device, pipe, socket)
  if (!stats.isFile()) {
    throw new SecurityError('Path is not a regular file');
  }

  // 2. Check file ownership (must be current user)
  const currentUid = process.getuid?.() ?? -1;
  if (currentUid !== -1 && stats.uid !== currentUid) {
    throw new SecurityError('File not owned by current user');
  }

  // 3. Check size BEFORE reading
  if (stats.size > maxSize) {
    throw new SecurityError(`File too large: ${stats.size} bytes (max: ${maxSize})`);
  }

  return stats;
}

/**
 * Parse command line arguments
 */
function parseArgs(args: string[]): {
  path?: string;
  encoding: BufferEncoding;
  maxSize: number;
} {
  const result: ReturnType<typeof parseArgs> = {
    encoding: DEFAULT_ENCODING as BufferEncoding,
    maxSize: DEFAULT_MAX_FILE_SIZE,
  };

  for (const arg of args) {
    if (arg.startsWith('--path=')) {
      result.path = arg.split('=').slice(1).join('='); // Handle paths with = in them
    } else if (arg.startsWith('--encoding=')) {
      result.encoding = arg.split('=')[1] as BufferEncoding;
    } else if (arg.startsWith('--max-size=')) {
      const size = parseInt(arg.split('=')[1], 10);
      if (!isNaN(size) && size > 0) {
        result.maxSize = Math.min(size, DEFAULT_MAX_FILE_SIZE); // Never exceed default
      }
    }
  }

  return result;
}

/**
 * Main function - read file with security validation
 */
export async function readFile(args: string[]): Promise<{ content: string; size: number; path: string }> {
  const parsed = parseArgs(args);

  // Require --path parameter
  if (!parsed.path) {
    throw new SecurityError('--path parameter is required');
  }

  // 1. Validate path (traversal, symlinks, allowed directory)
  const validatedPath = validatePath(parsed.path);

  // 2. Validate file stats (ownership, size, type)
  const stats = validateFileStats(validatedPath, parsed.maxSize);

  // 3. Read file content
  const content = fs.readFileSync(validatedPath, { encoding: parsed.encoding });

  return {
    content,
    size: stats.size,
    path: validatedPath,
  };
}

// CLI entry point
async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help')) {
    console.error('Usage: npx tsx scripts/read-file.ts --path=<file-path> [--encoding=utf-8] [--max-size=2097152]');
    console.error('');
    console.error('Security restrictions:');
    console.error(`  - Files must be in ${ALLOWED_BASE_DIR}`);
    console.error(`  - Maximum file size: ${DEFAULT_MAX_FILE_SIZE} bytes (2MB)`);
    console.error('  - File must be owned by current user');
    console.error('  - Symlinks are followed but must resolve within allowed directory');
    process.exit(1);
  }

  try {
    const result = await readFile(args);
    console.log(JSON.stringify(result, null, 2));
  } catch (err) {
    if (err instanceof SecurityError) {
      console.error(JSON.stringify({ error: err.message }));
    } else {
      // For non-security errors, sanitize and output
      const message = err instanceof Error ? err.message : String(err);
      console.error(JSON.stringify({ error: sanitizeErrorMessage(message) }));
    }
    process.exit(1);
  }
}

main();
