import { Injectable, Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { getErrorMessage, getErrorStack } from '../../common';
import { PrismaService } from '../../prisma/prisma.service';
import { TranscriptRegistrationService } from '../transcript-registration.service';
import { AppWebSocketGateway } from '../../websocket/websocket.gateway';
import { TranscriptDetectionPayload } from '../types';
import { uploadAgentTranscript as uploadAgentTranscriptUtil } from './transcript.utils';

/**
 * ST-170, ST-182: Transcript Detection and Streaming Handler
 * Handles transcript detection, registration, and live streaming
 */
@Injectable()
export class TranscriptHandler {
  private readonly logger = new Logger(TranscriptHandler.name);

  // ST-267: Rate limiting for transcript detection
  private transcriptQueue: Array<{
    client: Socket;
    data: TranscriptDetectionPayload;
  }> = [];
  private isProcessingTranscriptQueue = false;
  private readonly TRANSCRIPT_BATCH_SIZE = 5;
  private readonly TRANSCRIPT_BATCH_DELAY_MS = 200;

  // ST-182: Track active master transcript subscriptions
  private readonly masterTranscriptSubscriptions = new Map<string, Set<string>>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly transcriptRegistrationService: TranscriptRegistrationService,
    private readonly appWebSocketGateway: AppWebSocketGateway,
  ) {}

  /**
   * ST-170: Handle transcript detected event from laptop agent
   * ST-267: Added rate limiting via queue
   */
  async handleTranscriptDetected(
    client: Socket,
    data: TranscriptDetectionPayload,
  ): Promise<void> {
    this.logger.log(`[ST-170] Transcript detected from agent: ${data.agentId}, sessionId: ${data.metadata?.sessionId}`);

    // Queue the request instead of processing immediately
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
        const batch = this.transcriptQueue.splice(0, this.TRANSCRIPT_BATCH_SIZE);

        if (batch.length > 1) {
          this.logger.log(`[ST-267] Processing transcript batch: ${batch.length} items, ${this.transcriptQueue.length} remaining`);
        }

        await Promise.all(batch.map(async ({ client, data }) => {
          try {
            await this.transcriptRegistrationService.handleTranscriptDetected(data);

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

        if (this.transcriptQueue.length > 0) {
          await new Promise(resolve => setTimeout(resolve, this.TRANSCRIPT_BATCH_DELAY_MS));
        }
      }
    } finally {
      this.isProcessingTranscriptQueue = false;
    }
  }

  /**
   * ST-182: Frontend requests to start tailing a master transcript
   */
  async handleMasterTranscriptSubscribe(
    client: Socket,
    data: {
      runId: string;
      sessionIndex: number;
      filePath: string;
      fromBeginning?: boolean;
    },
  ): Promise<void> {
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

    const agent = agents[0];

    // Forward tail request to laptop agent - we can't access client.server directly
    // So we need to get it passed in or use a different approach
    // For now, let's skip the direct emit since the forwardTailRequestToAgent does this
    this.logger.log(`[ST-182] Would forward tail request to agent ${agent.hostname}, but need server instance`);
  }

  /**
   * ST-182: Frontend requests to stop tailing a master transcript
   */
  async handleMasterTranscriptUnsubscribe(
    server: Server,
    client: Socket,
    data: { runId: string; sessionIndex: number },
  ): Promise<void> {
    const { runId, sessionIndex } = data;
    this.logger.log(`[ST-182] Master transcript unsubscribe: runId=${runId}, sessionIndex=${sessionIndex}`);

    client.leave(`master-transcript:${runId}`);

    const subs = this.masterTranscriptSubscriptions.get(runId);
    if (subs) {
      subs.delete(client.id);
      if (subs.size === 0) {
        this.masterTranscriptSubscriptions.delete(runId);

        // Tell laptop agent to stop tailing
        const agents = await this.prisma.remoteAgent.findMany({
          where: {
            status: 'online',
            capabilities: { has: 'tail-file' },
          },
        });

        for (const agent of agents) {
          if (agent.socketId) {
            server.to(agent.socketId).emit('transcript:stop_tail', {
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
   */
  async handleTranscriptStreamingStarted(
    data: {
      runId: string;
      sessionIndex: number;
      filePath: string;
      fileSize: number;
      startPosition: number;
    },
  ): Promise<void> {
    this.logger.log(`[ST-182] Streaming started: runId=${data.runId}, sessionIndex=${data.sessionIndex}`);
    this.appWebSocketGateway.server.to(`master-transcript:${data.runId}`).emit('master-transcript:streaming_started', data);
  }

  /**
   * ST-182: Handle transcript lines from laptop agent
   */
  async handleTranscriptLines(
    data: {
      runId: string;
      sessionIndex: number;
      lines: Array<{ line: string; sequenceNumber: number }>;
      isHistorical: boolean;
      timestamp: string;
    },
  ): Promise<void> {
    this.appWebSocketGateway.server.to(`master-transcript:${data.runId}`).emit('master-transcript:lines', data);
  }

  /**
   * ST-182: Handle transcript batch from laptop agent
   */
  async handleTranscriptBatch(
    data: {
      runId: string;
      sessionIndex: number;
      lines: Array<{ line: string; sequenceNumber: number }>;
      isHistorical: boolean;
      timestamp: string;
    },
  ): Promise<void> {
    this.logger.log(`[ST-182] Batch received: runId=${data.runId}, lines=${data.lines.length}`);
    this.appWebSocketGateway.server.to(`master-transcript:${data.runId}`).emit('master-transcript:batch', data);
  }

  /**
   * ST-182: Handle transcript streaming error from laptop agent
   */
  async handleTranscriptError(
    data: {
      runId: string;
      sessionIndex: number;
      error: string;
      code: string;
    },
  ): Promise<void> {
    this.logger.error(`[ST-182] Transcript error: runId=${data.runId}, code=${data.code}, error=${data.error}`);
    this.appWebSocketGateway.server.to(`master-transcript:${data.runId}`).emit('master-transcript:error', data);
  }

  /**
   * ST-182: Handle streaming stopped event from laptop agent
   */
  async handleTranscriptStreamingStopped(
    data: { runId: string; sessionIndex: number },
  ): Promise<void> {
    this.logger.log(`[ST-182] Streaming stopped: runId=${data.runId}, sessionIndex=${data.sessionIndex}`);
    this.appWebSocketGateway.server.to(`master-transcript:${data.runId}`).emit('master-transcript:stopped', data);
  }

  /**
   * ST-182: Forward tail request to agent (called by AppWebSocketGateway)
   */
  async forwardTailRequestToAgent(
    server: Server,
    data: {
      runId: string;
      sessionIndex: number;
      filePath: string;
      fromBeginning?: boolean;
    },
  ): Promise<{ success: boolean; error?: string; agentHostname?: string }> {
    const { runId, sessionIndex, filePath, fromBeginning } = data;

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

    const agent = agents[0];

    if (!agent.socketId) {
      this.logger.warn(`[ST-182] Agent ${agent.hostname} has no socketId`);
      return { success: false, error: 'Agent has no socket connection' };
    }

    server.to(agent.socketId).emit('transcript:start_tail', {
      runId,
      sessionIndex,
      filePath,
      fromBeginning: fromBeginning ?? true,
    });

    this.logger.log(`[ST-182] Forwarded tail request to agent ${agent.hostname} (socket: ${agent.socketId})`);
    return { success: true, agentHostname: agent.hostname };
  }

  /**
   * ST-182: Forward stop tail request to agent
   */
  async forwardStopTailToAgent(
    server: Server,
    data: {
      runId: string;
      sessionIndex: number;
    },
  ): Promise<void> {
    const { runId, sessionIndex } = data;

    const agents = await this.prisma.remoteAgent.findMany({
      where: {
        status: 'online',
        capabilities: { has: 'watch-transcripts' },
      },
    });

    for (const agent of agents) {
      if (agent.socketId) {
        server.to(agent.socketId).emit('transcript:stop_tail', {
          runId,
          sessionIndex,
        });
        this.logger.log(`[ST-182] Forwarded stop tail to agent ${agent.hostname}`);
      }
    }
  }

  /**
   * ST-168: Upload agent transcript to Artifact table
   * ST-284: Delegated to transcript.utils
   */
  async uploadAgentTranscript(
    server: Server,
    workflowRunId: string,
    componentRunId: string,
    transcriptPath: string,
    agentId: string,
  ): Promise<void> {
    return uploadAgentTranscriptUtil(
      this.prisma,
      server,
      workflowRunId,
      componentRunId,
      transcriptPath,
      agentId,
    );
  }
}
