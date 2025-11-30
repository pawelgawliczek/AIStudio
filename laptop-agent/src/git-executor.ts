import { execFileSync } from 'child_process';

/**
 * ST-153: Git Command Executor for Laptop Agent
 *
 * Safely executes git commands with:
 * - Whitelist validation
 * - Forbidden pattern blocking
 * - execFileSync (no shell injection)
 * - Timeout protection
 */

// =============================================================================
// Local copy of approved git operations (mirrors backend/src/remote-agent/approved-scripts.ts)
// =============================================================================

interface ApprovedGitOperation {
  description: string;
  timeout: number;
  readOnly: boolean;
  allowedArgs: string[];
}

const APPROVED_GIT_OPERATIONS: Record<string, ApprovedGitOperation> = {
  'status': { description: 'Get working tree status', timeout: 30000, readOnly: true, allowedArgs: ['--porcelain', '--branch', '-s', '-b', '--short'] },
  'log': { description: 'View commit history', timeout: 30000, readOnly: true, allowedArgs: ['--oneline', '-n', '--format', '--since', '--until', '-1', '-5', '-10'] },
  'diff': { description: 'Show changes', timeout: 60000, readOnly: true, allowedArgs: ['--cached', '--staged', '--stat', '--name-only', '--name-status', 'HEAD', 'main', 'origin/main'] },
  'rev-parse': { description: 'Parse git references', timeout: 10000, readOnly: true, allowedArgs: ['HEAD', '--verify', '--short', '--abbrev-ref', '--show-toplevel'] },
  'branch': { description: 'List branches', timeout: 30000, readOnly: true, allowedArgs: ['-l', '-a', '-r', '--list', '--show-current'] },
  'remote': { description: 'Manage remotes', timeout: 10000, readOnly: true, allowedArgs: ['-v', 'get-url', 'origin'] },
  'merge-tree': { description: 'Simulate merge', timeout: 60000, readOnly: true, allowedArgs: ['--write-tree'] },
  'fetch': { description: 'Download from remote', timeout: 120000, readOnly: false, allowedArgs: ['origin', 'main', '--all', '--prune', '--tags'] },
  'pull': { description: 'Fetch and integrate', timeout: 120000, readOnly: false, allowedArgs: ['--rebase', 'origin', 'main'] },
  'add': { description: 'Stage changes', timeout: 30000, readOnly: false, allowedArgs: ['-A', '.', '-u', '--all', '-p'] },
  'commit': { description: 'Record changes', timeout: 60000, readOnly: false, allowedArgs: ['-m', '--amend', '--no-edit', '-a', '--allow-empty'] },
  'push': { description: 'Upload to remote', timeout: 120000, readOnly: false, allowedArgs: ['origin', '-u', '--set-upstream', '--force-with-lease'] },
  'checkout': { description: 'Switch branches', timeout: 60000, readOnly: false, allowedArgs: ['-b', '--', 'main', 'origin/main'] },
  'rebase': { description: 'Reapply commits', timeout: 300000, readOnly: false, allowedArgs: ['origin/main', 'main', '--abort', '--continue', '--skip'] },
  'stash': { description: 'Stash changes', timeout: 30000, readOnly: false, allowedArgs: ['push', 'pop', 'list', 'drop', '-m'] },
  'worktree': { description: 'Manage worktrees', timeout: 120000, readOnly: false, allowedArgs: ['add', 'remove', 'list', 'prune', '--force'] },
};

const FORBIDDEN_GIT_PATTERNS = [
  /^git\s+push\s+.*--force(?!\s*-with-lease)/i,
  /^git\s+reset\s+--hard/i,
  /^git\s+clean\s+-[fdx]/i,
  /^git\s+reflog\s+expire/i,
  /^git\s+gc\s+--prune/i,
  /^git\s+filter-branch/i,
  /^git\s+push\s+origin\s+:(main|master)/i,
  /^git\s+branch\s+-[dD]\s+(main|master)/i,
];

