import { Logger, forwardRef, Inject } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { getErrorMessage } from '../common';
import { PrismaService } from '../prisma/prisma.service';
import { TelemetryService } from '../telemetry/telemetry.service';
import { AppWebSocketGateway } from '../websocket/websocket.gateway';
import { ArtifactHandler } from './handlers/artifact.handler';
import { ClaudeCodeHandler } from './handlers/claude-code.handler';
import { GitJobHandler } from './handlers/git-job.handler';
import { TranscriptHandler } from './handlers/transcript.handler';
import {
  getSessionStatus as getSessionStatusUtil,
  getActiveAgents as getActiveAgentsUtil,
  handleSessionSubscribe as handleSessionSubscribeUtil,
  handleSessionUnsubscribe as handleSessionUnsubscribeUtil,
  handleAgentRegister as handleAgentRegisterUtil,
  emitJobToAgent as emitJobToAgentUtil,
  getOnlineAgentsWithCapability as getOnlineAgentsWithCapabilityUtil,
  handleAgentHeartbeat as handleAgentHeartbeatUtil,
  handleAgentResult as handleAgentResultUtil,
  handleDisconnectLogic,
} from './remote-agent.utils';
import { StreamEventService } from './stream-event.service';
import { TranscriptRegistrationService } from './transcript-registration.service';
import {
  AgentJob,
  ArtifactUploadBatchPayload,
  ClaudeCodeJobPayload,
  ClaudeCodeProgressEvent,
  ClaudeCodeCompleteEvent,
  GitJobPayload,
  GitResultEvent,
  TranscriptDetectionPayload,
  UploadBatchItem,
  UploadAckPayload,
  ItemAckPayload,
  TranscriptLinesPayload,
} from './types';

