/**
 * Security Sanitization - Phase 0 (ST-200)
 *
 * CRITICAL: Prompt injection defense for Master Session commands.
 * All functions MUST pass 100% test coverage before Phase 1.
 */

import { v4 as uuidv4 } from 'uuid';

/**
 * Sanitize text before injecting into Claude CLI prompt
 * Prevents code block injection and control character attacks
 */
export function sanitizeForPrompt(input: string): string {
  return input
    // Escape triple backticks to prevent code block injection
    .replace(/```/g, '\\`\\`\\`')
    // Remove control characters (NULL, backspace, etc.) but preserve newlines (\n) and tabs (\t)
    .replace(/[\x00-\x08\x0B-\x1F\x7F]/g, '')
    // Collapse excessive newlines (3+ → 2)
    .replace(/\n{3,}/g, '\n\n');
}

/**
 * Generate cryptographically random nonce (UUID v4)
 * Used for command/response validation
 */
export function generateNonce(): string {
  return uuidv4();
}

/**
 * Validate nonce in Master Session response
 * Returns validation result with extracted nonce
 */
export interface NonceValidationResult {
  valid: boolean;
  extractedNonce?: string;
  error?: string;
}

export function validateNonce(response: string, expectedNonce: string): NonceValidationResult {
  // Extract nonce from response using regex
  const nonceRegex = /\[NONCE:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\]/i;
  const match = response.match(nonceRegex);

  if (!match) {
    return {
      valid: false,
      error: 'Nonce not found in response',
    };
  }

  const extractedNonce = match[1];

  // Case-insensitive UUID comparison
  if (extractedNonce.toLowerCase() !== expectedNonce.toLowerCase()) {
    return {
      valid: false,
      extractedNonce,
      error: 'Nonce mismatch - possible response forgery',
    };
  }

  return {
    valid: true,
    extractedNonce,
  };
}

/**
 * MCP Tool Allowlist - Only safe tools can be executed via Master Session
 * DENY by default (security-first approach)
 */
const MCP_TOOL_ALLOWLIST = new Set<string>([
  // === Workflow Execution Tools (SAFE) ===
  'mcp__vibestudio__record_agent_start',
  'mcp__vibestudio__record_agent_complete',
  'mcp__vibestudio__advance_step',
  'mcp__vibestudio__repeat_step',
  'mcp__vibestudio__get_current_step',

  // === Read-Only Story/Epic Tools (SAFE) ===
  'mcp__vibestudio__get_story',
  'mcp__vibestudio__list_stories',
  'mcp__vibestudio__search_stories',
  'mcp__vibestudio__get_epic',
  'mcp__vibestudio__list_epics',

  // === Read-Only Team/Component Tools (SAFE) ===
  'mcp__vibestudio__list_teams',
  'mcp__vibestudio__get_team_context',
  'mcp__vibestudio__get_component_context',
  'mcp__vibestudio__list_agents',
  'mcp__vibestudio__get_agent',

  // === Artifact Tools (SAFE - read and write) ===
  'mcp__vibestudio__get_artifact',
  'mcp__vibestudio__upload_artifact',
  'mcp__vibestudio__list_artifacts',
  'mcp__vibestudio__upload_artifact_from_file',

  // === File Operations (SAFE - within worktree) ===
  'Read',
  'Write',
  'Edit',
  'Glob',
  'Grep',

  // === Task Tool (SAFE - agent spawning) ===
  'Task',

  // === Bash (SAFE - within worktree, permission-gated) ===
  'Bash',

  // === Other Read-Only Tools ===
  'mcp__vibestudio__list_projects',
  'mcp__vibestudio__get_project',
  'mcp__vibestudio__search_use_cases',
  'mcp__vibestudio__find_related_use_cases',

  // Note: The following are EXPLICITLY BLOCKED:
  // - mcp__vibestudio__delete_* (deletion)
  // - mcp__vibestudio__update_* (mutation)
  // - mcp__vibestudio__deploy_to_production (dangerous)
  // - mcp__vibestudio__run_safe_migration (schema changes)
  // - mcp__vibestudio__restore_backup (destructive)
]);

/**
 * Check if MCP tool is allowed for Master Session execution
 * Case-sensitive, deny-by-default
 */
export function isToolAllowed(toolName: string): boolean {
  return MCP_TOOL_ALLOWLIST.has(toolName);
}

/**
 * Sanitize error messages to prevent information disclosure
 * Redacts file paths, UUIDs, passwords, secrets, tokens
 */
export function sanitizeError(error: string): string {
  return error
    // Redact file paths (Unix/Mac and Windows)
    .replace(/\/[^\s]+/g, '[PATH]')
    .replace(/[A-Z]:\\[^\s]+/g, '[PATH]')
    // Redact UUIDs
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '[UUID]')
    // Redact password/secret/token values (case-insensitive)
    // Matches: "password: value", "PASSWORD=value", "secret=value", "token: value"
    .replace(/(password|secret|token)[:\s=]+[^\s]+/gi, '$1: [REDACTED]');
}
