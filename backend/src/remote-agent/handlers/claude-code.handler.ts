import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as jwt from 'jsonwebtoken';
import { Server, Socket } from 'socket.io';
import { getErrorMessage } from '../../common';
import { PrismaService } from '../../prisma/prisma.service';
import { StreamEventService } from '../stream-event.service';
import {
  ClaudeCodeJobPayload,
  ClaudeCodeProgressEvent,
  ClaudeCodeCompleteEvent,
} from '../types';
import {
  handleSessionInit as handleSessionInitUtil,
  handleQuestionDetected as handleQuestionDetectedUtil,
  updateWorkflowRunMetadata as updateWorkflowRunMetadataUtil,
} from './claude-code.utils';

/**
 * ST-150: Claude Code Agent Execution Handler
 * Handles Claude Code job emission, progress tracking, and completion
 */
@Injectable()
export class ClaudeCodeHandler {
  private readonly logger = new Logger(ClaudeCodeHandler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly streamEventService: StreamEventService,
  ) {}

  /**
   * Emit Claude Code job to connected agent
   */
  async emitClaudeCodeJob(
    server: Server,
    agentId: string,
    job: ClaudeCodeJobPayload,
  ): Promise<void> {
    const agent = await this.prisma.remoteAgent.findUnique({
      where: { id: agentId },
    });

    if (!agent || agent.status !== 'online' || !agent.socketId) {
      throw new Error('Agent not online');
    }

    if (!agent.claudeCodeAvailable) {
      throw new Error('Agent does not have Claude Code capability');
    }

    // ST-253: Verify socket actually exists before emitting
    const sockets = await server.fetchSockets();
    const socketExists = sockets.some(s => s.id === agent.socketId);

    if (!socketExists) {
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

    server.to(agent.socketId).emit('agent:claude_job', job);
    this.logger.log(`Emitted Claude Code job ${job.id} to agent ${agentId} (${agent.hostname})`);
  }

  /**
   * Handle Claude Code progress events from laptop agent
   */
  async handleClaudeCodeProgress(
    server: Server,
    client: Socket,
    data: ClaudeCodeProgressEvent,
    agentId: string,
  ): Promise<void> {
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
      await handleSessionInitUtil(this.prisma, job, data);
    }

    if (data.type === 'question_detected') {
      await handleQuestionDetectedUtil(this.prisma, server, job, data);
    }

    // Emit to any connected frontend clients
    server.emit(`workflow:${job.workflowRunId}:progress`, {
      componentRunId: job.componentRunId,
      type: data.type,
      sequenceNumber: data.sequenceNumber,
      payload: data.payload,
    });
  }

  /**
   * Handle Claude Code completion event from laptop agent
   */
  async handleClaudeCodeComplete(
    server: Server,
    client: Socket,
    data: ClaudeCodeCompleteEvent,
    agentId: string,
  ): Promise<void> {
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
        Date.now(),
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
        if (data.sessionId || data.transcriptPath) {
          await updateWorkflowRunMetadataUtil(this.prisma, job.workflowRunId, data);
        }
      }

      // Emit completion to any connected frontend clients
      if (job?.workflowRunId) {
        server.emit(`workflow:${job.workflowRunId}:complete`, {
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
   * Handle Claude Code pause event
   */
  async handleClaudeCodePaused(
    server: Server,
    client: Socket,
    data: {
      jobId: string;
      jobToken: string;
      reason: string;
      question?: string;
    },
    agentId: string,
  ): Promise<void> {
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
      server.emit(`workflow:${job.workflowRunId}:paused`, {
        componentRunId: job?.componentRunId,
        reason: data.reason,
        question: data.question,
      });
    }

    client.emit('agent:ack', { jobId: data.jobId, received: true });
  }

  /**
   * Handle resume notification from agent
   */
  async handleResumeAvailable(
    server: Server,
    client: Socket,
    data: {
      jobId: string;
      jobToken: string;
      lastSequence: number;
    },
    agentId: string,
  ): Promise<void> {
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

    // Clear WorkflowRun disconnect time and pause status
    if (job.workflowRunId) {
      await this.prisma.workflowRun.update({
        where: { id: job.workflowRunId },
        data: {
          agentDisconnectedAt: null,
          isPaused: false,
          pauseReason: null,
        },
      });

      // Emit workflow:resumed event
      server.emit(`workflow:${job.workflowRunId}:resumed`, {
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
   * ST-160: Send answer to laptop agent for --resume
   */
  async emitAnswerToAgent(
    server: Server,
    agentId: string,
    data: {
      sessionId: string;
      answer: string;
      questionId: string;
      jobId: string;
    },
  ): Promise<void> {
    const agent = await this.prisma.remoteAgent.findUnique({
      where: { id: agentId },
    });

    if (!agent || agent.status !== 'online' || !agent.socketId) {
      throw new Error('Agent not online');
    }

    server.to(agent.socketId).emit('agent:resume_with_answer', {
      sessionId: data.sessionId,
      answer: data.answer,
      questionId: data.questionId,
      jobId: data.jobId,
    });

    this.logger.log(`[ST-160] Sent answer for question ${data.questionId} to agent ${agentId}`);
  }

  /**
   * Private: Validate per-job JWT token
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
}
