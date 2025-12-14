/**
 * Shared MCP utilities
 *
 * ST-187: MCP Tool Optimization & Step Commands
 */

// Identifier resolution
export {
  isStoryKey,
  isUUID,
  resolveStory,
  resolveRunId,
  resolveProject,
  resolveTeam,
  resolveComponent,
  resolveState,
  type ResolvedStory,
  type ResolvedRun,
  type ResolvedProject,
} from './resolve-identifiers';

// Agent tracking (ST-215: Automatic tracking in advance_step)
export {
  startAgentTracking,
  completeAgentTracking,
  generateComponentSummary,
  type StartAgentResult,
  type CompleteAgentResult,
} from './agent-tracking';

// Session context
export {
  getContext,
  setContext,
  clearContext,
  clearAllContexts,
  getContextCount,
  mergeWithContext,
  applyContext,
  validateContext,
  formatContext,
  type SessionContext,
} from './session-context';
