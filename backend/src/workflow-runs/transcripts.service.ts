/**
 * ST-173: Transcripts Service
 *
 * Business logic for transcript management, following service layer architecture.
 *
 * Responsibilities:
 * - Upload agent transcripts from laptop to database
 * - Upload master transcripts when workflow completes
 * - Query transcripts (grouped by master/agent)
 * - Apply security validations (redaction, quotas)
 *
 * SECURITY REQUIREMENTS (from SECURITY_REVIEW):
 * - Quota enforcement: 10MB per run, 100MB per project
 * - Sensitive data redaction: API keys, JWTs, emails
 * - Never block workflow completion on upload failure
 */

import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { RemoteRunner } from '../mcp/utils/remote-runner';
import { PrismaService } from '../prisma/prisma.service';
import {
  TranscriptListResponseDto,
  MasterTranscriptSummaryDto,
  AgentTranscriptSummaryDto,
  TranscriptDetailResponseDto,
} from './dto/transcript.dto';

// Quota constants (from SECURITY_REVIEW)
const MAX_PER_RUN_SIZE = 10 * 1024 * 1024; // 10MB per workflow run
const MAX_PER_PROJECT_SIZE = 100 * 1024 * 1024; // 100MB per project
const CONTENT_PREVIEW_LENGTH = 500; // Characters for preview

