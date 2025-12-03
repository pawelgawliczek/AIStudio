/**
 * ST-164: Deprecation Metadata Helper
 *
 * Provides standardized deprecation metadata for deprecated MCP tools.
 * Used by coordinator/project manager tools during the transition period.
 */

export interface DeprecationMetadata {
  status: 'deprecated';
  version: string;
  timeline: {
    warning: string; // When warnings started (e.g., '2025-02-01')
    lastSupported: string; // Last date tool will work
    removedDate: string; // When tool will be removed
  };
  migrationGuide: string;
  alternatives: string[];
  contactSupport: string;
}

/**
 * Creates standardized deprecation metadata for coordinator/project manager tools.
 *
 * This metadata is included in all responses from deprecated tools to help
 * users migrate to the new state-based workflow system (ST-143).
 *
 * @returns DeprecationMetadata object with timeline and migration information
 */
export function createDeprecationMetadata(): DeprecationMetadata {
  return {
    status: 'deprecated',
    version: '2.0.0',
    timeline: {
      warning: '2025-02-01',
      lastSupported: '2025-04-01',
      removedDate: '2025-04-15',
    },
    migrationGuide: 'https://docs.vibestudio.com/migrations/st-164',
    alternatives: [
      'create_workflow with WorkflowState definitions',
      'create_workflow_state for execution phases',
      'See ST-143 for state-based workflows',
    ],
    contactSupport: 'support@vibestudio.com',
  };
}

/**
 * Type guard to check if an object is valid DeprecationMetadata.
 *
 * @param obj - Object to check
 * @returns true if obj is a valid DeprecationMetadata object
 */
export function isDeprecationMetadata(
  obj: unknown,
): obj is DeprecationMetadata {
  if (!obj || typeof obj !== 'object') {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  // Check status field
  if (candidate.status !== 'deprecated') {
    return false;
  }

  // Check version field
  if (typeof candidate.version !== 'string') {
    return false;
  }

  // Check timeline object
  if (!candidate.timeline || typeof candidate.timeline !== 'object') {
    return false;
  }

  const timeline = candidate.timeline as Record<string, unknown>;
  if (
    typeof timeline.warning !== 'string' ||
    typeof timeline.lastSupported !== 'string' ||
    typeof timeline.removedDate !== 'string'
  ) {
    return false;
  }

  // Check migrationGuide field
  if (typeof candidate.migrationGuide !== 'string') {
    return false;
  }

  // Check alternatives array
  if (!Array.isArray(candidate.alternatives)) {
    return false;
  }

  if (!candidate.alternatives.every((item) => typeof item === 'string')) {
    return false;
  }

  // Check contactSupport field
  if (typeof candidate.contactSupport !== 'string') {
    return false;
  }

  return true;
}
