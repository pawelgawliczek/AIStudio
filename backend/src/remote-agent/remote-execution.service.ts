import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { isScriptApproved, validateParams, getScriptTimeout } from './approved-scripts';
import { RemoteAgentGateway } from './remote-agent.gateway';

/**
 * ST-133: Remote Execution Service
 *
 * Manages remote script execution via connected agents.
 * Handles job creation, agent selection, timeout management, and fallback.
 */
@Injectable()
export class RemoteExecutionService {
  private readonly logger = new Logger(RemoteExecutionService.name);
  private readonly DEFAULT_TIMEOUT = 30000; // 30 seconds

  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: RemoteAgentGateway,
  ) {}

  /**
   * Execute a script remotely via connected agent
   *
   * If agent is offline, returns fallback command for local execution.
   *
   * @param scriptName - Script name from approved-scripts.ts
   * @param params - Script parameters (must be whitelisted)
   * @param requestedBy - User/agent identifier
   * @returns Promise<result> or { agentOffline: true, fallbackCommand: "..." }
   */
  async execute(
    scriptName: string,
    params: string[],
    requestedBy: string = 'mcp-user',
  ): Promise<any> {
    // Validate script is approved
    if (!isScriptApproved(scriptName)) {
      throw new Error(`Script '${scriptName}' is not approved for remote execution`);
    }

    // Validate parameters
    const validation = validateParams(scriptName, params);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    // Find online agent with this capability
    const agents = await this.gateway.getOnlineAgentsWithCapability(scriptName);

    if (agents.length === 0) {
      // No agent online - return fallback
      const fallbackCommand = this.buildFallbackCommand(scriptName, params);
      this.logger.warn(`No agent available for ${scriptName}, returning fallback`);

      return {
        agentOffline: true,
        fallbackCommand,
        message: 'Remote agent offline. Run this command locally instead.',
      };
    }

    // Select first available agent (can enhance with load balancing)
    const agent = agents[0];

    // Create job in database
    const job = await this.prisma.remoteJob.create({
      data: {
        script: scriptName,
        params: params,
        status: 'pending',
        agentId: agent.id,
        requestedBy,
      },
    });

    // Emit job to agent via WebSocket
    try {
      await this.gateway.emitJobToAgent(agent.id, {
        id: job.id,
        script: scriptName,
        params,
      });

      // Mark job as running
      await this.prisma.remoteJob.update({
        where: { id: job.id },
        data: {
          status: 'running',
          startedAt: new Date(),
        },
      });

      // Wait for result with timeout
      const timeout = getScriptTimeout(scriptName);
      const result = await this.waitForResult(job.id, timeout);

      return result;
    } catch (error) {
      this.logger.error(`Remote execution failed: ${error.message}`);

      // Update job status
      await this.prisma.remoteJob.update({
        where: { id: job.id },
        data: {
          status: 'failed',
          error: error.message,
          completedAt: new Date(),
        },
      });

      throw error;
    }
  }

  /**
   * Wait for job result with timeout
   */
  private async waitForResult(jobId: string, timeout: number): Promise<any> {
    const startTime = Date.now();
    const pollInterval = 1000; // Check every 1 second

    while (Date.now() - startTime < timeout) {
      const job = await this.prisma.remoteJob.findUnique({
        where: { id: jobId },
      });

      if (!job) {
        throw new Error('Job not found');
      }

      if (job.status === 'completed') {
        return job.result;
      }

      if (job.status === 'failed') {
        throw new Error(`Job failed: ${job.error}`);
      }

      if (job.status === 'timeout') {
        throw new Error('Job timed out on remote agent');
      }

      // Wait before polling again
      await new Promise((resolve) => setTimeout(resolve, pollInterval));
    }

    // Timeout exceeded
    await this.prisma.remoteJob.update({
      where: { id: jobId },
      data: {
        status: 'timeout',
        error: 'Execution timeout exceeded',
        completedAt: new Date(),
      },
    });

    throw new Error(`Job timed out after ${timeout}ms`);
  }

  /**
   * Build fallback command for local execution
   */
  private buildFallbackCommand(scriptName: string, params: string[]): string {
    const paramsStr = params.join(' ');
    return `ts-node scripts/${scriptName}.ts ${paramsStr}`;
  }

  /**
   * Get job status
   */
  async getJobStatus(jobId: string): Promise<any> {
    return this.prisma.remoteJob.findUnique({
      where: { id: jobId },
    });
  }

  /**
   * List recent jobs
   */
  async listJobs(limit: number = 20): Promise<any[]> {
    return this.prisma.remoteJob.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  /**
   * Get online agents
   */
  async getOnlineAgents(): Promise<any[]> {
    return this.prisma.remoteAgent.findMany({
      where: { status: 'online' },
    });
  }
}