// Redaction patterns (from SECURITY_REVIEW)
const REDACTION_PATTERNS = {
  // API Keys (OpenAI, Anthropic, etc.)
  OPENAI_KEY: /sk-[A-Za-z0-9]{32,}/g,
  ANTHROPIC_KEY: /sk-ant-[A-Za-z0-9-_]{32,}/g,
  GENERIC_KEY: /[A-Za-z0-9_-]{32,}(?=["'\s,}])/g, // Conservative pattern

  // AWS Keys
  AWS_ACCESS_KEY: /AKIA[0-9A-Z]{16}/g,
  AWS_SECRET_KEY: /(?:aws_secret_access_key|secret_access_key)\s*[:=]\s*['"]?[A-Za-z0-9+/=]{40}['"]?/gi,

  // JWTs
  JWT: /eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,

  // Email addresses
  EMAIL: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,

  // Generic secrets
  PASSWORD: /(?:password|passwd|pwd)\s*[:=]\s*['"][^'"]{4,}['"]/gi,
  SECRET: /(?:secret|token|api_key|apikey)\s*[:=]\s*['"][^'"]{4,}['"]/gi,
};

interface ReadFileResult {
  content: string;
  size: number;
  path: string;
}

@Injectable()
export class TranscriptsService {
  private readonly logger = new Logger(TranscriptsService.name);
  private readonly remoteRunner: RemoteRunner;

  constructor(private prisma: PrismaService) {
    this.remoteRunner = new RemoteRunner();
  }

  /**
   * Upload an agent transcript from laptop to database
   *
   * Called by record_agent_complete after agent finishes execution.
   * Never throws - returns null on failure to avoid blocking workflow.
   *
   * @param workflowRunId - Workflow run UUID
   * @param componentId - Component UUID that created the transcript
   * @param transcriptPath - Path to transcript file on laptop
   * @param componentRunId - Optional ComponentRun ID for metadata update
   */
  async uploadAgentTranscript(
    workflowRunId: string,
    componentId: string,
    transcriptPath: string,
    componentRunId?: string,
  ): Promise<{ id: string } | null> {
    try {
      // 1. Get workflow run and project info
      const workflowRun = await this.prisma.workflowRun.findUnique({
        where: { id: workflowRunId },
        select: { id: true, projectId: true, workflowId: true },
      });

      if (!workflowRun) {
        this.logger.warn(`Workflow run not found: ${workflowRunId}`);
        return null;
      }

      // 2. Find TRANSCRIPT artifact definition
      const transcriptDef = await this.prisma.artifactDefinition.findFirst({
        where: {
          workflowId: workflowRun.workflowId,
          key: 'TRANSCRIPT',
        },
      });

      if (!transcriptDef) {
        throw new BadRequestException('TRANSCRIPT artifact definition not found for workflow');
      }

      // 3. Check quotas BEFORE reading file
      await this.validateQuota(workflowRunId, workflowRun.projectId, 0);

      // 4. Read file from laptop via RemoteRunner
      const result = await this.remoteRunner.execute<ReadFileResult>('read-file', [
        `--path=${transcriptPath}`,
        `--max-size=${MAX_PER_RUN_SIZE}`,
      ]);

      if (!result.executed || !result.success || !result.result) {
        this.logger.warn('Failed to read transcript from laptop', {
          error: result.error,
          transcriptPath,
        });
        await this.recordUploadFailure(componentRunId, result.error || 'Remote execution failed');
        return null;
      }

      const { content, size } = result.result;

      // 5. Validate quotas with actual size
      await this.validateQuota(workflowRunId, workflowRun.projectId, size);

      // 6. Redact sensitive data
      const { redactedContent } = this.redactSensitiveData(content);

      // 7. Create artifact
      const artifact = await this.prisma.artifact.create({
        data: {
          definitionId: transcriptDef.id,
          workflowRunId,
          content: redactedContent,
          contentType: 'application/x-jsonlines',
          contentPreview: redactedContent.slice(0, CONTENT_PREVIEW_LENGTH),
          size,
          version: 1,
          createdByComponentId: componentId, // Non-null = agent transcript
        },
      });

      // 8. Update ComponentRun metadata if provided
      if (componentRunId) {
        await this.prisma.componentRun.update({
          where: { id: componentRunId },
          data: {
            metadata: {
              transcriptArtifactId: artifact.id,
            },
          },
        });
      }

      this.logger.log(`Uploaded agent transcript: ${artifact.id} (${size} bytes)`);
      return { id: artifact.id };
    } catch (error) {
      this.logger.warn('Failed to upload agent transcript', {
        error: error instanceof Error ? error.message : String(error),
        workflowRunId,
        componentId,
        transcriptPath,
      });

      // Record failure in ComponentRun metadata
      await this.recordUploadFailure(
        componentRunId,
        error instanceof Error ? error.message : String(error),
      );

      // Never throw - return null to avoid blocking workflow
      return null;
    }
  }

  /**
   * Upload all master transcripts when workflow completes
   *
   * Called by update_team_status when status='completed'.
   * Continues on individual upload failure.
   *
   * @param workflowRunId - Workflow run UUID
   */
  async uploadMasterTranscripts(workflowRunId: string): Promise<string[]> {
    const uploadedArtifactIds: string[] = [];

    try {
      // 1. Get workflow run with transcript paths
      const workflowRun = await this.prisma.workflowRun.findUnique({
        where: { id: workflowRunId },
        select: {
          id: true,
          projectId: true,
          workflowId: true,
          masterTranscriptPaths: true,
          metadata: true,
        },
      });

      if (!workflowRun) {
        this.logger.warn(`Workflow run not found: ${workflowRunId}`);
        return [];
      }

      const transcriptPaths = workflowRun.masterTranscriptPaths || [];
      if (transcriptPaths.length === 0) {
        this.logger.log('No master transcripts to upload');
        return [];
      }

      // 2. Find TRANSCRIPT artifact definition
      const transcriptDef = await this.prisma.artifactDefinition.findFirst({
        where: {
          workflowId: workflowRun.workflowId,
          key: 'TRANSCRIPT',
        },
      });

      if (!transcriptDef) {
        this.logger.warn('TRANSCRIPT artifact definition not found');
        return [];
      }

      // 3. Upload each transcript
      for (const transcriptPath of transcriptPaths) {
        try {
          // Check quotas
          await this.validateQuota(workflowRunId, workflowRun.projectId, 0);

          // Read file from laptop
          const result = await this.remoteRunner.execute<ReadFileResult>('read-file', [
            `--path=${transcriptPath}`,
            `--max-size=${MAX_PER_RUN_SIZE}`,
          ]);

          if (!result.executed || !result.success || !result.result) {
            this.logger.warn('Failed to read master transcript', {
              error: result.error,
              transcriptPath,
            });
            continue;
          }

          const { content, size } = result.result;

          // Validate quota with actual size
          await this.validateQuota(workflowRunId, workflowRun.projectId, size);

          // Redact sensitive data
          const { redactedContent } = this.redactSensitiveData(content);

          // Create artifact (null componentId = master transcript)
          const artifact = await this.prisma.artifact.create({
            data: {
              definitionId: transcriptDef.id,
              workflowRunId,
              content: redactedContent,
              contentType: 'application/x-jsonlines',
              contentPreview: redactedContent.slice(0, CONTENT_PREVIEW_LENGTH),
              size,
              version: 1,
              createdByComponentId: null, // Null = master transcript
            },
          });

          uploadedArtifactIds.push(artifact.id);
          this.logger.log(`Uploaded master transcript: ${artifact.id} (${size} bytes)`);
        } catch (error) {
          this.logger.warn('Failed to upload master transcript', {
            error: error instanceof Error ? error.message : String(error),
            transcriptPath,
          });
          // Continue with next transcript
        }
      }

      // 4. Store artifact IDs in WorkflowRun metadata
      if (uploadedArtifactIds.length > 0) {
        const existingMetadata = (workflowRun.metadata as Record<string, unknown>) || {};
        await this.prisma.workflowRun.update({
          where: { id: workflowRunId },
          data: {
            metadata: {
              ...existingMetadata,
              masterTranscriptArtifactIds: uploadedArtifactIds,
            },
          },
        });
      }

      return uploadedArtifactIds;
    } catch (error) {
      this.logger.error('Failed to upload master transcripts', {
        error: error instanceof Error ? error.message : String(error),
        workflowRunId,
      });
      return uploadedArtifactIds;
    }
  }

  /**
   * Get all transcripts for a workflow run, grouped by master/agent
   */
  async getTranscriptsForRun(runId: string): Promise<TranscriptListResponseDto> {
    // Query all transcript artifacts for this run
    const artifacts = await this.prisma.artifact.findMany({
      where: {
        workflowRunId: runId,
        definition: {
          key: 'TRANSCRIPT',
        },
      },
      include: {
        createdByComponent: {
          select: { name: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    // Group by master vs agent (createdByComponentId null = master)
    const master: MasterTranscriptSummaryDto[] = [];
    const agents: AgentTranscriptSummaryDto[] = [];

    let masterIndex = 0;
    for (const artifact of artifacts) {
      if (artifact.createdByComponentId === null) {
        // Master transcript
        master.push({
          artifactId: artifact.id,
          contentPreview: artifact.contentPreview || '',
          size: artifact.size,
          createdAt: artifact.createdAt,
          index: masterIndex++,
        });
      } else {
        // Agent transcript
        agents.push({
          artifactId: artifact.id,
          componentId: artifact.createdByComponentId,
          componentName: artifact.createdByComponent?.name || 'Unknown',
          contentPreview: artifact.contentPreview || '',
          size: artifact.size,
          createdAt: artifact.createdAt,
        });
      }
    }

    return { master, agents };
  }

  /**
   * Get a specific transcript by artifact ID
   */
  async getTranscriptById(
    artifactId: string,
    includeContent: boolean = true,
  ): Promise<TranscriptDetailResponseDto> {
    const artifact = await this.prisma.artifact.findUnique({
      where: { id: artifactId },
      include: {
        createdByComponent: {
          select: { name: true },
        },
      },
    });

    if (!artifact) {
      throw new NotFoundException(`Transcript not found: ${artifactId}`);
    }

    const transcriptType = artifact.createdByComponentId === null ? 'master' : 'agent';

    return {
      id: artifact.id,
      content: includeContent ? artifact.content : undefined,
      contentPreview: artifact.contentPreview || undefined,
      contentType: artifact.contentType,
      size: artifact.size,
      transcriptType,
      componentId: artifact.createdByComponentId || undefined,
      componentName: artifact.createdByComponent?.name,
      createdAt: artifact.createdAt,
    };
  }

  /**
   * Validate quota limits before upload
   *
   * @throws BadRequestException if quota exceeded
   */
  async validateQuota(
    workflowRunId: string,
    projectId: string,
    newSize: number,
  ): Promise<void> {
    // 1. Check per-run quota
    const runTotal = await this.prisma.artifact.aggregate({
      where: {
        workflowRunId,
        definition: { key: 'TRANSCRIPT' },
      },
      _sum: { size: true },
    });

    const runSize = (runTotal._sum.size || 0) + newSize;
    if (runSize > MAX_PER_RUN_SIZE) {
      throw new BadRequestException(
        `Workflow run transcript quota exceeded (10MB). Current: ${runSize} bytes`,
      );
    }

    // 2. Check per-project quota
    const projectTotal = await this.prisma.artifact.aggregate({
      where: {
        workflowRun: { projectId },
        definition: { key: 'TRANSCRIPT' },
      },
      _sum: { size: true },
    });

    const projectSize = (projectTotal._sum.size || 0) + newSize;
    if (projectSize > MAX_PER_PROJECT_SIZE) {
      throw new BadRequestException(
        `Project transcript quota exceeded (100MB). Current: ${projectSize} bytes`,
      );
    }
  }

  /**
   * Redact sensitive data from transcript content
   *
   * @returns Object with redacted content and flag indicating if redaction occurred
   */
  redactSensitiveData(content: string): { redactedContent: string; redactionApplied: boolean } {
    let redactedContent = content;
    let redactionApplied = false;

    // Apply each redaction pattern
    for (const [key, pattern] of Object.entries(REDACTION_PATTERNS)) {
      const matches = content.match(pattern);
      if (matches && matches.length > 0) {
        redactionApplied = true;
        const replacement = key.includes('EMAIL')
          ? '[REDACTED-EMAIL]'
          : key.includes('JWT')
            ? '[REDACTED-JWT]'
            : '[REDACTED-KEY]';
        redactedContent = redactedContent.replace(pattern, replacement);
      }
    }

    return { redactedContent, redactionApplied };
  }

  /**
   * Record upload failure in ComponentRun metadata
   */
  private async recordUploadFailure(
    componentRunId: string | undefined,
    errorMessage: string,
  ): Promise<void> {
    if (!componentRunId) return;

    try {
      const componentRun = await this.prisma.componentRun.findUnique({
        where: { id: componentRunId },
        select: { metadata: true },
      });

      const existingMetadata = (componentRun?.metadata as Record<string, unknown>) || {};
      await this.prisma.componentRun.update({
        where: { id: componentRunId },
        data: {
          metadata: {
            ...existingMetadata,
            transcriptUploadFailed: true,
            transcriptUploadError: errorMessage,
          },
        },
      });
    } catch {
      // Ignore errors updating metadata
    }
  }
}
