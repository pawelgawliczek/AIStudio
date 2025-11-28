import { Logger } from '@nestjs/common';
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
import { Server, Socket } from 'socket.io';
import { PrismaService } from '../prisma/prisma.service';

/**
 * ST-133: Remote Agent Gateway
 *
 * WebSocket gateway for remote execution agents (laptop/local machines).
 * Handles agent registration, heartbeat, and job result submission.
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

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

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
   */
  async handleDisconnect(client: Socket) {
    this.logger.log(`Agent disconnected: ${client.id}`);

    // Find agent by socket ID and mark offline
    try {
      await this.prisma.remoteAgent.updateMany({
        where: { socketId: client.id },
        data: {
          status: 'offline',
          socketId: null,
          lastSeenAt: new Date(),
        },
      });
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
   */
  @SubscribeMessage('agent:register')
  async handleAgentRegister(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: {
      secret: string;
      hostname: string;
      capabilities: string[]
    },
  ) {
    const { secret, hostname, capabilities } = data;

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

    // Register or update agent in database
    try {
      const agent = await this.prisma.remoteAgent.upsert({
        where: { hostname },
        create: {
          hostname,
          socketId: client.id,
          status: 'online',
          capabilities,
          lastSeenAt: new Date(),
        },
        update: {
          socketId: client.id,
          status: 'online',
          capabilities,
          lastSeenAt: new Date(),
        },
      });

      // Store agent data in socket context
      client.data.agentId = agent.id;
      client.data.hostname = hostname;

      this.logger.log(`Agent registered: ${hostname} (${client.id})`);

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
}
