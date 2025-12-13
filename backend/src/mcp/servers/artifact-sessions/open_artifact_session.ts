/**
 * Open Artifact Session Tool
 * ST-152: Start Claude Code session with artifact content as context
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { PrismaClient } from '@prisma/client';
import {
  isCapabilityApproved,
  validateInstructions,
} from '../../../remote-agent/approved-scripts';
import {
  NotFoundError,
  ValidationError,
} from '../../types';
import { handlePrismaError } from '../../utils';
import { handler as getArtifactHandler } from '../artifacts/get_artifact';

export const tool: Tool = {
  name: 'open_artifact_session',
  description: 'Start interactive artifact editing session. Returns jobId; use save_artifact_changes to persist.',
  inputSchema: {
    type: 'object',
    properties: {
      artifactId: {
        type: 'string',
        description: 'Artifact UUID (provide this OR definitionKey + workflowRunId)',
      },
      definitionKey: {
        type: 'string',
        description: 'Artifact definition key (e.g., "ARCH_DOC"). Requires workflowRunId.',
      },
      workflowRunId: {
        type: 'string',
        description: 'Workflow Run UUID (required)',
      },
      discussionPrompt: {
        type: 'string',
        description: 'Initial prompt/request for the discussion session',
      },
      model: {
        type: 'string',
        description: 'Model to use (default: claude-sonnet-4-20250514)',
      },
      maxTurns: {
        type: 'number',
        description: 'Maximum conversation turns (default: 50)',
      },
    },
    required: ['workflowRunId'],
  },
};

export const metadata = {
  category: 'artifact_sessions',
  domain: 'story_runner',
  tags: ['artifact', 'session', 'edit', 'claude-code', 'st-152'],
  version: '1.0.0',
  since: 'ST-152',
};

interface OpenArtifactSessionParams {
  artifactId?: string;
  definitionKey?: string;
  workflowRunId: string;
  discussionPrompt?: string;
  model?: string;
  maxTurns?: number;
}

interface OpenArtifactSessionResponse {
  success: boolean;
  jobId?: string;
  artifactId?: string;
  artifactKey?: string;
  artifactName?: string;
  version?: number;
  agentId?: string;
  agentHostname?: string;
  status?: string;
  agentOffline?: boolean;
  error?: string;
}

/**
 * Build session context template with artifact content and schema
 */
function buildSessionContext(
  artifact: {
    content: string;
    version: number;
    definition?: {
      name: string;
      key: string;
      type: string;
      schema?: unknown;
    };
  },
  discussionPrompt?: string,
): string {
  const { definition, content, version } = artifact;
  const name = definition?.name || 'Unknown';
  const key = definition?.key || 'UNKNOWN';
  const type = definition?.type || 'markdown';
  const schema = definition?.schema;

  let context = `# Artifact: ${name} (${key})
Type: ${type}
Version: ${version}
`;

  if (schema) {
    context += `\nSchema:\n\`\`\`json\n${JSON.stringify(schema, null, 2)}\n\`\`\`\n`;
  }

  context += `
---
## Current Content
---
${content}
---

You are reviewing and editing this artifact. The user wants to discuss and potentially modify it.

When you're done making changes, format the final content clearly as:
\`\`\`${type}
[your final content here]
\`\`\`

This allows the user to save the changes back to the artifact.

${discussionPrompt ? `**User's request:** ${discussionPrompt}` : 'Please review this artifact and await the user\'s instructions.'}
`;

  return context;
}

export async function handler(
  prisma: PrismaClient,
  params: OpenArtifactSessionParams,
): Promise<OpenArtifactSessionResponse> {
  try {
    const {
      artifactId,
      definitionKey,
      workflowRunId,
      discussionPrompt,
      model = 'claude-sonnet-4-20250514',
      maxTurns = 50,
    } = params;

    // Validate we have either artifactId or definitionKey
    if (!artifactId && !definitionKey) {
      throw new ValidationError(
        'Either artifactId or definitionKey must be provided',
      );
    }

    // Validate capability is approved
    if (!isCapabilityApproved('claude-code')) {
      return {
        success: false,
        error: 'Claude Code execution is not approved',
      };
    }

    // Fetch artifact using existing handler
    const artifact = await getArtifactHandler(prisma, {
      artifactId,
      definitionKey,
      workflowRunId,
      includeContent: true,
    });

    // Build session context with artifact content
    const instructions = buildSessionContext(
      {
        content: artifact.content,
        version: artifact.version,
        definition: artifact.definition,
      },
      discussionPrompt,
    );

    // Validate instructions don't contain secrets
    const instructionValidation = validateInstructions(instructions);
    if (!instructionValidation.valid) {
      return {
        success: false,
        error: instructionValidation.error,
      };
    }

    // Find online agent with claude-code capability
    const agents = await prisma.remoteAgent.findMany({
      where: {
        status: 'online',
        claudeCodeAvailable: true,
        capabilities: { has: 'claude-code' },
      },
      orderBy: { lastSeenAt: 'desc' },
    });

    if (agents.length === 0) {
      return {
        success: false,
        agentOffline: true,
        error: 'No Claude Code agent available',
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

    // Create RemoteJob for artifact session
    const job = await prisma.remoteJob.create({
      data: {
        script: 'claude-code',
        params: {
          artifactId: artifact.id,
          artifactKey: artifact.definition?.key,
          workflowRunId,
          instructions,
          model,
          maxTurns,
          sessionType: 'artifact-edit',
        } as any,
        status: 'pending',
        agentId: selectedAgent.id,
        requestedBy: 'open_artifact_session',
        jobType: 'artifact-session',
        workflowRunId,
      },
    });

    // Update agent's current execution
    await prisma.remoteAgent.update({
      where: { id: selectedAgent.id },
      data: { currentExecutionId: job.id },
    });

    return {
      success: true,
      jobId: job.id,
      artifactId: artifact.id,
      artifactKey: artifact.definition?.key,
      artifactName: artifact.definition?.name,
      version: artifact.version,
      agentId: selectedAgent.id,
      agentHostname: selectedAgent.hostname,
      status: 'pending',
    };
  } catch (error: any) {
    if (error.name === 'MCPError') {
      throw error;
    }
    throw handlePrismaError(error, 'open_artifact_session');
  }
}
