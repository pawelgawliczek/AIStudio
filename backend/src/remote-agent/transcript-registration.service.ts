/**
 * ST-170: Transcript Registration Service
 *
 * Handles automatic transcript registration from laptop agent:
 * 1. Receives transcript detection events via WebSocket
 * 2. Parses transcript metadata (sessionId, agentId)
 * 3. Matches to active workflows or stores in unassigned_transcripts table
 * 4. record_agent_complete reads from unassigned_transcripts for metrics
 */

import { createReadStream } from 'fs';
import * as fs from 'fs/promises';
import * as readline from 'readline';
import { Injectable, Logger } from '@nestjs/common';
import { getErrorMessage, getErrorStack } from '../common';
import { PrismaService } from '../prisma/prisma.service';

interface TranscriptDetectedPayload {
  agentId: string | null;
  transcriptPath: string;
  projectPath: string;
  metadata?: Record<string, unknown>; // Parsed first line from laptop agent
}

interface TranscriptMetadata {
  sessionId?: string;
  agentId?: string;
  type: string;
  cwd?: string;
}

@Injectable()
export class TranscriptRegistrationService {
  private readonly logger = new Logger(TranscriptRegistrationService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Handle transcript detected event from laptop agent
   */
  async handleTranscriptDetected(payload: TranscriptDetectedPayload): Promise<void> {
    this.logger.log(`Transcript detected: ${payload.agentId || 'master'} at ${payload.transcriptPath}`);

    try {
      // Use metadata provided by laptop agent (already parsed from first line)
      let metadata: TranscriptMetadata;

      if (payload.metadata) {
        // Laptop agent already parsed the first line and sent metadata
        metadata = {
          sessionId: payload.metadata.sessionId as string | undefined,
          agentId: (payload.metadata.agentId as string | undefined) || payload.agentId || undefined,
          type: (payload.metadata.type as string) || 'unknown',
          cwd: payload.metadata.cwd as string | undefined,
        };
        this.logger.log(`Using metadata from laptop agent: sessionId=${metadata.sessionId}`);
      } else {
        // Fallback: try to parse locally (will fail with ENOENT for laptop files)
        const parsedMetadata = await this.parseTranscriptMetadata(payload.transcriptPath);

        if (!parsedMetadata) {
          return;
        }
        metadata = parsedMetadata;
      }

      // Try to match to active workflow
      const match = await this.matchToWorkflow(metadata);

      if (match) {
        this.logger.log(`Matched transcript to workflow run ${match.runId}`);

        // Register transcript for the matched workflow
        await this.registerForLiveStreaming(match.runId, match.componentId, payload);
      } else {
        this.logger.log(`No active workflow found, storing as unassigned`);

        // Store as unassigned for later matching
        await this.storeUnassignedTranscript(metadata, payload);
      }
    } catch (error) {
      this.logger.error(`Failed to handle transcript detection: ${getErrorMessage(error)}`, getErrorStack(error));
    }
  }

  /**
   * Parse first line of transcript to extract metadata
   */
  private async parseTranscriptMetadata(transcriptPath: string): Promise<TranscriptMetadata | null> {
    try {
      const firstLine = await this.readFirstLine(transcriptPath);
      const parsed = JSON.parse(firstLine);

      return {
        sessionId: parsed.sessionId,
        agentId: parsed.agentId,
        type: parsed.type,
        cwd: parsed.cwd,
      };
    } catch (error) {
      this.logger.warn(`Failed to parse transcript metadata: ${getErrorMessage(error)}`);
      return null;
    }
  }

  /**
   * Read first line of file
   */
  private async readFirstLine(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const stream = createReadStream(filePath, { encoding: 'utf8' });
      const reader = readline.createInterface({ input: stream });

      reader.on('line', (line) => {
        reader.close();
        stream.destroy();
        resolve(line);
      });

      reader.on('error', reject);
      stream.on('error', reject);
    });
  }

  /**
   * Match transcript to active workflow run by sessionId
   */
  private async matchToWorkflow(metadata: TranscriptMetadata): Promise<{ runId: string; componentId?: string } | null> {
    if (!metadata.sessionId) {
      return null;
    }

    // Search for WorkflowRun with matching sessionId in metadata
    const runs = await this.prisma.workflowRun.findMany({
      where: {
        status: { in: ['running', 'paused'] },
      },
      include: {
        componentRuns: {
          where: {
            status: 'running',
          },
        },
      },
    });

    for (const run of runs) {
      // Check if metadata contains transcript tracking with matching sessionId
      const runMetadata = run.metadata as Record<string, unknown> | null;
      const transcriptTracking = runMetadata?._transcriptTracking as { sessionId?: string } | undefined;
      if (transcriptTracking?.sessionId === metadata.sessionId) {
        // Find pending component (running but no transcript yet)
        const pendingComponent = run.componentRuns.find(
          (cr) => cr.status === 'running' && !cr.transcriptPath
        );

        return {
          runId: run.id,
          componentId: pendingComponent?.componentId,
        };
      }
    }

    return null;
  }

  /**
   * Register transcript in spawnedAgentTranscripts for live streaming
   */
  private async registerForLiveStreaming(
    runId: string,
    componentId: string | undefined,
    payload: TranscriptDetectedPayload
  ): Promise<void> {
    // Update WorkflowRun with transcript info
    const run = await this.prisma.workflowRun.findUnique({
      where: { id: runId },
    });

    if (!run) {
      this.logger.warn(`WorkflowRun not found: ${runId}`);
      return;
    }

    // Add to spawnedAgentTranscripts array (with deduplication)
    const metadata = (run.metadata as Record<string, unknown>) || {};
    const spawnedAgentTranscripts = (metadata.spawnedAgentTranscripts as Array<{ componentId?: string; agentId: string | null; transcriptPath: string; spawnedAt: string }>) || [];

    // ST-249: Deduplicate by agentId AND transcriptPath to prevent multiple registrations
    const alreadyRegistered = spawnedAgentTranscripts.some(
      (t) => t.agentId === payload.agentId && t.transcriptPath === payload.transcriptPath
    );

    if (alreadyRegistered) {
      this.logger.log(`Transcript already registered, skipping: ${payload.agentId}`);
      return;
    }

    spawnedAgentTranscripts.push({
      componentId: componentId || undefined,
      agentId: payload.agentId,
      transcriptPath: payload.transcriptPath,
      spawnedAt: new Date().toISOString(),
    });

    await this.prisma.workflowRun.update({
      where: { id: runId },
      data: {
        metadata: {
          ...metadata,
          spawnedAgentTranscripts,
        },
      },
    });

    this.logger.log(`Registered transcript for live streaming: ${payload.transcriptPath}`);
  }

  /**
   * Store unassigned transcript for later matching
   */
  private async storeUnassignedTranscript(
    metadata: TranscriptMetadata,
    payload: TranscriptDetectedPayload
  ): Promise<void> {
    if (!metadata.sessionId) {
      this.logger.warn(`Cannot store unassigned transcript without sessionId: ${payload.transcriptPath}`);
      return;
    }

    // Store in database for later matching
    await this.prisma.unassignedTranscript.create({
      data: {
        sessionId: metadata.sessionId,
        agentId: metadata.agentId || null,
        transcriptPath: payload.transcriptPath,
        projectPath: payload.projectPath,
        type: metadata.type,
        cwd: metadata.cwd || null,
      },
    });

    this.logger.log(`Stored unassigned transcript: ${payload.agentId || 'master'} (session: ${metadata.sessionId})`);
  }

  /**
   * Called when workflow starts - check for unassigned transcripts
   */
  async matchUnassignedTranscripts(runId: string, sessionId: string): Promise<void> {
    this.logger.log(`Checking for unassigned transcripts for session: ${sessionId}`);

    // Find all unassigned transcripts with matching sessionId
    const unassigned = await this.prisma.unassignedTranscript.findMany({
      where: {
        sessionId,
        matchedAt: null, // Not yet matched
      },
    });

    if (unassigned.length === 0) {
      this.logger.log(`No unassigned transcripts found for session: ${sessionId}`);
      return;
    }

    this.logger.log(`Found ${unassigned.length} unassigned transcript(s) for session ${sessionId}`);

    // Match all transcripts to this workflow run
    for (const transcript of unassigned) {
      await this.prisma.unassignedTranscript.update({
        where: { id: transcript.id },
        data: {
          workflowRunId: runId,
          matchedAt: new Date(),
        },
      });

      // Register for live streaming
      await this.registerForLiveStreaming(
        runId,
        undefined, // componentId unknown at this point
        {
          agentId: transcript.agentId || '',
          transcriptPath: transcript.transcriptPath,
          projectPath: transcript.projectPath,
        }
      );

      this.logger.log(`Matched unassigned transcript to workflow run: ${transcript.transcriptPath}`);
    }
  }
}
