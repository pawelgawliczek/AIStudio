/**
 * Truncation Utilities for MCP Token Efficiency
 *
 * Provides consistent truncation behavior across MCP tools with
 * transparent follow-up instructions for fetching full content.
 */

export interface TruncationInfo {
  field: string;
  originalLength: number;
  truncatedTo: number;
  reason: string;
  fetchCommand: string;
}

export interface TruncatedField<T> {
  value: T;
  truncationInfo?: TruncationInfo;
}

/**
 * Truncate content and return metadata for follow-up
 *
 * @param content - The content to truncate (string or object)
 * @param maxLength - Maximum length in characters
 * @param fieldName - Name of the field being truncated
 * @param fetchCommand - MCP command to fetch full content
 * @returns Object with truncated value and truncation info if truncated
 */
export function truncateWithMetadata<T>(
  content: T,
  maxLength: number,
  fieldName: string,
  fetchCommand: string,
): TruncatedField<T | string | null> {
  if (content === null || content === undefined) {
    return { value: content as T };
  }

  const stringified =
    typeof content === 'string' ? content : JSON.stringify(content);
  const originalLength = stringified.length;

  if (originalLength <= maxLength) {
    return { value: content };
  }

  const truncated = stringified.substring(0, maxLength) + '...';

  return {
    value: truncated,
    truncationInfo: {
      field: fieldName,
      originalLength,
      truncatedTo: maxLength,
      reason: `Truncated for token efficiency (${originalLength} -> ${maxLength} chars)`,
      fetchCommand,
    },
  };
}

/**
 * Mark content as omitted (for binary/large content that shouldn't be truncated)
 *
 * @param fieldName - Name of the field being omitted
 * @param byteSize - Size in bytes of the omitted content
 * @param fetchCommand - MCP command to fetch full content
 * @returns TruncationInfo object describing the omission
 */
export function markOmitted(
  fieldName: string,
  byteSize: number,
  fetchCommand: string,
): TruncationInfo {
  return {
    field: fieldName,
    originalLength: byteSize,
    truncatedTo: 0,
    reason: 'Content excluded by default for token efficiency',
    fetchCommand,
  };
}

/**
 * Collect truncation info from multiple fields into a single array
 *
 * @param truncatedFields - Array of TruncatedField results
 * @returns Array of TruncationInfo for fields that were truncated
 */
export function collectTruncationInfo(
  truncatedFields: TruncatedField<any>[],
): TruncationInfo[] {
  return truncatedFields
    .filter((f) => f.truncationInfo)
    .map((f) => f.truncationInfo!);
}

/**
 * Apply truncation to an object's fields based on config
 *
 * @param obj - Object to truncate fields from
 * @param truncationConfig - Map of field names to truncation settings
 * @returns Object with truncated fields and _truncated metadata array
 */
export function truncateObjectFields<T extends Record<string, any>>(
  obj: T,
  truncationConfig: Record<
    keyof T,
    { maxLength: number; fetchCommand: string } | null
  >,
): T & { _truncated?: TruncationInfo[] } {
  const result = { ...obj } as T & { _truncated?: TruncationInfo[] };
  const truncationInfos: TruncationInfo[] = [];

  for (const [field, config] of Object.entries(truncationConfig)) {
    if (config && obj[field] !== undefined && obj[field] !== null) {
      const truncated = truncateWithMetadata(
        obj[field],
        config.maxLength,
        field,
        config.fetchCommand,
      );
      (result as any)[field] = truncated.value;
      if (truncated.truncationInfo) {
        truncationInfos.push(truncated.truncationInfo);
      }
    }
  }

  if (truncationInfos.length > 0) {
    result._truncated = truncationInfos;
  }

  return result;
}

/**
 * Helper to create a fetch command string for artifact content
 */
export function artifactFetchCommand(artifactId: string): string {
  return `get_artifact({ artifactId: '${artifactId}', includeContent: true })`;
}

/**
 * Helper to create a fetch command string for team run results
 */
export function teamRunResultsFetchCommand(runId: string): string {
  return `get_team_run_results({ runId: '${runId}', includeComponentDetails: true })`;
}

/**
 * Helper to create a fetch command string for component context
 */
export function componentContextFetchCommand(
  componentId: string,
  runId: string,
): string {
  return `get_component_context({ componentId: '${componentId}', runId: '${runId}', summaryMode: false })`;
}

/**
 * Helper to create a fetch command string for story details
 */
export function storyFetchCommand(
  storyId: string,
  includeOption: string,
): string {
  return `get_story({ storyId: '${storyId}', ${includeOption}: true })`;
}
