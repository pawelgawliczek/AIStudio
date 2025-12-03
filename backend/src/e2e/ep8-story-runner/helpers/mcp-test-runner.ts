/**
 * ST-161: MCP Test Runner
 *
 * Executes real MCP tools via Claude Code CLI for E2E testing.
 * Simulates actual user experience by spawning real CLI processes.
 *
 * Features:
 * - Environment detection (KVM vs laptop)
 * - Direct CLI spawning for laptop tests
 * - Remote agent routing for KVM tests
 * - No-fix constraints to prevent Claude from "outsmarting" tests
 * - Token-optimized instructions
 */

import { spawn } from 'child_process';
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export type Environment = 'kvm' | 'laptop';

export interface MCPTestResult<T = unknown> {
  success: boolean;
  result?: T;
  error?: string;
  metrics?: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
}

/**
 * No-fix constraints to prevent Claude from attempting to fix issues
 */
const NO_FIX_CONSTRAINTS = `
IMPORTANT TEST CONSTRAINTS:
- Execute ONLY the specified MCP tool with exact parameters
- Do NOT try to fix any errors or issues
- Do NOT reason about problems or suggest solutions
- Do NOT call additional tools to investigate
- Return the raw result (success or error) immediately
- If tool fails, return the error message as-is
- Maximum 1 tool call allowed

CRITICAL: If you get "No such tool available" error, output EXACTLY:
MCP_TOOL_NOT_FOUND: <tool_name>
`.trim();

export class MCPTestRunner {
  private env: Environment;
  private prisma: PrismaClient;
  private projectPath: string;
  private claudeCodePath: string;
  private mcpConfigPath: string;

  constructor(prisma: PrismaClient, options?: { projectPath?: string; claudeCodePath?: string; mcpConfigPath?: string }) {
    this.prisma = prisma;
    this.env = this.detectEnvironment();
    this.projectPath = options?.projectPath || this.getDefaultProjectPath();
    this.claudeCodePath = options?.claudeCodePath || 'claude';
    this.mcpConfigPath = options?.mcpConfigPath || this.getDefaultMCPConfigPath();

    console.log(`[MCPTestRunner] Environment: ${this.env.toUpperCase()}`);
    console.log(`[MCPTestRunner] Project path: ${this.projectPath}`);
    console.log(`[MCPTestRunner] MCP config: ${this.mcpConfigPath}`);
  }

  /**
   * Get MCP config path based on environment
   */
  private getDefaultMCPConfigPath(): string {
    if (this.env === 'kvm') {
      return path.join('/opt/stack/AIStudio', 'mcp-config.json');
    }
    // On laptop, use parent directory (AIStudio root)
    return path.join(process.cwd(), '..', 'mcp-config-laptop.json');
  }

  /**
   * Detect if running on KVM or laptop
   */
  private detectEnvironment(): Environment {
    // Allow override via environment variable
    if (process.env.MCP_TEST_ENV) {
      return process.env.MCP_TEST_ENV as Environment;
    }

    // Check for KVM-specific paths
    const isKVM = fs.existsSync('/opt/stack/AIStudio');
    const hasLocalGit = fs.existsSync(path.join(process.cwd(), '.git'));

    // If we're on KVM (has /opt/stack) and no local .git, we're on KVM
    // If we have a local .git repo, we're likely on laptop
    return isKVM && !hasLocalGit ? 'kvm' : 'laptop';
  }

  /**
   * Get default project path based on environment
   */
  private getDefaultProjectPath(): string {
    if (this.env === 'kvm') {
      return '/opt/stack/AIStudio';
    }
    // On laptop, use project root (parent of backend if running from backend dir)
    const cwd = process.cwd();
    if (cwd.endsWith('/backend')) {
      return path.join(cwd, '..');
    }
    return cwd;
  }

  /**
   * Get current environment
   */
  getEnvironment(): Environment {
    return this.env;
  }

  /**
   * Ensure the test runner is ready (agent online check for KVM)
   */
  async ensureReady(): Promise<void> {
    if (this.env === 'kvm') {
      await this.ensureAgentOnline();
    } else {
      // On laptop, verify Claude Code is available
      await this.verifyClaudeCodeAvailable();
    }
  }

  /**
   * Execute an MCP tool via real Claude Code CLI
   */
  async execute<T = unknown>(toolName: string, params: object): Promise<MCPTestResult<T>> {
    if (this.env === 'laptop') {
      return this.executeLocal<T>(toolName, params);
    } else {
      return this.executeViaAgent<T>(toolName, params);
    }
  }

