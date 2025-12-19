import { JwtService } from '@nestjs/jwt';
import { Server, Socket } from 'socket.io';
import { PrismaService } from '../prisma/prisma.service';
import { StreamEventService } from './stream-event.service';

/**
 * ST-160: Get session streaming status for a workflow
 * ST-284: Extracted from remote-agent.gateway to reduce file size
 */
export async function getSessionStatus(
  prisma: PrismaService,
  workflowRunId: string,
): Promise<{
  isActive: boolean;
  agentId?: string;
  agentHostname?: string;
  currentJobId?: string;
  pendingQuestions: number;
  lastEventAt?: Date;
}> {
  const workflowRun = await prisma.workflowRun.findUnique({
    where: { id: workflowRunId },
  });

  let agentHostname: string | undefined;
  if (workflowRun?.executingAgentId) {
    const agent = await prisma.remoteAgent.findUnique({
      where: { id: workflowRun.executingAgentId },
      select: { hostname: true },
    });
    agentHostname = agent?.hostname;
  }

  const pendingQuestions = await prisma.agentQuestion.count({
    where: {
      workflowRunId,
      status: 'pending',
    },
  });

  const lastEvent = await prisma.agentStreamEvent.findFirst({
    where: { workflowRunId },
    orderBy: { createdAt: 'desc' },
  });

  const currentJob = await prisma.remoteJob.findFirst({
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
 * ST-259: Get active agents with execution state
 * ST-284: Extracted from remote-agent.gateway to reduce file size
 */
export async function getActiveAgents(prisma: PrismaService) {
  const agents = await prisma.remoteAgent.findMany({
    where: {
      OR: [
        { status: 'online' },
        { currentExecutionId: { not: null } },
      ],
    },
    orderBy: { lastSeenAt: 'desc' },
  });

  const enrichedAgents = await Promise.all(
    agents.map(async (agent) => {
      const jobsInFlight = await prisma.remoteJob.count({
        where: {
          agentId: agent.id,
          status: { in: ['pending', 'running', 'paused'] },
        },
      });

      let currentJobId: string | undefined;
      let currentJobType: string | undefined;
      let currentWorkflowRunId: string | undefined;

      if (agent.currentExecutionId) {
        const currentJob = await prisma.remoteJob.findUnique({
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

/**
 * ST-160: Subscribe frontend client to session streaming
 * ST-284: Extracted from remote-agent.gateway to reduce file size
 */
export async function handleSessionSubscribe(
  server: Server,
  streamEventService: StreamEventService,
  client: any,
  data: { workflowRunId: string; componentRunId?: string },
  logger: any,
): Promise<void> {
  const { workflowRunId, componentRunId } = data;

  client.join(`workflow:${workflowRunId}`);
  logger.log(`[ST-160] Client ${client.id} subscribed to workflow ${workflowRunId}`);

  if (componentRunId) {
    client.join(`component:${componentRunId}`);
    logger.log(`[ST-160] Client ${client.id} subscribed to component ${componentRunId}`);
  }

  try {
    const events = await streamEventService.getEventsForWorkflowRun(workflowRunId, {
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
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`[ST-160] Failed to fetch session history: ${message}`);
  }

  client.emit('session:subscribed', {
    workflowRunId,
    componentRunId,
    success: true,
  });
}

/**
 * ST-160: Unsubscribe from session streaming
 * ST-284: Extracted from remote-agent.gateway to reduce file size
 */
export function handleSessionUnsubscribe(
  client: any,
  data: { workflowRunId: string; componentRunId?: string },
  logger: any,
): void {
  const { workflowRunId, componentRunId } = data;

  client.leave(`workflow:${workflowRunId}`);

  if (componentRunId) {
    client.leave(`component:${componentRunId}`);
  }

  logger.log(`[ST-160] Client ${client.id} unsubscribed from workflow ${workflowRunId}`);

  client.emit('session:unsubscribed', {
    workflowRunId,
    componentRunId,
    success: true,
  });
}

/**
 * Agent registration with pre-shared secret
 * ST-284: Extracted from remote-agent.gateway to reduce file size
 */
export async function handleAgentRegister(
  prisma: PrismaService,
  jwtService: JwtService,
  server: Server,
  client: Socket,
  data: {
    secret: string;
    hostname: string;
    capabilities: string[];
    claudeCodeVersion?: string;
    config?: {
      projectPath?: string;
      worktreeRoot?: string;
    };
  },
  reconnectHandler: ((agentId: string) => Promise<{ resumed: number; workflowRunIds: string[] }>) | null,
  logger: any,
): Promise<void> {
  const { secret, hostname, capabilities, claudeCodeVersion, config } = data;

  // Validate pre-shared secret
  const expectedSecret = process.env.AGENT_SECRET || 'development-secret-change-in-production';
  if (secret !== expectedSecret) {
    logger.warn(`Agent registration rejected: Invalid secret from ${hostname}`);
    client.emit('agent:error', { error: 'Invalid secret' });
    client.disconnect();
    return;
  }

  // Issue JWT token
  const token = await jwtService.signAsync(
    { hostname, type: 'remote-agent' },
    {
      secret: process.env.JWT_SECRET || 'development-secret-change-in-production',
      expiresIn: '30d',
    },
  );

  const hasClaudeCode = capabilities.includes('claude-code');

  try {
    const agent = await prisma.remoteAgent.upsert({
      where: { hostname },
      create: {
        hostname,
        socketId: client.id,
        status: 'online',
        capabilities,
        lastSeenAt: new Date(),
        claudeCodeAvailable: hasClaudeCode,
        claudeCodeVersion: claudeCodeVersion || null,
        config: config || {},
      },
      update: {
        socketId: client.id,
        status: 'online',
        capabilities,
        lastSeenAt: new Date(),
        claudeCodeAvailable: hasClaudeCode,
        claudeCodeVersion: claudeCodeVersion || null,
        currentExecutionId: null,
        config: config || {},
      },
    });

    client.data.agentId = agent.id;
    client.data.hostname = hostname;

    logger.log(`Agent registered: ${hostname} (${client.id}), Claude Code: ${hasClaudeCode ? claudeCodeVersion : 'N/A'}`);

    // ST-150: Handle reconnection of waiting jobs
    if (reconnectHandler) {
      const result = await reconnectHandler(agent.id);
      if (result.resumed > 0) {
        logger.log(`Resumed ${result.resumed} jobs after agent reconnection`);

        for (const workflowRunId of result.workflowRunIds) {
          server.emit(`workflow:${workflowRunId}:resumed`, {
            agentId: agent.id,
            hostname,
            timestamp: new Date().toISOString(),
          });
          logger.log(`Emitted workflow:${workflowRunId}:resumed (agent reconnected)`);
        }
      }
    }

    client.emit('agent:registered', {
      success: true,
      token,
      agentId: agent.id,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`Agent registration failed: ${message}`);
    client.emit('agent:error', { error: 'Registration failed' });
    client.disconnect();
  }
}

/**
 * Emit job to connected agent
 * ST-284: Extracted from remote-agent.gateway to reduce file size
 */
export async function emitJobToAgent(
  prisma: PrismaService,
  server: Server,
  agentId: string,
  job: any,
  logger: any,
): Promise<void> {
  const agent = await prisma.remoteAgent.findUnique({
    where: { id: agentId },
  });

  if (!agent || agent.status !== 'online' || !agent.socketId) {
    throw new Error('Agent not online');
  }

  // ST-253: Verify socket actually exists
  const sockets = await server.fetchSockets();
  const socketExists = sockets.some(s => s.id === agent.socketId);

  if (!socketExists) {
    logger.warn(`Stale socket detected for agent ${agentId}, marking offline`);
    await prisma.remoteAgent.update({
      where: { id: agentId },
      data: {
        status: 'offline',
        socketId: null,
        lastSeenAt: new Date(),
      },
    });
    throw new Error('Agent socket is stale (disconnected without proper cleanup)');
  }

  server.to(agent.socketId).emit('agent:job', job);
  logger.log(`Emitted job ${job.id} to agent ${agentId}`);
}

/**
 * Get list of online agents with specific capability
 * ST-284: Extracted from remote-agent.gateway to reduce file size
 */
export async function getOnlineAgentsWithCapability(
  prisma: PrismaService,
  capability: string,
) {
  return prisma.remoteAgent.findMany({
    where: {
      status: 'online',
      capabilities: {
        has: capability,
      },
    },
  });
}

/**
 * Agent heartbeat handler
 * ST-284: Extracted from remote-agent.gateway to reduce file size
 */
export async function handleAgentHeartbeat(
  prisma: PrismaService,
  agentId: string | undefined,
): Promise<void> {
  if (!agentId) {
    throw new Error('Not registered');
  }

  await prisma.remoteAgent.update({
    where: { id: agentId },
    data: { lastSeenAt: new Date() },
  });
}

/**
 * Agent result submission handler
 * ST-284: Extracted from remote-agent.gateway to reduce file size
 */
export async function handleAgentResult(
  prisma: PrismaService,
  agentId: string | undefined,
  data: { jobId: string; status: string; result?: unknown; error?: string },
  logger: any,
): Promise<void> {
  const { jobId, status, result, error } = data;

  if (!agentId) {
    throw new Error('Not registered');
  }

  logger.log(`Agent ${agentId} submitted result for job ${jobId}: ${status}`);

  await prisma.remoteJob.update({
    where: { id: jobId },
    data: {
      status,
      result: result ? (result as any) : null,
      error: error || null,
      completedAt: new Date(),
      agentId,
    },
  });
}

/**
 * Handle agent disconnection logic
 * ST-284: Extracted from remote-agent.gateway to reduce file size
 */
export async function handleDisconnectLogic(
  prisma: PrismaService,
  server: Server,
  clientId: string,
  agentId: string | undefined,
  disconnectHandler: ((agentId: string) => Promise<{ jobIds: string[]; workflowRunIds: string[] }>) | null,
  logger: any,
): Promise<{ jobCount: number; workflowCount: number }> {
  await prisma.remoteAgent.updateMany({
    where: { socketId: clientId },
    data: {
      status: 'offline',
      socketId: null,
      lastSeenAt: new Date(),
      currentExecutionId: null,
    },
  });

  let jobCount = 0;
  let workflowCount = 0;

  // ST-150: Handle running Claude Code jobs if agent was executing
  if (agentId && disconnectHandler) {
    const result = await disconnectHandler(agentId);

    jobCount = result.jobIds?.length || 0;
    workflowCount = result.workflowRunIds?.length || 0;

    if (result && result.workflowRunIds) {
      for (const workflowRunId of result.workflowRunIds) {
        server.emit(`workflow:${workflowRunId}:paused`, {
          reason: 'offline',
          agentId,
          timestamp: new Date().toISOString(),
        });
        logger.log(`Emitted workflow:${workflowRunId}:paused (agent offline)`);
      }
    }
  }

  return { jobCount, workflowCount };
}
