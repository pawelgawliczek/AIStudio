/**
 * ST-133: Remote Execution Agent - Approved Scripts Whitelist
 *
 * Security-critical configuration defining which scripts can be executed remotely
 * and what parameters they accept.
 *
 * Only scripts listed here can be executed via remote agent.
 */

export interface ApprovedScript {
  script: string; // Relative path to script from project root
  allowedParams: string[]; // Allowed parameter names (without values)
  timeout: number; // Max execution time in milliseconds
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
    allowedParams: ['--latest', '--latest-agent', '--agent', '--search', '--file'],
    timeout: 30000, // 30 seconds
  },
  'analyze-story-transcripts': {
    script: 'scripts/analyze-story-transcripts.ts',
    allowedParams: ['--story-id', '--story-key', '--branch', '--days'],
    timeout: 60000, // 60 seconds
  },
  'list-transcripts': {
    script: 'scripts/list-transcripts.ts',
    allowedParams: ['--limit', '--since', '--pattern'],
    timeout: 10000, // 10 seconds
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