  /**
   * LAPTOP: Spawn claude CLI directly
   * Uses stdin for instruction to avoid shell escaping issues
   */
  private async executeLocal<T>(toolName: string, params: object): Promise<MCPTestResult<T>> {
    const instruction = this.buildInstruction(toolName, params);
    const fullToolName = toolName.startsWith('mcp__') ? toolName : `mcp__vibestudio__${toolName}`;

    return new Promise((resolve) => {
      // Claude CLI args:
      // --mcp-config: Load MCP server configuration
      // --print: Non-interactive output mode
      // --verbose: Required for stream-json output format
      // --output-format stream-json: Stream JSON output for parsing
      // --allowedTools: Restrict to single tool for deterministic testing
      // Prompt is piped via stdin to avoid shell escaping issues
      const args = [
        '--mcp-config',
        this.mcpConfigPath,
        '--print',
        '--verbose',
        '--output-format',
        'stream-json',
        '--allowedTools',
        fullToolName,
      ];

      console.log(`[MCPTestRunner] Executing: ${this.claudeCodePath} ${args.join(' ')} < "<instruction>"`);

      const proc = spawn(this.claudeCodePath, args, {
        cwd: this.projectPath,
        stdio: ['pipe', 'pipe', 'pipe'], // stdin for prompt
        env: {
          ...process.env,
          CI: 'true',
        },
      });

      // Write instruction to stdin
      proc.stdin.write(instruction);
      proc.stdin.end();

      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      proc.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      proc.on('close', (code) => {
        console.log(`[MCPTestRunner] CLI exited with code: ${code}`);

        if (code === 0) {
          const result = this.parseStreamOutput<T>(stdout);
          resolve(result);
        } else {
          resolve({
            success: false,
            error: stderr || `CLI exited with code: ${code}`,
          });
        }
      });

      proc.on('error', (err) => {
        console.error(`[MCPTestRunner] CLI spawn error:`, err);
        resolve({
          success: false,
          error: err.message,
        });
      });

      // Timeout after 60 seconds
      setTimeout(() => {
        if (!proc.killed) {
          proc.kill('SIGTERM');
          resolve({
            success: false,
            error: 'CLI execution timeout (60s)',
          });
        }
      }, 60000);
    });
  }

