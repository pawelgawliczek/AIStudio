/**
 * Runner Configuration Types
 * Resource limits and runtime configuration
 */

/**
 * Global resource limits for workflow runs
 */
export interface ResourceLimits {
  /** Maximum number of agent spawns per run */
  maxAgentSpawns: number;
  /** Maximum token budget per run */
  maxTokenBudget: number;
  /** Maximum state transitions (prevents infinite loops) */
  maxStateTransitions: number;
  /** Maximum run duration in milliseconds */
  maxRunDuration: number;
  /** Maximum concurrent runs (global) */
  maxConcurrentRuns: number;
}

/**
 * Default resource limits
 */
export const DEFAULT_LIMITS: ResourceLimits = {
  maxAgentSpawns: 20,
  maxTokenBudget: 500000,
  maxStateTransitions: 50,
  maxRunDuration: 7200000, // 2 hours
  maxConcurrentRuns: 5,
};

/**
 * Agent-specific configuration
 */
export interface AgentConfig {
  /** Maximum turns for agent CLI */
  maxTurns: number;
  /** Timeout in milliseconds */
  timeout: number;
  /** Default timeout in milliseconds (alias for timeout) */
  defaultTimeout: number;
  /** Model to use (defaults to claude-sonnet-4-20250514) */
  model?: string;
  /** Allowed MCP tools */
  allowedTools?: string[];
}

/**
 * Default agent configuration
 */
export const DEFAULT_AGENT_CONFIG: AgentConfig = {
  maxTurns: 100,
  timeout: 1800000, // 30 minutes
  defaultTimeout: 1800000, // 30 minutes
};

/**
 * Master session configuration
 */
export interface MasterConfig {
  /** Maximum turns for master CLI */
  maxTurns: number;
  /** Idle timeout in milliseconds */
  idleTimeout: number;
  /** Model to use */
  model?: string;
}

/**
 * Default master configuration
 */
export const DEFAULT_MASTER_CONFIG: MasterConfig = {
  maxTurns: 1000,
  idleTimeout: 300000, // 5 minutes
};

/**
 * Complete runner configuration
 */
export interface RunnerConfig {
  /** Resource limits */
  limits: ResourceLimits;
  /** Default agent config */
  agent: AgentConfig;
  /** Master session config */
  master: MasterConfig;
  /** Backend API URL */
  backendUrl: string;
  /** Working directory for Claude Code */
  workingDirectory: string;
  /** Checkpoint directory */
  checkpointDir: string;
  /** Database URL for direct access */
  databaseUrl: string;
  /** ST-200: WebSocket orchestrator for laptop agent communication (optional - for testing) */
  orchestrator?: any;
}

/**
 * Load configuration from environment
 */
export function loadConfig(): RunnerConfig {
  return {
    limits: {
      maxAgentSpawns: parseInt(process.env.MAX_AGENT_SPAWNS || '20', 10),
      maxTokenBudget: parseInt(process.env.MAX_TOKEN_BUDGET || '500000', 10),
      maxStateTransitions: parseInt(process.env.MAX_STATE_TRANSITIONS || '50', 10),
      maxRunDuration: parseInt(process.env.MAX_RUN_DURATION || '7200000', 10),
      maxConcurrentRuns: parseInt(process.env.MAX_CONCURRENT_RUNS || '5', 10),
    },
    agent: {
      maxTurns: parseInt(process.env.AGENT_MAX_TURNS || '100', 10),
      timeout: parseInt(process.env.AGENT_TIMEOUT || '1800000', 10),
      defaultTimeout: parseInt(process.env.AGENT_TIMEOUT || '1800000', 10),
      model: process.env.AGENT_MODEL,
    },
    master: {
      maxTurns: parseInt(process.env.MASTER_MAX_TURNS || '1000', 10),
      idleTimeout: parseInt(process.env.MASTER_IDLE_TIMEOUT || '300000', 10),
      model: process.env.MASTER_MODEL,
    },
    backendUrl: process.env.BACKEND_URL || 'http://localhost:3000',
    workingDirectory: process.env.WORKING_DIRECTORY || '/app/worktree',
    checkpointDir: process.env.CHECKPOINT_DIR || '/app/checkpoints',
    databaseUrl: process.env.DATABASE_URL || '',
  };
}
