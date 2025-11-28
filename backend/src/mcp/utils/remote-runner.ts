/**
 * RemoteRunner - Reusable utility for remote script execution via laptop agent
 *
 * ST-140: Provides a clean interface for MCP tools to execute scripts on the
 * remote laptop agent (where Claude Code runs and has access to transcripts, etc.)
 *
 * When agent is online: Executes script remotely and returns parsed result
 * When agent is offline: Returns fallback command for manual execution
 *
 * Usage in any MCP tool:
 *   const runner = new RemoteRunner();
 *   const result = await runner.execute<MyType>('parse-transcript', ['--latest']);
 *   if (result.executed) return { success: true, data: result.result };
 *   return { success: true, runLocally: true, command: result.fallbackCommand };
 */

export interface RemoteRunnerResult<T = any> {
  /** true if script was executed on remote agent */
  executed: boolean;
  /** true if execution succeeded (when executed=true) */
  success: boolean;
  /** Script output (parsed JSON or raw) when execution succeeded */
  result?: T;
  /** Fallback command to run manually when agent is offline */
  fallbackCommand?: string;
  /** Error message if execution failed */
  error?: string;
  /** Additional context about the execution */
  context?: {
    agentId?: string;
    jobId?: string;
    executionTimeMs?: number;
  };
}

export interface RemoteAgent {
  id: string;
  name: string;
  status: 'online' | 'offline';
  capabilities: string[];
  lastHeartbeat: Date;
}

interface ExecuteOptions {
  /** Timeout in milliseconds (default: 30000) */
  timeout?: number;
  /** Identifier for who requested the execution */
  requestedBy?: string;
}

/**
 * RemoteRunner - Execute scripts on remote laptop agent
 *
 * Uses HTTP to communicate with the remote-agent controller.
 * No NestJS dependencies - can be used from any context.
 */
export class RemoteRunner {
  private readonly baseUrl: string;

  constructor(baseUrl?: string) {
    // Use localhost when running in Docker (backend container)
    // The backend container can reach itself at localhost:3000
    this.baseUrl = baseUrl || process.env.REMOTE_AGENT_URL || 'http://localhost:3000';
  }

  /**
   * Execute a script on the remote agent
   *
   * @param scriptName - Name of the script (must be in approved-scripts.ts)
   * @param params - Array of script parameters
   * @param options - Execution options (timeout, requestedBy)
   * @returns RemoteRunnerResult with execution status and result or fallback
   */
  async execute<T = any>(
    scriptName: string,
    params: string[] = [],
    options: ExecuteOptions = {},
  ): Promise<RemoteRunnerResult<T>> {
    const startTime = Date.now();
    const { requestedBy = 'mcp-tool' } = options;

    try {
      // Call the remote-agent execute endpoint
      const response = await fetch(`${this.baseUrl}/api/remote-agent/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          script: scriptName,
          params,
          requestedBy,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const data = await response.json();

      // Check if agent was offline
      if (data.result?.agentOffline) {
        return {
          executed: false,
          success: false,
          fallbackCommand: data.result.fallbackCommand,
          error: data.result.message || 'Remote agent is offline',
        };
      }

      // Execution succeeded
      return {
        executed: true,
        success: data.success,
        result: data.result as T,
        context: {
          executionTimeMs: Date.now() - startTime,
        },
      };
    } catch (error) {
      // Network error or agent unreachable - return fallback
      const fallbackCommand = this.buildFallbackCommand(scriptName, params);

      return {
        executed: false,
        success: false,
        fallbackCommand,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Check if any agent with a specific capability is online
   */
  async isAgentOnline(capability?: string): Promise<boolean> {
    try {
      const agents = await this.getOnlineAgents();

      if (!capability) {
        return agents.length > 0;
      }

      return agents.some(
        (agent) => agent.capabilities && agent.capabilities.includes(capability),
      );
    } catch {
      return false;
    }
  }

  /**
   * Get list of online agents
   */
  async getOnlineAgents(): Promise<RemoteAgent[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/remote-agent/agents`);

      if (!response.ok) {
        return [];
      }

      const agents = await response.json();
      return agents.filter((a: RemoteAgent) => a.status === 'online');
    } catch {
      return [];
    }
  }

  /**
   * Build fallback command for local execution
   */
  private buildFallbackCommand(scriptName: string, params: string[]): string {
    const projectPath = process.env.PROJECT_HOST_PATH || '/opt/stack/AIStudio';
    const paramsStr = params.join(' ');
    return `cd "${projectPath}" && npx tsx scripts/${scriptName}.ts ${paramsStr}`;
  }
}

/**
 * Singleton instance for convenience
 * Usage: import { remoteRunner } from './remote-runner';
 */
export const remoteRunner = new RemoteRunner();
