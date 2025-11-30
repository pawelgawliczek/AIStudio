import { Injectable, Logger } from '@nestjs/common';
import { createHmac } from 'crypto';
import * as jwt from 'jsonwebtoken';
import { PrismaService } from '../prisma/prisma.service';
import {
  isScriptApproved,
  validateParams,
  getScriptTimeout,
  isCapabilityApproved,
  validateCapabilityParams,
  validateInstructions,
  validateAllowedTools,
  getCapabilityTimeout,
} from './approved-scripts';
import { RemoteAgentGateway } from './remote-agent.gateway';

/**
 * ST-150: Claude Code execution request parameters
 */
export interface ClaudeCodeExecutionRequest {
  componentId: string;
  stateId: string;
  workflowRunId: string;
  instructions: string;
  storyContext?: Record<string, unknown>;
  allowedTools?: string[];
  model?: string;
  maxTurns?: number;
  projectPath?: string;
}

/**
 * ST-150: Claude Code execution result
 */
export interface ClaudeCodeExecutionResult {
  success: boolean;
  jobId: string;
  agentId: string;
  output?: unknown;
  metrics?: {
    inputTokens: number;
    outputTokens: number;
    cacheCreationTokens?: number;
    cacheReadTokens?: number;
    totalTokens: number;
  };
  transcriptPath?: string;
  error?: string;
}

/**
 * ST-133: Remote Execution Service
 * ST-150: Claude Code Agent Execution
 *
 * Manages remote script and agent execution via connected agents.
 * Handles job creation, agent selection, timeout management, and fallback.
 */
@Injectable()
export class RemoteExecutionService {
  private readonly logger = new Logger(RemoteExecutionService.name);
  private readonly DEFAULT_TIMEOUT = 30000; // 30 seconds
  private readonly CLAUDE_CODE_TIMEOUT = 3600000; // 60 minutes
  private readonly GRACE_PERIOD_MS = 15 * 60 * 1000; // 15 minutes
  private readonly MAX_CONCURRENT_PER_AGENT = 5;

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

  // ===========================================================================
  // ST-150: Claude Code Agent Execution
  // ===========================================================================

  /**
   * Execute Claude Code agent on remote laptop
   *
   * @param request - Claude Code execution parameters
   * @param componentRunId - ComponentRun ID for tracking
   * @param requestedBy - User/agent identifier
   * @returns Promise<result> or { agentOffline: true, ... } for offline fallback
   */
  async executeClaudeAgent(
    request: ClaudeCodeExecutionRequest,
    componentRunId: string,
    requestedBy: string = 'story-runner',
  ): Promise<ClaudeCodeExecutionResult | { agentOffline: true; offlineFallback: string }> {
    // Validate capability is approved
    if (!isCapabilityApproved('claude-code')) {
      throw new Error('Claude Code execution is not approved');
    }

    // Validate parameters
    const paramValidation = validateCapabilityParams('claude-code', request as unknown as Record<string, unknown>);
    if (!paramValidation.valid) {
      throw new Error(paramValidation.error);
    }

    // Validate instructions don't contain secrets
    const instructionValidation = validateInstructions(request.instructions);
    if (!instructionValidation.valid) {
      throw new Error(instructionValidation.error);
    }

    // Validate allowed tools if provided
    if (request.allowedTools && request.allowedTools.length > 0) {
      const toolValidation = validateAllowedTools(request.allowedTools);
      if (!toolValidation.valid) {
        throw new Error(toolValidation.error);
      }
    }

    // Find online agent with claude-code capability
    const agents = await this.findClaudeCodeAgents();

    if (agents.length === 0) {
      // No agent online - get offline fallback from state
      const state = await this.prisma.workflowState.findUnique({
        where: { id: request.stateId },
      });

      const offlineFallback = state?.offlineFallback || 'pause';
      this.logger.warn(`No Claude Code agent available, fallback: ${offlineFallback}`);

      return {
        agentOffline: true,
        offlineFallback,
      };
    }

    // Select available agent (load balancing: least concurrent jobs)
    const agent = await this.selectLeastLoadedAgent(agents);

    // Rate limit check
    if (!(await this.canDispatchToAgent(agent.id))) {
      throw new Error(
        `Agent ${agent.hostname} at max capacity (${this.MAX_CONCURRENT_PER_AGENT} concurrent jobs)`,
      );
    }

    // Create job in database
    const job = await this.prisma.remoteJob.create({
      data: {
        script: 'claude-code', // Special marker for Claude Code jobs
        params: request as unknown as any, // Store full request as params
        status: 'pending',
        agentId: agent.id,
        requestedBy,
        jobType: 'claude-agent',
        componentRunId,
        workflowRunId: request.workflowRunId,
      },
    });

    // Update ComponentRun with job tracking
    await this.prisma.componentRun.update({
      where: { id: componentRunId },
      data: {
        remoteJobId: job.id,
        executedOn: `laptop:${agent.hostname}`,
      },
    });

    // Update WorkflowRun with executing agent
    await this.prisma.workflowRun.update({
      where: { id: request.workflowRunId },
      data: {
        executingAgentId: agent.id,
      },
    });

    // Update agent's current execution
    await this.prisma.remoteAgent.update({
      where: { id: agent.id },
      data: {
        currentExecutionId: job.id,
      },
    });

    // Generate job signature (HMAC) and per-job token
    const timestamp = Date.now();
    const signature = this.signJobPayload(job.id, request, timestamp);
    const jobToken = this.generateJobToken(job.id, agent.id);

    // Emit job to agent via WebSocket
    try {
      await this.gateway.emitClaudeCodeJob(agent.id, {
        id: job.id,
        componentId: request.componentId,
        stateId: request.stateId,
        workflowRunId: request.workflowRunId,
        instructions: request.instructions,
        config: {
          storyContext: request.storyContext,
          allowedTools: request.allowedTools,
          model: request.model,
          maxTurns: request.maxTurns,
          projectPath: request.projectPath,
        },
        signature,
        timestamp,
        jobToken,
      });

      // Mark job as running
      await this.prisma.remoteJob.update({
        where: { id: job.id },
        data: {
          status: 'running',
          startedAt: new Date(),
          lastHeartbeatAt: new Date(),
        },
      });

      // Wait for result with timeout
      const timeout = getCapabilityTimeout('claude-code');
      const result = await this.waitForClaudeCodeResult(job.id, timeout);

      return result;
    } catch (error) {
      this.logger.error(`Claude Code execution failed: ${error.message}`);

      // Update job status
      await this.prisma.remoteJob.update({
        where: { id: job.id },
        data: {
          status: 'failed',
          error: error.message,
          completedAt: new Date(),
        },
      });

      // Clear agent's current execution
      await this.prisma.remoteAgent.update({
        where: { id: agent.id },
        data: {
          currentExecutionId: null,
        },
      });

      throw error;
    }
  }

