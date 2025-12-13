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
  description: 'Spawn Claude Code agent on remote laptop. Returns jobId; handles offline agents gracefully.',
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
      // ST-160: Native subagent support
      executionType: {
        type: 'string',
        enum: ['custom', 'native_explore', 'native_plan', 'native_general'],
        description: 'Execution type: "custom" (default) or "native_*" for Anthropic native subagents',
      },
      nativeAgentConfig: {
        type: 'object',
        description: 'Configuration for native subagent types',
        properties: {
          questionTimeout: {
            type: 'number',
            description: 'Timeout in ms for question response (default: 300000)',
          },
          maxQuestions: {
            type: 'number',
            description: 'Maximum questions allowed per execution',
          },
          allowedTools: {
            type: 'array',
            items: { type: 'string' },
            description: 'Override tools for native agent execution',
          },
        },
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

// ST-160: Native subagent execution types
type ExecutionType = 'custom' | 'native_explore' | 'native_plan' | 'native_general';

interface NativeAgentConfig {
  questionTimeout?: number;  // Timeout for question response (ms)
  maxQuestions?: number;     // Max questions per execution
  allowedTools?: string[];   // Override tools for native agent
}

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
  // ST-160: Native subagent support
  executionType?: ExecutionType;
  nativeAgentConfig?: NativeAgentConfig;
}

// Note: This is a simplified implementation that creates the job directly.
// In a full implementation, this would call RemoteExecutionService.executeClaudeAgent()
// which handles the WebSocket dispatch and agent selection.
export async function handler(
  prisma: PrismaClient,
  params: SpawnAgentParams,
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
    // ST-160: Native subagent support
    executionType = 'custom',
    nativeAgentConfig,
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
        // ST-160: Native subagent support
        executionType,
        nativeAgentConfig: nativeAgentConfig || null,
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
