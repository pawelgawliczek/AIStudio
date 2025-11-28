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

  constructor(private readonly remoteExecution: RemoteExecutionService) {
    this.agentSecret = process.env.AGENT_SECRET || 'development-secret-change-in-production';
  }

  /**
   * Validate API secret from X-Agent-Secret header
   */
  private validateSecret(secret: string | undefined): void {
    if (!secret || secret !== this.agentSecret) {
      this.logger.warn('Unauthorized remote-agent API access attempt');
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
}
