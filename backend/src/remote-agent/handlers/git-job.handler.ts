import { Injectable, Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { getErrorMessage } from '../../common';
import { PrismaService } from '../../prisma/prisma.service';
import { GitJobPayload, GitResultEvent } from '../types';

/**
 * ST-153: Git Command Execution Handler
 * Handles git job emission and result processing
 */
@Injectable()
export class GitJobHandler {
  private readonly logger = new Logger(GitJobHandler.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Emit git job to connected agent
   */
  async emitGitJob(server: Server, agentId: string, job: GitJobPayload): Promise<void> {
    const agent = await this.prisma.remoteAgent.findUnique({
      where: { id: agentId },
    });

    if (!agent || agent.status !== 'online' || !agent.socketId) {
      throw new Error('Agent not online');
    }

    if (!agent.capabilities.includes('git-execute')) {
      throw new Error('Agent does not have git-execute capability');
    }

    server.to(agent.socketId).emit('agent:git_job', job);
    this.logger.log(`Emitted git job ${job.id} to agent ${agentId} (${agent.hostname})`);
  }

  /**
   * Handle git command result from laptop agent
   */
  async handleGitResult(
    client: Socket,
    data: GitResultEvent,
    agentId: string,
  ): Promise<void> {
    if (!agentId) {
      client.emit('agent:error', { error: 'Not registered' });
      return;
    }

    this.logger.log(
      `Git job ${data.jobId} result: status=${data.status}, operation=${data.operation || 'N/A'}`,
    );

    try {
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
}
