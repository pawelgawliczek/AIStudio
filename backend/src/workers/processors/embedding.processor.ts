import { Process, Processor } from '@nestjs/bull';
import { Logger, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job } from 'bull';
import OpenAI from 'openai';
import { PrismaService } from '../../prisma/prisma.service';
import { QUEUE_NAMES } from '../constants';

/**
 * EmbeddingProcessor
 *
 * Responsibilities:
 * - Generate embeddings for use cases using OpenAI API
 * - Update vector store (pgvector) for semantic search
 * - Reindex embeddings when use cases change
 * - Support semantic search via MCP tools (UC-BA-004)
 */
@Processor(QUEUE_NAMES.EMBEDDING)
export class EmbeddingProcessor {
  private readonly logger = new Logger(EmbeddingProcessor.name);
  private openai: OpenAI;

  constructor(
    private prisma: PrismaService,
    @Inject(ConfigService) private configService: ConfigService,
  ) {
    const apiKey = this.configService?.get<string>('OPENAI_API_KEY');
    if (apiKey) {
      this.openai = new OpenAI({ apiKey });
    } else {
      this.logger.warn('OPENAI_API_KEY not configured - embeddings will be disabled');
    }
  }

  /**
   * Generate embedding for a single use case
   */
  @Process('generate-embedding')
  async generateEmbedding(job: Job<{
    useCaseId: string;
    content: string;
  }>) {
    const { useCaseId, content } = job.data;
    this.logger.log(`Generating embedding for use case ${useCaseId}`);

    try {
      if (!this.openai) {
        throw new Error('OpenAI API not configured');
      }

      // Generate embedding using OpenAI
      const response = await this.openai.embeddings.create({
        model: 'text-embedding-3-small', // Cost-effective model
        input: content,
      });

      const embedding = response.data[0].embedding;

      // Store embedding in database (pgvector column)
      await this.prisma.useCase.update({
        where: { id: useCaseId },
        data: {
          // @ts-ignore - pgvector type
          embedding: embedding,
          embeddingUpdatedAt: new Date(),
        },
      });

      this.logger.log(`Successfully generated embedding for use case ${useCaseId}`);
      return { success: true, dimensions: embedding.length };
    } catch (error) {
      this.logger.error(`Failed to generate embedding for use case ${useCaseId}:`, error);
      throw error;
    }
  }

  /**
   * Regenerate embeddings for all use cases in a project
   * Used for maintenance or when switching embedding models
   */
  @Process('regenerate-all')
  async regenerateAllEmbeddings(job: Job<{ projectId: string }>) {
    const { projectId } = job.data;
    this.logger.log(`Regenerating all embeddings for project ${projectId}`);

    try {
      // Get all use cases for the project with their latest version
      const useCases = await this.prisma.useCase.findMany({
        where: { projectId },
        select: {
          id: true,
          key: true,
          title: true,
          area: true,
          versions: {
            orderBy: { version: 'desc' },
            take: 1,
            select: {
              content: true,
              summary: true,
            },
          },
        },
      });

      this.logger.log(`Found ${useCases.length} use cases to reindex`);

      // Process in batches to avoid rate limits
      const batchSize = 5;
      let processed = 0;

      for (let i = 0; i < useCases.length; i += batchSize) {
        const batch = useCases.slice(i, i + batchSize);

        await Promise.all(
          batch.map(async (useCase: any) => {
            const latestVersion = useCase.versions[0];
            const content = this.buildUseCaseContent({
              code: useCase.key,
              title: useCase.title,
              description: latestVersion?.summary || useCase.area || '',
              mainFlow: latestVersion?.content || '',
            });
            return this.generateEmbedding({
              data: { useCaseId: useCase.id, content },
            } as Job);
          }),
        );

        processed += batch.length;
        await job.progress((processed / useCases.length) * 100);

        // Rate limiting delay (OpenAI has rate limits)
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      this.logger.log(`Completed regenerating embeddings for project ${projectId}`);
      return { success: true, total: useCases.length };
    } catch (error) {
      this.logger.error(`Failed to regenerate embeddings for project ${projectId}:`, error);
      throw error;
    }
  }

  /**
   * Build searchable content from use case
   */
  private buildUseCaseContent(useCase: {
    code: string;
    title: string;
    description: string;
    mainFlow?: any;
  }): string {
    let content = `${useCase.code}: ${useCase.title}\n\n${useCase.description}`;

    if (useCase.mainFlow) {
      const flows = Array.isArray(useCase.mainFlow)
        ? useCase.mainFlow.join('\n')
        : String(useCase.mainFlow);
      content += `\n\nMain Flow:\n${flows}`;
    }

    return content;
  }
}
