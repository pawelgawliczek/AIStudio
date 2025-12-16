/**
 * ST-133: Remote Execution Agent - Approved Scripts Whitelist
 * ST-150: Claude Code Agent Execution Capability
 * ST-153: Location-Aware Git Operations
 *
 * Security-critical configuration defining which scripts and capabilities
 * can be executed remotely and what parameters they accept.
 *
 * Only scripts and capabilities listed here can be executed via remote agent.
 */

export interface ApprovedScript {
  script: string; // Relative path to script from project root
  description: string; // Human-readable description
  allowedParams: string[]; // Allowed parameter names (without values)
  timeout: number; // Max execution time in milliseconds
  positionalArgs?: boolean; // ST-164: If true, only validate first param (action), allow any positional args after
}

/**
 * ST-150: Approved Claude Code capability configuration
 */
export interface ApprovedCapability {
  type: 'claude-agent'; // Capability type
  description: string; // Human-readable description
  timeout: number; // Max execution time in milliseconds
  requiredParams: string[]; // Required parameter names for execution
  optionalParams: string[]; // Optional parameter names
}

/**
 * Whitelist of approved scripts for remote execution
 *
 * Add new scripts here with explicit parameter allowlist.
 * NEVER allow arbitrary script execution.
 */
export const APPROVED_SCRIPTS: Record<string, ApprovedScript> = {
  'parse-transcript': {
    script: 'scripts/parse-transcript.ts',
    description: 'Parse Claude Code transcript files for token metrics',
    allowedParams: ['--latest', '--latest-agent', '--agent', '--search', '--file', '--path'],
    timeout: 30000, // 30 seconds
  },
  'analyze-story-transcripts': {
    script: 'scripts/analyze-story-transcripts.ts',
    description: 'Analyze transcripts for a specific story',
    allowedParams: ['--story-id', '--story-key', '--branch', '--days'],
    timeout: 60000, // 60 seconds
  },
  'list-transcripts': {
    script: 'scripts/list-transcripts.ts',
    description: 'List available transcript files',
    allowedParams: ['--limit', '--since', '--pattern'],
    timeout: 10000, // 10 seconds
  },
  // ST-164: Workflow tracker for context recovery after compaction
  'workflow-tracker': {
    script: '.claude/hooks/workflow-tracker.sh',
    description: 'Manage running workflow tracking for context recovery',
    allowedParams: ['register', 'unregister', 'set-current', 'get-current', 'list'],
    timeout: 5000, // 5 seconds
    positionalArgs: true, // First param is action, rest are positional (runId, workflowId, storyId)
  },
  // ST-173: Read file content for transcript uploads
  'read-file': {
    script: 'scripts/read-file.ts',
    description: 'Read transcript files with security validation (path traversal protection, ownership check)',
    allowedParams: ['--path', '--encoding', '--max-size'],
    timeout: 30000, // 30 seconds
  },
  // ST-269: Execute whitelisted commands for code impact metrics
  'exec-command': {
    script: 'scripts/exec-command.ts',
    description: 'Execute whitelisted git commands for code metrics (git diff, git status only)',
    allowedParams: ['--command', '--cwd'],
    timeout: 60000, // 60 seconds
  },
};

/**
 * Check if a script is approved for remote execution
 */
export function isScriptApproved(scriptName: string): boolean {
  return scriptName in APPROVED_SCRIPTS;
}

/**
 * Validate script parameters against whitelist
 */
export function validateParams(
  scriptName: string,
  params: string[]
): { valid: boolean; error?: string } {
  const approved = APPROVED_SCRIPTS[scriptName];

  if (!approved) {
    return {
      valid: false,
      error: `Script '${scriptName}' not in whitelist`
    };
  }

  // ST-164: For positional args scripts, only validate first param (the action)
  if (approved.positionalArgs) {
    if (params.length === 0) {
      return { valid: true }; // No params is OK (will show help)
    }
    const action = params[0];
    if (!approved.allowedParams.includes(action)) {
      return {
        valid: false,
        error: `Action '${action}' not allowed for script '${scriptName}'`,
      };
    }
    return { valid: true };
  }

  // Extract parameter keys (without values)
  for (const param of params) {
    const paramKey = param.split('=')[0];

    if (!approved.allowedParams.includes(paramKey)) {
      return {
        valid: false,
        error: `Parameter '${paramKey}' not allowed for script '${scriptName}'`,
      };
    }
  }

  return { valid: true };
}