  /**
   * Find online agents with Claude Code capability
   */
  private async findClaudeCodeAgents(): Promise<any[]> {
    return this.prisma.remoteAgent.findMany({
      where: {
        status: 'online',
        claudeCodeAvailable: true,
        capabilities: {
          has: 'claude-code',
        },
      },
    });
  }

  /**
   * Select agent with least concurrent jobs
   */
  private async selectLeastLoadedAgent(agents: any[]): Promise<any> {
    const agentLoads = await Promise.all(
      agents.map(async (agent) => {
        const runningJobs = await this.prisma.remoteJob.count({
          where: {
            agentId: agent.id,
            status: 'running',
          },
        });
        return { agent, runningJobs };
      }),
    );

    // Sort by load (ascending) and return first
    agentLoads.sort((a, b) => a.runningJobs - b.runningJobs);
    return agentLoads[0].agent;
  }

  /**
   * Check if agent can accept more jobs (rate limiting)
   */
  private async canDispatchToAgent(agentId: string): Promise<boolean> {
    const runningJobs = await this.prisma.remoteJob.count({
      where: {
        agentId,
        status: 'running',
      },
    });
    return runningJobs < this.MAX_CONCURRENT_PER_AGENT;
  }

  /**
   * Sign job payload with HMAC for tamper prevention
   */
  private signJobPayload(
    jobId: string,
    request: ClaudeCodeExecutionRequest,
    timestamp: number,
  ): string {
    const secret = process.env.AGENT_SECRET;
    if (!secret) {
      throw new Error('AGENT_SECRET not configured');
    }

    const payload = JSON.stringify({
      id: jobId,
      componentId: request.componentId,
      stateId: request.stateId,
      instructions: request.instructions,
      timestamp,
    });

    return createHmac('sha256', secret).update(payload).digest('hex');
  }

  /**
   * Generate per-job JWT token
   */
  private generateJobToken(jobId: string, agentId: string): string {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error('JWT_SECRET not configured');
    }

