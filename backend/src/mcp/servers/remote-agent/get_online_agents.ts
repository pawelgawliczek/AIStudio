/**
 * ST-150: Get Online Agents Tool
 *
 * Lists all currently connected remote agents with their capabilities and status.
 * Used by Story Runner to discover available execution hosts.
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { PrismaClient } from '@prisma/client';

export const tool: Tool = {
  name: 'get_online_agents',
  description: `List all currently online remote agents.

Returns connected agents with:
- Agent ID and hostname
- Capabilities (parse-transcript, claude-code, etc.)
- Claude Code availability and version
- Current execution status
- Last heartbeat timestamp

Use this to discover available execution hosts before spawning agents.`,
  inputSchema: {
    type: 'object',
    properties: {
      capability: {
        type: 'string',
        description:
          'Filter agents by capability (e.g., "claude-code", "parse-transcript"). If not provided, returns all online agents.',
      },
      includeOffline: {
        type: 'boolean',
        description: 'Include offline agents in the response (default: false)',
      },
    },
    required: [],
  },
};

export const metadata = {
  category: 'remote_agent',
  domain: 'Remote Execution',
  tags: ['agent', 'remote', 'discovery', 'st-150'],
  version: '1.0.0',
  since: '2025-11-30',
};

interface GetOnlineAgentsParams {
  capability?: string;
  includeOffline?: boolean;
}

export async function handler(
  params: GetOnlineAgentsParams,
  prisma: PrismaClient,
): Promise<{
  success: boolean;
  agents: Array<{
    id: string;
    hostname: string;
    status: string;
    capabilities: string[];
    claudeCodeAvailable: boolean;
    claudeCodeVersion: string | null;
    currentExecutionId: string | null;
    lastSeenAt: Date | null;
  }>;
  count: number;
  onlineCount: number;
}> {
  const { capability, includeOffline = false } = params;

  // Build query filter
  const where: Record<string, unknown> = {};

  if (!includeOffline) {
    where.status = 'online';
  }

  if (capability) {
    where.capabilities = {
      has: capability,
    };
  }

  const agents = await prisma.remoteAgent.findMany({
    where,
    orderBy: [{ status: 'asc' }, { lastSeenAt: 'desc' }],
  });

  const onlineCount = agents.filter((a) => a.status === 'online').length;

  return {
    success: true,
    agents: agents.map((agent) => ({
      id: agent.id,
      hostname: agent.hostname,
      status: agent.status,
      capabilities: agent.capabilities,
      claudeCodeAvailable: agent.claudeCodeAvailable,
      claudeCodeVersion: agent.claudeCodeVersion,
      currentExecutionId: agent.currentExecutionId,
      lastSeenAt: agent.lastSeenAt,
    })),
    count: agents.length,
    onlineCount,
  };
}
