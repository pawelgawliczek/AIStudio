/**
 * ST-203: Structured Component Summary Types
 *
 * Defines structured JSON format for componentSummary field.
 * Replaces free-form text with a standardized format for better agent handoffs.
 */

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
  const summary: ComponentSummaryStructured = {
    version: '1.0',
    status: status || 'success',
    summary: '',
    keyOutputs: [],
    nextAgentHints: [],
    artifactsProduced: [],
    errors: [],
  };

  // Generate summary text
  if (!output || Object.keys(output).length === 0) {
    summary.summary = `${componentName} completed execution.`;
  } else {
    // Detect status from output first (before generating summary text)
    const outputStatus = output.status || output.result;
    if (typeof outputStatus === 'string') {
      // Detect specific status values
      if (outputStatus === 'partial' || outputStatus.includes('partial')) {
        summary.status = 'partial';
      } else if (outputStatus === 'blocked' || outputStatus.includes('blocked')) {
        summary.status = 'blocked';
      }
      summary.summary = `${componentName} ${outputStatus}.`;
    } else {
      summary.summary = `${componentName} completed.`;
    }

    // Extract key outputs
    const keyOutputs: string[] = [];

    // Check for file modifications
    if (Array.isArray(output.files) && output.files.length > 0) {
      keyOutputs.push(`Modified ${output.files.length} file(s)`);
    }
    if (Array.isArray(output.filesModified) && output.filesModified.length > 0) {
      keyOutputs.push(`Modified ${output.filesModified.length} file(s)`);
    }

    // Check for summary/changes field
    const outputSummary = output.summary || output.changes || output.description;
    if (typeof outputSummary === 'string' && outputSummary.length > 0) {
      // Truncate long summaries
      const truncated =
        outputSummary.length > 100 ? outputSummary.substring(0, 100) + '...' : outputSummary;
      keyOutputs.push(truncated);
    }

    // Check for error count
    if (typeof output.errorCount === 'number' && output.errorCount > 0) {
      keyOutputs.push(`Found ${output.errorCount} error(s)`);
    }

    summary.keyOutputs = keyOutputs.slice(0, 5); // Max 5 items

    // Extract errors if present
    const errors: string[] = [];
    if (output.errors && Array.isArray(output.errors)) {
      errors.push(...(output.errors as string[]).map(e => String(e)));
    }
    if (output.error && typeof output.error === 'string') {
      errors.push(output.error);
    }
    summary.errors = errors.slice(0, 3); // Max 3 items

    // Detect failure from errors
    if (errors.length > 0) {
      summary.status = 'failed';
    }

    // Extract artifacts produced (check multiple field names)
    if (output.artifactsCreated && Array.isArray(output.artifactsCreated)) {
      summary.artifactsProduced = (output.artifactsCreated as string[]).map(a => String(a));
    } else if (output.artifactsProduced && Array.isArray(output.artifactsProduced)) {
      summary.artifactsProduced = (output.artifactsProduced as string[]).map(a => String(a));
    } else if (output.artifacts && Array.isArray(output.artifacts)) {
      summary.artifactsProduced = (output.artifacts as string[]).map(a => String(a));
    }

    // Extract recommendations as nextAgentHints
    if (output.recommendations && Array.isArray(output.recommendations)) {
      summary.nextAgentHints = (output.recommendations as string[]).slice(0, 3).map(r => String(r));
    }

    // Detect failure indicators
    if (output.success === false || output.failed === true) {
      summary.status = 'failed';
      if (!summary.errors || summary.errors.length === 0) {
        summary.errors = ['Execution had issues.'];
      }
    }
  }

  // Truncate summary to max 200 chars
  if (summary.summary.length > 200) {
    summary.summary = summary.summary.substring(0, 197) + '...';
  }

  // Remove empty arrays
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

  return summary;
}
