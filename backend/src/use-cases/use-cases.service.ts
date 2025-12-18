import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import { getErrorMessage } from '../common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateUseCaseDto,
  UpdateUseCaseDto,
  SearchUseCasesDto,
  LinkUseCaseToStoryDto,
  UseCaseResponse,
} from './dto';
import { normalizeArea, findSimilarAreas, SimilarAreaMatch } from './taxonomy.util';
import { UseCasesCrudService } from './services/use-cases-crud.service';
import { UseCasesSearchService } from './services/use-cases-search.service';

/**
 * ST-284: Refactored Use Cases Service (Facade)
 * Delegates to specialized sub-services for maintainability
 */
@Injectable()
export class UseCasesService {
  private readonly logger = new Logger(UseCasesService.name);
  private openai: OpenAI | null = null;

  constructor(
    private prisma: PrismaService,
    private crudService: UseCasesCrudService,
    private searchService: UseCasesSearchService,
  ) {
    if (process.env.OPENAI_API_KEY) {
      this.openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });
      this.logger.log('OpenAI client initialized for semantic search');
    } else {
      this.logger.warn('OPENAI_API_KEY not found - semantic search disabled');
    }
  }

  /**
   * Create a new use case with initial version
   */
  async create(dto: CreateUseCaseDto, createdById?: string): Promise<UseCaseResponse> {
    return this.crudService.create(
      dto,
      createdById,
      this.openai,
      this.validateAndNormalizeArea.bind(this)
    );
  }

  /**
   * Find all use cases with optional filters
   */
  async findAll(projectId?: string, area?: string): Promise<UseCaseResponse[]> {
    return this.crudService.findAll(projectId, area);
  }

  /**
   * Find a single use case by ID
   */
  async findOne(id: string): Promise<UseCaseResponse> {
    return this.crudService.findOne(id);
  }

  /**
   * Update a use case (creates a new version)
   */
  async update(id: string, dto: UpdateUseCaseDto, createdById?: string): Promise<UseCaseResponse> {
    return this.crudService.update(
      id,
      dto,
      createdById,
      this.openai,
      this.validateAndNormalizeArea.bind(this)
    );
  }

  /**
   * Delete a use case
   */
  async remove(id: string): Promise<void> {
    return this.crudService.remove(id);
  }

  /**
   * Search use cases with component/area/story/epic filtering
   */
  async search(dto: SearchUseCasesDto): Promise<UseCaseResponse[]> {
    return this.searchService.search(dto);
  }

  /**
   * Link a use case to a story
   */
  async linkToStory(dto: LinkUseCaseToStoryDto): Promise<void> {
    return this.searchService.linkToStory(dto);
  }

  /**
   * Unlink a use case from a story
   */
  async unlinkFromStory(useCaseId: string, storyId: string): Promise<void> {
    return this.searchService.unlinkFromStory(useCaseId, storyId);
  }

  /**
   * Find related use cases for a story
   */
  async findRelatedForStory(storyId: string, options?: {
    includeEpicUseCases?: boolean;
    includeSemanticallySimilar?: boolean;
    limit?: number;
    minSimilarity?: number;
  }): Promise<UseCaseResponse[]> {
    return this.searchService.findRelatedForStory(
      storyId,
      options || {},
      this.openai,
      this.searchSemantic.bind(this),
    );
  }

  /**
   * Get use case with full context for AI agents
   */
  async getWithFullContext(id: string): Promise<any> {
    return this.searchService.getWithFullContext(id);
  }

  /**
   * Batch get use cases by IDs
   */
  async findManyByIds(ids: string[]): Promise<UseCaseResponse[]> {
    return this.crudService.findManyByIds(ids);
  }

  /**
   * Regenerate embeddings for all use cases
   */
  async regenerateAllEmbeddings(): Promise<void> {
    if (!this.openai) {
      this.logger.warn('Cannot regenerate embeddings: OpenAI client not initialized');
      return;
    }

    const versions = await this.prisma.$queryRaw<Array<{ id: string; content: string }>>`
      SELECT id, content
      FROM use_case_versions
      WHERE embedding IS NULL
    `;

    this.logger.log(`Regenerating embeddings for ${versions.length} use case versions`);

    for (const version of versions) {
      try {
        const embedding = await this.generateEmbedding(version.content);
        await this.prisma.$executeRaw`
          UPDATE use_case_versions
          SET embedding = ${`[${embedding.join(',')}]`}::vector
          WHERE id = ${version.id}::uuid
        `;
        this.logger.log(`Generated embedding for use case version ${version.id}`);
      } catch (error) {
        this.logger.error(`Failed to generate embedding for version ${version.id}: ${getErrorMessage(error)}`);
      }
    }

    this.logger.log('Finished regenerating embeddings');
  }

  /**
   * ST-207: Validate area against project taxonomy
   */
  async validateArea(projectId: string, area: string): Promise<boolean> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { taxonomy: true },
    });

    if (!project) {
      return false;
    }

    const taxonomy = (project.taxonomy as string[]) || [];
    const normalizedArea = normalizeArea(area);

    return taxonomy.some(
      (t) => normalizeArea(t).toLowerCase() === normalizedArea.toLowerCase()
    );
  }

  /**
   * ST-207: Get similar areas for suggestions
   */
  async getSimilarAreas(projectId: string, area: string): Promise<SimilarAreaMatch[]> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { taxonomy: true },
    });

    if (!project) {
      return [];
    }

    const taxonomy = (project.taxonomy as string[]) || [];
    return findSimilarAreas(area, taxonomy);
  }

  /**
   * ST-207: Bulk update use case areas when taxonomy area is renamed
   */
  async bulkUpdateArea(
    projectId: string,
    oldArea: string,
    newArea: string
  ): Promise<number> {
    const useCases = await this.prisma.useCase.findMany({
      where: {
        projectId,
        area: oldArea,
      },
    });

    for (const useCase of useCases) {
      await this.prisma.useCase.update({
        where: { id: useCase.id },
        data: { area: newArea },
      });
    }

    return useCases.length;
  }

  /**
   * Generate embedding for text using OpenAI
   */
  private async generateEmbedding(text: string): Promise<number[]> {
    if (!this.openai) {
      throw new Error('OpenAI client not initialized');
    }

    const response = await this.openai.embeddings.create({
      model: 'text-embedding-ada-002',
      input: text,
    });

    return response.data[0].embedding;
  }

  /**
   * Semantic search using vector similarity
   */
  private async searchSemantic(dto: SearchUseCasesDto & { minSimilarity?: number }): Promise<UseCaseResponse[]> {
    return this.searchService.searchSemantic(
      dto,
      this.openai,
      this.generateEmbedding.bind(this)
    );
  }

  /**
   * Private helper to validate and normalize area
   */
  private async validateAndNormalizeArea(
    projectId: string,
    area: string,
    autoAddArea?: boolean
  ): Promise<string> {
    const normalizedArea = normalizeArea(area);

    if (!normalizedArea) {
      throw new BadRequestException('Area name cannot be empty');
    }

    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { taxonomy: true },
    });

    if (!project) {
      throw new NotFoundException(`Project with ID ${projectId} not found`);
    }

    const taxonomy = (project.taxonomy as string[]) || [];

    const exactMatch = taxonomy.find(
      (t) => normalizeArea(t).toLowerCase() === normalizedArea.toLowerCase()
    );

    if (exactMatch) {
      return exactMatch;
    }

    if (autoAddArea) {
      const updatedTaxonomy = [...taxonomy, normalizedArea];
      await this.prisma.project.update({
        where: { id: projectId },
        data: { taxonomy: updatedTaxonomy },
      });
      return normalizedArea;
    }

    const suggestions = findSimilarAreas(area, taxonomy);

    if (suggestions.length > 0) {
      const error: any = new BadRequestException(
        `Area '${normalizedArea}' is not in the taxonomy. Did you mean one of these similar areas? Use autoAddArea: true to add new areas.`
      );
      error.response = {
        ...error.response,
        suggestions: suggestions.map((s) => s.area),
      };
      throw error;
    }

    throw new BadRequestException(
      `Area '${normalizedArea}' is not in the taxonomy. Use autoAddArea: true to add new areas.`
    );
  }
}
