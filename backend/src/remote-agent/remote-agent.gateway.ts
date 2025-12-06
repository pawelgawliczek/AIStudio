import { Logger, forwardRef, Inject } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import * as jwt from 'jsonwebtoken';
import { Server, Socket } from 'socket.io';
import { PrismaService } from '../prisma/prisma.service';
import { StreamEventService } from './stream-event.service';
import { TranscriptRegistrationService } from './transcript-registration.service';
import { AppWebSocketGateway } from '../websocket/websocket.gateway';

/**
 * ST-160: Native subagent execution types
 */
export type ExecutionType = 'custom' | 'native_explore' | 'native_plan' | 'native_general';

/**
 * ST-160: Native agent configuration
 */
export interface NativeAgentConfig {
  questionTimeout?: number;  // Timeout for question response (ms)
  maxQuestions?: number;     // Max questions per execution
  allowedTools?: string[];   // Override tools for native agent
}

/**
 * ST-150: Claude Code job payload sent to laptop agent
 * ST-160: Added executionType and nativeAgentConfig
 */
export interface ClaudeCodeJobPayload {
  id: string;
  componentId: string;
  stateId: string;
  workflowRunId: string;
  instructions: string;
  config: {
    storyContext?: Record<string, unknown>;
    allowedTools?: string[];
    model?: string;
    maxTurns?: number;
    projectPath?: string;
    // ST-160: Native subagent support
    executionType?: ExecutionType;
    nativeAgentConfig?: NativeAgentConfig;
  };
  signature: string;
  timestamp: number;
  jobToken: string;
}

/**
 * ST-150: Progress event from laptop agent
 * ST-160: Added session_init and question_detected event types
 */
export interface ClaudeCodeProgressEvent {
  jobId: string;
  jobToken: string;
  type: 'token_update' | 'tool_call' | 'tool_result' | 'activity_change' | 'stream_end'
    | 'session_init' | 'question_detected';  // ST-160: Native subagent events
  payload: Record<string, unknown>;
  timestamp: number;
  sequenceNumber: number;
}

/**
 * ST-150: Completion event from laptop agent
 */
export interface ClaudeCodeCompleteEvent {
  jobId: string;
  jobToken: string;
  success: boolean;
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
 * ST-153: Git job payload sent to laptop agent
 */
export interface GitJobPayload {
  id: string;
  command: string;
  cwd: string;
  timeout?: number;
}

/**
 * ST-153: Git job result from laptop agent
 */
export interface GitResultEvent {
  jobId: string;
  status: 'completed' | 'failed';
  output?: string;
  operation?: string;
  exitCode?: number;
  error?: string;
}

/**
 * ST-133: Remote Agent Gateway
 * ST-150: Claude Code Agent Execution
 * ST-153: Git Command Execution
 *
 * WebSocket gateway for remote execution agents (laptop/local machines).
 * Handles agent registration, heartbeat, job result submission,
 * Claude Code execution streaming, and git command execution.
 *
 * Namespace: /remote-agent
 * Authentication: Pre-shared secret → JWT
 */
@WebSocketGateway({
  namespace: '/remote-agent',
  cors: {
    origin: '*', // Remote agents can connect from any network
    credentials: true,
  },
})
export class RemoteAgentGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(RemoteAgentGateway.name);

