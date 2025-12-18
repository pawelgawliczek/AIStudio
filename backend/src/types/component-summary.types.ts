/**
 * ST-203: Structured Component Summary Types
 *
 * Defines structured JSON format for componentSummary field.
 * Replaces free-form text with a standardized format for better agent handoffs.
 */

import {
  detectStatusFromOutput,
  extractKeyOutputs,
  extractErrors,
  extractArtifacts,
  cleanupEmptyArrays,
} from './component-summary.helpers';

export type ComponentSummaryStatus = 'success' | 'partial' | 'blocked' | 'failed';

export interface ComponentSummaryStructured {
  version: '1.0';
  status: ComponentSummaryStatus;
  summary: string; // 1-2 sentence description (max 200 chars)
  keyOutputs?: string[]; // Bullet points (max 5)
  nextAgentHints?: string[]; // Suggestions for next agent (max 3)
  artifactsProduced?: string[]; // Artifact keys created
  errors?: string[]; // Errors if any (max 3)
}

/**
 * Serialize structured summary to JSON string for database storage
 */
export function serializeComponentSummary(
  summary: ComponentSummaryStructured,
): string {
  return JSON.stringify(summary);
}

/**
 * Parse componentSummary JSON string from database
 * Returns null if parsing fails or summary is null/empty
 */
const VALID_STATUSES: ComponentSummaryStatus[] = ['success', 'partial', 'blocked', 'failed'];

export function parseComponentSummary(
  summaryJson: string | null | undefined,
): ComponentSummaryStructured | null {
  if (!summaryJson) {
    return null;
  }

  try {
    const parsed = JSON.parse(summaryJson);
    // Validate it has required fields
    if (
      parsed &&
      typeof parsed === 'object' &&
      'version' in parsed &&
      'status' in parsed &&
      'summary' in parsed &&
      VALID_STATUSES.includes(parsed.status)
    ) {
      return parsed as ComponentSummaryStructured;
    }
    return null;
  } catch {
    // Invalid JSON - likely legacy text format
    return null;
  }
}

/**
 * Generate structured summary from component output
 * Replaces the old generateComponentSummary function
 *
 * @param output Component output data
 * @param componentName Name of the component
 * @param status Optional status override (default: 'success')
 * @returns Structured summary object
 */
export function generateStructuredSummary(
  output: Record<string, unknown> | undefined,
  componentName: string,
  status?: ComponentSummaryStatus,
): ComponentSummaryStructured {
  // Initialize summary with defaults
  const summary: ComponentSummaryStructured = {
    version: '1.0',
    status: status || 'success',
    summary: '',
  };

  // Generate summary text
  if (!output || Object.keys(output).length === 0) {
    summary.summary = `${componentName} completed execution.`;
  } else {
    // Use helper to detect status from output
    summary.status = detectStatusFromOutput(output, summary.status);

    // Generate summary text based on output status
    const outputStatus = output.status || output.result;
    if (typeof outputStatus === 'string') {
      summary.summary = `${componentName} ${outputStatus}.`;
    } else {
      summary.summary = `${componentName} completed.`;
    }

    // Use helpers to extract structured data
    const keyOutputs = extractKeyOutputs(output);
    if (keyOutputs.length > 0) {
      summary.keyOutputs = keyOutputs;
    }

    const errors = extractErrors(output);
    if (errors.length > 0) {
      summary.errors = errors;
      // Update status to failed if errors present
      if (summary.status === 'success') {
        summary.status = 'failed';
      }
    }

    const artifacts = extractArtifacts(output);
    if (artifacts.length > 0) {
      summary.artifactsProduced = artifacts;
    }

    // Extract recommendations as nextAgentHints
    if (output.recommendations && Array.isArray(output.recommendations)) {
      summary.nextAgentHints = (output.recommendations as string[]).slice(0, 3).map(r => String(r));
    }
  }

  // Truncate summary to max 200 chars
  if (summary.summary.length > 200) {
    summary.summary = summary.summary.substring(0, 197) + '...';
  }

  // Use helper to remove empty arrays
  cleanupEmptyArrays(summary);

  return summary;
}
