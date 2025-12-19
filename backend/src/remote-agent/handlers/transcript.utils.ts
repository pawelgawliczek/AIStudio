import * as jwt from 'jsonwebtoken';
import { Server } from 'socket.io';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * ST-168: Upload agent transcript to Artifact table
 * ST-284: Extracted from transcript.handler to reduce file size
 */
export async function uploadAgentTranscript(
  prisma: PrismaService,
  server: Server,
  workflowRunId: string,
  componentRunId: string,
  transcriptPath: string,
  agentId: string,
): Promise<void> {
  console.log(
    `ST-168: Uploading transcript for componentRun ${componentRunId} from ${transcriptPath}`,
  );

  const componentRun = await prisma.componentRun.findUnique({
    where: { id: componentRunId },
    include: { component: true },
  });

  if (!componentRun) {
    throw new Error(`ComponentRun ${componentRunId} not found`);
  }

  const workflowRun = await prisma.workflowRun.findUnique({
    where: { id: workflowRunId },
  });

  if (!workflowRun) {
    throw new Error(`WorkflowRun ${workflowRunId} not found`);
  }

  // Create remote job to read transcript file
  const readJob = await prisma.remoteJob.create({
    data: {
      script: 'read-file',
      params: { path: transcriptPath },
      status: 'pending',
      agentId,
      requestedBy: 'transcript-upload',
      jobType: 'file-read',
    },
  });

  const agent = await prisma.remoteAgent.findUnique({
    where: { id: agentId },
  });

  if (!agent || agent.status !== 'online') {
    throw new Error(`Agent ${agentId} is not online`);
  }

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET not configured');
  }

  const jobToken = jwt.sign(
    { jobId: readJob.id, agentId, type: 'job-execution' },
    secret,
    { expiresIn: '65m' }
  );

  const agentSocket = await findAgentSocket(server, agentId);
  if (!agentSocket) {
    throw new Error(`Agent ${agentId} socket not found`);
  }

  agentSocket.emit('agent:job', {
    id: readJob.id,
    script: 'read-file',
    params: { path: transcriptPath },
    jobToken,
    timestamp: Date.now(),
  });

  const timeout = 30000;
  const result = await waitForJobCompletion(prisma, readJob.id, timeout);

  if (!result.success) {
    throw new Error(`Failed to read transcript: ${result.error || 'Unknown error'}`);
  }

  const resultData = result.result as Record<string, unknown> | undefined;
  const transcriptContent = resultData?.content as string | undefined;
  if (!transcriptContent) {
    throw new Error('Transcript content is empty');
  }

  const transcriptDef = await prisma.artifactDefinition.findFirst({
    where: {
      workflowId: workflowRun.workflowId,
      key: 'TRANSCRIPT',
    },
  });

  if (!transcriptDef) {
    console.warn(
      `No TRANSCRIPT artifact definition found for workflow ${workflowRun.workflowId}. Skipping upload.`,
    );
    return;
  }

  if (!workflowRun.storyId) {
    console.warn('WorkflowRun has no storyId, skipping transcript upload');
    return;
  }

  const artifact = await prisma.artifact.create({
    data: {
      definitionId: transcriptDef.id,
      storyId: workflowRun.storyId,
      workflowRunId,
      lastUpdatedRunId: workflowRunId,
      content: transcriptContent,
      contentType: 'application/x-jsonlines',
      contentPreview: transcriptContent.substring(0, 500),
      size: Buffer.byteLength(transcriptContent, 'utf8'),
      currentVersion: 1,
      createdByComponentId: componentRun.componentId,
    },
  });

  await prisma.componentRun.update({
    where: { id: componentRunId },
    data: {
      metadata: {
        ...(componentRun.metadata as Record<string, unknown> || {}),
        transcriptArtifactId: artifact.id,
        transcriptPath,
      },
    },
  });

  console.log(
    `ST-168: Transcript uploaded successfully. Artifact ID: ${artifact.id}, Size: ${artifact.size} bytes`,
  );
}

/**
 * Wait for remote job completion
 */
async function waitForJobCompletion(
  prisma: PrismaService,
  jobId: string,
  timeoutMs: number,
): Promise<{ success: boolean; result?: unknown; error?: string }> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    const job = await prisma.remoteJob.findUnique({
      where: { id: jobId },
    });

    if (!job) {
      return { success: false, error: 'Job not found' };
    }

    if (job.status === 'completed') {
      return { success: true, result: job.result };
    }

    if (job.status === 'failed') {
      return { success: false, error: job.error || 'Job failed' };
    }

    await new Promise(resolve => setTimeout(resolve, 500));
  }

  return { success: false, error: 'Timeout waiting for job completion' };
}

/**
 * Find agent socket by agentId
 */
async function findAgentSocket(server: Server, agentId: string) {
  const sockets = await server.fetchSockets();
  for (const socket of sockets) {
    if (socket.data.agentId === agentId) {
      return socket;
    }
  }
  return null;
}
