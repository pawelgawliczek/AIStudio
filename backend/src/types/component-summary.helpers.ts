/**
 * Component Summary Helper Functions
 * ST-284: Architecture & Complexity Cleanup - Phase 1
 *
 * Helper functions extracted from generateStructuredSummary to reduce complexity.
 */

import { ComponentSummaryStatus } from './component-summary.types';

/**
 * Detect status from output object
 *
 * @param output Component output data
 * @param defaultStatus Default status if cannot detect (or explicit override)
 * @returns Detected status
 */
export function detectStatusFromOutput(
  output: Record<string, unknown> | undefined | null,
  defaultStatus: ComponentSummaryStatus
): ComponentSummaryStatus {
  // Handle null/undefined output
  if (!output) {
    return defaultStatus;
  }

  // If defaultStatus is not 'success', treat it as an explicit override
  // This allows callers to force a specific status
  if (defaultStatus !== 'success') {
    return defaultStatus;
  }

  // Check for explicit status in output (partial, blocked)
  const outputStatus = output.status || output.result;
  if (typeof outputStatus === 'string') {
    if (outputStatus === 'blocked' || outputStatus.includes('blocked')) {
      return 'blocked';
    }
    if (outputStatus === 'partial' || outputStatus.includes('partial')) {
      return 'partial';
    }
  }

  // Check for failure indicators
  if (
    (Array.isArray(output.errors) && output.errors.length > 0) ||
    output.error ||
    output.success === false ||
    output.failed === true
  ) {
    return 'failed';
  }

  // Use default status
  return defaultStatus;
}

/**
 * Extract key outputs from component output
 *
 * @param output Component output data
 * @returns Array of key output strings (max 5)
 */
export function extractKeyOutputs(
  output: Record<string, unknown> | undefined | null
): string[] {
  if (!output) {
    return [];
  }

  const keyOutputs: string[] = [];

  // Check for file modifications (prefer filesModified over files)
  if (Array.isArray(output.filesModified) && output.filesModified.length > 0) {
    keyOutputs.push(`Modified ${output.filesModified.length} file(s)`);
  } else if (Array.isArray(output.files) && output.files.length > 0) {
    keyOutputs.push(`Modified ${output.files.length} file(s)`);
  }

  // Check for summary/changes/description field
  const outputSummary = output.summary || output.changes || output.description;
  if (typeof outputSummary === 'string' && outputSummary.length > 0) {
    // Truncate long summaries to 100 characters
    const truncated =
      outputSummary.length > 100 ? outputSummary.substring(0, 100) + '...' : outputSummary;
    keyOutputs.push(truncated);
  }

  // Check for error count
  if (typeof output.errorCount === 'number' && output.errorCount > 0) {
    keyOutputs.push(`Found ${output.errorCount} error(s)`);
  }

  // Return max 5 items
  return keyOutputs.slice(0, 5);
}

/**
 * Extract errors from component output
 *
 * @param output Component output data
 * @returns Array of error strings (max 3)
 */
export function extractErrors(
  output: Record<string, unknown> | undefined | null
): string[] {
  if (!output) {
    return [];
  }

  const errors: string[] = [];

  // Extract errors from errors array
  if (Array.isArray(output.errors)) {
    errors.push(...output.errors.map(e => String(e)));
  } else if (typeof output.errors === 'string') {
    // Handle non-array errors field gracefully
    errors.push(output.errors);
  }

  // Extract error from error field
  if (output.error && typeof output.error === 'string') {
    errors.push(output.error);
  }

  // Add default error when failure indicated but no errors present
  if (errors.length === 0 && (output.success === false || output.failed === true)) {
    errors.push('Execution had issues.');
  }

  // Return max 3 items
  return errors.slice(0, 3);
}

/**
 * Extract artifacts from component output
 *
 * @param output Component output data
 * @returns Array of artifact keys
 */
export function extractArtifacts(
  output: Record<string, unknown> | undefined | null
): string[] {
  if (!output) {
    return [];
  }

  // Check multiple field names in priority order
  let artifacts: unknown[] = [];

  if (Array.isArray(output.artifactsCreated)) {
    artifacts = output.artifactsCreated;
  } else if (typeof output.artifactsCreated === 'string') {
    artifacts = [output.artifactsCreated];
  } else if (Array.isArray(output.artifactsProduced)) {
    artifacts = output.artifactsProduced;
  } else if (typeof output.artifactsProduced === 'string') {
    artifacts = [output.artifactsProduced];
  } else if (Array.isArray(output.artifacts)) {
    artifacts = output.artifacts;
  } else if (typeof output.artifacts === 'string') {
    artifacts = [output.artifacts];
  }

  // Convert all artifacts to strings
  return artifacts.map(a => String(a));
}

/**
 * Remove empty optional arrays from summary object (mutates in place)
 *
 * @param summary Component summary object to clean up
 */
export function cleanupEmptyArrays(
  summary: {
    keyOutputs?: string[];
    nextAgentHints?: string[];
    artifactsProduced?: string[];
    errors?: string[];
  }
): void {
  if (summary.keyOutputs && summary.keyOutputs.length === 0) {
    delete summary.keyOutputs;
  }
  if (summary.nextAgentHints && summary.nextAgentHints.length === 0) {
    delete summary.nextAgentHints;
  }
  if (summary.artifactsProduced && summary.artifactsProduced.length === 0) {
    delete summary.artifactsProduced;
  }
  if (summary.errors && summary.errors.length === 0) {
    delete summary.errors;
  }
}
