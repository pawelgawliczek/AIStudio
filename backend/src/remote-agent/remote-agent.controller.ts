import { Controller, Post, Body, Get, Logger } from '@nestjs/common';
import { RemoteExecutionService } from './remote-execution.service';

/**
 * ST-133: Remote Agent Controller
 *
 * Provides HTTP endpoints for testing remote execution.
 * In production, this would be integrated with MCP tools.
 */
@Controller('api/remote-agent')
export class RemoteAgentController {
  private readonly logger = new Logger(RemoteAgentController.name);

  constructor(private readonly remoteExecution: RemoteExecutionService) {}

  /**
   * List online agents
   */
  @Get('agents')
  async listAgents() {
    return this.remoteExecution.getOnlineAgents();
  }

  /**
   * Execute a script remotely
   * POST /api/remote-agent/execute
   * Body: { script: "list-transcripts", params: ["--limit=5"] }
   */
  @Post('execute')
  async execute(@Body() body: { script: string; params: string[] }) {
    this.logger.log(`Execute request: ${body.script} ${body.params?.join(' ')}`);

    try {
      const result = await this.remoteExecution.execute(
        body.script,
        body.params || [],
        'api-test'
      );
      return { success: true, result };
    } catch (error) {
      this.logger.error(`Execution failed: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * List recent jobs
   */
  @Get('jobs')
  async listJobs() {
    return this.remoteExecution.listJobs(20);
  }
}