    return jwt.sign({ jobId, agentId, type: 'job-execution' }, secret, {
      expiresIn: '65m', // Slightly longer than 60min timeout
    });
  }

  /**
   * Wait for Claude Code execution result with timeout
   */
  private async waitForClaudeCodeResult(
    jobId: string,
    timeout: number,
  ): Promise<ClaudeCodeExecutionResult> {
    const startTime = Date.now();
    const pollInterval = 5000; // Check every 5 seconds for Claude Code

    while (Date.now() - startTime < timeout) {
      const job = await this.prisma.remoteJob.findUnique({
        where: { id: jobId },
      });

      if (!job) {
        throw new Error('Job not found');
      }

      if (job.status === 'completed') {
        const result = job.result as any;
        return {
          success: true,
          jobId: job.id,
          agentId: job.agentId || '',
          output: result?.output,
          metrics: result?.metrics,
          transcriptPath: result?.transcriptPath,
        };
      }

      if (job.status === 'failed') {
        return {
          success: false,
          jobId: job.id,
          agentId: job.agentId || '',
          error: job.error || 'Execution failed',
        };
      }

      if (job.status === 'timeout') {
        return {
          success: false,
          jobId: job.id,
          agentId: job.agentId || '',
          error: 'Execution timed out',
        };
      }

      if (job.status === 'waiting_reconnect') {
        // Check if grace period expired
        if (job.reconnectExpiresAt && new Date() > job.reconnectExpiresAt) {
          await this.prisma.remoteJob.update({
            where: { id: jobId },
            data: {
              status: 'failed',
              error: 'Agent reconnection grace period expired',
              completedAt: new Date(),
            },
          });

          return {
            success: false,
            jobId: job.id,
            agentId: job.agentId || '',
            error: 'Agent disconnected and did not reconnect within grace period',
          };
        }
      }

      // Wait before polling again
      await new Promise((resolve) => setTimeout(resolve, pollInterval));
    }

    // Timeout exceeded
    await this.prisma.remoteJob.update({
      where: { id: jobId },
      data: {
        status: 'timeout',
        error: 'Execution timeout exceeded (60 minutes)',
        completedAt: new Date(),
      },
    });

    return {
      success: false,
      jobId,
      agentId: '',
      error: `Execution timed out after ${timeout / 1000 / 60} minutes`,
    };
  }

  /**
   * Handle agent disconnection during Claude Code execution
   * Sets job to waiting_reconnect with grace period
   */
  async handleAgentDisconnect(agentId: string): Promise<void> {
    // Find running jobs for this agent
    const runningJobs = await this.prisma.remoteJob.findMany({
      where: {
        agentId,
        status: 'running',
        jobType: 'claude-agent',
      },
    });

    const now = new Date();
    const graceExpiry = new Date(now.getTime() + this.GRACE_PERIOD_MS);

    for (const job of runningJobs) {
      this.logger.warn(`Agent disconnected during job ${job.id}, starting grace period`);

      await this.prisma.remoteJob.update({
        where: { id: job.id },
        data: {
          status: 'waiting_reconnect',
          disconnectedAt: now,
          reconnectExpiresAt: graceExpiry,
        },
      });

      // Update WorkflowRun
      if (job.workflowRunId) {
        await this.prisma.workflowRun.update({
          where: { id: job.workflowRunId },
          data: {
            agentDisconnectedAt: now,
          },
        });
      }
    }
  }

  /**
   * Handle agent reconnection - resume jobs in waiting_reconnect
   */
  async handleAgentReconnect(agentId: string): Promise<number> {
    const waitingJobs = await this.prisma.remoteJob.findMany({
      where: {
        agentId,
        status: 'waiting_reconnect',
      },
    });

    let resumed = 0;
    for (const job of waitingJobs) {
      // Check if grace period hasn't expired
      if (!job.reconnectExpiresAt || new Date() < job.reconnectExpiresAt) {
        this.logger.log(`Resuming job ${job.id} after agent reconnect`);

        await this.prisma.remoteJob.update({
          where: { id: job.id },
          data: {
            status: 'running',
            disconnectedAt: null,
            reconnectExpiresAt: null,
            lastHeartbeatAt: new Date(),
          },
        });

        // Clear WorkflowRun disconnect time
        if (job.workflowRunId) {
          await this.prisma.workflowRun.update({
            where: { id: job.workflowRunId },
            data: {
              agentDisconnectedAt: null,
            },
          });
        }

        resumed++;
      }
    }

    return resumed;
  }

  /**
   * Update job heartbeat (called from gateway on progress events)
   */
  async updateJobHeartbeat(jobId: string): Promise<void> {
    await this.prisma.remoteJob.update({
      where: { id: jobId },
      data: {
        lastHeartbeatAt: new Date(),
      },
    });
  }

  /**
   * Get Claude Code capable agents
   */
  async getClaudeCodeAgents(): Promise<any[]> {
    return this.findClaudeCodeAgents();
  }
}
