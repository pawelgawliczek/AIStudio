import { PrismaService } from '../../prisma/prisma.service';
import { ClaudeCodeCompleteEvent, ClaudeCodeProgressEvent } from '../types';

/**
 * ST-160: Handle session_init event
 * ST-284: Extracted from claude-code.handler to reduce file size
 */
export async function handleSessionInit(
  prisma: PrismaService,
  job: any,
  data: ClaudeCodeProgressEvent,
): Promise<void> {
  const sessionId = data.payload.sessionId as string;
  if (sessionId) {
    await prisma.remoteJob.update({
      where: { id: data.jobId },
      data: {
        result: {
          ...(job.result as Record<string, unknown> || {}),
          sessionId,
        },
      },
    });
    console.log(`[ST-160] Session ID captured for job ${data.jobId}: ${sessionId}`);

    // ST-195: Update WorkflowRun metadata
    const workflowRun = await prisma.workflowRun.findUnique({
      where: { id: job.workflowRunId },
      select: { metadata: true },
    });

    if (workflowRun) {
      const existingMetadata = (workflowRun.metadata as Record<string, unknown>) || {};
      const existingTracking = (existingMetadata._transcriptTracking as Record<string, unknown>) || {};

      const updatedTracking = {
        ...existingTracking,
        sessionId,
        actualSessionId: sessionId,
      };

      await prisma.workflowRun.update({
        where: { id: job.workflowRunId },
        data: {
          metadata: {
            ...existingMetadata,
            _transcriptTracking: updatedTracking,
          },
        },
      });

      console.log(
        `[ST-195] Updated WorkflowRun ${job.workflowRunId} with actual sessionId=${sessionId}`,
      );
    }
  }
}

/**
 * ST-160: Handle question_detected event
 * ST-284: Extracted from claude-code.handler to reduce file size
 */
export async function handleQuestionDetected(
  prisma: PrismaService,
  server: any,
  job: any,
  data: ClaudeCodeProgressEvent,
): Promise<void> {
  const questionText = data.payload.questionText as string;
  const sessionId = data.payload.sessionId as string;
  const executionType = data.payload.executionType as string || 'custom';

  if (questionText && sessionId) {
    try {
      const jobParams = (job.params as Record<string, unknown>) || {};
      const stateId = (jobParams.stateId as string) || job.workflowRunId;

      const question = await prisma.agentQuestion.create({
        data: {
          workflowRunId: job.workflowRunId,
          stateId,
          componentRunId: job.componentRunId,
          sessionId,
          questionText,
          status: 'pending',
          canHandoff: executionType !== 'native_explore' && executionType !== 'native_plan',
        },
      });

      console.log(`[ST-160] Created AgentQuestion ${question.id} for job ${data.jobId}`);

      // Emit dedicated question event to frontend
      server.emit(`workflow:${job.workflowRunId}:question`, {
        questionId: question.id,
        componentRunId: job.componentRunId,
        sessionId,
        questionText,
        canHandoff: question.canHandoff,
        executionType,
        timestamp: new Date().toISOString(),
      });

      // Pause the job until question is answered
      await prisma.remoteJob.update({
        where: { id: data.jobId },
        data: { status: 'paused' },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[ST-160] Failed to create AgentQuestion: ${message}`);
    }
  }
}

/**
 * ST-195: Update WorkflowRun metadata with actual session info
 * ST-284: Extracted from claude-code.handler to reduce file size
 */
export async function updateWorkflowRunMetadata(
  prisma: PrismaService,
  workflowRunId: string,
  data: ClaudeCodeCompleteEvent,
): Promise<void> {
  const workflowRun = await prisma.workflowRun.findUnique({
    where: { id: workflowRunId },
    select: { metadata: true, masterTranscriptPaths: true },
  });

  if (workflowRun) {
    const existingMetadata = (workflowRun.metadata as Record<string, unknown>) || {};
    const existingTracking = (existingMetadata._transcriptTracking as Record<string, unknown>) || {};

    const updatedTracking = {
      ...existingTracking,
      ...(data.sessionId && { sessionId: data.sessionId }),
      ...(data.transcriptPath && { transcriptPath: data.transcriptPath }),
      actualSessionId: data.sessionId,
    };

    const existingPaths = workflowRun.masterTranscriptPaths || [];
    const updatedPaths = data.transcriptPath && !existingPaths.includes(data.transcriptPath)
      ? [...existingPaths, data.transcriptPath]
      : existingPaths;

    await prisma.workflowRun.update({
      where: { id: workflowRunId },
      data: {
        metadata: {
          ...existingMetadata,
          _transcriptTracking: updatedTracking,
        },
        masterTranscriptPaths: updatedPaths,
      },
    });

    console.log(
      `ST-195: Updated WorkflowRun ${workflowRunId} with actual sessionId=${data.sessionId}, path=${data.transcriptPath}`,
    );
  }
}
