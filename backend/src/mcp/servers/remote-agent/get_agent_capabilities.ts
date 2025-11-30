/**
 * ST-150: Get Agent Capabilities Tool
 *
 * Returns detailed capabilities for a specific agent or all approved capabilities.
 * Used to check what an agent can do before dispatching work.
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { PrismaClient } from '@prisma/client';
import {
  APPROVED_SCRIPTS,
  APPROVED_CAPABILITIES,
} from '../../../remote-agent/approved-scripts';

export const tool: Tool = {
  name: 'get_agent_capabilities',
  description: `Get capabilities for a remote agent or list all approved capabilities.

Returns:
- For specific agent: Agent details with its registered capabilities
- Without agentId: All approved scripts and capabilities with their configurations

Capabilities include:
- parse-transcript: Parse Claude Code transcripts for metrics
- analyze-story-transcripts: Analyze transcripts for a story
- list-transcripts: List available transcript files
- claude-code: Execute Claude Code sessions (60 min timeout)`,
  inputSchema: {
    type: 'object',
    properties: {
      agentId: {
        type: 'string',
        description:
          'Agent UUID to get capabilities for. If not provided, returns all approved capabilities.',
      },
      hostname: {
        type: 'string',
        description:
          'Agent hostname to get capabilities for (alternative to agentId).',
      },
    },
    required: [],
  },
};

export const metadata = {
  category: 'remote_agent',
  domain: 'Remote Execution',
  tags: ['agent', 'capabilities', 'remote', 'st-150'],
  version: '1.0.0',
  since: '2025-11-30',
};

interface GetAgentCapabilitiesParams {
  agentId?: string;
  hostname?: string;
}

interface CapabilityInfo {
  name: string;
  type: 'script' | 'capability';
  description: string;
  timeout: number;
  allowedParams?: string[];
  requiredParams?: string[];
}

export async function handler(
  params: GetAgentCapabilitiesParams,
  prisma: PrismaClient,
): Promise<{
  success: boolean;
  agent?: {
    id: string;
    hostname: string;
    status: string;
    capabilities: string[];
    claudeCodeAvailable: boolean;
    claudeCodeVersion: string | null;
  };
  approvedCapabilities: CapabilityInfo[];
  agentCapabilities?: CapabilityInfo[];
}> {
  const { agentId, hostname } = params;

  // Build list of all approved capabilities
  const approvedCapabilities: CapabilityInfo[] = [];

  // Add approved scripts
  for (const [name, config] of Object.entries(APPROVED_SCRIPTS)) {
    approvedCapabilities.push({
      name,
      type: 'script',
      description: config.description,
      timeout: config.timeout,
      allowedParams: config.allowedParams,
    });
  }

  // Add approved capabilities (like claude-code)
  for (const [name, config] of Object.entries(APPROVED_CAPABILITIES)) {
    approvedCapabilities.push({
      name,
      type: 'capability',
      description: config.description,
      timeout: config.timeout,
      requiredParams: config.requiredParams,
    });
  }

  // If agent specified, look it up
  if (agentId || hostname) {
    const where = agentId ? { id: agentId } : { hostname };
    const agent = await prisma.remoteAgent.findUnique({ where });

    if (!agent) {
      return {
        success: false,
        approvedCapabilities,
      } as any;
    }

    // Filter to only capabilities this agent has
    const agentCapabilities = approvedCapabilities.filter((cap) =>
      agent.capabilities.includes(cap.name),
    );

    return {
      success: true,
      agent: {
        id: agent.id,
        hostname: agent.hostname,
        status: agent.status,
        capabilities: agent.capabilities,
        claudeCodeAvailable: agent.claudeCodeAvailable,
        claudeCodeVersion: agent.claudeCodeVersion,
      },
      approvedCapabilities,
      agentCapabilities,
    };
  }

  // No agent specified - just return all approved capabilities
  return {
    success: true,
    approvedCapabilities,
  };
}
