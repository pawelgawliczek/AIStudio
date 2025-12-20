import * as crypto from 'crypto';
import { Injectable, Logger } from '@nestjs/common';
import { Server } from 'socket.io';
import { getErrorMessage, getErrorStack } from '../../common';
import { PrismaService } from '../../prisma/prisma.service';
import { ArtifactUploadItem, ItemAckPayload } from '../types';

/**
 * ST-326: Artifact Upload Handler
 * ST-362: Added epic-level artifact support
 * Handles artifact uploads from laptop agent with duplicate detection
 */
@Injectable()
export class ArtifactHandler {
  private readonly logger = new Logger(ArtifactHandler.name);

  // ST-326: Frontend server for broadcasting to frontend clients (set after construction)
  private frontendServer: Server | null = null;

  constructor(
    private readonly prisma: PrismaService,
  ) {}

  /**
   * ST-362: Resolve project ID from story or epic
   */
  private async resolveProjectId(storyKey?: string, epicKey?: string): Promise<string | null> {
    if (storyKey) {
      const story = await this.prisma.story.findFirst({
        where: { key: storyKey },
        select: { projectId: true },
      });
      return story?.projectId ?? null;
    }
    if (epicKey) {
      const epic = await this.prisma.epic.findFirst({
        where: { key: epicKey },
        select: { projectId: true },
      });
      return epic?.projectId ?? null;
    }
    return null;
  }

  /**
   * ST-326: Set frontend server for broadcasting to frontend clients
   * Called by RemoteAgentGateway after construction
   */
  setFrontendServer(server: Server): void {
    this.frontendServer = server;
    this.logger.log('[ST-326] Frontend server reference set for artifact broadcasting');
  }

  /**
   * ST-326: Handle individual artifact upload with ACK callback
   * ST-362: Added epic-level artifact support
   * Used by artifact:upload handler to process each item
   */
  async handleArtifactUpload(
    item: ArtifactUploadItem,
    callback: (ack: ItemAckPayload) => void,
  ): Promise<void> {
    const { queueId, storyKey, epicKey, artifactKey, content, contentType, timestamp } = item;

    try {
      // ST-362: Determine if this is epic-level or story-level artifact
      const isEpicLevel = epicKey && !storyKey;
      const logPrefix = isEpicLevel ? `[ST-362] Epic ${epicKey}` : `[ST-326] Story ${storyKey}`;

      // Validate we have either story or epic key
      if (!storyKey && !epicKey) {
        this.logger.error('[ST-362] Neither storyKey nor epicKey provided');
        callback({ success: false, id: queueId, error: 'Neither storyKey nor epicKey provided' });
        return;
      }

      // Find the story or epic by key
      let storyId: string | null = null;
      let epicId: string | null = null;
      let projectId: string | null = null;

      if (storyKey) {
        const story = await this.prisma.story.findFirst({
          where: { key: storyKey },
          select: { id: true, projectId: true },
        });

        if (!story) {
          this.logger.error(`${logPrefix}: Story not found`);
          callback({ success: false, id: queueId, error: 'Story not found' });
          return;
        }
        storyId = story.id;
        projectId = story.projectId;
      } else if (epicKey) {
        const epic = await this.prisma.epic.findFirst({
          where: { key: epicKey },
          select: { id: true, projectId: true },
        });

        if (!epic) {
          this.logger.error(`${logPrefix}: Epic not found`);
          callback({ success: false, id: queueId, error: 'Epic not found' });
          return;
        }
        epicId = epic.id;
        projectId = epic.projectId;
      }

      // Validate artifact key format
      if (!/^[A-Z0-9_-]+$/i.test(artifactKey)) {
        this.logger.error(`${logPrefix}: Invalid artifact key format: ${artifactKey}`);
        callback({ success: false, id: queueId, error: `Invalid artifact key format: ${artifactKey}` });
        return;
      }

      // Find the artifact definition by key
      const artifactDefinition = await this.prisma.artifactDefinition.findFirst({
        where: {
          key: artifactKey.toUpperCase(),
          workflow: { projectId: projectId! },
        },
      });

      if (!artifactDefinition) {
        this.logger.error(`${logPrefix}: Artifact definition ${artifactKey} not found for project ${projectId}`);
        callback({ success: false, id: queueId, error: 'Artifact definition not found' });
        return;
      }

      // Calculate content hash for duplicate detection
      const contentHash = this.calculateSHA256(content);

      // ST-362: Build where clause based on story or epic
      const whereClause = storyId
        ? { definitionId: artifactDefinition.id, storyId }
        : { definitionId: artifactDefinition.id, epicId };

      // Check for existing artifact with same content
      const existingArtifact = await this.prisma.artifact.findFirst({
        where: { ...whereClause, contentHash },
      });

      if (existingArtifact) {
        this.logger.log(`${logPrefix}: Duplicate artifact content detected for queueId ${queueId}`);
        callback({ success: true, id: queueId, isDuplicate: true });
        return;
      }

      // Check if artifact exists with different content (update case)
      const existingByDefinition = await this.prisma.artifact.findFirst({
        where: whereClause,
        orderBy: { currentVersion: 'desc' },
      });

      let artifact;

      if (existingByDefinition) {
        // Update existing artifact with new version
        artifact = await this.prisma.artifact.update({
          where: { id: existingByDefinition.id },
          data: {
            content,
            contentHash,
            contentType,
            contentPreview: content.substring(0, 500),
            size: Buffer.byteLength(content, 'utf8'),
            currentVersion: existingByDefinition.currentVersion + 1,
            updatedAt: new Date(timestamp),
          },
        });

        this.logger.log(
          `${logPrefix}: Artifact updated. Queue ID: ${queueId}, Artifact ID: ${artifact.id}, Version: ${artifact.currentVersion}`,
        );
      } else {
        // Create new artifact (ST-362: support both storyId and epicId)
        artifact = await this.prisma.artifact.create({
          data: {
            definitionId: artifactDefinition.id,
            storyId,  // null for epic-level artifacts
            epicId,   // null for story-level artifacts
            content,
            contentHash,
            contentType,
            contentPreview: content.substring(0, 500),
            size: Buffer.byteLength(content, 'utf8'),
            currentVersion: 1,
            createdAt: new Date(timestamp),
            updatedAt: new Date(timestamp),
          },
        });

        this.logger.log(
          `${logPrefix}: Artifact created. Queue ID: ${queueId}, Artifact ID: ${artifact.id}, Size: ${artifact.size} bytes`,
        );
      }

      // Broadcast artifact:updated to frontend
      if (this.frontendServer) {
        this.frontendServer.emit('artifact:updated', {
          artifactId: artifact.id,
          storyId,
          epicId,
          storyKey,
          epicKey,
          artifactKey,
          version: artifact.currentVersion,
          timestamp: artifact.updatedAt,
        });
      }

      // Send success ACK
      callback({ success: true, id: queueId });
    } catch (error) {
      this.logger.error(`[ST-362] Failed to upload artifact for queueId ${queueId}: ${getErrorMessage(error)}`, getErrorStack(error));
      callback({ success: false, id: queueId, error: getErrorMessage(error) });
    }
  }

  /**
   * ST-326: Calculate SHA256 hash of content for duplicate detection
   */
  private calculateSHA256(content: string): string {
    return crypto.createHash('sha256').update(content, 'utf8').digest('hex');
  }
}
