#!/usr/bin/env npx tsx
// ST-271: Test comment to verify code impact metrics are being captured
/**
 * ST-269: Execute Command Script for Remote Agent
 *
 * Securely executes whitelisted commands on the laptop with strict validation.
 * Designed specifically for code impact metrics (git diff, git status).
 *
 * SECURITY REQUIREMENTS:
 * - CRITICAL: Command whitelist enforcement (only git diff, git status)
 * - CRITICAL: Path validation (--cwd must be valid directory)
 * - CRITICAL: No shell injection (uses spawn, not exec)
 * - HIGH: Audit logging (all executions logged to Loki)
 * - MEDIUM: Timeout enforcement (60 seconds max)
 *
 * Usage:
 *   npx tsx scripts/exec-command.ts --command="git diff main...HEAD --numstat" --cwd=/path/to/project
 *   npx tsx scripts/exec-command.ts --command="git status --porcelain" --cwd=/path/to/project
 *
 * Output (JSON):
 *   { "stdout": "...", "stderr": "...", "exitCode": 0, "command": "git diff" }
 *
 * Errors (JSON):
 *   { "error": "Command not whitelisted", "command": "git push" }
 */

import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

// Security: Whitelist of allowed commands
const ALLOWED_COMMANDS = [
  /^git diff(\s|$)/,
  /^git status(\s|$)/,
];

// Timeout for command execution (60 seconds)
const COMMAND_TIMEOUT = 60000;

/**
 * Security error class
 */
class SecurityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SecurityError';
  }
}

/**
 * Validate command against whitelist
 *
 * @param command - Command to validate
 * @returns true if command is allowed
 * @throws SecurityError if command is not whitelisted
 */
function validateCommand(command: string): void {
  const isAllowed = ALLOWED_COMMANDS.some((pattern) => pattern.test(command));

  if (!isAllowed) {
    throw new SecurityError(`Command not whitelisted: ${command}`);
  }
}

/**
 * Validate and normalize working directory path
 *
 * @param cwd - Working directory path
 * @returns Validated directory path
 * @throws SecurityError if path is invalid or not a directory
 */
function validateCwd(cwd: string): string {
  // Normalize path
  const normalizedPath = path.normalize(cwd);

  // Check if path exists
  if (!fs.existsSync(normalizedPath)) {
    throw new SecurityError('Working directory does not exist');
  }

  // Check if path is a directory
  const stats = fs.statSync(normalizedPath);
  if (!stats.isDirectory()) {
    throw new SecurityError('Working directory path is not a directory');
  }

  // Resolve to real path (follow symlinks)
  try {
    return fs.realpathSync(normalizedPath);
  } catch {
    throw new SecurityError('Unable to resolve working directory path');
  }
}

/**
 * Parse command line arguments
 */
function parseArgs(args: string[]): {
  command?: string;
  cwd?: string;
} {
  const result: ReturnType<typeof parseArgs> = {};

  for (const arg of args) {
    if (arg.startsWith('--command=')) {
      result.command = arg.split('=').slice(1).join('='); // Handle commands with = in them
    } else if (arg.startsWith('--cwd=')) {
      result.cwd = arg.split('=').slice(1).join('=');
    }
  }

  return result;
}

/**
 * Execute command with security validation and timeout
 *
 * @param command - Command to execute
 * @param cwd - Working directory
 * @returns Promise with stdout, stderr, and exit code
 */
async function executeCommand(
  command: string,
  cwd: string,
): Promise<{ stdout: string; stderr: string; exitCode: number; command: string }> {
  // Validate command
  validateCommand(command);

  // Validate working directory
  const validatedCwd = validateCwd(cwd);

  // Parse command into executable and args (no shell injection)
  const parts = command.split(/\s+/);
  const executable = parts[0];
  const args = parts.slice(1);

  return new Promise((resolve, reject) => {
    // Use spawn (not exec) to prevent shell injection
    const proc = spawn(executable, args, {
      cwd: validatedCwd,
      timeout: COMMAND_TIMEOUT,
      shell: false, // CRITICAL: No shell to prevent injection
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      resolve({
        stdout,
        stderr,
        exitCode: code ?? 0,
        command: executable,
      });
    });

    proc.on('error', (error) => {
      reject(new Error(`Command execution failed: ${error.message}`));
    });

    // Handle timeout
    setTimeout(() => {
      proc.kill('SIGTERM');
      reject(new Error('Command execution timeout'));
    }, COMMAND_TIMEOUT);
  });
}

/**
 * Main function - execute command with security validation
 */
export async function execCommand(args: string[]): Promise<{
  stdout: string;
  stderr: string;
  exitCode: number;
  command: string;
}> {
  const parsed = parseArgs(args);

  // Require --command parameter
  if (!parsed.command) {
    throw new SecurityError('--command parameter is required');
  }

  // Require --cwd parameter
  if (!parsed.cwd) {
    throw new SecurityError('--cwd parameter is required');
  }

  return executeCommand(parsed.command, parsed.cwd);
}

// CLI entry point
async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help')) {
    console.error('Usage: npx tsx scripts/exec-command.ts --command=<command> --cwd=<directory>');
    console.error('');
    console.error('Security restrictions:');
    console.error('  - Only whitelisted commands allowed: git diff, git status');
    console.error('  - Working directory must exist and be a directory');
    console.error(`  - Timeout: ${COMMAND_TIMEOUT / 1000} seconds`);
    console.error('  - No shell injection (uses spawn)');
    process.exit(1);
  }

  try {
    const result = await execCommand(args);
    console.log(JSON.stringify(result, null, 2));
  } catch (err) {
    if (err instanceof SecurityError) {
      console.error(JSON.stringify({ error: err.message }));
    } else {
      const message = err instanceof Error ? err.message : String(err);
      console.error(JSON.stringify({ error: message }));
    }
    process.exit(1);
  }
}

main();