function validateGitCommand(fullCommand: string): { valid: boolean; error?: string } {
  for (const pattern of FORBIDDEN_GIT_PATTERNS) {
    if (pattern.test(fullCommand)) {
      return { valid: false, error: `Forbidden git command pattern: ${fullCommand}` };
    }
  }

  const match = fullCommand.match(/^git\s+([a-z-]+)(.*)$/i);
  if (!match) {
    return { valid: false, error: `Invalid git command format: ${fullCommand}` };
  }

  const operation = match[1].toLowerCase();
  if (!(operation in APPROVED_GIT_OPERATIONS)) {
    return { valid: false, error: `Git operation '${operation}' is not approved for remote execution` };
  }

  return { valid: true };
}

function getGitOperationTimeout(operation: string): number {
  return APPROVED_GIT_OPERATIONS[operation]?.timeout || 60000;
}

export interface GitExecutionResult {
  success: boolean;
  output?: string;
  error?: string;
  operation?: string;
  exitCode?: number;
}

/**
 * Execute a git command safely
 *
 * @param command - Full git command (e.g., "git status --porcelain")
 * @param cwd - Working directory (worktree path)
 * @param timeout - Optional timeout override
 */
export function executeGitCommand(
  command: string,
  cwd: string,
  timeout?: number
): GitExecutionResult {
  // 1. Validate command against whitelist
  const validation = validateGitCommand(command);
  if (!validation.valid) {
    return {
      success: false,
      error: validation.error || 'Command validation failed',
    };
  }

  // 2. Parse command into operation and args
  const match = command.match(/^git\s+([a-z-]+)(.*)$/i);
  if (!match) {
    return {
      success: false,
      error: `Invalid git command format: ${command}`,
    };
  }

  const operation = match[1].toLowerCase();
  const argsStr = match[2]?.trim() || '';

  // 3. Parse arguments (handle quoted strings)
  const args = parseGitArgs(argsStr);

  // 4. Get timeout for operation
  const opTimeout = timeout || getGitOperationTimeout(operation);

  // 5. Execute using execFileSync (no shell - prevents injection)
  try {
    console.log(`[ST-153] Executing: git ${operation} ${args.join(' ')}`);
    console.log(`[ST-153] CWD: ${cwd}`);

    const output = execFileSync('git', [operation, ...args], {
      cwd,
      timeout: opTimeout,
      encoding: 'utf-8',
      maxBuffer: 10 * 1024 * 1024, // 10MB
    });

    return {
      success: true,
      output: output.trim(),
      operation,
    };
  } catch (error: any) {
    // Git command failed (non-zero exit)
    if (error.status !== undefined) {
      return {
        success: false,
        error: error.stderr?.toString() || error.message,
        output: error.stdout?.toString(),
        operation,
        exitCode: error.status,
      };
    }

    // Timeout or other error
    return {
      success: false,
      error: error.message,
      operation,
    };
  }
}

/**
 * Parse git arguments string into array
 * Handles quoted strings and -m "message" patterns
 */
function parseGitArgs(argsStr: string): string[] {
  if (!argsStr) return [];

  const args: string[] = [];
  let current = '';
  let inQuote = false;
  let quoteChar = '';

  for (let i = 0; i < argsStr.length; i++) {
    const char = argsStr[i];

    if (inQuote) {
      if (char === quoteChar) {
        inQuote = false;
        // Don't add the quote char
      } else {
        current += char;
      }
    } else if (char === '"' || char === "'") {
      inQuote = true;
      quoteChar = char;
    } else if (char === ' ' || char === '\t') {
      if (current) {
        args.push(current);
        current = '';
      }
    } else {
      current += char;
    }
  }

  if (current) {
    args.push(current);
  }

  return args;
}

/**
 * Check if git is available
 */
export function checkGitAvailable(): { available: boolean; version?: string } {
  try {
    const output = execFileSync('git', ['--version'], {
      encoding: 'utf-8',
      timeout: 5000,
    });
    const match = output.match(/git version ([\d.]+)/);
    return {
      available: true,
      version: match?.[1] || output.trim(),
    };
  } catch {
    return { available: false };
  }
}