/**
 * ST-133: Remote Agent Gateway
 * ST-150: Claude Code Agent Execution
 * ST-153: Git Command Execution
 * ST-284: Refactored into handler services
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
    origin: '*',
    credentials: true,
  },
})
export class RemoteAgentGateway implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit {
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
    private readonly artifactHandler: ArtifactHandler,
    private readonly claudeCodeHandler: ClaudeCodeHandler,
    private readonly gitJobHandler: GitJobHandler,
    @Inject(forwardRef(() => TranscriptHandler))
    private readonly transcriptHandler: TranscriptHandler,
  ) {}

  /**
   * ST-150: Set disconnect/reconnect handlers
   */
  setDisconnectHandler(handler: (agentId: string) => Promise<{ jobIds: string[]; workflowRunIds: string[] }>) {
    this.disconnectHandler = handler;
  }

  setReconnectHandler(handler: (agentId: string) => Promise<{ resumed: number; workflowRunIds: string[] }>) {
    this.reconnectHandler = handler;
  }

  /**
   * ST-284: Initialize handlers after gateway is ready
   * ST-326: Inject frontend server reference to handlers to avoid circular dependency
   */
  afterInit(): void {
    this.artifactHandler.setFrontendServer(this.appWebSocketGateway.server);
    this.transcriptHandler.setFrontendServer(this.appWebSocketGateway.server);
    this.logger.log('[ST-284] Gateway initialized, frontend server injected into handlers');
  }

  /**
   * Handle agent connection
   * ST-258 Phase 4: Add telemetry
   */
  async handleConnection(client: Socket) {
    await this.telemetry.withSpan('remote_agent.connect', async (span) => {
      span.setAttribute('socket.id', client.id);
      span.setAttribute('remote.address', client.handshake.address);
      this.logger.log(`Agent connecting: ${client.id}`);
    });
  }

  /**
   * Handle agent disconnection
   * ST-150: Also handle running Claude Code jobs (grace period)
   * ST-258 Phase 4: Add telemetry
   * ST-284: Delegated to remote-agent.utils
   */
  async handleDisconnect(client: Socket) {
    await this.telemetry.withSpan('remote_agent.disconnect', async (span) => {
      span.setAttribute('socket.id', client.id);
      const { agentId } = client.data;

      if (agentId) {
        span.setAttribute('agent.id', agentId);
      }

      this.logger.log(`Agent disconnected: ${client.id}`);

      try {
        const result = await handleDisconnectLogic(
          this.prisma,
          this.server,
          client.id,
          agentId,
          this.disconnectHandler,
          this.logger,
        );

        span.setAttribute('affected.job_count', result.jobCount);
        span.setAttribute('affected.workflow_count', result.workflowCount);
      } catch (error) {
        this.logger.error(`Failed to mark agent offline: ${getErrorMessage(error)}`);
        span.recordException(error as Error);
        throw error;
      }
    });
  }

  /**
   * Agent registration with pre-shared secret
   * ST-284: Delegated to remote-agent.utils
   */
  @SubscribeMessage('agent:register')
  async handleAgentRegister(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: {
      secret: string;
      hostname: string;
      capabilities: string[];
      claudeCodeVersion?: string;
      config?: {
        projectPath?: string;
        worktreeRoot?: string;
      };
    },
  ) {
    return handleAgentRegisterUtil(
      this.prisma,
      this.jwtService,
      this.server,
      client,
      data,
      this.reconnectHandler,
      this.logger,
    );
  }

  /**
   * ST-281: Health check ping from agent
   */
  @SubscribeMessage('agent:ping')
  handleAgentPing(@ConnectedSocket() client: Socket): { pong: boolean; timestamp: number } {
    return { pong: true, timestamp: Date.now() };
  }

  /**
   * Agent heartbeat to maintain online status
   * ST-258 Phase 4: Add telemetry
   * ST-284: Delegated to remote-agent.utils
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
        await handleAgentHeartbeatUtil(this.prisma, agentId);
      } catch (error) {
        this.logger.error(`Heartbeat update failed: ${getErrorMessage(error)}`);
        span.recordException(error as Error);
        throw error;
      }
    });
  }

  /**
   * Agent submits job result
   * ST-284: Delegated to remote-agent.utils
   */
  @SubscribeMessage('agent:result')
  async handleAgentResult(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { jobId: string; status: string; result?: unknown; error?: string },
  ) {
    const { agentId } = client.data;

    try {
      await handleAgentResultUtil(this.prisma, agentId, data, this.logger);
      client.emit('agent:ack', { jobId: data.jobId, received: true });
    } catch (error) {
      this.logger.error(`Failed to update job result: ${getErrorMessage(error)}`);
      client.emit('agent:error', { error: 'Failed to update job' });
    }
  }

  /**
   * Emit job to connected agent
   * ST-284: Delegated to remote-agent.utils
   */
  async emitJobToAgent(agentId: string, job: AgentJob) {
    return emitJobToAgentUtil(this.prisma, this.server, agentId, job, this.logger);
  }

  /**
   * Get list of online agents with specific capability
   * ST-284: Delegated to remote-agent.utils
   */
  async getOnlineAgentsWithCapability(capability: string) {
    return getOnlineAgentsWithCapabilityUtil(this.prisma, capability);
  }

  /**
   * ST-259: Get active agents with execution state
   * ST-284: Delegated to remote-agent.utils
   */
  async getActiveAgents() {
    return getActiveAgentsUtil(this.prisma);
  }

  // ===========================================================================
  // ST-150: Claude Code Agent Execution WebSocket Events (delegated to handler)
  // ===========================================================================

  async emitClaudeCodeJob(agentId: string, job: ClaudeCodeJobPayload): Promise<void> {
    return this.claudeCodeHandler.emitClaudeCodeJob(this.server, agentId, job);
  }

  @SubscribeMessage('agent:claude_progress')
  async handleClaudeCodeProgress(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: ClaudeCodeProgressEvent,
  ) {
    const { agentId } = client.data;
    return this.claudeCodeHandler.handleClaudeCodeProgress(this.server, client, data, agentId);
  }

  @SubscribeMessage('agent:claude_complete')
  async handleClaudeCodeComplete(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: ClaudeCodeCompleteEvent,
  ) {
    const { agentId } = client.data;
    return this.claudeCodeHandler.handleClaudeCodeComplete(this.server, client, data, agentId);
  }

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
    return this.claudeCodeHandler.handleClaudeCodePaused(this.server, client, data, agentId);
  }

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
    return this.claudeCodeHandler.handleResumeAvailable(this.server, client, data, agentId);
  }

  async emitAnswerToAgent(
    agentId: string,
    data: {
      sessionId: string;
      answer: string;
      questionId: string;
      jobId: string;
    },
  ): Promise<void> {
    return this.claudeCodeHandler.emitAnswerToAgent(this.server, agentId, data);
  }

  /**
   * ST-160: Subscribe frontend client to session streaming
   * ST-284: Delegated to remote-agent.utils
   */
  @SubscribeMessage('session:subscribe')
  async handleSessionSubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { workflowRunId: string; componentRunId?: string },
  ) {
    return handleSessionSubscribeUtil(this.server, this.streamEventService, client, data, this.logger);
  }

  /**
   * ST-160: Unsubscribe from session streaming
   * ST-284: Delegated to remote-agent.utils
   */
  @SubscribeMessage('session:unsubscribe')
  async handleSessionUnsubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { workflowRunId: string; componentRunId?: string },
  ) {
    return handleSessionUnsubscribeUtil(client, data, this.logger);
  }

  /**
   * ST-160: Get session streaming status (ST-284: Delegated to remote-agent.utils)
   */
  async getSessionStatus(workflowRunId: string): Promise<{ isActive: boolean; agentId?: string; agentHostname?: string; currentJobId?: string; pendingQuestions: number; lastEventAt?: Date }> {
    return getSessionStatusUtil(this.prisma, workflowRunId);
  }

  /**
   * ST-160: Broadcast session update to all subscribed clients
   */
  broadcastSessionUpdate(workflowRunId: string, update: { componentRunId?: string; type: string; content: string; timestamp: string }): void {
    this.server.to(`workflow:${workflowRunId}`).emit('session:update', update);
  }

  // ===========================================================================
  // ST-153: Git Command Execution WebSocket Events (delegated to handler)
  // ===========================================================================

  async emitGitJob(agentId: string, job: GitJobPayload): Promise<void> {
    return this.gitJobHandler.emitGitJob(this.server, agentId, job);
  }

  @SubscribeMessage('agent:git_result')
  async handleGitResult(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: GitResultEvent,
  ) {
    const { agentId } = client.data;
    return this.gitJobHandler.handleGitResult(client, data, agentId);
  }

  // ===========================================================================
  // ST-170, ST-182: Transcript Detection and Streaming (delegated to handler)
  // ===========================================================================

  @SubscribeMessage('agent:transcript_detected')
  async handleTranscriptDetected(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: TranscriptDetectionPayload,
  ) {
    return this.transcriptHandler.handleTranscriptDetected(client, data);
  }

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
    return this.transcriptHandler.handleMasterTranscriptSubscribe(client, data);
  }

  @SubscribeMessage('master-transcript:unsubscribe')
  async handleMasterTranscriptUnsubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { runId: string; sessionIndex: number },
  ) {
    return this.transcriptHandler.handleMasterTranscriptUnsubscribe(this.server, client, data);
  }

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
    return this.transcriptHandler.handleTranscriptStreamingStarted(data);
  }

  @SubscribeMessage('transcript:lines')
  async handleTranscriptLines(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: {
      queueId: number;
      runId: string;
      sessionIndex: number;
      lines: Array<{ line: string; sequenceNumber: number }>;
      isHistorical: boolean;
      timestamp: string;
    },
  ) {
    const ack = await this.transcriptHandler.handleTranscriptLines(data);
    // EP-14: Emit ACK back to client for guaranteed delivery protocol
    client.emit('upload:ack:item', {
      success: ack.success,
      id: data.queueId,
      ...(ack.error && { error: ack.error }),
    });
    return ack;
  }

  @SubscribeMessage('transcript:batch')
  async handleTranscriptBatch(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: {
      queueId: number;
      runId: string;
      sessionIndex: number;
      lines: Array<{ line: string; sequenceNumber: number }>;
      isHistorical: boolean;
      timestamp: string;
    },
  ) {
    const ack = await this.transcriptHandler.handleTranscriptBatch(data);
    // EP-14: Emit ACK back to client for guaranteed delivery protocol
    client.emit('upload:ack:item', {
      success: ack.success,
      id: data.queueId,
      ...(ack.error && { error: ack.error }),
    });
    return ack;
  }

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
    return this.transcriptHandler.handleTranscriptError(data);
  }

  @SubscribeMessage('transcript:streaming_stopped')
  async handleTranscriptStreamingStopped(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { runId: string; sessionIndex: number },
  ) {
    return this.transcriptHandler.handleTranscriptStreamingStopped(data);
  }

  /**
   * ST-182: Public method for AppWebSocketGateway to forward tail requests
   */
  async forwardTailRequestToAgent(data: {
    runId: string;
    sessionIndex: number;
    filePath: string;
    fromBeginning?: boolean;
  }): Promise<{ success: boolean; error?: string; agentHostname?: string }> {
    return this.transcriptHandler.forwardTailRequestToAgent(this.server, data);
  }

  /**
   * ST-182: Public method for AppWebSocketGateway to forward stop tail requests
   */
  async forwardStopTailToAgent(data: {
    runId: string;
    sessionIndex: number;
  }): Promise<void> {
    return this.transcriptHandler.forwardStopTailToAgent(this.server, data);
  }

  // ===========================================================================
  // ST-323: Upload Batch Handler with ACK callbacks
  // ===========================================================================

  /**
   * ST-323: Handle batch upload of transcript items from laptop agent
   * ST-329: Route transcript_line items to handleTranscriptLines for DB persistence
   * Processes items sequentially and sends individual ACK callbacks for each item
   * Also sends a batch ACK with all successfully processed IDs
   */
  @SubscribeMessage('upload:batch')
  async handleUploadBatch(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { agentId: string; items: unknown[] },
  ): Promise<void> {
    const { agentId, items } = data;
    const { agentId: clientAgentId } = client.data;

    // Verify agent ID matches
    if (clientAgentId !== agentId) {
      this.logger.error(`[ST-323] Agent ID mismatch: client=${clientAgentId}, payload=${agentId}`);
      return;
    }

    this.logger.log(`[ST-323] Processing batch upload: ${items.length} items from agent ${agentId}`);

    const successfulIds: number[] = [];

    // Process each item sequentially with individual ACK callbacks
    for (const item of items) {
      // ST-329: Detect transcript_line items by checking for runId and lines fields
      // These items come from TranscriptTailer.queueUpload('transcript_line', payload)
      const hasTranscriptLineFields =
        typeof item === 'object' &&
        item !== null &&
        'runId' in item &&
        'lines' in item &&
        'sessionIndex' in item &&
        'queueId' in item;

      if (hasTranscriptLineFields) {
        // Route to handleTranscriptLines for DB persistence
        await this.handleTranscriptLineUpload(client, item as TranscriptLinesPayload, (ack) => {
          // Send individual ACK via callback pattern
          client.emit('upload:ack:item', ack);

          // Track successful uploads for batch ACK
          if (ack.success && !ack.isDuplicate) {
            successfulIds.push(ack.id);
          }
        });
      } else {
        // Original behavior for full transcript artifacts (UploadBatchItem format)
        await this.transcriptHandler.handleTranscriptUpload(item as UploadBatchItem, (ack) => {
          // Send individual ACK via callback pattern
          client.emit('upload:ack:item', ack);

          // Track successful uploads for batch ACK
          if (ack.success && !ack.isDuplicate) {
            successfulIds.push(ack.id);
          }
        });
      }
    }

    // Send batch ACK with all successful IDs
    const batchAck: UploadAckPayload = { ids: successfulIds };
    client.emit('upload:ack', batchAck);

    this.logger.log(`[ST-323] Batch upload complete: ${successfulIds.length}/${items.length} items uploaded`);
  }

  /**
   * ST-329: Handle transcript_line upload from queue
   * Converts TranscriptLinesPayload to handleTranscriptLines format and persists to DB
   */
  private async handleTranscriptLineUpload(
    _client: Socket,
    payload: TranscriptLinesPayload,
    callback: (ack: ItemAckPayload) => void,
  ): Promise<void> {
    try {
      // Validate payload structure
      if (!payload.runId || !payload.lines || !Array.isArray(payload.lines)) {
        this.logger.error(`[ST-329] Invalid transcript_line payload structure`, { queueId: payload.queueId });
        callback({ success: false, id: payload.queueId, error: 'Invalid payload structure' });
        return;
      }

      this.logger.log(`[ST-329] Processing transcript_line upload: runId=${payload.runId}, lines=${payload.lines.length}, queueId=${payload.queueId}`);

      // Call handleTranscriptLines with proper format
      const ack = await this.transcriptHandler.handleTranscriptLines({
        queueId: payload.queueId,
        runId: payload.runId,
        sessionIndex: payload.sessionIndex,
        lines: payload.lines,
        isHistorical: payload.isHistorical ?? true,
        timestamp: payload.timestamp,
      });

      // Map response to ItemAckPayload format
      callback({
        success: ack.success,
        id: ack.queueId,
        error: ack.error,
      });
    } catch (error) {
      this.logger.error(`[ST-329] Failed to process transcript_line upload: ${getErrorMessage(error)}`);
      callback({ success: false, id: payload.queueId, error: getErrorMessage(error) });
    }
  }

  // ===========================================================================
  // ST-326: Artifact Upload Handler with ACK callbacks
  // ===========================================================================

  /**
   * ST-326: Handle batch upload of artifact items from laptop agent
   * Processes items sequentially and sends individual ACK callbacks for each item
   * Also sends a batch ACK with all successfully processed IDs
   */
  @SubscribeMessage('artifact:upload')
  async handleArtifactUpload(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: ArtifactUploadBatchPayload,
  ): Promise<void> {
    const { agentId, items } = data;
    const { agentId: clientAgentId } = client.data;

    // Verify agent ID matches
    if (clientAgentId !== agentId) {
      this.logger.error(`[ST-326] Agent ID mismatch: client=${clientAgentId}, payload=${agentId}`);
      return;
    }

    this.logger.log(`[ST-326] Processing artifact upload batch: ${items.length} items from agent ${agentId}`);

    const successfulIds: number[] = [];

    // Process each item sequentially with individual ACK callbacks
    for (const item of items) {
      await this.artifactHandler.handleArtifactUpload(item, (ack) => {
        // Send individual ACK via callback pattern
        client.emit('upload:ack:item', ack);

        // Track successful uploads for batch ACK
        if (ack.success && !ack.isDuplicate) {
          successfulIds.push(ack.id);
        }
      });
    }

    // Send batch ACK with all successful IDs
    const batchAck: UploadAckPayload = { ids: successfulIds };
    client.emit('upload:ack', batchAck);

    this.logger.log(`[ST-326] Artifact batch upload complete: ${successfulIds.length}/${items.length} items uploaded`);
  }

  // ===========================================================================
  // ST-363: Artifact Move Handlers
  // ===========================================================================

  /**
   * ST-363: Emit artifact move request to laptop agent
   * Called by internal controller when update_story changes epicId
   */
  async emitArtifactMoveRequest(data: {
    storyKey: string;
    epicKey: string | null;
    oldPath: string;
    newPath: string;
  }): Promise<void> {
    // Find an online laptop agent with artifact-move capability
    const agents = await getOnlineAgentsWithCapabilityUtil(this.prisma, 'artifact-move');

    if (agents.length === 0) {
      this.logger.warn(`[ST-363] No online agents with artifact-move capability found`);
      return;
    }

    // Use the first available agent
    const agent = agents[0];

    if (!agent.socketId) {
      this.logger.warn(`[ST-363] Agent ${agent.id} has no socket ID, cannot send move request`);
      return;
    }

    const requestId = `move-${Date.now()}-${Math.random().toString(36).substring(7)}`;

    this.logger.log(`[ST-363] Sending artifact move request to agent ${agent.id} for ${data.storyKey}`);

    this.server.to(agent.socketId).emit('artifact:move-request', {
      requestId,
      storyKey: data.storyKey,
      epicKey: data.epicKey,
      oldPath: data.oldPath,
      newPath: data.newPath,
      timestamp: Date.now(),
    });
  }

  /**
   * ST-363: Handle artifact move completion from laptop agent
   */
  @SubscribeMessage('artifact:move-complete')
  async handleArtifactMoveComplete(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { requestId: string; storyKey: string; success: true; newPath: string; timestamp: number },
  ): Promise<void> {
    const { agentId } = client.data;

    this.logger.log(`[ST-363] Artifact move completed successfully for ${data.storyKey} by agent ${agentId}`);

    // Broadcast to frontend clients
    this.appWebSocketGateway.server.emit('artifact:moved', {
      storyKey: data.storyKey,
      newPath: data.newPath,
      timestamp: new Date(data.timestamp),
    });
  }

  /**
   * ST-363: Handle artifact move failure from laptop agent
   */
  @SubscribeMessage('artifact:move-failed')
  async handleArtifactMoveFailed(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { requestId: string; storyKey: string; success: false; error: string; timestamp: number },
  ): Promise<void> {
    const { agentId } = client.data;

    this.logger.error(`[ST-363] Artifact move failed for ${data.storyKey} by agent ${agentId}: ${data.error}`);

    // Broadcast to frontend clients
    this.appWebSocketGateway.server.emit('artifact:move-failed', {
      storyKey: data.storyKey,
      error: data.error,
      timestamp: new Date(data.timestamp),
    });
  }
}