  /**
   * KVM: Use spawn_agent to route to laptop agent
   */
  private async executeViaAgent<T>(toolName: string, params: object): Promise<MCPTestResult<T>> {
    // Dynamic import to avoid circular dependencies
    const { handler: spawnAgent } = await import('../../../mcp/servers/remote-agent/spawn_agent');

    const instruction = this.buildInstruction(toolName, params);
    const fullToolName = toolName.startsWith('mcp__') ? toolName : `mcp__vibestudio__${toolName}`;

    // Generate unique IDs for test execution
    const testId = `e2e-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const spawnResult = await spawnAgent(this.prisma, {
      componentId: testId,
      stateId: testId,
      workflowRunId: testId,
      componentRunId: testId,
      instructions: instruction,
      allowedTools: [fullToolName],
      model: 'claude-sonnet-4-20250514',
      maxTurns: 1, // Single turn - prevents Claude from "fixing" issues
    });

    if ('agentOffline' in spawnResult && spawnResult.agentOffline) {
      return {
        success: false,
        error: `Agent offline. Fallback: ${spawnResult.offlineFallback || 'unknown'}`,
      };
    }

    if (!spawnResult.success || !spawnResult.jobId) {
      return {
        success: false,
        error: spawnResult.error || 'Failed to spawn agent',
      };
    }

    // Poll for result
    return this.waitForJobResult<T>(spawnResult.jobId);
  }

  /**
   * Build instruction with no-fix constraints
   */
  private buildInstruction(toolName: string, params: object): string {
    const fullToolName = toolName.startsWith('mcp__') ? toolName : `mcp__vibestudio__${toolName}`;

    return `
${NO_FIX_CONSTRAINTS}

If you get "No such tool available" error for ${fullToolName}, output EXACTLY:
MCP_TOOL_NOT_FOUND: ${fullToolName}

Call ${fullToolName} with these exact params:
${JSON.stringify(params, null, 2)}

Return only the tool result. Do not add commentary.
`.trim();
  }

  /**
   * Parse stream-json output from Claude CLI
   * Stream format: Each line is a JSON object with type field
   * Tool results are in: {"type":"user","message":{"content":[{"type":"tool_result","content":[{"type":"text","text":"..."}]}]}}
   */
  private parseStreamOutput<T>(output: string): MCPTestResult<T> {
    try {
      const lines = output.split('\n').filter((l) => l.trim());
      let result: T | undefined;
      let error: string | undefined;
      const metrics = { inputTokens: 0, outputTokens: 0, totalTokens: 0 };

      // Debug logging (can be enabled by setting MCP_TEST_DEBUG=true)
      const debug = process.env.MCP_TEST_DEBUG === 'true';
      if (debug) console.log(`[MCPTestRunner] Parsing ${lines.length} lines of output`);

      for (const line of lines) {
        try {
          const record = JSON.parse(line);

          // Extract token metrics from usage (in assistant messages)
          if (record.message?.usage) {
            metrics.inputTokens += record.message.usage.input_tokens || 0;
            metrics.outputTokens += record.message.usage.output_tokens || 0;
          }

          // Log record types for debugging
          if (debug && record.type) {
            console.log(`[MCPTestRunner] Record type: ${record.type}`);
          }

          // Check assistant messages for MCP_TOOL_NOT_FOUND pattern
          if (record.type === 'assistant' && record.message?.content) {
            for (const block of record.message.content) {
              if (block.type === 'text' && block.text) {
                const text = block.text;
                // Check for our special MCP_TOOL_NOT_FOUND marker
                const toolNotFoundMatch = text.match(/MCP_TOOL_NOT_FOUND:\s*(\S+)/);
                if (toolNotFoundMatch) {
                  const toolName = toolNotFoundMatch[1];
                  error = `MCP_TOOL_NOT_FOUND: ${toolName} - MCP server may not be loaded. Check --mcp-config path.`;
                  if (debug) console.log(`[MCPTestRunner] Tool not found: ${toolName}`);
                  // This is a critical infrastructure error - return immediately
                  metrics.totalTokens = metrics.inputTokens + metrics.outputTokens;
                  return { success: false, error, metrics };
                }
                // Also check for "No such tool available" in assistant text
                if (text.includes('No such tool available')) {
                  const match = text.match(/No such tool available:\s*(\S+)/);
                  const toolName = match ? match[1] : 'unknown';
                  error = `MCP_TOOL_NOT_FOUND: ${toolName} - MCP server may not be loaded. Check --mcp-config path.`;
                  if (debug) console.log(`[MCPTestRunner] Tool not found (detected from text): ${toolName}`);
                  metrics.totalTokens = metrics.inputTokens + metrics.outputTokens;
                  return { success: false, error, metrics };
                }
              }
            }
          }

          // Skip non-user messages (we want tool results which are in user messages)
          if (record.type !== 'user' || !record.message?.content) {
            continue;
          }
          if (debug) console.log(`[MCPTestRunner] Found user message with ${record.message.content.length} content blocks`);

          // Process each content block in user message
          for (const block of record.message.content) {
            if (debug) console.log(`[MCPTestRunner] Block type: ${block.type}, keys: ${Object.keys(block).join(', ')}`);

            // Look for tool_result blocks
            if (block.type !== 'tool_result') {
              continue;
            }
            if (debug) console.log(`[MCPTestRunner] Found tool_result block: ${JSON.stringify(block).slice(0, 500)}`);

            // Handle is_error flag (indicates tool_use_error)
            if (block.is_error) {
              // Error content is typically a string directly
              const errorContent = typeof block.content === 'string' ? block.content : JSON.stringify(block.content);

              // Check for "No such tool available" in tool error
              if (errorContent.includes('No such tool available')) {
                const match = errorContent.match(/No such tool available:\s*(\S+)/);
                const toolName = match ? match[1] : 'unknown';
                error = `MCP_TOOL_NOT_FOUND: ${toolName} - MCP server may not be loaded. Check --mcp-config path.`;
                if (debug) console.log(`[MCPTestRunner] Tool not found (from tool error): ${toolName}`);
                metrics.totalTokens = metrics.inputTokens + metrics.outputTokens;
                return { success: false, error, metrics };
              }

              error = errorContent;
              if (debug) console.log(`[MCPTestRunner] Error from tool: ${error}`);
              continue;
            }

            // Handle content - can be string or array
            if (block.content) {
              // If content is an array of objects (success case)
              if (Array.isArray(block.content)) {
                for (const contentItem of block.content) {
                  if (contentItem.type === 'text' && contentItem.text) {
                    const text = contentItem.text;

                    // Check for error messages
                    if (text.includes('<tool_use_error>') || text.includes('Error:')) {
                      error = text;
                      continue;
                    }

                    // Try to parse as JSON (successful tool result)
                    try {
                      const parsed = JSON.parse(text);
                      if (!result) {
                        result = parsed as T;
                        if (debug) console.log(`[MCPTestRunner] Parsed result successfully`);
                      }
                    } catch {
                      // Not JSON - might be formatted text or error
                      if (!result && !error) {
                        // Store as potential error if it looks like one
                        if (text.toLowerCase().includes('error') || text.toLowerCase().includes('failed')) {
                          error = text;
                        }
                      }
                    }
                  }
                }
              } else if (typeof block.content === 'string') {
                // Content is a direct string (error case usually)
                const text = block.content;
                if (text.includes('<tool_use_error>') || text.includes('Error:')) {
                  error = text;
                } else {
                  // Try to parse as JSON
                  try {
                    const parsed = JSON.parse(text);
                    if (!result) {
                      result = parsed as T;
                      if (debug) console.log(`[MCPTestRunner] Parsed result from string content`);
                    }
                  } catch {
                    // Not JSON - store as potential result text
                    if (!result && !error) {
                      result = text as unknown as T;
                    }
                  }
                }
              }
            }
          }
        } catch {
          // Line isn't valid JSON, skip
        }
      }

      metrics.totalTokens = metrics.inputTokens + metrics.outputTokens;

      if (error) {
        return { success: false, error, metrics };
      }

      if (result) {
        return { success: true, result, metrics };
      }

      return { success: false, error: 'No tool result found in output', metrics };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        error: `Parse error: ${errorMessage}`,
      };
    }
  }

  /**
   * Wait for remote job to complete
   */
  private async waitForJobResult<T>(jobId: string, timeout = 120000): Promise<MCPTestResult<T>> {
    const start = Date.now();
    const pollInterval = 2000;

    while (Date.now() - start < timeout) {
      const job = await this.prisma.remoteJob.findUnique({ where: { id: jobId } });

      if (job?.status === 'completed') {
        return {
          success: true,
          result: job.result as T,
        };
      }

      if (job?.status === 'failed') {
        return {
          success: false,
          error: job.error || 'Job failed',
        };
      }

      await new Promise((r) => setTimeout(r, pollInterval));
    }

    return {
      success: false,
      error: `Timeout waiting for job result (${timeout}ms)`,
    };
  }

  /**
   * Check agent connection, auto-restart if needed (KVM only)
   */
  private async ensureAgentOnline(maxRetries = 3): Promise<void> {
    const { handler: getOnlineAgents } = await import(
      '../../../mcp/servers/remote-agent/get_online_agents'
    );

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const result = await getOnlineAgents(this.prisma, { capability: 'claude-code' });

      if (result.onlineCount > 0) {
        console.log(
          `[MCPTestRunner] Agent online: ${result.agents[0]?.hostname || 'unknown'}`,
        );
        return;
      }

      console.log(
        `[MCPTestRunner] No agent online, restart attempt ${attempt}/${maxRetries}`,
      );
      await this.restartAgent();
      await new Promise((r) => setTimeout(r, 5000)); // Wait 5s for agent to come online
    }

    throw new Error('Laptop agent failed to start after multiple attempts');
  }

  /**
   * Restart the laptop agent via launchctl
   */
  private async restartAgent(): Promise<void> {
    const plist = '~/Library/LaunchAgents/cloud.pawelgawliczek.vibestudio-agent.plist';

    try {
      // Unload and reload the agent
      await execAsync(`launchctl unload ${plist} 2>/dev/null; launchctl load ${plist}`);
      console.log(`[MCPTestRunner] Agent restart command sent`);
    } catch (err) {
      console.error(`[MCPTestRunner] Agent restart failed:`, err);
      // Don't throw - we'll check if agent comes online in next iteration
    }
  }

  /**
   * Verify Claude Code CLI is available (laptop only)
   */
  private async verifyClaudeCodeAvailable(): Promise<void> {
    return new Promise((resolve, reject) => {
      const proc = spawn(this.claudeCodePath, ['--version'], {
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let version = '';

      proc.stdout.on('data', (data) => {
        version += data.toString();
      });

      proc.on('close', (code) => {
        if (code === 0 && version.trim()) {
          console.log(`[MCPTestRunner] Claude Code available: ${version.trim()}`);
          resolve();
        } else {
          reject(new Error('Claude Code CLI not available'));
        }
      });

      proc.on('error', (err) => {
        reject(new Error(`Claude Code CLI check failed: ${err.message}`));
      });

      // Timeout after 10 seconds
      setTimeout(() => {
        if (!proc.killed) {
          proc.kill();
          reject(new Error('Claude Code CLI check timeout'));
        }
      }, 10000);
    });
  }

  /**
   * Execute multiple tools in sequence
   */
  async executeSequence<T = unknown>(
    calls: Array<{ tool: string; params: object }>,
  ): Promise<Array<MCPTestResult<T>>> {
    const results: Array<MCPTestResult<T>> = [];

    for (const call of calls) {
      const result = await this.execute<T>(call.tool, call.params);
      results.push(result);

      // Stop on first failure
      if (!result.success) {
        break;
      }
    }

    return results;
  }

  /**
   * Get database connection for direct queries in tests
   */
  getPrisma(): PrismaClient {
    return this.prisma;
  }
}

/**
 * Create and initialize MCPTestRunner
 */
export async function createMCPTestRunner(
  prisma: PrismaClient,
  options?: { projectPath?: string; claudeCodePath?: string },
): Promise<MCPTestRunner> {
  const runner = new MCPTestRunner(prisma, options);
  await runner.ensureReady();
  return runner;
}
