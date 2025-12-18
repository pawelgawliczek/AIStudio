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
import { Prisma } from '@prisma/client';
import { Server, Socket } from 'socket.io';
import { getErrorMessage, getErrorStack } from '../common';
import { PrismaService } from '../prisma/prisma.service';
import { TelemetryService } from '../telemetry/telemetry.service';
import { AppWebSocketGateway } from '../websocket/websocket.gateway';
import { StreamEventService } from './stream-event.service';
import { TranscriptRegistrationService } from './transcript-registration.service';

// Remote job result types
interface RemoteJobResult {
  status: 'completed' | 'failed' | 'timeout';
  result?: unknown;
  error?: string;
}

interface AgentJob {
  id: string;
  script?: string;
  params?: Record<string, unknown> | string[];
  jobToken?: string;
  timestamp?: number;
  [key: string]: unknown;
}

interface TranscriptDetectionPayload {
  agentId: string | null;
  transcriptPath: string;
  projectPath: string;
  metadata?: Record<string, unknown>;
}

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
  sessionId?: string; // ST-195: Actual Claude Code session ID for transcript matching
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
    private readonly telemetry: TelemetryService,
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
   * ST-258 Phase 4: Add telemetry
   */
  async handleConnection(client: Socket) {
    await this.telemetry.withSpan('remote_agent.connect', async (span) => {
      span.setAttribute('socket.id', client.id);
      span.setAttribute('remote.address', client.handshake.address);

      this.logger.log(`Agent connecting: ${client.id}`);

      // Don't authenticate here - wait for registration event with pre-shared secret
      // This allows agents to establish connection before proving identity
    });
  }

  /**
   * Handle agent disconnection
   * Mark agent as offline in database
   * ST-150: Also handle running Claude Code jobs (grace period)
   * ST-150: Emit workflow:paused event for frontend notification
   * ST-258 Phase 4: Add telemetry
   */
  async handleDisconnect(client: Socket) {
    await this.telemetry.withSpan('remote_agent.disconnect', async (span) => {
      span.setAttribute('socket.id', client.id);
      const { agentId } = client.data;

      if (agentId) {
        span.setAttribute('agent.id', agentId);
      }

      this.logger.log(`Agent disconnected: ${client.id}`);

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

          span.setAttribute('affected.job_count', result.jobIds?.length || 0);
          span.setAttribute('affected.workflow_count', result.workflowRunIds?.length || 0);

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
        this.logger.error(`Failed to mark agent offline: ${getErrorMessage(error)}`);
        span.recordException(error as Error);
        throw error;
      }
    });
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
      this.logger.error(`Agent registration failed: ${getErrorMessage(error)}`);
      client.emit('agent:error', { error: 'Registration failed' });
      client.disconnect();
    }
  }

  /**
   * ST-281: Health check ping from agent
   * Used to verify connection is actually working after hibernation wake
   */
  @SubscribeMessage('agent:ping')
  handleAgentPing(@ConnectedSocket() client: Socket): { pong: boolean; timestamp: number } {
    return { pong: true, timestamp: Date.now() };
  }

  /**
   * Agent heartbeat to maintain online status
   * ST-258 Phase 4: Add telemetry
   *
   * @event agent:heartbeat
   */
  @SubscribeMessage('agent:heartbeat')
  async handleAgentHeartbeat(@ConnectedSocket() client: Socket) {
    await this.telemetry.withSpan('remote_agent.heartbeat', async (span) => {
      const { agentId } = client.data;

      if (!agentId) {
        span.setAttribute('error', 'not_registered');
        client.emit('agent:error', { error: 'Not registered' });
        return;
      }

      span.setAttribute('agent.id', agentId);
      span.setAttribute('socket.id', client.id);

      try {
        await this.prisma.remoteAgent.update({
          where: { id: agentId },
          data: { lastSeenAt: new Date() },
        });
      } catch (error) {
        this.logger.error(`Heartbeat update failed: ${getErrorMessage(error)}`);
        span.recordException(error as Error);
        throw error;
      }
    });
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
    @MessageBody() data: RemoteJobResult & { jobId: string },
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
          result: result ? (result as Prisma.InputJsonValue) : Prisma.JsonNull,
          error: error || null,
          completedAt: new Date(),
          agentId,
        },
      });

      client.emit('agent:ack', { jobId, received: true });
    } catch (error) {
      this.logger.error(`Failed to update job result: ${getErrorMessage(error)}`);
      client.emit('agent:error', { error: 'Failed to update job' });
    }
  }

  /**
   * Emit job to connected agent
   * Called by RemoteExecutionService
   */
  async emitJobToAgent(agentId: string, job: AgentJob) {
    // Find agent's socket
    const agent = await this.prisma.remoteAgent.findUnique({
      where: { id: agentId },
    });

    if (!agent || agent.status !== 'online' || !agent.socketId) {
      throw new Error('Agent not online');
    }

    // ST-253: Verify socket actually exists before emitting (fixes stale socket issue)
    const sockets = await this.server.fetchSockets();
    const socketExists = sockets.some(s => s.id === agent.socketId);

    if (!socketExists) {
      // Socket is stale - mark agent offline and throw
      this.logger.warn(`Stale socket detected for agent ${agentId}, marking offline`);
      await this.prisma.remoteAgent.update({
        where: { id: agentId },
        data: {
          status: 'offline',
          socketId: null,
          lastSeenAt: new Date(),
        },
      });
      throw new Error('Agent socket is stale (disconnected without proper cleanup)');
    }

    // Emit job to agent's socket
    this.server.to(agent.socketId).emit('agent:job', job);
    this.logger.log(`Emitted job ${job.id} to agent ${agentId}`);
  }

  /**
   * Get list of online agents with specific capability
   */
  async getOnlineAgentsWithCapability(capability: string) {
    return this.prisma.remoteAgent.findMany({
      where: {
        status: 'online',
        capabilities: {
          has: capability,
        },
      },
    });
  }

  /**
   * ST-259: Get active agents with execution state
   * Returns agents that are currently online or executing jobs
   */
  async getActiveAgents() {
    // Get all online agents
    const agents = await this.prisma.remoteAgent.findMany({
      where: {
        OR: [
          { status: 'online' },
          { currentExecutionId: { not: null } },
        ],
      },
      orderBy: { lastSeenAt: 'desc' },
    });

    // Enrich with job information
    const enrichedAgents = await Promise.all(
      agents.map(async (agent) => {
        // Count jobs in flight
        const jobsInFlight = await this.prisma.remoteJob.count({
          where: {
            agentId: agent.id,
            status: { in: ['pending', 'running', 'paused'] },
          },
        });

        // Get current job details
        let currentJobId: string | undefined;
        let currentJobType: string | undefined;
        let currentWorkflowRunId: string | undefined;

        if (agent.currentExecutionId) {
          const currentJob = await this.prisma.remoteJob.findUnique({
            where: { id: agent.currentExecutionId },
            select: { id: true, jobType: true, workflowRunId: true },
          });

          if (currentJob) {
            currentJobId = currentJob.id;
            currentJobType = currentJob.jobType ?? undefined;
            currentWorkflowRunId = currentJob.workflowRunId ? currentJob.workflowRunId : undefined;
          }
        }

        return {
          id: agent.id,
          hostname: agent.hostname,
          status: agent.status,
          capabilities: agent.capabilities,
          connectedAt: agent.createdAt,
          lastSeenAt: agent.lastSeenAt ?? agent.createdAt,
          currentJobId,
          currentJobType,
          currentWorkflowRunId,
          jobsInFlight,
        };
      })
    );

    return enrichedAgents;
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

    // ST-253: Verify socket actually exists before emitting (fixes stale socket issue)
    const sockets = await this.server.fetchSockets();
    const socketExists = sockets.some(s => s.id === agent.socketId);

    if (!socketExists) {
      // Socket is stale - mark agent offline and throw
      this.logger.warn(`Stale socket detected for agent ${agentId}, marking offline`);
      await this.prisma.remoteAgent.update({
        where: { id: agentId },
        data: {
          status: 'offline',
          socketId: null,
          lastSeenAt: new Date(),
        },
      });
      throw new Error('Agent socket is stale (disconnected without proper cleanup)');
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
            },
          },
        });
        this.logger.log(`[ST-160] Session ID captured for job ${data.jobId}: ${sessionId}`);

        // ST-195: Update WorkflowRun metadata with actual sessionId for transcript matching
        // This is critical for the TranscriptWatcher to match new transcripts to workflows
        const workflowRun = await this.prisma.workflowRun.findUnique({
          where: { id: job.workflowRunId },
          select: { metadata: true },
        });

        if (workflowRun) {
          const existingMetadata = (workflowRun.metadata as Record<string, unknown>) || {};
          const existingTracking = (existingMetadata._transcriptTracking as Record<string, unknown>) || {};

          // Update sessionId - transcriptPath will be added by TranscriptWatcher when detected
          const updatedTracking = {
            ...existingTracking,
            sessionId, // Replace pre-generated sessionId with actual one from Claude Code
            actualSessionId: sessionId,
          };

          await this.prisma.workflowRun.update({
            where: { id: job.workflowRunId },
            data: {
              metadata: {
                ...existingMetadata,
                _transcriptTracking: updatedTracking,
              },
            },
          });

          this.logger.log(
            `[ST-195] Updated WorkflowRun ${job.workflowRunId} with actual sessionId=${sessionId}`,
          );
        }
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
          const jobParams = (job.params as Record<string, unknown>) || {};
          const stateId = (jobParams.stateId as string) || job.workflowRunId; // Fallback to workflowRunId

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
        } catch (error) {
          this.logger.error(`[ST-160] Failed to create AgentQuestion: ${getErrorMessage(error)}`);
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
              } as Prisma.InputJsonValue)
            : Prisma.JsonNull,
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

        // ST-195: Update WorkflowRun metadata with actual sessionId and transcriptPath
        // This fixes transcript streaming by using Claude Code's actual session ID
        if (data.sessionId || data.transcriptPath) {
          const workflowRun = await this.prisma.workflowRun.findUnique({
            where: { id: job.workflowRunId },
            select: { metadata: true, masterTranscriptPaths: true },
          });

          if (workflowRun) {
            const existingMetadata = (workflowRun.metadata as Record<string, unknown>) || {};
            const existingTracking = (existingMetadata._transcriptTracking as Record<string, unknown>) || {};

            // Update metadata with actual session info
            const updatedTracking = {
              ...existingTracking,
              ...(data.sessionId && { sessionId: data.sessionId }),
              ...(data.transcriptPath && { transcriptPath: data.transcriptPath }),
              actualSessionId: data.sessionId, // Store explicitly as actualSessionId
            };

            // Add transcriptPath to masterTranscriptPaths if not already there
            const existingPaths = workflowRun.masterTranscriptPaths || [];
            const updatedPaths = data.transcriptPath && !existingPaths.includes(data.transcriptPath)
              ? [...existingPaths, data.transcriptPath]
              : existingPaths;

            await this.prisma.workflowRun.update({
              where: { id: job.workflowRunId },
              data: {
                metadata: {
                  ...existingMetadata,
                  _transcriptTracking: updatedTracking,
                },
                masterTranscriptPaths: updatedPaths,
              },
            });

            this.logger.log(
              `ST-195: Updated WorkflowRun ${job.workflowRunId} with actual sessionId=${data.sessionId}, path=${data.transcriptPath}`,
            );
          }
        }
      }

      // ST-168: Upload transcript when agent completes (Story Runner integration)
      if (data.success && data.transcriptPath && job?.componentRunId && job?.workflowRunId) {
        try {
          await this.uploadAgentTranscript(
            job.workflowRunId,
            job.componentRunId,
            data.transcriptPath,
            agentId,
          );
        } catch (uploadError) {
          this.logger.warn(
            `Failed to upload transcript for componentRun ${job.componentRunId}: ${getErrorMessage(uploadError)}`,
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
      this.logger.error(`Failed to update job completion: ${getErrorMessage(error)}`);
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
      this.logger.warn(`Job token validation failed: ${getErrorMessage(error)}`);
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
            ? {
                output: data.output,
                operation: data.operation,
              }
            : {
                output: data.output,
                exitCode: data.exitCode,
              },
          error: data.error || null,
          completedAt: new Date(),
        },
      });

      client.emit('agent:ack', { jobId: data.jobId, received: true });
    } catch (error) {
      this.logger.error(`Failed to update git job result: ${getErrorMessage(error)}`);
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
        events: events.map((e: any) => ({
          componentRunId: e.componentRunId,
          type: e.eventType,
          sequenceNumber: e.sequenceNumber,
          timestamp: e.timestamp.toISOString(),
          payload: e.payload,
        })),
      });
    } catch (error) {
      this.logger.error(`[ST-160] Failed to fetch session history: ${getErrorMessage(error)}`);
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
        params: { path: transcriptPath },
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

    const resultData = result.result as Record<string, unknown> | undefined;
    const transcriptContent = resultData?.content as string | undefined;
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

    // Upload to Artifact table (ST-214: story-scoped)
    if (!workflowRun.storyId) {
      this.logger.warn('WorkflowRun has no storyId, skipping transcript upload');
      return;
    }
    const artifact = await this.prisma.artifact.create({
      data: {
        definitionId: transcriptDef.id,
        storyId: workflowRun.storyId,
        workflowRunId,
        lastUpdatedRunId: workflowRunId,
        content: transcriptContent,
        contentType: 'application/x-jsonlines',
        contentPreview: transcriptContent.substring(0, 500),
        size: Buffer.byteLength(transcriptContent, 'utf8'),
        currentVersion: 1,
        createdByComponentId: componentRun.componentId, // Non-null = agent transcript
      },
    });

    // Store artifact ID in ComponentRun metadata
    await this.prisma.componentRun.update({
      where: { id: componentRunId },
      data: {
        metadata: {
          ...(componentRun.metadata as Record<string, unknown> || {}),
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
  ): Promise<{ success: boolean; result?: unknown; error?: string }> {
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
  private async findAgentSocket(agentId: string) {
    const sockets = await this.server.fetchSockets();
    for (const socket of sockets) {
      if (socket.data.agentId === agentId) {
        return socket; // RemoteSocket type is compatible for emit()
      }
    }
    return null;
  }

  /**
   * ST-267: Rate limiting for transcript detection
   * Prevents connection pool exhaustion from bulk transcript syncs
   */
  private transcriptQueue: Array<{
    client: Socket;
    data: TranscriptDetectionPayload;
  }> = [];
  private isProcessingTranscriptQueue = false;
  private readonly TRANSCRIPT_BATCH_SIZE = 5;  // Process 5 at a time
  private readonly TRANSCRIPT_BATCH_DELAY_MS = 200;  // 200ms between batches

  /**
   * ST-170: Handle transcript detected event from laptop agent
   * ST-267: Added rate limiting via queue to prevent connection pool exhaustion
   */
  @SubscribeMessage('agent:transcript_detected')
  async handleTranscriptDetected(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: TranscriptDetectionPayload,
  ) {
    this.logger.log(`[ST-170] Transcript detected from agent: ${data.agentId}, sessionId: ${data.metadata?.sessionId}`);

    // ST-267: Queue the request instead of processing immediately
    this.transcriptQueue.push({ client, data });
    this.processTranscriptQueue();
  }

  /**
   * ST-267: Process transcript queue with rate limiting
   */
  private async processTranscriptQueue(): Promise<void> {
    if (this.isProcessingTranscriptQueue || this.transcriptQueue.length === 0) {
      return;
    }

    this.isProcessingTranscriptQueue = true;

    try {
      while (this.transcriptQueue.length > 0) {
        // Take a batch
        const batch = this.transcriptQueue.splice(0, this.TRANSCRIPT_BATCH_SIZE);

        if (batch.length > 1) {
          this.logger.log(`[ST-267] Processing transcript batch: ${batch.length} items, ${this.transcriptQueue.length} remaining`);
        }

        // Process batch concurrently but with limited concurrency
        await Promise.all(batch.map(async ({ client, data }) => {
          try {
            await this.transcriptRegistrationService.handleTranscriptDetected(data);

            // Acknowledge receipt
            client.emit('agent:transcript_detected_ack', {
              agentId: data.agentId,
              success: true,
            });
          } catch (error) {
            this.logger.error(`[ST-170] Failed to handle transcript detection: ${getErrorMessage(error)}`, getErrorStack(error));

            client.emit('agent:transcript_detected_ack', {
              agentId: data.agentId,
              success: false,
              error: getErrorMessage(error),
            });
          }
        }));

        // Delay before next batch if there are more
        if (this.transcriptQueue.length > 0) {
          await new Promise(resolve => setTimeout(resolve, this.TRANSCRIPT_BATCH_DELAY_MS));
        }
      }
    } finally {
      this.isProcessingTranscriptQueue = false;
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

    // ST-233: Broadcast directly to frontend clients on default namespace
    this.appWebSocketGateway.server.to(`master-transcript:${data.runId}`).emit('master-transcript:streaming_started', data);
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
    // ST-233: Broadcast directly to frontend clients on default namespace
    this.appWebSocketGateway.server.to(`master-transcript:${data.runId}`).emit('master-transcript:lines', data);
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

    // ST-233: Broadcast directly to frontend clients on default namespace
    this.appWebSocketGateway.server.to(`master-transcript:${data.runId}`).emit('master-transcript:batch', data);
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

    // ST-233: Broadcast directly to frontend clients on default namespace
    this.appWebSocketGateway.server.to(`master-transcript:${data.runId}`).emit('master-transcript:error', data);
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

    // ST-233: Broadcast directly to frontend clients on default namespace
    this.appWebSocketGateway.server.to(`master-transcript:${data.runId}`).emit('master-transcript:stopped', data);
  }

  /**
   * ST-182: Public method for AppWebSocketGateway to forward tail requests
   *
   * This is needed because cross-namespace emit doesn't work correctly.
   * AppWebSocketGateway (on `/` namespace) can't emit to sockets on `/remote-agent` namespace.
   * Instead, it should call this method which uses RemoteAgentGateway's own server instance.
   */
  async forwardTailRequestToAgent(data: {
    runId: string;
    sessionIndex: number;
    filePath: string;
    fromBeginning?: boolean;
  }): Promise<{ success: boolean; error?: string; agentHostname?: string }> {
    const { runId, sessionIndex, filePath, fromBeginning } = data;

    // Find online agent with watch-transcripts capability
    const agents = await this.prisma.remoteAgent.findMany({
      where: {
        status: 'online',
        capabilities: { has: 'watch-transcripts' },
      },
    });

    if (agents.length === 0) {
      this.logger.warn(`[ST-182] No laptop agent online with watch-transcripts capability`);
      return { success: false, error: 'No laptop agent online with watch-transcripts capability' };
    }

    // Use the first available agent
    const agent = agents[0];

    if (!agent.socketId) {
      this.logger.warn(`[ST-182] Agent ${agent.hostname} has no socketId`);
      return { success: false, error: 'Agent has no socket connection' };
    }

    // Forward tail request to laptop agent using this gateway's server instance
    this.server.to(agent.socketId).emit('transcript:start_tail', {
      runId,
      sessionIndex,
      filePath,
      fromBeginning: fromBeginning ?? true,
    });

    this.logger.log(`[ST-182] Forwarded tail request to agent ${agent.hostname} (socket: ${agent.socketId})`);
    return { success: true, agentHostname: agent.hostname };
  }

  /**
   * ST-182: Public method for AppWebSocketGateway to forward stop tail requests
   */
  async forwardStopTailToAgent(data: {
    runId: string;
    sessionIndex: number;
  }): Promise<void> {
    const { runId, sessionIndex } = data;

    // Find online agents with watch-transcripts capability
    const agents = await this.prisma.remoteAgent.findMany({
      where: {
        status: 'online',
        capabilities: { has: 'watch-transcripts' },
      },
    });

    for (const agent of agents) {
      if (agent.socketId) {
        this.server.to(agent.socketId).emit('transcript:stop_tail', {
          runId,
          sessionIndex,
        });
        this.logger.log(`[ST-182] Forwarded stop tail to agent ${agent.hostname}`);
      }
    }
  }
}
