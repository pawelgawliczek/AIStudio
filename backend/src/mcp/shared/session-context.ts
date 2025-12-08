/**
 * Session context management for MCP connections
 *
 * ST-187: MCP Tool Optimization & Step Commands
 *
 * This module provides per-connection context storage, allowing users to set
 * common parameters once (like projectId) instead of passing them to every tool call.
 *
 * Usage:
 *   1. User calls set_context({ project: "AI Studio" })
 *   2. All subsequent tool calls use context.projectId automatically
 *   3. Explicit parameters always override context values
 */

/**
 * Context data that can be stored per session
 */
export interface SessionContext {
  /** Project UUID (resolved from project name or ID) */
  projectId?: string;

  /** Project name (for display) */
  projectName?: string;

  /** Team/Workflow UUID */
  teamId?: string;

  /** Team/Workflow name (for display) */
  teamName?: string;

  /** Default model for agent operations */
  model?: string;

  /** Active story ID (for story-focused sessions) */
  storyId?: string;

  /** Active story key (for display) */
  storyKey?: string;

  /** Active workflow run ID */
  runId?: string;

  /** Timestamp when context was set */
  setAt?: string;
}

/**
 * Context store - maps connection IDs to context data
 *
 * In MCP, each connection has a unique identifier. We use this to store
 * per-connection context so different sessions don't interfere.
 */
const contextStore = new Map<string, SessionContext>();

/**
 * Default connection ID for single-session scenarios
 */
const DEFAULT_CONNECTION_ID = 'default';

/**
 * Get the current session context
 *
 * @param connectionId - MCP connection ID (optional, uses default if not provided)
 * @returns Current context or empty object
 */
export function getContext(connectionId?: string): SessionContext {
  const id = connectionId || DEFAULT_CONNECTION_ID;
  return contextStore.get(id) || {};
}

/**
 * Set session context (merges with existing context)
 *
 * @param context - Context values to set
 * @param connectionId - MCP connection ID (optional)
 * @returns Updated context
 */
export function setContext(
  context: Partial<SessionContext>,
  connectionId?: string
): SessionContext {
  const id = connectionId || DEFAULT_CONNECTION_ID;
  const existing = contextStore.get(id) || {};

  const updated: SessionContext = {
    ...existing,
    ...context,
    setAt: new Date().toISOString(),
  };

  contextStore.set(id, updated);
  return updated;
}

/**
 * Clear session context
 *
 * @param connectionId - MCP connection ID (optional)
 */
export function clearContext(connectionId?: string): void {
  const id = connectionId || DEFAULT_CONNECTION_ID;
  contextStore.delete(id);
}

/**
 * Clear all session contexts (for testing/cleanup)
 */
export function clearAllContexts(): void {
  contextStore.clear();
}

/**
 * Get the number of active contexts
 */
export function getContextCount(): number {
  return contextStore.size;
}

/**
 * Helper to merge explicit params with context
 *
 * Explicit params always override context values.
 *
 * @param params - Explicit parameters from tool call
 * @param context - Session context
 * @param mappings - Map of param names to context keys
 * @returns Merged parameters
 *
 * @example
 * // Map 'projectId' from context if not in params
 * const merged = mergeWithContext(
 *   { title: "New Story" },
 *   context,
 *   { projectId: 'projectId' }
 * );
 * // Result: { title: "New Story", projectId: context.projectId }
 */
export function mergeWithContext<T extends Record<string, unknown>>(
  params: T,
  context: SessionContext,
  mappings: Record<string, keyof SessionContext>
): T {
  const result = { ...params };

  for (const [paramKey, contextKey] of Object.entries(mappings)) {
    // Only use context value if param is not explicitly provided
    if (result[paramKey] === undefined && context[contextKey] !== undefined) {
      (result as Record<string, unknown>)[paramKey] = context[contextKey];
    }
  }

  return result;
}

/**
 * Middleware for MCP tools to automatically apply context
 *
 * Usage in tool handler:
 * ```typescript
 * export async function handler(prisma: PrismaClient, params: SomeParams) {
 *   const mergedParams = applyContext(params, {
 *     projectId: 'projectId',
 *     teamId: 'teamId',
 *   });
 *   // Now mergedParams.projectId is filled from context if not provided
 * }
 * ```
 *
 * @param params - Tool parameters
 * @param mappings - Map of param names to context keys
 * @param connectionId - MCP connection ID (optional)
 * @returns Parameters with context applied
 */
export function applyContext<T extends Record<string, unknown>>(
  params: T,
  mappings: Record<string, keyof SessionContext>,
  connectionId?: string
): T {
  const context = getContext(connectionId);
  return mergeWithContext(params, context, mappings);
}

/**
 * Context validation helper
 *
 * @param context - Context to validate
 * @param required - Required context fields
 * @returns Validation result
 */
export function validateContext(
  context: SessionContext,
  required: (keyof SessionContext)[]
): { valid: boolean; missing: string[] } {
  const missing = required.filter((key) => context[key] === undefined);
  return {
    valid: missing.length === 0,
    missing,
  };
}

/**
 * Format context for display
 *
 * @param context - Context to format
 * @returns Human-readable context summary
 */
export function formatContext(context: SessionContext): string {
  const parts: string[] = [];

  if (context.projectName) {
    parts.push(`project: ${context.projectName}`);
  } else if (context.projectId) {
    parts.push(`projectId: ${context.projectId.substring(0, 8)}...`);
  }

  if (context.teamName) {
    parts.push(`team: ${context.teamName}`);
  } else if (context.teamId) {
    parts.push(`teamId: ${context.teamId.substring(0, 8)}...`);
  }

  if (context.storyKey) {
    parts.push(`story: ${context.storyKey}`);
  } else if (context.storyId) {
    parts.push(`storyId: ${context.storyId.substring(0, 8)}...`);
  }

  if (context.runId) {
    parts.push(`runId: ${context.runId.substring(0, 8)}...`);
  }

  if (context.model) {
    parts.push(`model: ${context.model}`);
  }

  if (parts.length === 0) {
    return 'No context set';
  }

  return parts.join(', ');
}