  // ST-150: Store disconnect handler reference for injection
  private disconnectHandler: ((agentId: string) => Promise<{ jobIds: string[]; workflowRunIds: string[] }>) | null = null;
  private reconnectHandler: ((agentId: string) => Promise<{ resumed: number; workflowRunIds: string[] }>) | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly streamEventService: StreamEventService,
    private readonly transcriptRegistrationService: TranscriptRegistrationService,
    @Inject(forwardRef(() => AppWebSocketGateway))
    private readonly appWebSocketGateway: AppWebSocketGateway,
  ) {}

  /**
   * ST-150: Set disconnect/reconnect handlers (called by RemoteExecutionService)
   */
  setDisconnectHandler(handler: (agentId: string) => Promise<{ jobIds: string[]; workflowRunIds: string[] }>) {
    this.disconnectHandler = handler;
  }

  setReconnectHandler(handler: (agentId: string) => Promise<{ resumed: number; workflowRunIds: string[] }>) {
    this.reconnectHandler = handler;
  }

  /**
   * Handle agent connection
   * Agents must register before they can receive jobs
   */
  async handleConnection(client: Socket) {
    this.logger.log(`Agent connecting: ${client.id}`);

    // Don't authenticate here - wait for registration event with pre-shared secret
    // This allows agents to establish connection before proving identity
  }

  /**
   * Handle agent disconnection
   * Mark agent as offline in database
   * ST-150: Also handle running Claude Code jobs (grace period)
   * ST-150: Emit workflow:paused event for frontend notification
   */
  async handleDisconnect(client: Socket) {
    this.logger.log(`Agent disconnected: ${client.id}`);
    const { agentId } = client.data;

    // Find agent by socket ID and mark offline
    try {
      await this.prisma.remoteAgent.updateMany({
        where: { socketId: client.id },
        data: {
          status: 'offline',
          socketId: null,
          lastSeenAt: new Date(),
          currentExecutionId: null,
        },
      });

      // ST-150: Handle running Claude Code jobs if agent was executing
      if (agentId && this.disconnectHandler) {
        const result = await this.disconnectHandler(agentId);

        // ST-150: Emit workflow:paused event for each affected workflow
        if (result && result.workflowRunIds) {
          for (const workflowRunId of result.workflowRunIds) {
            this.server.emit(`workflow:${workflowRunId}:paused`, {
              reason: 'offline',
              agentId,
              timestamp: new Date().toISOString(),
            });
            this.logger.log(`Emitted workflow:${workflowRunId}:paused (agent offline)`);
          }
        }
      }
    } catch (error) {
      this.logger.error(`Failed to mark agent offline: ${error.message}`);
    }
  }

  /**
   * Agent registration with pre-shared secret
   *
   * On success:
   * - Issues JWT token for future authentication
   * - Registers agent in database
   * - Marks agent as online
   *
   * @event agent:register
   * @param secret - Pre-shared secret for initial authentication
   * @param hostname - Agent hostname
   * @param capabilities - Array of script capabilities
   * @param config - ST-158: Agent config (projectPath, worktreeRoot)
   */
  @SubscribeMessage('agent:register')
  async handleAgentRegister(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: {
      secret: string;
      hostname: string;
      capabilities: string[];
      claudeCodeVersion?: string; // ST-150: Claude Code CLI version
      config?: {
        projectPath?: string;
        worktreeRoot?: string;
      }; // ST-158: Agent config
    },
  ) {
    const { secret, hostname, capabilities, claudeCodeVersion, config } = data;

    // Validate pre-shared secret
    const expectedSecret = process.env.AGENT_SECRET || 'development-secret-change-in-production';
    if (secret !== expectedSecret) {
      this.logger.warn(`Agent registration rejected: Invalid secret from ${hostname}`);
      client.emit('agent:error', { error: 'Invalid secret' });
      client.disconnect();
      return;
    }

    // Issue JWT token
    const token = await this.jwtService.signAsync(
      { hostname, type: 'remote-agent' },
      {
        secret: process.env.JWT_SECRET || 'development-secret-change-in-production',
        expiresIn: '30d', // Long-lived for remote agents
      },
    );

    // ST-150: Check if claude-code capability is present
    const hasClaudeCode = capabilities.includes('claude-code');

    // Register or update agent in database
    // ST-158: Include config for projectPath and worktreeRoot
    try {
      const agent = await this.prisma.remoteAgent.upsert({
        where: { hostname },
        create: {
          hostname,
          socketId: client.id,
          status: 'online',
          capabilities,
          lastSeenAt: new Date(),
          claudeCodeAvailable: hasClaudeCode,
          claudeCodeVersion: claudeCodeVersion || null,
          config: config || {}, // ST-158: Store agent config
        },
        update: {
          socketId: client.id,
          status: 'online',
          capabilities,
          lastSeenAt: new Date(),
          claudeCodeAvailable: hasClaudeCode,
          claudeCodeVersion: claudeCodeVersion || null,
          currentExecutionId: null, // Clear on reconnect
          config: config || {}, // ST-158: Update agent config
        },
      });

      // Store agent data in socket context
      client.data.agentId = agent.id;
      client.data.hostname = hostname;

      this.logger.log(`Agent registered: ${hostname} (${client.id}), Claude Code: ${hasClaudeCode ? claudeCodeVersion : 'N/A'}`);

      // ST-150: Handle reconnection of waiting jobs
      if (this.reconnectHandler) {
        const result = await this.reconnectHandler(agent.id);
        if (result.resumed > 0) {
          this.logger.log(`Resumed ${result.resumed} jobs after agent reconnection`);

          // ST-150: Emit workflow:resumed event for each affected workflow
          for (const workflowRunId of result.workflowRunIds) {
            this.server.emit(`workflow:${workflowRunId}:resumed`, {
              agentId: agent.id,
              hostname,
              timestamp: new Date().toISOString(),
            });
            this.logger.log(`Emitted workflow:${workflowRunId}:resumed (agent reconnected)`);
          }
        }
      }

      // Send JWT token to agent
      client.emit('agent:registered', {
        success: true,
        token,
        agentId: agent.id,
      });
    } catch (error) {
      this.logger.error(`Agent registration failed: ${error.message}`);
      client.emit('agent:error', { error: 'Registration failed' });
      client.disconnect();
    }
  }

  /**
   * Agent heartbeat to maintain online status
   *
   * @event agent:heartbeat
   */
  @SubscribeMessage('agent:heartbeat')
  async handleAgentHeartbeat(@ConnectedSocket() client: Socket) {
    const { agentId } = client.data;

    if (!agentId) {
      client.emit('agent:error', { error: 'Not registered' });
      return;
    }

    try {
      await this.prisma.remoteAgent.update({
        where: { id: agentId },
        data: { lastSeenAt: new Date() },
      });
    } catch (error) {
      this.logger.error(`Heartbeat update failed: ${error.message}`);
    }
  }

  /**
   * Agent submits job result
   *
   * @event agent:result
   * @param jobId - Job UUID
   * @param result - Execution result (success/failure)
   */
  @SubscribeMessage('agent:result')
  async handleAgentResult(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: {
      jobId: string;
      status: 'completed' | 'failed' | 'timeout';
      result?: any;
      error?: string;
    },
  ) {
    const { agentId } = client.data;
    const { jobId, status, result, error } = data;

    if (!agentId) {
      client.emit('agent:error', { error: 'Not registered' });
      return;
    }

    this.logger.log(`Agent ${agentId} submitted result for job ${jobId}: ${status}`);

    try {
      await this.prisma.remoteJob.update({
        where: { id: jobId },
        data: {
          status,
          result: result || null,
          error: error || null,
          completedAt: new Date(),
          agentId,
        },
      });

      client.emit('agent:ack', { jobId, received: true });
    } catch (error) {
      this.logger.error(`Failed to update job result: ${error.message}`);
      client.emit('agent:error', { error: 'Failed to update job' });
    }
  }

  /**
   * Emit job to connected agent
   * Called by RemoteExecutionService
   */
  async emitJobToAgent(agentId: string, job: any) {
    // Find agent's socket
    const agent = await this.prisma.remoteAgent.findUnique({
      where: { id: agentId },
    });

    if (!agent || agent.status !== 'online' || !agent.socketId) {
      throw new Error('Agent not online');
    }

    // Emit job to agent's socket
    this.server.to(agent.socketId).emit('agent:job', job);
    this.logger.log(`Emitted job ${job.id} to agent ${agentId}`);
  }

  /**
   * Get list of online agents with specific capability
   */
  async getOnlineAgentsWithCapability(capability: string): Promise<any[]> {
    return this.prisma.remoteAgent.findMany({
      where: {
        status: 'online',
        capabilities: {
          has: capability,
        },
      },
    });
  }

  // ===========================================================================
  // ST-150: Claude Code Agent Execution WebSocket Events
  // ===========================================================================

  /**
   * Emit Claude Code job to connected agent
   * Called by RemoteExecutionService
   */
  async emitClaudeCodeJob(agentId: string, job: ClaudeCodeJobPayload): Promise<void> {
    // Find agent's socket
    const agent = await this.prisma.remoteAgent.findUnique({
      where: { id: agentId },
    });

    if (!agent || agent.status !== 'online' || !agent.socketId) {
      throw new Error('Agent not online');
    }

    if (!agent.claudeCodeAvailable) {
      throw new Error('Agent does not have Claude Code capability');
    }

    // Emit Claude Code job to agent's socket
    this.server.to(agent.socketId).emit('agent:claude_job', job);
    this.logger.log(`Emitted Claude Code job ${job.id} to agent ${agentId} (${agent.hostname})`);
  }

  /**
   * Handle Claude Code progress events from laptop agent
   *
   * @event agent:claude_progress
   * @param data - Progress event with token updates, tool calls, etc.
   */
  @SubscribeMessage('agent:claude_progress')
  async handleClaudeCodeProgress(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: ClaudeCodeProgressEvent,
  ) {
    const { agentId } = client.data;

    if (!agentId) {
      client.emit('agent:error', { error: 'Not registered' });
      return;
    }

    // Validate job token
    const tokenValid = this.validateJobToken(data.jobToken, data.jobId, agentId);
    if (!tokenValid) {
      this.logger.warn(`Invalid job token for progress event on job ${data.jobId}`);
      client.emit('agent:error', { error: 'Invalid job token' });
      return;
    }

    // Get job to find component run
    const job = await this.prisma.remoteJob.findUnique({
      where: { id: data.jobId },
    });

    if (!job || !job.componentRunId || !job.workflowRunId) {
      this.logger.warn(`Job ${data.jobId} not found or missing run IDs`);
      return;
    }

    // Store streaming event
    await this.streamEventService.storeEvent(
      job.componentRunId,
      job.workflowRunId,
      data.type,
      data.sequenceNumber,
      new Date(data.timestamp),
      data.payload,
    );

    // Update job heartbeat
    await this.prisma.remoteJob.update({
      where: { id: data.jobId },
      data: { lastHeartbeatAt: new Date() },
    });

    // ST-160: Handle special event types
    if (data.type === 'session_init') {
      // Store session ID on job for resume support
      const sessionId = data.payload.sessionId as string;
      if (sessionId) {
        await this.prisma.remoteJob.update({
          where: { id: data.jobId },
          data: {
            result: {
              ...(job.result as Record<string, unknown> || {}),
              sessionId,
            } as any,
          },
        });
        this.logger.log(`[ST-160] Session ID captured for job ${data.jobId}: ${sessionId}`);
      }
    }

    if (data.type === 'question_detected') {
      // Create AgentQuestion record
      const questionText = data.payload.questionText as string;
      const sessionId = data.payload.sessionId as string;
      const executionType = data.payload.executionType as string || 'custom';

      if (questionText && sessionId) {
        try {
          // Get state from job params
          const jobParams = job.params as Record<string, unknown> || {};
          const stateId = jobParams.stateId as string || job.workflowRunId; // Fallback to workflowRunId

          const question = await this.prisma.agentQuestion.create({
            data: {
              workflowRunId: job.workflowRunId,
              stateId,
              componentRunId: job.componentRunId,
              sessionId,
              questionText,
              status: 'pending',
              canHandoff: executionType !== 'native_explore' && executionType !== 'native_plan',
            },
          });

          this.logger.log(`[ST-160] Created AgentQuestion ${question.id} for job ${data.jobId}`);

          // Emit dedicated question event to frontend
          this.server.emit(`workflow:${job.workflowRunId}:question`, {
            questionId: question.id,
            componentRunId: job.componentRunId,
            sessionId,
            questionText,
            canHandoff: question.canHandoff,
            executionType,
            timestamp: new Date().toISOString(),
          });

          // Pause the job until question is answered
          await this.prisma.remoteJob.update({
            where: { id: data.jobId },
            data: { status: 'paused' },
          });
        } catch (error: any) {
          this.logger.error(`[ST-160] Failed to create AgentQuestion: ${error.message}`);
        }
      }
    }

    // Emit to any connected frontend clients (future: real-time UI updates)
    this.server.emit(`workflow:${job.workflowRunId}:progress`, {
      componentRunId: job.componentRunId,
      type: data.type,
      sequenceNumber: data.sequenceNumber,
      payload: data.payload,
    });
  }

  /**
   * Handle Claude Code completion event from laptop agent
   *
   * @event agent:claude_complete
   * @param data - Completion event with output, metrics, etc.
   */
  @SubscribeMessage('agent:claude_complete')
  async handleClaudeCodeComplete(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: ClaudeCodeCompleteEvent,
  ) {
    const { agentId } = client.data;

    if (!agentId) {
      client.emit('agent:error', { error: 'Not registered' });
      return;
    }

    // Validate job token
    const tokenValid = this.validateJobToken(data.jobToken, data.jobId, agentId);
    if (!tokenValid) {
      this.logger.warn(`Invalid job token for complete event on job ${data.jobId}`);
      client.emit('agent:error', { error: 'Invalid job token' });
      return;
    }

    this.logger.log(
      `Claude Code job ${data.jobId} completed: success=${data.success}, ` +
        `tokens=${data.metrics?.totalTokens || 'N/A'}`,
    );

    // Get job for tracking
    const job = await this.prisma.remoteJob.findUnique({
      where: { id: data.jobId },
    });

    if (job?.componentRunId && job?.workflowRunId) {
      // Store stream_end event
      await this.streamEventService.storeEvent(
        job.componentRunId,
        job.workflowRunId,
        'stream_end',
        Date.now(), // Use timestamp as sequence number for terminal event
        new Date(),
        {
          success: data.success,
          metrics: data.metrics,
          transcriptPath: data.transcriptPath,
          error: data.error,
        },
      );
    }

    try {
      // Update job status
      await this.prisma.remoteJob.update({
        where: { id: data.jobId },
        data: {
          status: data.success ? 'completed' : 'failed',
          result: data.success
            ? ({
                output: data.output,
                metrics: data.metrics,
                transcriptPath: data.transcriptPath,
              } as any) // Cast to any to satisfy Prisma JSON type
            : null,
          error: data.error || null,
          completedAt: new Date(),
        },
      });

      // Clear agent's current execution
      await this.prisma.remoteAgent.update({
        where: { id: agentId },
        data: { currentExecutionId: null },
      });

      // Clear WorkflowRun executing agent
      if (job?.workflowRunId) {
        await this.prisma.workflowRun.update({
          where: { id: job.workflowRunId },
          data: {
            executingAgentId: null,
            agentDisconnectedAt: null,
          },
        });
      }

      // ST-168: Upload transcript when agent completes (Story Runner integration)
      if (data.success && data.transcriptPath && job?.componentRunId) {
        try {
          await this.uploadAgentTranscript(
            job.workflowRunId,
            job.componentRunId,
            data.transcriptPath,
            agentId,
          );
        } catch (uploadError) {
          this.logger.warn(
            `Failed to upload transcript for componentRun ${job.componentRunId}: ${uploadError.message}`,
          );
          // Don't fail the job completion if transcript upload fails
        }
      }

      // Emit completion to any connected frontend clients
      if (job?.workflowRunId) {
        this.server.emit(`workflow:${job.workflowRunId}:complete`, {
          componentRunId: job.componentRunId,
          success: data.success,
          metrics: data.metrics,
          error: data.error,
        });
      }

      client.emit('agent:ack', { jobId: data.jobId, received: true });
    } catch (error) {
      this.logger.error(`Failed to update job completion: ${error.message}`);
      client.emit('agent:error', { error: 'Failed to update job' });
    }
  }

  /**
   * Handle Claude Code pause event (agent paused for user input)
   *
   * @event agent:claude_paused
   */
  @SubscribeMessage('agent:claude_paused')
  async handleClaudeCodePaused(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: {
      jobId: string;
      jobToken: string;
      reason: string;
      question?: string;
    },
  ) {
    const { agentId } = client.data;

    if (!agentId) {
      client.emit('agent:error', { error: 'Not registered' });
      return;
    }

    // Validate job token
    const tokenValid = this.validateJobToken(data.jobToken, data.jobId, agentId);
    if (!tokenValid) {
      client.emit('agent:error', { error: 'Invalid job token' });
      return;
    }

    this.logger.log(`Claude Code job ${data.jobId} paused: ${data.reason}`);

    const job = await this.prisma.remoteJob.findUnique({
      where: { id: data.jobId },
    });

    if (job?.componentRunId && job?.workflowRunId) {
      // Store pause event
      await this.streamEventService.storeEvent(
        job.componentRunId,
        job.workflowRunId,
        'agent_paused',
        Date.now(),
        new Date(),
        {
          reason: data.reason,
          question: data.question,
        },
      );
    }

    // Update job status to paused
    await this.prisma.remoteJob.update({
      where: { id: data.jobId },
      data: {
        status: 'paused',
      },
    });

    // Emit to frontend for user notification
    if (job?.workflowRunId) {
      this.server.emit(`workflow:${job.workflowRunId}:paused`, {
        componentRunId: job?.componentRunId,
        reason: data.reason,
        question: data.question,
      });
    }

    client.emit('agent:ack', { jobId: data.jobId, received: true });
  }

  /**
   * Handle resume notification from agent (reconnected and resuming)
   *
   * @event agent:resume_available
   */
  @SubscribeMessage('agent:resume_available')
  async handleResumeAvailable(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: {
      jobId: string;
      jobToken: string;
      lastSequence: number;
    },
  ) {
    const { agentId } = client.data;

    if (!agentId) {
      client.emit('agent:error', { error: 'Not registered' });
      return;
    }

    this.logger.log(
      `Agent ${agentId} available to resume job ${data.jobId} from sequence ${data.lastSequence}`,
    );

    // Get job and check if it's waiting for reconnect
    const job = await this.prisma.remoteJob.findUnique({
      where: { id: data.jobId },
    });

    if (!job) {
      client.emit('agent:error', { error: 'Job not found' });
      return;
    }

    if (job.status !== 'waiting_reconnect') {
      client.emit('agent:error', {
        error: `Job not in waiting_reconnect state (current: ${job.status})`,
      });
      return;
    }

    // Resume the job
    await this.prisma.remoteJob.update({
      where: { id: data.jobId },
      data: {
        status: 'running',
        disconnectedAt: null,
        reconnectExpiresAt: null,
        lastHeartbeatAt: new Date(),
      },
    });

    // Clear WorkflowRun disconnect time and pause status - ST-150
    if (job.workflowRunId) {
      await this.prisma.workflowRun.update({
        where: { id: job.workflowRunId },
        data: {
          agentDisconnectedAt: null,
          isPaused: false,
          pauseReason: null,
        },
      });

      // ST-150: Emit workflow:resumed event for frontend notification
      this.server.emit(`workflow:${job.workflowRunId}:resumed`, {
        jobId: data.jobId,
        agentId,
        timestamp: new Date().toISOString(),
      });
      this.logger.log(`Emitted workflow:${job.workflowRunId}:resumed (agent reconnected)`);
    }

    // Send resume acknowledgment
    client.emit('agent:resume_ack', {
      jobId: data.jobId,
      resumed: true,
      continueFromSequence: data.lastSequence,
    });
  }

  /**
   * Validate per-job JWT token
   */
  private validateJobToken(token: string, jobId: string, agentId: string): boolean {
    try {
      const secret = process.env.JWT_SECRET;
      if (!secret) {
        this.logger.error('JWT_SECRET not configured');
        return false;
      }

      const decoded = jwt.verify(token, secret) as {
        jobId: string;
        agentId: string;
        type: string;
      };

      return (
        decoded.type === 'job-execution' &&
        decoded.jobId === jobId &&
        decoded.agentId === agentId
      );
    } catch (error) {
      this.logger.warn(`Job token validation failed: ${error.message}`);
      return false;
    }
  }

  // ===========================================================================
  // ST-153: Git Command Execution WebSocket Events
  // ===========================================================================

  /**
   * Emit git job to connected agent
   * Called by RemoteExecutionService
   */
  async emitGitJob(agentId: string, job: GitJobPayload): Promise<void> {
    // Find agent's socket
    const agent = await this.prisma.remoteAgent.findUnique({
      where: { id: agentId },
    });

    if (!agent || agent.status !== 'online' || !agent.socketId) {
      throw new Error('Agent not online');
    }

    if (!agent.capabilities.includes('git-execute')) {
      throw new Error('Agent does not have git-execute capability');
    }

    // Emit git job to agent's socket
    this.server.to(agent.socketId).emit('agent:git_job', job);
    this.logger.log(`Emitted git job ${job.id} to agent ${agentId} (${agent.hostname})`);
  }

  /**
   * Handle git command result from laptop agent
   *
   * @event agent:git_result
   * @param data - Result event with output, exit code, etc.
   */
  @SubscribeMessage('agent:git_result')
  async handleGitResult(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: GitResultEvent,
  ) {
    const { agentId } = client.data;

    if (!agentId) {
      client.emit('agent:error', { error: 'Not registered' });
      return;
    }

    this.logger.log(
      `Git job ${data.jobId} result: status=${data.status}, operation=${data.operation || 'N/A'}`,
    );

    try {
      // Update job status
      await this.prisma.remoteJob.update({
        where: { id: data.jobId },
        data: {
          status: data.status,
          result: data.status === 'completed'
            ? ({
                output: data.output,
                operation: data.operation,
              } as any)
            : ({
                output: data.output,
                exitCode: data.exitCode,
              } as any),
          error: data.error || null,
          completedAt: new Date(),
        },
      });

      client.emit('agent:ack', { jobId: data.jobId, received: true });
    } catch (error) {
      this.logger.error(`Failed to update git job result: ${error.message}`);
      client.emit('agent:error', { error: 'Failed to update job' });
    }
  }

  // ===========================================================================
  // ST-160: Native Subagent Question Handling & Session Streaming
  // ===========================================================================

  /**
   * ST-160: Send answer to laptop agent for --resume
   * Called when answer_question MCP tool is invoked
   */
  async emitAnswerToAgent(
    agentId: string,
    data: {
      sessionId: string;
      answer: string;
      questionId: string;
      jobId: string;
    },
  ): Promise<void> {
    // Find agent's socket
    const agent = await this.prisma.remoteAgent.findUnique({
      where: { id: agentId },
    });

    if (!agent || agent.status !== 'online' || !agent.socketId) {
      throw new Error('Agent not online');
    }

    // Emit answer to agent's socket
    this.server.to(agent.socketId).emit('agent:resume_with_answer', {
      sessionId: data.sessionId,
      answer: data.answer,
      questionId: data.questionId,
      jobId: data.jobId,
    });

    this.logger.log(`[ST-160] Sent answer for question ${data.questionId} to agent ${agentId}`);
  }

  /**
   * ST-160: Subscribe frontend client to session streaming
   * Allows watching real-time session output via WebGUI
   *
   * @event session:subscribe
   */
  @SubscribeMessage('session:subscribe')
  async handleSessionSubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { workflowRunId: string; componentRunId?: string },
  ) {
    const { workflowRunId, componentRunId } = data;

    // Join room for workflow updates
    client.join(`workflow:${workflowRunId}`);
    this.logger.log(`[ST-160] Client ${client.id} subscribed to workflow ${workflowRunId}`);

    if (componentRunId) {
      client.join(`component:${componentRunId}`);
      this.logger.log(`[ST-160] Client ${client.id} subscribed to component ${componentRunId}`);
    }

    // Send current session state (events so far)
    try {
      const events = await this.streamEventService.getEventsForWorkflowRun(workflowRunId, {
        limit: 100,
      });

      client.emit('session:history', {
        workflowRunId,
        events: events.map(e => ({
          componentRunId: e.componentRunId,
          type: e.eventType,
          sequenceNumber: e.sequenceNumber,
          timestamp: e.timestamp.toISOString(),
          payload: e.payload,
        })),
      });
    } catch (error: any) {
      this.logger.error(`[ST-160] Failed to fetch session history: ${error.message}`);
    }

    client.emit('session:subscribed', {
      workflowRunId,
      componentRunId,
      success: true,
    });
  }

  /**
   * ST-160: Unsubscribe frontend client from session streaming
   *
   * @event session:unsubscribe
   */
  @SubscribeMessage('session:unsubscribe')
  async handleSessionUnsubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { workflowRunId: string; componentRunId?: string },
  ) {
    const { workflowRunId, componentRunId } = data;

    client.leave(`workflow:${workflowRunId}`);

    if (componentRunId) {
      client.leave(`component:${componentRunId}`);
    }

    this.logger.log(`[ST-160] Client ${client.id} unsubscribed from workflow ${workflowRunId}`);

    client.emit('session:unsubscribed', {
      workflowRunId,
      componentRunId,
      success: true,
    });
  }

  /**
   * ST-160: Get session streaming status for a workflow
   * Returns current agent execution state, pending questions, etc.
   */
  async getSessionStatus(workflowRunId: string): Promise<{
    isActive: boolean;
    agentId?: string;
    agentHostname?: string;
    currentJobId?: string;
    pendingQuestions: number;
    lastEventAt?: Date;
  }> {
    // Get workflow run
    const workflowRun = await this.prisma.workflowRun.findUnique({
      where: { id: workflowRunId },
    });

    // Get agent hostname if executing
    let agentHostname: string | undefined;
    if (workflowRun?.executingAgentId) {
      const agent = await this.prisma.remoteAgent.findUnique({
        where: { id: workflowRun.executingAgentId },
        select: { hostname: true },
      });
      agentHostname = agent?.hostname;
    }

    // Count pending questions
    const pendingQuestions = await this.prisma.agentQuestion.count({
      where: {
        workflowRunId,
        status: 'pending',
      },
    });

    // Get last event
    const lastEvent = await this.prisma.agentStreamEvent.findFirst({
      where: { workflowRunId },
      orderBy: { createdAt: 'desc' },
    });

    // Find current job
    const currentJob = await this.prisma.remoteJob.findFirst({
      where: {
        workflowRunId,
        status: { in: ['running', 'paused'] },
      },
      orderBy: { createdAt: 'desc' },
    });

    return {
      isActive: !!workflowRun?.executingAgentId,
      agentId: workflowRun?.executingAgentId || undefined,
      agentHostname,
      currentJobId: currentJob?.id || undefined,
      pendingQuestions,
      lastEventAt: lastEvent?.createdAt,
    };
  }

  /**
   * ST-160: Broadcast session update to all subscribed clients
   * Used for real-time text streaming from agent
   */
  broadcastSessionUpdate(
    workflowRunId: string,
    update: {
      componentRunId?: string;
      type: string;
      content: string;
      timestamp: string;
    },
  ): void {
    this.server.to(`workflow:${workflowRunId}`).emit('session:update', update);
  }

  /**
   * ST-168: Upload agent transcript to Artifact table (Story Runner integration)
   *
   * This method:
   * 1. Uses remote agent to read transcript file from laptop
   * 2. Creates TRANSCRIPT artifact in database
   * 3. Stores artifact ID in ComponentRun metadata
   */
  private async uploadAgentTranscript(
    workflowRunId: string,
    componentRunId: string,
    transcriptPath: string,
    agentId: string,
  ): Promise<void> {
    this.logger.log(
      `ST-168: Uploading transcript for componentRun ${componentRunId} from ${transcriptPath}`,
    );

    // Get workflow and component info
    const componentRun = await this.prisma.componentRun.findUnique({
      where: { id: componentRunId },
      include: { component: true },
    });

    if (!componentRun) {
      throw new Error(`ComponentRun ${componentRunId} not found`);
    }

    const workflowRun = await this.prisma.workflowRun.findUnique({
      where: { id: workflowRunId },
    });

    if (!workflowRun) {
      throw new Error(`WorkflowRun ${workflowRunId} not found`);
    }

    // Create remote job to read transcript file
    const readJob = await this.prisma.remoteJob.create({
      data: {
        script: 'read-file',
        params: { path: transcriptPath } as any,
        status: 'pending',
        agentId,
        requestedBy: 'transcript-upload',
        jobType: 'file-read',
      },
    });

    // Dispatch job to agent via WebSocket
    const agent = await this.prisma.remoteAgent.findUnique({
      where: { id: agentId },
    });

    if (!agent || agent.status !== 'online') {
      throw new Error(`Agent ${agentId} is not online`);
    }

    // Generate job token
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error('JWT_SECRET not configured');
    }
    const jobToken = jwt.sign(
      { jobId: readJob.id, agentId, type: 'job-execution' },
      secret,
      { expiresIn: '65m' }
    );

    // Send job to agent
    const agentSocket = await this.findAgentSocket(agentId);
    if (!agentSocket) {
      throw new Error(`Agent ${agentId} socket not found`);
    }

    agentSocket.emit('agent:job', {
      id: readJob.id,
      script: 'read-file',
      params: { path: transcriptPath },
      jobToken,
      timestamp: Date.now(),
    });

    // Wait for job completion (with timeout)
    const timeout = 30000; // 30 seconds
    const result = await this.waitForJobCompletion(readJob.id, timeout);

    if (!result.success) {
      throw new Error(`Failed to read transcript: ${result.error || 'Unknown error'}`);
    }

    const transcriptContent = result.result?.content;
    if (!transcriptContent) {
      throw new Error('Transcript content is empty');
    }

    // Find TRANSCRIPT artifact definition for this workflow
    const transcriptDef = await this.prisma.artifactDefinition.findFirst({
      where: {
        workflowId: workflowRun.workflowId,
        key: 'TRANSCRIPT',
      },
    });

    if (!transcriptDef) {
      this.logger.warn(
        `No TRANSCRIPT artifact definition found for workflow ${workflowRun.workflowId}. Skipping upload.`,
      );
      return;
    }

    // Upload to Artifact table
    const artifact = await this.prisma.artifact.create({
      data: {
        definitionId: transcriptDef.id,
        workflowRunId,
        content: transcriptContent,
        contentType: 'application/x-jsonlines',
        contentPreview: transcriptContent.substring(0, 500),
        size: Buffer.byteLength(transcriptContent, 'utf8'),
        version: 1,
        createdByComponentId: componentRun.componentId, // Non-null = agent transcript
      },
    });

    // Store artifact ID in ComponentRun metadata
    await this.prisma.componentRun.update({
      where: { id: componentRunId },
      data: {
        metadata: {
          ...(componentRun.metadata as object || {}),
          transcriptArtifactId: artifact.id,
          transcriptPath,
        },
      },
    });

    this.logger.log(
      `ST-168: Transcript uploaded successfully. Artifact ID: ${artifact.id}, Size: ${artifact.size} bytes`,
    );
  }

  /**
   * Helper: Wait for remote job completion
   */
  private async waitForJobCompletion(
    jobId: string,
    timeoutMs: number,
  ): Promise<{ success: boolean; result?: any; error?: string }> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
      const job = await this.prisma.remoteJob.findUnique({
        where: { id: jobId },
      });

      if (!job) {
        return { success: false, error: 'Job not found' };
      }

      if (job.status === 'completed') {
        return { success: true, result: job.result };
      }

      if (job.status === 'failed') {
        return { success: false, error: job.error || 'Job failed' };
      }

      // Wait 500ms before checking again
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    return { success: false, error: 'Timeout waiting for job completion' };
  }

  /**
   * Helper: Find agent socket by agentId
   */
  private async findAgentSocket(agentId: string): Promise<any | null> {
    const sockets = await this.server.fetchSockets();
    for (const socket of sockets) {
      if (socket.data.agentId === agentId) {
        return socket as any; // RemoteSocket type is compatible for emit()
      }
    }
    return null;
  }

  /**
   * ST-170: Handle transcript detected event from laptop agent
   */
  @SubscribeMessage('agent:transcript_detected')
  async handleTranscriptDetected(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { agentId: string; transcriptPath: string; projectPath: string },
  ) {
    this.logger.log(`[ST-170] Transcript detected from agent: ${data.agentId}`);

    try {
      await this.transcriptRegistrationService.handleTranscriptDetected(data);

      // Acknowledge receipt
      client.emit('agent:transcript_detected_ack', {
        agentId: data.agentId,
        success: true,
      });
    } catch (error) {
      this.logger.error(`[ST-170] Failed to handle transcript detection: ${error.message}`, error.stack);

      client.emit('agent:transcript_detected_ack', {
        agentId: data.agentId,
        success: false,
        error: error.message,
      });
    }
  }

  // ===========================================================================
  // ST-182: Master Transcript Live Streaming
  // ===========================================================================

  /**
   * Track active master transcript subscriptions
   * Map<runId, Set<clientId>>
   */
  private readonly masterTranscriptSubscriptions = new Map<string, Set<string>>();

  /**
   * ST-182: Frontend requests to start tailing a master transcript
   * Forwards request to laptop agent via WebSocket
   *
   * @event master-transcript:subscribe
   */
  @SubscribeMessage('master-transcript:subscribe')
  async handleMasterTranscriptSubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: {
      runId: string;
      sessionIndex: number;
      filePath: string;
      fromBeginning?: boolean;
    },
  ) {
    const { runId, sessionIndex, filePath, fromBeginning } = data;
    this.logger.log(`[ST-182] Master transcript subscribe: runId=${runId}, sessionIndex=${sessionIndex}`);

    // Track subscription
    if (!this.masterTranscriptSubscriptions.has(runId)) {
      this.masterTranscriptSubscriptions.set(runId, new Set());
    }
    this.masterTranscriptSubscriptions.get(runId)!.add(client.id);

    // Join room for this workflow's transcript updates
    client.join(`master-transcript:${runId}`);

    // Find an online laptop agent with the watch-transcripts capability
    const agents = await this.prisma.remoteAgent.findMany({
      where: {
        status: 'online',
        capabilities: { has: 'watch-transcripts' },
      },
    });

    if (agents.length === 0) {
      client.emit('master-transcript:error', {
        runId,
        sessionIndex,
        error: 'No laptop agent online with watch-transcripts capability',
        code: 'NO_AGENT',
      });
      return;
    }

    // Use the first available agent
    const agent = agents[0];

    // Forward tail request to laptop agent
    this.server.to(agent.socketId!).emit('transcript:start_tail', {
      runId,
      sessionIndex,
      filePath,
      fromBeginning: fromBeginning ?? true,
    });

    this.logger.log(`[ST-182] Forwarded tail request to agent ${agent.hostname}`);
  }

  /**
   * ST-182: Frontend requests to stop tailing a master transcript
   *
   * @event master-transcript:unsubscribe
   */
  @SubscribeMessage('master-transcript:unsubscribe')
  async handleMasterTranscriptUnsubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { runId: string; sessionIndex: number },
  ) {
    const { runId, sessionIndex } = data;
    this.logger.log(`[ST-182] Master transcript unsubscribe: runId=${runId}, sessionIndex=${sessionIndex}`);

    // Leave room
    client.leave(`master-transcript:${runId}`);

    // Remove from tracking
    const subs = this.masterTranscriptSubscriptions.get(runId);
    if (subs) {
      subs.delete(client.id);
      if (subs.size === 0) {
        this.masterTranscriptSubscriptions.delete(runId);

        // No more subscribers, tell laptop agent to stop tailing
        const agents = await this.prisma.remoteAgent.findMany({
          where: {
            status: 'online',
            capabilities: { has: 'tail-file' },
          },
        });

        for (const agent of agents) {
          if (agent.socketId) {
            this.server.to(agent.socketId).emit('transcript:stop_tail', {
              runId,
              sessionIndex,
            });
          }
        }
      }
    }
  }

  /**
   * ST-182: Handle streaming_started event from laptop agent
   * Relay to subscribed frontend clients on default namespace via AppWebSocketGateway
   *
   * @event transcript:streaming_started
   */
  @SubscribeMessage('transcript:streaming_started')
  async handleTranscriptStreamingStarted(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: {
      runId: string;
      sessionIndex: number;
      filePath: string;
      fileSize: number;
      startPosition: number;
    },
  ) {
    this.logger.log(`[ST-182] Streaming started: runId=${data.runId}, sessionIndex=${data.sessionIndex}`);

    // Relay to all subscribed frontend clients on default namespace
    this.appWebSocketGateway.relayMasterTranscriptStreamingStarted(data);
  }

  /**
   * ST-182: Handle transcript lines from laptop agent
   * Relay to subscribed frontend clients on default namespace via AppWebSocketGateway
   *
   * @event transcript:lines
   */
  @SubscribeMessage('transcript:lines')
  async handleTranscriptLines(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: {
      runId: string;
      sessionIndex: number;
      lines: Array<{ line: string; sequenceNumber: number }>;
      isHistorical: boolean;
      timestamp: string;
    },
  ) {
    // Relay to all subscribed frontend clients on default namespace
    this.appWebSocketGateway.relayMasterTranscriptLines(data);
  }

  /**
   * ST-182: Handle transcript batch from laptop agent (historical content)
   * Relay to subscribed frontend clients on default namespace via AppWebSocketGateway
   *
   * @event transcript:batch
   */
  @SubscribeMessage('transcript:batch')
  async handleTranscriptBatch(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: {
      runId: string;
      sessionIndex: number;
      lines: Array<{ line: string; sequenceNumber: number }>;
      isHistorical: boolean;
      timestamp: string;
    },
  ) {
    this.logger.log(`[ST-182] Batch received: runId=${data.runId}, lines=${data.lines.length}`);

    // Relay to all subscribed frontend clients on default namespace
    this.appWebSocketGateway.relayMasterTranscriptBatch(data);
  }

  /**
   * ST-182: Handle transcript streaming error from laptop agent
   * Relay to subscribed frontend clients on default namespace via AppWebSocketGateway
   *
   * @event transcript:error
   */
  @SubscribeMessage('transcript:error')
  async handleTranscriptError(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: {
      runId: string;
      sessionIndex: number;
      error: string;
      code: string;
    },
  ) {
    this.logger.error(`[ST-182] Transcript error: runId=${data.runId}, code=${data.code}, error=${data.error}`);

    // Relay to all subscribed frontend clients on default namespace
    this.appWebSocketGateway.relayMasterTranscriptError(data);
  }

  /**
   * ST-182: Handle streaming stopped event from laptop agent
   * Relay to subscribed frontend clients on default namespace via AppWebSocketGateway
   *
   * @event transcript:streaming_stopped
   */
  @SubscribeMessage('transcript:streaming_stopped')
  async handleTranscriptStreamingStopped(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { runId: string; sessionIndex: number },
  ) {
    this.logger.log(`[ST-182] Streaming stopped: runId=${data.runId}, sessionIndex=${data.sessionIndex}`);

    // Relay to all subscribed frontend clients on default namespace
    this.appWebSocketGateway.relayMasterTranscriptStopped(data);
  }
}
