/**
 * ST-150: Spawn Agent Tool
 *
 * Spawns a Claude Code agent on a remote laptop or locally based on configuration.
 * This is the main entry point for the Story Runner to dispatch agent work.
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { PrismaClient } from '@prisma/client';
import {
  isCapabilityApproved,
  validateCapabilityParams,
  validateInstructions,
  validateAllowedTools,
  getCapabilityTimeout,
} from '../../../remote-agent/approved-scripts';

export const tool: Tool = {
  name: 'spawn_agent',
  description: `Spawn a Claude Code agent on a remote laptop or locally.

This tool dispatches agent work to connected laptop agents via WebSocket.
If no agent is online, returns offline fallback instructions.

**Prerequisites:**
- Remote agent must be online with 'claude-code' capability
- Instructions must not contain secrets (auto-validated)
- Allowed tools must be whitelisted

**Usage:**
1. Call get_online_agents to check availability
2. Call spawn_agent with component context
3. Monitor progress via WebSocket or poll job status

**Offline Handling:**
If no agent is online, returns { agentOffline: true, offlineFallback: "pause" | "skip" | "local" }
The Story Runner should pause/skip based on the fallback setting.`,
  inputSchema: {
    type: 'object',
    properties: {
      componentId: {
        type: 'string',
        description: 'Component UUID to execute',
      },
      stateId: {
        type: 'string',
        description: 'WorkflowState UUID for execution context',
      },
      workflowRunId: {
        type: 'string',
        description: 'WorkflowRun UUID for tracking',
      },
      componentRunId: {
        type: 'string',
        description: 'ComponentRun UUID for metrics tracking',
      },
      instructions: {
        type: 'string',
        description: 'Agent instructions (will be validated for secrets)',
      },
      storyContext: {
        type: 'object',
        description: 'Story context to pass to the agent',
      },
      allowedTools: {
        type: 'array',
        items: { type: 'string' },
        description: 'List of allowed MCP tools (validated against whitelist)',
      },
      model: {
        type: 'string',
        description: 'Model to use (default: claude-sonnet-4-20250514)',
      },
      maxTurns: {
        type: 'number',
        description: 'Maximum conversation turns (default: 50)',
      },
      projectPath: {
        type: 'string',
        description: 'Project path on the remote laptop',
      },
      preferredAgentId: {
        type: 'string',
        description: 'Preferred agent UUID (optional, for sticky sessions)',
      },
    },
    required: ['componentId', 'stateId', 'workflowRunId', 'componentRunId', 'instructions'],
  },
};

export const metadata = {
  category: 'remote_agent',
  domain: 'Remote Execution',
  tags: ['agent', 'spawn', 'claude-code', 'remote', 'st-150'],
  version: '1.0.0',
  since: '2025-11-30',
};

interface SpawnAgentParams {
  componentId: string;
  stateId: string;
  workflowRunId: string;
  componentRunId: string;
  instructions: string;
  storyContext?: Record<string, unknown>;
  allowedTools?: string[];
  model?: string;
  maxTurns?: number;
  projectPath?: string;
  preferredAgentId?: string;
}

// Note: This is a simplified implementation that creates the job directly.
// In a full implementation, this would call RemoteExecutionService.executeClaudeAgent()
// which handles the WebSocket dispatch and agent selection.
export async function handler(
  params: SpawnAgentParams,
  prisma: PrismaClient,
): Promise<{
  success: boolean;
  jobId?: string;
  agentId?: string;
  agentHostname?: string;
  status?: string;
  agentOffline?: boolean;
  offlineFallback?: string;
  error?: string;
}> {
  const {
    componentId,
    stateId,
    workflowRunId,
    componentRunId,
    instructions,
    storyContext,
    allowedTools,
    model = 'claude-sonnet-4-20250514',
    maxTurns = 50,
    projectPath,
    preferredAgentId,
  } = params;

  // Validate capability is approved
  if (!isCapabilityApproved('claude-code')) {
    return {
      success: false,
      error: 'Claude Code execution is not approved',
    };
  }

  // Validate parameters
  const paramValidation = validateCapabilityParams('claude-code', {
    componentId,
    stateId,
    workflowRunId,
    instructions,
  });
  if (!paramValidation.valid) {
    return {
      success: false,
      error: paramValidation.error,
    };
  }

  // Validate instructions don't contain secrets
  const instructionValidation = validateInstructions(instructions);
  if (!instructionValidation.valid) {
    return {
      success: false,
      error: instructionValidation.error,
    };
  }

  // Validate allowed tools if provided
  if (allowedTools && allowedTools.length > 0) {
    const toolValidation = validateAllowedTools(allowedTools);
    if (!toolValidation.valid) {
      return {
        success: false,
        error: toolValidation.error,
      };
    }
  }

  // Find online agent with claude-code capability
  const agentQuery: Record<string, unknown> = {
    status: 'online',
    claudeCodeAvailable: true,
    capabilities: { has: 'claude-code' },
  };

  // Prefer specific agent if requested
  if (preferredAgentId) {
    const preferred = await prisma.remoteAgent.findUnique({
      where: { id: preferredAgentId },
    });
    if (preferred && preferred.status === 'online' && preferred.claudeCodeAvailable) {
      // Use preferred agent
    } else {
      // Fall back to any available
    }
  }

  const agents = await prisma.remoteAgent.findMany({
    where: agentQuery,
    orderBy: { lastSeenAt: 'desc' },
  });

  if (agents.length === 0) {
    // No agent online - check offline fallback from state
    const state = await prisma.workflowState.findUnique({
      where: { id: stateId },
    });

    const offlineFallback = state?.offlineFallback || 'pause';

    return {
      success: false,
      agentOffline: true,
      offlineFallback,
      error: `No Claude Code agent available. Fallback: ${offlineFallback}`,
    };
  }

  // Select agent with fewest current executions (load balancing)
  let selectedAgent = agents[0];
  for (const agent of agents) {
    if (!agent.currentExecutionId && selectedAgent.currentExecutionId) {
      selectedAgent = agent;
      break;
    }
  }

  // Create job in database
  const job = await prisma.remoteJob.create({
    data: {
      script: 'claude-code',
      params: {
        componentId,
        stateId,
        workflowRunId,
        instructions,
        storyContext: storyContext || {},
        allowedTools: allowedTools || [],
        model,
        maxTurns,
        projectPath,
      } as any,
      status: 'pending',
      agentId: selectedAgent.id,
      requestedBy: 'spawn_agent_tool',
      jobType: 'claude-agent',
      componentRunId,
      workflowRunId,
    },
  });

  // Update agent's current execution
  await prisma.remoteAgent.update({
    where: { id: selectedAgent.id },
    data: { currentExecutionId: job.id },
  });

  // Update ComponentRun with execution info
  await prisma.componentRun.update({
    where: { id: componentRunId },
    data: {
      executedOn: `laptop:${selectedAgent.hostname}`,
      remoteJobId: job.id,
    },
  });

  // Update WorkflowRun with executing agent
  await prisma.workflowRun.update({
    where: { id: workflowRunId },
    data: {
      executingAgentId: selectedAgent.id,
    },
  });

  // Note: The actual WebSocket dispatch to the agent would be done by
  // RemoteAgentGateway.emitJobToAgent() which is called by RemoteExecutionService.
  // For this MCP tool, we just create the job record. The gateway's job polling
  // or explicit dispatch would send it to the agent.

  return {
    success: true,
    jobId: job.id,
    agentId: selectedAgent.id,
    agentHostname: selectedAgent.hostname,
    status: 'pending',
  };
}
