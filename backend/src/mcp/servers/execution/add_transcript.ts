/**
 * ST-172: Add transcript path to WorkflowRun
 * Called by hooks (compact, Task) to register transcript files with a workflow run.
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { PrismaClient } from '@prisma/client';
import { ValidationError } from '../../types';

export const tool: Tool = {
  name: 'add_transcript',
  description: 'ST-172: Add a transcript path to a WorkflowRun. Use for master session transcripts (after compaction) or spawned agent transcripts.',
  inputSchema: {
    type: 'object',
    properties: {
      runId: {
        type: 'string',
        description: 'Workflow Run ID. Required if sessionId not provided.',
      },
      sessionId: {
        type: 'string',
        description: 'Claude session ID to look up the WorkflowRun. Used when runId is not known (e.g., after compaction).',
      },
      transcriptPath: {
        type: 'string',
        description: 'Full path to the transcript JSONL file (required)',
      },
      type: {
        type: 'string',
        enum: ['master', 'agent'],
        description: 'Transcript type: "master" for orchestrator session, "agent" for spawned agents (required)',
      },
      // For agent transcripts
      componentId: {
        type: 'string',
        description: 'Component ID (required for type="agent")',
      },
      agentId: {
        type: 'string',
        description: 'Claude agent ID (8-char hex, for type="agent")',
      },
    },
    required: ['transcriptPath', 'type'],
  },
};

export const metadata = {
  category: 'execution',
  domain: 'Team Execution',
  tags: ['transcript', 'tracking', 'hooks'],
  version: '1.0.0',
  since: '2025-12-04',
};

export async function handler(prisma: PrismaClient, params: any) {
  const { runId, sessionId, transcriptPath, type, componentId, agentId } = params;

  if (!transcriptPath) {
    throw new ValidationError('Missing required parameter: transcriptPath', {
      expectedState: 'A valid transcript file path must be provided',
    });
  }

  if (!type || !['master', 'agent'].includes(type)) {
    throw new ValidationError('Invalid type. Must be "master" or "agent"', {
      expectedState: '"master" or "agent"',
      currentState: type,
    });
  }

  if (type === 'agent' && !componentId) {
    throw new ValidationError('componentId is required for agent transcripts', {
      expectedState: 'A valid component ID for the spawned agent',
    });
  }

  // Find the WorkflowRun
  let workflowRun;

  if (runId) {
    workflowRun = await prisma.workflowRun.findUnique({
      where: { id: runId },
    });
  } else if (sessionId) {
    // Look up by sessionId stored in metadata._transcriptTracking.sessionId
    // or by finding a run where masterTranscriptPaths contains a file matching the sessionId
    workflowRun = await prisma.workflowRun.findFirst({
      where: {
        OR: [
          // Check metadata for sessionId
          {
            metadata: {
              path: ['_transcriptTracking', 'sessionId'],
              equals: sessionId,
            },
          },
          // Or check if any transcript path contains the sessionId
          {
            masterTranscriptPaths: {
              has: transcriptPath.replace('.jsonl', ''), // Remove extension for partial match
            },
          },
        ],
        status: 'running', // Only match running workflows
      },
      orderBy: {
        startedAt: 'desc',
      },
    });
  }

  if (!workflowRun) {
    // Not an error - this might be a session without an active workflow
    return {
      success: false,
      reason: 'no_active_workflow',
      message: `No active workflow run found for ${runId ? `runId=${runId}` : `sessionId=${sessionId}`}. Transcript not recorded.`,
    };
  }

  // Add the transcript based on type
  if (type === 'master') {
    // Add to masterTranscriptPaths (avoid duplicates)
    const existingPaths = workflowRun.masterTranscriptPaths || [];
    if (!existingPaths.includes(transcriptPath)) {
      await prisma.workflowRun.update({
        where: { id: workflowRun.id },
        data: {
          masterTranscriptPaths: [...existingPaths, transcriptPath],
        },
      });
      console.log(`[ST-172] Added master transcript to WorkflowRun ${workflowRun.id}: ${transcriptPath}`);

      return {
        success: true,
        runId: workflowRun.id,
        type: 'master',
        transcriptPath,
        totalMasterTranscripts: existingPaths.length + 1,
        message: `Added master transcript to workflow run. Total: ${existingPaths.length + 1} transcripts.`,
      };
    } else {
      return {
        success: true,
        runId: workflowRun.id,
        type: 'master',
        transcriptPath,
        duplicate: true,
        message: 'Transcript already recorded (duplicate ignored).',
      };
    }
  } else {
    // type === 'agent'
    // Add to spawnedAgentTranscripts
    const existingAgents = (workflowRun.spawnedAgentTranscripts as any[] | null) || [];
    const existingEntry = existingAgents.find(
      (a: any) => a.componentId === componentId && a.transcriptPath === transcriptPath
    );

    if (!existingEntry) {
      const newEntry = {
        componentId,
        agentId: agentId || null,
        transcriptPath,
        spawnedAt: new Date().toISOString(),
      };

      await prisma.workflowRun.update({
        where: { id: workflowRun.id },
        data: {
          spawnedAgentTranscripts: [...existingAgents, newEntry],
        },
      });
      console.log(`[ST-172] Added agent transcript to WorkflowRun ${workflowRun.id}: componentId=${componentId}, path=${transcriptPath}`);

      return {
        success: true,
        runId: workflowRun.id,
        type: 'agent',
        componentId,
        agentId,
        transcriptPath,
        totalAgentTranscripts: existingAgents.length + 1,
        message: `Added agent transcript to workflow run. Total: ${existingAgents.length + 1} agent transcripts.`,
      };
    } else {
      return {
        success: true,
        runId: workflowRun.id,
        type: 'agent',
        componentId,
        transcriptPath,
        duplicate: true,
        message: 'Agent transcript already recorded (duplicate ignored).',
      };
    }
  }
}
