import { Controller, Post, Body, Get, Logger, Headers, UnauthorizedException } from '@nestjs/common';
import { RemoteExecutionService } from './remote-execution.service';

/**
 * ST-133: Remote Agent Controller
 *
 * Provides HTTP endpoints for remote execution.
 * Protected by X-Agent-Secret header matching AGENT_SECRET env var.
 *
 * Security: All endpoints require valid agent secret.
 */
@Controller('remote-agent')
export class RemoteAgentController {
  private readonly logger = new Logger(RemoteAgentController.name);
  private readonly agentSecret: string;
  private readonly internalApiSecret: string;

  constructor(private readonly remoteExecution: RemoteExecutionService) {
    this.agentSecret = process.env.AGENT_SECRET || 'development-secret-change-in-production';
    // ST-158: Also accept INTERNAL_API_SECRET for MCP server authentication
    this.internalApiSecret = process.env.INTERNAL_API_SECRET || '';
  }

  /**
   * Validate API secret from X-Agent-Secret header
   * ST-158: Accept both AGENT_SECRET (laptop agent) and INTERNAL_API_SECRET (MCP server)
   */
  private validateSecret(secret: string | undefined): void {
    if (!secret) {
      this.logger.warn('Unauthorized remote-agent API access attempt: missing secret');
      throw new UnauthorizedException('Invalid or missing X-Agent-Secret header');
    }
    // Accept either AGENT_SECRET or INTERNAL_API_SECRET
    if (secret !== this.agentSecret && secret !== this.internalApiSecret) {
      this.logger.warn('Unauthorized remote-agent API access attempt: invalid secret');
      throw new UnauthorizedException('Invalid or missing X-Agent-Secret header');
    }
  }

  /**
   * List online agents
   * Requires X-Agent-Secret header
   */
  @Get('agents')
  async listAgents(@Headers('x-agent-secret') secret: string) {
    this.validateSecret(secret);
    return this.remoteExecution.getOnlineAgents();
  }

  /**
   * Execute a script remotely
   * POST /api/remote-agent/execute
   * Requires X-Agent-Secret header
   * Body: { script: "list-transcripts", params: ["--limit=5"] }
   */
  @Post('execute')
  async execute(
    @Headers('x-agent-secret') secret: string,
    @Body() body: { script: string; params: string[] },
  ) {
    this.validateSecret(secret);
    this.logger.log(`Execute request: ${body.script} ${body.params?.join(' ')}`);

    try {
      const result = await this.remoteExecution.execute(
        body.script,
        body.params || [],
        'api-authenticated',
      );
      return { success: true, result };
    } catch (error) {
      this.logger.error(`Execution failed: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * List recent jobs
   * Requires X-Agent-Secret header
   */
  @Get('jobs')
  async listJobs(@Headers('x-agent-secret') secret: string) {
    this.validateSecret(secret);
    return this.remoteExecution.listJobs(20);
  }

  /**
   * ST-158: Execute a git command remotely
   * POST /api/remote-agent/git-execute
   * Requires X-Agent-Secret header
   * Body: { command: "git status", cwd: "/path/to/worktree", timeout?: 30000 }
   */
  @Post('git-execute')
  async gitExecute(
    @Headers('x-agent-secret') secret: string,
    @Body() body: { command: string; cwd: string; timeout?: number },
  ) {
    this.validateSecret(secret);
    this.logger.log(`Git execute request: ${body.command} in ${body.cwd}`);

    try {
      const result = await this.remoteExecution.executeGitCommand({
        command: body.command,
        cwd: body.cwd,
        timeout: body.timeout,
      });
      return result;
    } catch (error) {
      this.logger.error(`Git execution failed: ${error.message}`);
      return { success: false, error: error.message };
    }
  }
}