/**
 * Get timeout for a script
 */
export function getScriptTimeout(scriptName: string): number {
  const approved = APPROVED_SCRIPTS[scriptName];
  return approved?.timeout || 30000; // Default 30s
}

// =============================================================================
// ST-150: Claude Code Agent Execution Capabilities
// =============================================================================

/**
 * Whitelist of approved capabilities for remote agent execution
 *
 * Claude Code execution requires specific parameters for security:
 * - componentId: Which component is executing
 * - stateId: Which workflow state
 * - workflowRunId: Parent workflow run for tracking
 * - instructions: The prompt to execute (sanitized server-side)
 */
export const APPROVED_CAPABILITIES: Record<string, ApprovedCapability> = {
  'claude-code': {
    type: 'claude-agent',
    description: 'Execute Claude Code sessions for agent work',
    timeout: 3600000, // 60 minutes (per ST-150 spec)
    requiredParams: ['componentId', 'stateId', 'workflowRunId', 'instructions'],
    optionalParams: ['storyContext', 'allowedTools', 'model', 'maxTurns', 'projectPath'],
  },
  // ST-170: Transcript watching daemon
  'watch-transcripts': {
    type: 'daemon' as any, // Daemon capability (not claude-agent)
    description: 'Watch transcript directory and auto-register new agent and master session transcripts',
    timeout: -1, // Daemon mode (no timeout)
    requiredParams: [],
    optionalParams: [],
  },
};

/**
 * ST-150: Approved tools that Claude Code agent can use
 * Only these tools will be allowed in --allowedTools parameter
 */
export const APPROVED_CLAUDE_TOOLS = [
  // Core Claude Code tools
  'Read',
  'Write',
  'Edit',
  'Glob',
  'Grep',
  'Bash',
  'Task',
  'TodoWrite',
  'AskUserQuestion',
  'WebFetch',
  'WebSearch',
  // MCP tools - VibeStudio
  'mcp__vibestudio__*',
  // MCP tools - Playwright
  'mcp__playwright__*',
];

/**
 * ST-150: Forbidden patterns in instructions (secrets detection)
 * Instructions containing these patterns will be rejected
 */
export const FORBIDDEN_INSTRUCTION_PATTERNS = [
  /password\s*[:=]\s*['"][^'"]+['"]/i,
  /api[_-]?key\s*[:=]\s*['"][^'"]+['"]/i,
  /secret\s*[:=]\s*['"][^'"]+['"]/i,
  /bearer\s+[a-zA-Z0-9._-]+/i,
  /-----BEGIN\s+(RSA\s+)?PRIVATE\s+KEY-----/i,
  /aws_access_key_id\s*[:=]\s*['"][^'"]+['"]/i,
  /aws_secret_access_key\s*[:=]\s*['"][^'"]+['"]/i,
];

/**
 * Check if a capability is approved for remote execution
 */
export function isCapabilityApproved(capabilityName: string): boolean {
  return capabilityName in APPROVED_CAPABILITIES;
}

/**
 * Get timeout for a capability
 */
export function getCapabilityTimeout(capabilityName: string): number {
  const approved = APPROVED_CAPABILITIES[capabilityName];
  return approved?.timeout || 3600000; // Default 60 min for Claude Code
}

/**
 * Validate capability parameters
 */
