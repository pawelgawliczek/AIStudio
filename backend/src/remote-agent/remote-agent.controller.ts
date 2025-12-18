import { Controller, Post, Body, Get, Logger, Headers, UnauthorizedException } from '@nestjs/common';
import { RemoteAgent } from '@prisma/client';
import { getErrorMessage } from '../common';
import { RemoteAgentGateway } from './remote-agent.gateway';
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

  constructor(
    private readonly remoteExecution: RemoteExecutionService,
    private readonly remoteAgentGateway: RemoteAgentGateway,  // ST-160: For sending answers to agents
  ) {
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
   * ST-182: Public endpoint for frontend to check agent availability
   * Returns sanitized agent status (no secrets)
   */
  @Get('online')
  async getOnlineAgents() {
    const agents = await this.remoteExecution.getOnlineAgents();
    return {
      agents: agents.map((agent: RemoteAgent) => ({
        id: agent.id,
        hostname: agent.hostname,
        status: agent.status,
        capabilities: agent.capabilities,
        claudeCodeAvailable: agent.claudeCodeAvailable,
        claudeCodeVersion: agent.claudeCodeVersion,
        lastSeenAt: agent.lastSeenAt,
      })),
    };
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
      this.logger.error(`Execution failed: ${getErrorMessage(error)}`);
      return { success: false, error: getErrorMessage(error) };
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
      this.logger.error(`Git execution failed: ${getErrorMessage(error)}`);
      return { success: false, error: getErrorMessage(error) };
    }
  }

  /**
   * Validate internal API secret from X-Internal-API-Secret header
   * Used for internal MCP tool calls
   */
  private validateInternalSecret(secret: string | undefined): void {
    if (!secret || secret !== this.internalApiSecret) {
      this.logger.warn('Unauthorized internal API access attempt');
      throw new UnauthorizedException('Invalid or missing X-Internal-API-Secret header');
    }
  }

  /**
   * ST-160: Send answer to remote agent for session resume
   * POST /api/internal/remote-agent/answer
   * Requires X-Internal-API-Secret header
   * Body: { agentId, sessionId, answer, questionId, jobId, workflowRunId }
   *
   * Called by answer_question MCP tool to trigger session resume on laptop agent
   */
  @Post('internal/answer')
  async sendAnswer(
    @Headers('x-internal-api-secret') secret: string,
    @Body() body: {
      agentId: string;
      sessionId: string;
      answer: string;
      questionId: string;
      jobId: string;
      workflowRunId: string;
    },
  ) {
    this.validateInternalSecret(secret);
    this.logger.log(`[ST-160] Send answer request for question ${body.questionId}`);

    try {
      await this.remoteAgentGateway.emitAnswerToAgent(body.agentId, {
        sessionId: body.sessionId,
        answer: body.answer,
        questionId: body.questionId,
        jobId: body.jobId,
      });

      return { success: true };
    } catch (error) {
      this.logger.error(`[ST-160] Failed to send answer: ${getErrorMessage(error)}`);
      return { success: false, error: getErrorMessage(error) };
    }
  }

  /**
   * ST-160: Get session streaming status
   * GET /api/remote-agent/session-status/:workflowRunId
   * Requires X-Agent-Secret header
   */
  @Get('session-status/:workflowRunId')
  async getSessionStatus(
    @Headers('x-agent-secret') secret: string,
    @Body() body: { workflowRunId: string },
  ) {
    this.validateSecret(secret);
    return this.remoteAgentGateway.getSessionStatus(body.workflowRunId);
  }

  /**
   * ST-259: Get active agents for Grafana dashboard
   * GET /api/remote-agent/active
   * Requires X-Agent-Secret header
   *
   * Returns list of active agents with execution state
   */
  @Get('active')
  async getActiveAgents(@Headers('x-agent-secret') secret: string) {
    this.validateSecret(secret);
    return this.remoteAgentGateway.getActiveAgents();
  }
}
