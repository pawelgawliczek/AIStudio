/**
 * ST-170: Upload Transcript MCP Tool
 *
 * Stores completed transcript content in the database for master sessions and spawned agents.
 * Called by the laptop TranscriptWatcher daemon when transcript execution completes.
 *
 * Features:
 * - Validates transcript type (master/agent)
 * - Stores full JSONL content in database
 * - Records ST-27 metrics (tokens, tools, duration)
 * - Updates ComponentRun status if agent transcript
 * - Prevents duplicate uploads
 */

import { PrismaClient } from '@prisma/client';
import { z } from 'zod';

/**
 * Input schema for upload_transcript tool
 */
const UploadTranscriptSchema = z.object({
  type: z.enum(['agent', 'master'], {
    description: 'Transcript type: "agent" for spawned agents, "master" for orchestrator sessions',
  }),
  sessionId: z.string().uuid().optional().describe('Claude session ID (optional)'),
  agentId: z
    .string()
    .regex(/^[a-f0-9]{8}$/)
    .optional()
    .describe('Agent ID (8-char hex, for agent transcripts)'),
  workflowRunId: z.string().uuid().optional().describe('Workflow run ID (optional)'),
  componentRunId: z.string().uuid().optional().describe('Component run ID (required for agent transcripts)'),
  transcriptContent: z.string().min(1).describe('Full JSONL transcript content'),
  metrics: z
    .object({
      totalTokens: z.number().int().nonnegative().describe('Total token count'),
      toolCallCount: z.number().int().nonnegative().optional().describe('Number of tool calls'),
      duration: z.number().nonnegative().optional().describe('Execution duration in milliseconds'),
      agentSpawns: z.number().int().nonnegative().optional().describe('Number of spawned agents (master only)'),
      turnCount: z.number().int().nonnegative().optional().describe('ST-147: Total conversation turns'),
    })
    .optional()
    .describe('Parsed ST-27 metrics'),
});

type UploadTranscriptInput = z.infer<typeof UploadTranscriptSchema>;

/**
 * Upload transcript to database
 */
export async function handler(prisma: PrismaClient, params: any) {
  // Validate input
  const validated = UploadTranscriptSchema.parse(params);

  // Type-specific validation
  if (validated.type === 'agent' && !validated.componentRunId) {
    throw new Error('componentRunId is required for agent transcripts');
  }

  if (validated.type === 'agent' && !validated.agentId) {
    throw new Error('agentId is required for agent transcripts');
  }

  // Check for duplicate upload
  if (validated.componentRunId) {
    const existing = await prisma.transcript.findFirst({
      where: { componentRunId: validated.componentRunId },
      select: { id: true },
    });

    if (existing) {
      return {
        success: true,
        duplicate: true,
        transcriptId: existing.id,
        message: 'Transcript already uploaded for this component run',
      };
    }
  }

  if (validated.sessionId && validated.type === 'master') {
    const existing = await prisma.transcript.findFirst({
      where: {
        sessionId: validated.sessionId,
        type: 'MASTER',
      },
      select: { id: true },
    });

    if (existing) {
      return {
        success: true,
        duplicate: true,
        transcriptId: existing.id,
        message: 'Transcript already uploaded for this master session',
      };
    }
  }

  // Calculate content size
  const contentSize = Buffer.byteLength(validated.transcriptContent, 'utf8');

  // Create transcript record
  const transcript = await prisma.transcript.create({
    data: {
      type: validated.type === 'agent' ? 'AGENT' : 'MASTER',
      sessionId: validated.sessionId,
      agentId: validated.agentId,
      workflowRunId: validated.workflowRunId,
      componentRunId: validated.componentRunId,
      content: validated.transcriptContent,
      contentSize,
      metrics: validated.metrics as any,
    },
  });

  // Update ComponentRun status if agent transcript
  if (validated.componentRunId) {
    await prisma.componentRun.update({
      where: { id: validated.componentRunId },
      data: {
        status: 'completed',
      },
    });
  }

  return {
    success: true,
    duplicate: false,
    transcriptId: transcript.id,
    uploadedAt: transcript.uploadedAt,
    contentSize: transcript.contentSize,
  };
};

/**
 * Tool definition for MCP registration
 */
export const definition = {
  name: 'upload_transcript',
  description: `Upload completed transcript to KVM storage (ST-170).

Called by the laptop TranscriptWatcher daemon when an agent or master session completes execution.

Features:
- Stores full JSONL transcript content in database
- Records ST-27 metrics (tokens, tools, duration)
- Updates ComponentRun status to 'completed'
- Prevents duplicate uploads
- Supports both agent and master session transcripts`,
  inputSchema: UploadTranscriptSchema,
};