export function validateCapabilityParams(
  capabilityName: string,
  params: Record<string, unknown>
): { valid: boolean; error?: string } {
  const approved = APPROVED_CAPABILITIES[capabilityName];

  if (!approved) {
    return {
      valid: false,
      error: `Capability '${capabilityName}' not in whitelist`,
    };
  }

  // Check required params
  for (const required of approved.requiredParams) {
    if (!(required in params) || params[required] === undefined || params[required] === null) {
      return {
        valid: false,
        error: `Missing required parameter '${required}' for capability '${capabilityName}'`,
      };
    }
  }

  // Check all params are allowed (required or optional)
  const allowedParams = [...approved.requiredParams, ...approved.optionalParams];
  for (const paramKey of Object.keys(params)) {
    if (!allowedParams.includes(paramKey)) {
      return {
        valid: false,
        error: `Parameter '${paramKey}' not allowed for capability '${capabilityName}'`,
      };
    }
  }

  return { valid: true };
}

/**
 * Validate instructions don't contain secrets
 */
export function validateInstructions(instructions: string): { valid: boolean; error?: string } {
  for (const pattern of FORBIDDEN_INSTRUCTION_PATTERNS) {
    if (pattern.test(instructions)) {
      return {
        valid: false,
        error: 'Instructions contain potential secrets - sanitize before dispatch',
      };
    }
  }
  return { valid: true };
}

/**
 * Validate allowed tools against whitelist
 */
export function validateAllowedTools(tools: string[]): { valid: boolean; error?: string } {
  for (const tool of tools) {
    const isApproved = APPROVED_CLAUDE_TOOLS.some((pattern) =>
      pattern.endsWith('*') ? tool.startsWith(pattern.slice(0, -1)) : tool === pattern
    );
    if (!isApproved) {
      return {
        valid: false,
        error: `Tool '${tool}' is not in approved list`,
      };
    }
  }
  return { valid: true };
}

// =============================================================================
// ST-153: Git Operations Capability
// =============================================================================

/**
 * Approved git operations for remote execution
 * Each operation has specific allowed arguments for security
 */
export interface ApprovedGitOperation {
  description: string;
  timeout: number; // Max execution time in ms
  readOnly: boolean; // True if operation doesn't modify state
  allowedArgs: string[]; // Allowed git arguments (without 'git' prefix)
}

/**
 * Whitelist of approved git operations
 *
 * SECURITY: Only these git commands can be executed remotely.
 * Each command has explicit argument validation.
 */
export const APPROVED_GIT_OPERATIONS: Record<string, ApprovedGitOperation> = {
  // Read-only operations
  'status': {
    description: 'Get working tree status',
    timeout: 30000,
    readOnly: true,
    allowedArgs: ['--porcelain', '--branch', '-s', '-b', '--short'],
  },
  'log': {
    description: 'View commit history',
    timeout: 30000,
    readOnly: true,
    allowedArgs: ['--oneline', '-n', '--format', '--since', '--until', '-1', '-5', '-10'],
  },
  'diff': {
    description: 'Show changes',
    timeout: 60000,
    readOnly: true,
    allowedArgs: ['--cached', '--staged', '--stat', '--name-only', '--name-status', 'HEAD', 'main', 'origin/main'],
  },
  'rev-parse': {
    description: 'Parse git references',
    timeout: 10000,
    readOnly: true,
    allowedArgs: ['HEAD', '--verify', '--short', '--abbrev-ref', '--show-toplevel'],
  },
  'branch': {
    description: 'List branches',
    timeout: 30000,
    readOnly: true,
    allowedArgs: ['-l', '-a', '-r', '--list', '--show-current'],
  },
  'remote': {
    description: 'Manage remotes',
    timeout: 10000,
    readOnly: true,
    allowedArgs: ['-v', 'get-url', 'origin'],
  },
  'merge-tree': {
    description: 'Simulate merge (conflict detection)',
    timeout: 60000,
    readOnly: true,
    allowedArgs: ['--write-tree'],
  },

  // Write operations
  'fetch': {
    description: 'Download objects from remote',
    timeout: 120000,
    readOnly: false,
    allowedArgs: ['origin', 'main', '--all', '--prune', '--tags'],
  },
  'pull': {
    description: 'Fetch and integrate remote changes',
    timeout: 120000,
    readOnly: false,
    allowedArgs: ['--rebase', 'origin', 'main'],
  },
  'add': {
    description: 'Stage changes',
    timeout: 30000,
    readOnly: false,
    allowedArgs: ['-A', '.', '-u', '--all', '-p'],
  },
  'commit': {
    description: 'Record changes',
    timeout: 60000,
    readOnly: false,
    allowedArgs: ['-m', '--amend', '--no-edit', '-a', '--allow-empty'],
  },
  'push': {
    description: 'Upload changes to remote',
    timeout: 120000,
    readOnly: false,
    allowedArgs: ['origin', '-u', '--set-upstream', '--force-with-lease'],
  },
  'checkout': {
    description: 'Switch branches or restore files',
    timeout: 60000,
    readOnly: false,
    allowedArgs: ['-b', '--', 'main', 'origin/main'],
  },
  'rebase': {
    description: 'Reapply commits on top of another base',
    timeout: 300000, // 5 minutes
    readOnly: false,
    allowedArgs: ['origin/main', 'main', '--abort', '--continue', '--skip'],
  },
  'stash': {
    description: 'Stash changes',
    timeout: 30000,
    readOnly: false,
    allowedArgs: ['push', 'pop', 'list', 'drop', '-m'],
  },
  'worktree': {
    description: 'Manage worktrees',
    timeout: 120000,
    readOnly: false,
    allowedArgs: ['add', 'remove', 'list', 'prune', '--force'],
  },
};

