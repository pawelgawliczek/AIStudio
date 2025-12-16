/**
 * MCP Tool Profiles
 *
 * Defines which tools are loaded based on the MCP_PROFILE environment variable.
 * This reduces context window usage by only exposing frequently-used tools.
 *
 * Part of MCP Context Optimization (ST-197):
 * - Core profile: ~25 tools (~22k tokens) - Default
 * - Full profile: All ~153 tools (~126k tokens)
 *
 * Industry research shows:
 * - Agents experience reliability issues after ~20 tools (Arcade)
 * - Tool Search Tool improves accuracy: Opus 4.5 79.5% → 88.1% (Anthropic)
 * - 85% token savings with progressive tool disclosure
 *
 * Usage: Set MCP_PROFILE=core (default) or MCP_PROFILE=full in environment
 */

/**
 * Core profile tools - Always loaded
 *
 * Selection criteria:
 * 1. Usage frequency from transcript analysis
 * 2. Essential for workflow orchestration
 * 3. Meta tools for dynamic discovery
 *
 * Tools not in core profile can be called via invoke_tool
 */
export const CORE_PROFILE_TOOLS: string[] = [
  // === Meta Tools (REQUIRED - enables dynamic discovery) ===
  'search_tools', // Discover tools by query/category
  'invoke_tool', // Call any tool by name

  // === Story Management (Top 4 by usage) ===
  'get_story', // 1366 calls - Most used tool
  'update_story', // 1005 calls
  'create_story', // 830 calls
  'list_stories', // Now includes text search (merged with search_stories)

  // === Artifacts (High usage for analysis docs) ===
  'upload_artifact', // 817 calls
  'get_artifact', // 765 calls
  'list_artifacts', // Needed for artifact discovery

  // === Workflow Execution ===
  'get_component_context', // 663 calls - Agent context loading
  'start_team_run', // 555 calls - Start workflow runs
  // ST-242: record_agent_start/complete REMOVED - advance_step handles tracking automatically
  'get_team_context', // 343 calls - Team orchestration
  'update_team_status', // 298 calls - Status updates
  'list_teams', // 341 calls - Team discovery

  // === Story Runner (EP-8) ===
  'get_current_step', // Core orchestration tool
  'advance_step', // Move through workflow
  'get_runner_status', // 262 calls - Monitor execution
  'repeat_step', // Retry with feedback

  // === Project Management ===
  'list_projects', // 584 calls - Project discovery
  'get_project', // Project details

  // === Context Management ===
  'get_context', // Session context
  'set_context', // Set session context
];

/**
 * Profile definitions
 */
export type ProfileName = 'core' | 'full';

export interface ToolProfile {
  name: ProfileName;
  description: string;
  tools: string[] | 'all';
}

export const TOOL_PROFILES: Record<ProfileName, ToolProfile> = {
  core: {
    name: 'core',
    description: 'Frequently-used tools only (~25 tools). Use invoke_tool for others.',
    tools: CORE_PROFILE_TOOLS,
  },
  full: {
    name: 'full',
    description: 'All available tools (~153 tools). High context usage.',
    tools: 'all',
  },
};

/**
 * Get profile from environment variable
 * Defaults to 'core' for optimal context usage
 */
export function getActiveProfile(): ProfileName {
  const profile = process.env.MCP_PROFILE?.toLowerCase();

  if (profile === 'full') {
    return 'full';
  }

  // Default to core profile
  return 'core';
}

/**
 * Check if a tool should be included in the current profile
 */
export function isToolInProfile(toolName: string, profileName?: ProfileName): boolean {
  const profile = profileName || getActiveProfile();
  const profileConfig = TOOL_PROFILES[profile];

  if (profileConfig.tools === 'all') {
    return true;
  }

  return profileConfig.tools.includes(toolName);
}
