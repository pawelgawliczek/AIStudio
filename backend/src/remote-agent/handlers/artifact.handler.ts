import * as crypto from 'crypto';
import { Injectable, Logger } from '@nestjs/common';
import { Server } from 'socket.io';
import { getErrorMessage, getErrorStack } from '../../common';
import { PrismaService } from '../../prisma/prisma.service';
import { ArtifactUploadItem, ItemAckPayload } from '../types';

/**
 * ST-326: Artifact Upload Handler
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
   * ST-326: Set frontend server for broadcasting to frontend clients
   * Called by RemoteAgentGateway after construction
   */
  setFrontendServer(server: Server): void {
    this.frontendServer = server;
    this.logger.log('[ST-326] Frontend server reference set for artifact broadcasting');
  }

  /**
   * ST-326: Handle individual artifact upload with ACK callback
   * Used by artifact:upload handler to process each item
   */
  async handleArtifactUpload(
    item: ArtifactUploadItem,
    callback: (ack: ItemAckPayload) => void,
  ): Promise<void> {
    const { queueId, storyKey, artifactKey, content, contentType, timestamp } = item;

    try {
      // Find the story by key
      const story = await this.prisma.story.findFirst({
        where: { key: storyKey },
        include: { project: true },
      });

      if (!story) {
        this.logger.error(`[ST-326] Story ${storyKey} not found`);
        callback({ success: false, id: queueId, error: 'Story not found' });
        return;
      }

      // Find the artifact definition by key
      const artifactDefinition = await this.prisma.artifactDefinition.findFirst({
        where: {
          key: artifactKey.toUpperCase(),
          workflow: { projectId: story.projectId },
        },
      });

      if (!artifactDefinition) {
        this.logger.error(`[ST-326] Artifact definition ${artifactKey} not found for project ${story.projectId}`);
        callback({ success: false, id: queueId, error: 'Artifact definition not found' });
        return;
      }

      // Calculate content hash for duplicate detection
      const contentHash = this.calculateSHA256(content);

      // Check for existing artifact with same content
      const existingArtifact = await this.prisma.artifact.findFirst({
        where: {
          definitionId: artifactDefinition.id,
          storyId: story.id,
          contentHash,
        },
      });

      if (existingArtifact) {
        this.logger.log(`[ST-326] Duplicate artifact content detected for queueId ${queueId}`);
        callback({ success: true, id: queueId, isDuplicate: true });
        return;
      }

      // Check if artifact exists with different content (update case)
      const existingByDefinition = await this.prisma.artifact.findFirst({
        where: {
          definitionId: artifactDefinition.id,
          storyId: story.id,
        },
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
          `[ST-326] Artifact updated. Queue ID: ${queueId}, Artifact ID: ${artifact.id}, Version: ${artifact.currentVersion}`,
        );
      } else {
        // Create new artifact
        artifact = await this.prisma.artifact.create({
          data: {
            definitionId: artifactDefinition.id,
            storyId: story.id,
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
          `[ST-326] Artifact created. Queue ID: ${queueId}, Artifact ID: ${artifact.id}, Size: ${artifact.size} bytes`,
        );
      }

      // Broadcast artifact:updated to frontend
      if (this.frontendServer) {
        this.frontendServer.emit('artifact:updated', {
          artifactId: artifact.id,
          storyId: story.id,
          storyKey,
          artifactKey,
          version: artifact.currentVersion,
          timestamp: artifact.updatedAt,
        });
      }

      // Send success ACK
      callback({ success: true, id: queueId });
    } catch (error) {
      this.logger.error(`[ST-326] Failed to upload artifact for queueId ${queueId}: ${getErrorMessage(error)}`, getErrorStack(error));
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