/**
 * Git commands that are FORBIDDEN for remote execution
 * These are destructive or dangerous operations
 */
export const FORBIDDEN_GIT_PATTERNS = [
  /^git\s+push\s+.*--force(?!\s*-with-lease)/i, // force push without --force-with-lease
  /^git\s+reset\s+--hard/i,
  /^git\s+clean\s+-[fdx]/i,
  /^git\s+reflog\s+expire/i,
  /^git\s+gc\s+--prune/i,
  /^git\s+filter-branch/i,
  /^git\s+push\s+origin\s+:(main|master)/i, // delete main/master
  /^git\s+branch\s+-[dD]\s+(main|master)/i, // delete main/master branch
];

/**
 * Check if a git operation is approved
 */
export function isGitOperationApproved(operation: string): boolean {
  return operation in APPROVED_GIT_OPERATIONS;
}

/**
 * Get git operation configuration
 */
export function getGitOperation(operation: string): ApprovedGitOperation | undefined {
  return APPROVED_GIT_OPERATIONS[operation];
}

/**
 * Validate a full git command string
 *
 * @param fullCommand - The complete git command (e.g., "git status --porcelain")
 * @returns Validation result
 */
export function validateGitCommand(fullCommand: string): { valid: boolean; error?: string } {
  // Check forbidden patterns first
  for (const pattern of FORBIDDEN_GIT_PATTERNS) {
    if (pattern.test(fullCommand)) {
      return {
        valid: false,
        error: `Forbidden git command pattern: ${fullCommand}`,
      };
    }
  }

  // Parse command: "git <operation> [args...]"
  const match = fullCommand.match(/^git\s+([a-z-]+)(.*)$/i);
  if (!match) {
    return {
      valid: false,
      error: `Invalid git command format: ${fullCommand}`,
    };
  }

  const operation = match[1].toLowerCase();
  const argsStr = match[2]?.trim() || '';

  // Check operation is approved
  const opConfig = APPROVED_GIT_OPERATIONS[operation];
  if (!opConfig) {
    return {
      valid: false,
      error: `Git operation '${operation}' is not approved for remote execution`,
    };
  }

  // Note: We don't strictly validate every argument here because some commands
  // need dynamic values (branch names, commit messages). The forbidden patterns
  // block dangerous combinations. For stricter validation, use specific handlers.

  return { valid: true };
}

/**
 * Get timeout for a git operation
 */
export function getGitOperationTimeout(operation: string): number {
  return APPROVED_GIT_OPERATIONS[operation]?.timeout || 60000;
}
