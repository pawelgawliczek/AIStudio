import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateUseCaseDto,
  UpdateUseCaseDto,
  SearchUseCasesDto,
  LinkUseCaseToStoryDto,
  UseCaseResponse,
} from './dto';
import { Prisma } from '@prisma/client';
import OpenAI from 'openai';

@Injectable()
export class UseCasesService {
  private readonly logger = new Logger(UseCasesService.name);
  private openai: OpenAI | null = null;

  constructor(private prisma: PrismaService) {
    // Initialize OpenAI client if API key is provided
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
  async create(dto: CreateUseCaseDto, createdById: string): Promise<UseCaseResponse> {
    // Check if project exists
    const project = await this.prisma.project.findUnique({
      where: { id: dto.projectId },
    });

    if (!project) {
      throw new NotFoundException(`Project with ID ${dto.projectId} not found`);
    }

    // Check if key is unique within project
    const existing = await this.prisma.useCase.findUnique({
      where: {
        projectId_key: {
          projectId: dto.projectId,
          key: dto.key,
        },
      },
    });

    if (existing) {
      throw new BadRequestException(
        `Use case with key ${dto.key} already exists in project ${dto.projectId}`,
      );
    }

    // Generate embedding if OpenAI is available
    let embedding: number[] | null = null;
    if (this.openai) {
      try {
        embedding = await this.generateEmbedding(dto.content);
      } catch (error) {
        this.logger.error(`Failed to generate embedding: ${error.message}`);
        // Continue without embedding - it can be generated later by background worker
      }
    }

    // Create use case with initial version in a transaction
    const useCase = await this.prisma.$transaction(async (tx) => {
      const newUseCase = await tx.useCase.create({
        data: {
          projectId: dto.projectId,
          key: dto.key,
          title: dto.title,
          area: dto.area,
        },
      });

      // Create version with embedding using raw SQL since Prisma doesn't support Unsupported type
      await tx.$executeRaw`
        INSERT INTO use_case_versions (id, use_case_id, version, summary, content, embedding, created_by)
        VALUES (
          uuid_generate_v4(),
          ${newUseCase.id}::uuid,
          1,
          ${dto.summary},
          ${dto.content},
          ${embedding ? `[${embedding.join(',')}]` : null}::vector,
          ${createdById}::uuid
        )
      `;

      return newUseCase;
    });

    return this.findOne(useCase.id);
  }

  /**
   * Find all use cases with optional filters
   */
  async findAll(projectId?: string, area?: string): Promise<UseCaseResponse[]> {
    const where: Prisma.UseCaseWhereInput = {};

    if (projectId) {
      where.projectId = projectId;
    }

    if (area) {
      where.area = area;
    }

    const useCases = await this.prisma.useCase.findMany({
      where,
      include: {
        versions: {
          orderBy: { version: 'desc' },
          take: 1,
          include: {
            createdBy: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
        storyLinks: {
          include: {
            story: {
              select: {
                id: true,
                key: true,
                title: true,
                status: true,
              },
            },
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return useCases.map((uc) => ({
      id: uc.id,
      projectId: uc.projectId,
      key: uc.key,
      title: uc.title,
      area: uc.area,
      createdAt: uc.createdAt,
      updatedAt: uc.updatedAt,
      latestVersion: uc.versions[0]
        ? {
            id: uc.versions[0].id,
            version: uc.versions[0].version,
            summary: uc.versions[0].summary,
            content: uc.versions[0].content,
            createdAt: uc.versions[0].createdAt,
            createdBy: uc.versions[0].createdBy,
            linkedStoryId: uc.versions[0].linkedStoryId,
            linkedDefectId: uc.versions[0].linkedDefectId,
          }
        : undefined,
      storyLinks: uc.storyLinks.map((link) => ({
        storyId: link.storyId,
        relation: link.relation,
        story: link.story,
      })),
    }));
  }

  /**
   * Find a single use case by ID
   */
  async findOne(id: string): Promise<UseCaseResponse> {
    const useCase = await this.prisma.useCase.findUnique({
      where: { id },
      include: {
        versions: {
          orderBy: { version: 'desc' },
          include: {
            createdBy: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
        storyLinks: {
          include: {
            story: {
              select: {
                id: true,
                key: true,
                title: true,
                status: true,
              },
            },
          },
        },
      },
    });

    if (!useCase) {
      throw new NotFoundException(`Use case with ID ${id} not found`);
    }

    return {
      id: useCase.id,
      projectId: useCase.projectId,
      key: useCase.key,
      title: useCase.title,
      area: useCase.area,
      createdAt: useCase.createdAt,
      updatedAt: useCase.updatedAt,
      latestVersion: useCase.versions[0]
        ? {
            id: useCase.versions[0].id,
            version: useCase.versions[0].version,
            summary: useCase.versions[0].summary,
            content: useCase.versions[0].content,
            createdAt: useCase.versions[0].createdAt,
            createdBy: useCase.versions[0].createdBy,
            linkedStoryId: useCase.versions[0].linkedStoryId,
            linkedDefectId: useCase.versions[0].linkedDefectId,
          }
        : undefined,
      versions: useCase.versions.map((v) => ({
        id: v.id,
        version: v.version,
        summary: v.summary,
        content: v.content,
        createdAt: v.createdAt,
        createdBy: v.createdBy,
        linkedStoryId: v.linkedStoryId,
        linkedDefectId: v.linkedDefectId,
      })),
      storyLinks: useCase.storyLinks.map((link) => ({
        storyId: link.storyId,
        relation: link.relation,
        story: link.story,
      })),
    };
  }

  /**
   * Update a use case (creates a new version)
   */
  async update(id: string, dto: UpdateUseCaseDto, createdById: string): Promise<UseCaseResponse> {
    const useCase = await this.prisma.useCase.findUnique({
      where: { id },
      include: {
        versions: {
          orderBy: { version: 'desc' },
          take: 1,
        },
      },
    });

    if (!useCase) {
      throw new NotFoundException(`Use case with ID ${id} not found`);
    }

    // Generate embedding if content is updated and OpenAI is available
    let embedding: number[] | null = null;
    if (dto.content && this.openai) {
      try {
        embedding = await this.generateEmbedding(dto.content);
      } catch (error) {
        this.logger.error(`Failed to generate embedding: ${error.message}`);
      }
    }

    // Update use case and create new version
    const latestVersion = useCase.versions[0];
    const newVersion = latestVersion ? latestVersion.version + 1 : 1;

    await this.prisma.$transaction(async (tx) => {
      // Update use case metadata
      await tx.useCase.update({
        where: { id },
        data: {
          title: dto.title ?? undefined,
          area: dto.area ?? undefined,
        },
      });

      // Create new version if content changed
      if (dto.content || dto.summary) {
        const summary = dto.summary ?? latestVersion?.summary;
        const content = dto.content ?? latestVersion?.content;

        // Use raw SQL for embedding field
        await tx.$executeRaw`
          INSERT INTO use_case_versions (id, use_case_id, version, summary, content, embedding, created_by)
          VALUES (
            uuid_generate_v4(),
            ${id}::uuid,
            ${newVersion},
            ${summary},
            ${content},
            ${embedding ? `[${embedding.join(',')}]` : null}::vector,
            ${createdById}::uuid
          )
        `;
      }
    });

    return this.findOne(id);
  }

  /**
   * Delete a use case
   */
  async remove(id: string): Promise<void> {
    const useCase = await this.prisma.useCase.findUnique({
      where: { id },
    });

    if (!useCase) {
      throw new NotFoundException(`Use case with ID ${id} not found`);
    }

    await this.prisma.useCase.delete({
      where: { id },
    });
  }

  /**
   * Search use cases with component/area/story/epic filtering (AI-friendly)
   * Provides deterministic, predictable results for AI agents
   */
  async search(dto: SearchUseCasesDto): Promise<UseCaseResponse[]> {
    const where: Prisma.UseCaseWhereInput = {
      projectId: dto.projectId,
    };

    // Filter by area (single)
    if (dto.area) {
      where.area = dto.area;
    }

    // Filter by areas (multiple OR)
    if (dto.areas && dto.areas.length > 0) {
      where.area = { in: dto.areas };
    }

    // Filter by story (use cases linked to this story)
    if (dto.storyId) {
      where.storyLinks = {
        some: {
          storyId: dto.storyId,
        },
      };
    }

    // Filter by epic (use cases linked to stories in this epic)
    if (dto.epicId) {
      where.storyLinks = {
        some: {
          story: {
            epicId: dto.epicId,
          },
        },
      };
    }

    // Text search across key, title, area
    if (dto.query) {
      where.OR = [
        { key: { contains: dto.query, mode: 'insensitive' } },
        { title: { contains: dto.query, mode: 'insensitive' } },
        { area: { contains: dto.query, mode: 'insensitive' } },
      ];
    }

    const useCases = await this.prisma.useCase.findMany({
      where,
      include: {
        versions: {
          orderBy: { version: 'desc' },
          take: 1,
          include: {
            createdBy: {
              select: { id: true, name: true, email: true },
            },
          },
        },
        storyLinks: {
          include: {
            story: {
              select: {
                id: true,
                key: true,
                title: true,
                status: true,
              },
            },
          },
        },
      },
      skip: dto.offset || 0,
      take: dto.limit || 20,
      orderBy: { updatedAt: 'desc' },
    });

    return useCases.map((uc) => ({
      id: uc.id,
      projectId: uc.projectId,
      key: uc.key,
      title: uc.title,
      area: uc.area,
      createdAt: uc.createdAt,
      updatedAt: uc.updatedAt,
      latestVersion: uc.versions[0]
        ? {
            id: uc.versions[0].id,
            version: uc.versions[0].version,
            summary: uc.versions[0].summary,
            content: uc.versions[0].content,
            createdAt: uc.versions[0].createdAt,
            createdBy: uc.versions[0].createdBy,
            linkedStoryId: uc.versions[0].linkedStoryId,
            linkedDefectId: uc.versions[0].linkedDefectId,
          }
        : undefined,
      storyLinks: uc.storyLinks.map((link) => ({
        storyId: link.storyId,
        relation: link.relation,
        story: link.story,
      })),
    }));
  }

  /**
   * Semantic search using vector similarity
   */
  private async searchSemantic(dto: SearchUseCasesDto & { minSimilarity?: number }): Promise<UseCaseResponse[]> {
    if (!this.openai) {
      throw new BadRequestException('Semantic search is not available (OpenAI API key not configured)');
    }

    if (!dto.query) {
      throw new BadRequestException('Query is required for semantic search');
    }

    // Generate embedding for query
    const queryEmbedding = await this.generateEmbedding(dto.query);

    const minSimilarity = dto.minSimilarity || 0.7;
    const limit = dto.limit || 20;

    // Use raw SQL for vector similarity search
    // Note: Prisma doesn't support pgvector operations natively yet
    const results = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT
        uc.id,
        uc.project_id as "projectId",
        uc.key,
        uc.title,
        uc.area,
        uc.created_at as "createdAt",
        uc.updated_at as "updatedAt",
        1 - (ucv.embedding <=> $1::vector) as similarity
      FROM use_cases uc
      INNER JOIN LATERAL (
        SELECT embedding, version, summary, content
        FROM use_case_versions
        WHERE use_case_id = uc.id AND embedding IS NOT NULL
        ORDER BY version DESC
        LIMIT 1
      ) ucv ON true
      WHERE 1 - (ucv.embedding <=> $1::vector) >= $2
      ${dto.projectId ? 'AND uc.project_id = $3' : ''}
      ORDER BY similarity DESC
      LIMIT $${dto.projectId ? '4' : '3'}
    `, `[${queryEmbedding.join(',')}]`, minSimilarity, ...(dto.projectId ? [dto.projectId] : []), limit);

    // Fetch full use case details for results
    const useCaseIds = results.map((r) => r.id);
    const useCases = await this.prisma.useCase.findMany({
      where: { id: { in: useCaseIds } },
      include: {
        versions: {
          orderBy: { version: 'desc' },
          take: 1,
          include: {
            createdBy: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
        storyLinks: {
          include: {
            story: {
              select: {
                id: true,
                key: true,
                title: true,
                status: true,
              },
            },
          },
        },
      },
    });

    // Map results with similarity scores
    const useCaseMap = new Map(useCases.map((uc) => [uc.id, uc]));

    return results.map((result) => {
      const uc = useCaseMap.get(result.id);
      if (!uc) return null;

      return {
        id: uc.id,
        projectId: uc.projectId,
        key: uc.key,
        title: uc.title,
        area: uc.area,
        createdAt: uc.createdAt,
        updatedAt: uc.updatedAt,
        similarity: result.similarity,
        latestVersion: uc.versions[0]
          ? {
              id: uc.versions[0].id,
              version: uc.versions[0].version,
              summary: uc.versions[0].summary,
              content: uc.versions[0].content,
              createdAt: uc.versions[0].createdAt,
              createdBy: uc.versions[0].createdBy,
              linkedStoryId: uc.versions[0].linkedStoryId,
              linkedDefectId: uc.versions[0].linkedDefectId,
            }
          : undefined,
        storyLinks: uc.storyLinks.map((link) => ({
          storyId: link.storyId,
          relation: link.relation,
          story: link.story,
        })),
      };
    }).filter(Boolean);
  }

  /**
   * Text search using PostgreSQL full-text search
   */
  private async searchText(dto: SearchUseCasesDto): Promise<UseCaseResponse[]> {
    if (!dto.query) {
      return this.findAll(dto.projectId, dto.area);
    }

    const where: Prisma.UseCaseWhereInput = {
      projectId: dto.projectId,
      area: dto.area,
      OR: [
        { key: { contains: dto.query, mode: 'insensitive' } },
        { title: { contains: dto.query, mode: 'insensitive' } },
        { area: { contains: dto.query, mode: 'insensitive' } },
      ],
    };

    const useCases = await this.prisma.useCase.findMany({
      where,
      include: {
        versions: {
          orderBy: { version: 'desc' },
          take: 1,
          include: {
            createdBy: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
        storyLinks: {
          include: {
            story: {
              select: {
                id: true,
                key: true,
                title: true,
                status: true,
              },
            },
          },
        },
      },
      take: dto.limit || 20,
      orderBy: { updatedAt: 'desc' },
    });

    return useCases.map((uc) => ({
      id: uc.id,
      projectId: uc.projectId,
      key: uc.key,
      title: uc.title,
      area: uc.area,
      createdAt: uc.createdAt,
      updatedAt: uc.updatedAt,
      latestVersion: uc.versions[0]
        ? {
            id: uc.versions[0].id,
            version: uc.versions[0].version,
            summary: uc.versions[0].summary,
            content: uc.versions[0].content,
            createdAt: uc.versions[0].createdAt,
            createdBy: uc.versions[0].createdBy,
            linkedStoryId: uc.versions[0].linkedStoryId,
            linkedDefectId: uc.versions[0].linkedDefectId,
          }
        : undefined,
      storyLinks: uc.storyLinks.map((link) => ({
        storyId: link.storyId,
        relation: link.relation,
        story: link.story,
      })),
    }));
  }

  /**
   * Search by component filter
   */
  private async searchByComponent(dto: SearchUseCasesDto): Promise<UseCaseResponse[]> {
    // Component search filters by area for now
    // In a more advanced implementation, this would parse components from use case content
    return this.findAll(dto.projectId, dto.area);
  }

  /**
   * Link a use case to a story
   */
  async linkToStory(dto: LinkUseCaseToStoryDto): Promise<void> {
    // Check if use case exists
    const useCase = await this.prisma.useCase.findUnique({
      where: { id: dto.useCaseId },
    });

    if (!useCase) {
      throw new NotFoundException(`Use case with ID ${dto.useCaseId} not found`);
    }

    // Check if story exists
    const story = await this.prisma.story.findUnique({
      where: { id: dto.storyId },
    });

    if (!story) {
      throw new NotFoundException(`Story with ID ${dto.storyId} not found`);
    }

    // Create or update link
    await this.prisma.storyUseCaseLink.upsert({
      where: {
        storyId_useCaseId: {
          storyId: dto.storyId,
          useCaseId: dto.useCaseId,
        },
      },
      create: {
        storyId: dto.storyId,
        useCaseId: dto.useCaseId,
        relation: dto.relation,
      },
      update: {
        relation: dto.relation,
      },
    });
  }

  /**
   * Unlink a use case from a story
   */
  async unlinkFromStory(useCaseId: string, storyId: string): Promise<void> {
    await this.prisma.storyUseCaseLink.delete({
      where: {
        storyId_useCaseId: {
          storyId,
          useCaseId,
        },
      },
    });
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
   * Find related use cases for a story (AI-friendly)
   * Returns use cases that are:
   * 1. Already linked to the story
   * 2. Linked to other stories in the same epic
   * 3. Semantically similar to the story description
   */
  async findRelatedForStory(storyId: string, options?: {
    includeEpicUseCases?: boolean;
    includeSemanticallySimilar?: boolean;
    limit?: number;
    minSimilarity?: number;
  }): Promise<UseCaseResponse[]> {
    const {
      includeEpicUseCases = true,
      includeSemanticallySimilar = true,
      limit = 10,
      minSimilarity = 0.6,
    } = options || {};

    // Get the story details
    const story = await this.prisma.story.findUnique({
      where: { id: storyId },
      include: {
        epic: true,
        useCaseLinks: {
          include: {
            useCase: {
              include: {
                versions: {
                  orderBy: { version: 'desc' },
                  take: 1,
                  include: {
                    createdBy: {
                      select: { id: true, name: true, email: true },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!story) {
      throw new NotFoundException(`Story with ID ${storyId} not found`);
    }

    const results: UseCaseResponse[] = [];
    const seenIds = new Set<string>();

    // 1. Use cases already linked to this story (highest priority)
    for (const link of story.useCaseLinks) {
      if (!seenIds.has(link.useCase.id)) {
        seenIds.add(link.useCase.id);
        results.push({
          id: link.useCase.id,
          projectId: link.useCase.projectId,
          key: link.useCase.key,
          title: link.useCase.title,
          area: link.useCase.area,
          createdAt: link.useCase.createdAt,
          updatedAt: link.useCase.updatedAt,
          latestVersion: link.useCase.versions[0] ? {
            id: link.useCase.versions[0].id,
            version: link.useCase.versions[0].version,
            summary: link.useCase.versions[0].summary,
            content: link.useCase.versions[0].content,
            createdAt: link.useCase.versions[0].createdAt,
            createdBy: link.useCase.versions[0].createdBy,
            linkedStoryId: link.useCase.versions[0].linkedStoryId,
            linkedDefectId: link.useCase.versions[0].linkedDefectId,
          } : undefined,
          similarity: 1.0, // Already linked = perfect match
        });
      }
    }

    // 2. Use cases from the same epic
    if (includeEpicUseCases && story.epicId && results.length < limit) {
      const epicUseCases = await this.prisma.useCase.findMany({
        where: {
          projectId: story.projectId,
          storyLinks: {
            some: {
              story: {
                epicId: story.epicId,
                id: { not: storyId },
              },
            },
          },
        },
        include: {
          versions: {
            orderBy: { version: 'desc' },
            take: 1,
            include: {
              createdBy: {
                select: { id: true, name: true, email: true },
              },
            },
          },
        },
        take: limit - results.length,
      });

      for (const uc of epicUseCases) {
        if (!seenIds.has(uc.id)) {
          seenIds.add(uc.id);
          results.push({
            id: uc.id,
            projectId: uc.projectId,
            key: uc.key,
            title: uc.title,
            area: uc.area,
            createdAt: uc.createdAt,
            updatedAt: uc.updatedAt,
            latestVersion: uc.versions[0] ? {
              id: uc.versions[0].id,
              version: uc.versions[0].version,
              summary: uc.versions[0].summary,
              content: uc.versions[0].content,
              createdAt: uc.versions[0].createdAt,
              createdBy: uc.versions[0].createdBy,
              linkedStoryId: uc.versions[0].linkedStoryId,
              linkedDefectId: uc.versions[0].linkedDefectId,
            } : undefined,
            similarity: 0.8, // Same epic = high relevance
          });
        }
      }
    }

    // 3. Semantically similar use cases
    if (includeSemanticallySimilar && this.openai && story.description && results.length < limit) {
      try {
        const searchQuery = `${story.title}\n\n${story.description}`;
        const semanticResults = await this.searchSemantic({
          projectId: story.projectId,
          query: searchQuery,
          limit: limit - results.length,
        });

        for (const result of semanticResults) {
          if (!seenIds.has(result.id)) {
            seenIds.add(result.id);
            results.push(result);
          }
        }
      } catch (error) {
        this.logger.error(`Failed to find semantically similar use cases: ${error.message}`);
      }
    }

    return results.slice(0, limit);
  }

  /**
   * Get use case with full context for AI agents
   * Includes all versions, linked stories, test coverage, etc.
   */
  async getWithFullContext(id: string): Promise<any> {
    const useCase = await this.prisma.useCase.findUnique({
      where: { id },
      include: {
        project: {
          select: {
            id: true,
            name: true,
            description: true,
          },
        },
        versions: {
          orderBy: { version: 'desc' },
          include: {
            createdBy: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
        storyLinks: {
          include: {
            story: {
              select: {
                id: true,
                key: true,
                title: true,
                description: true,
                status: true,
                businessImpact: true,
                businessComplexity: true,
                technicalComplexity: true,
              },
            },
          },
        },
        testCases: {
          select: {
            id: true,
            key: true,
            description: true,
            testLevel: true,
          },
        },
      },
    });

    if (!useCase) {
      throw new NotFoundException(`Use case with ID ${id} not found`);
    }

    return {
      ...useCase,
      versionCount: useCase.versions.length,
      linkedStoriesCount: useCase.storyLinks.length,
      testCoverageCount: useCase.testCases.length,
      latestVersion: useCase.versions[0],
      changelog: useCase.versions.map((v, idx) => ({
        version: v.version,
        createdAt: v.createdAt,
        createdBy: v.createdBy.name,
        linkedStoryId: v.linkedStoryId,
        linkedDefectId: v.linkedDefectId,
        isLatest: idx === 0,
      })),
    };
  }

  /**
   * Batch get use cases by IDs (AI-friendly for bulk operations)
   */
  async findManyByIds(ids: string[]): Promise<UseCaseResponse[]> {
    const useCases = await this.prisma.useCase.findMany({
      where: {
        id: { in: ids },
      },
      include: {
        versions: {
          orderBy: { version: 'desc' },
          take: 1,
          include: {
            createdBy: {
              select: { id: true, name: true, email: true },
            },
          },
        },
        storyLinks: {
          include: {
            story: {
              select: {
                id: true,
                key: true,
                title: true,
                status: true,
              },
            },
          },
        },
      },
    });

    return useCases.map((uc) => ({
      id: uc.id,
      projectId: uc.projectId,
      key: uc.key,
      title: uc.title,
      area: uc.area,
      createdAt: uc.createdAt,
      updatedAt: uc.updatedAt,
      latestVersion: uc.versions[0] ? {
        id: uc.versions[0].id,
        version: uc.versions[0].version,
        summary: uc.versions[0].summary,
        content: uc.versions[0].content,
        createdAt: uc.versions[0].createdAt,
        createdBy: uc.versions[0].createdBy,
        linkedStoryId: uc.versions[0].linkedStoryId,
        linkedDefectId: uc.versions[0].linkedDefectId,
      } : undefined,
      storyLinks: uc.storyLinks.map((link) => ({
        storyId: link.storyId,
        relation: link.relation,
        story: link.story,
      })),
    }));
  }

  /**
   * Regenerate embeddings for all use cases (for background worker)
   */
  async regenerateAllEmbeddings(): Promise<void> {
    if (!this.openai) {
      this.logger.warn('Cannot regenerate embeddings: OpenAI client not initialized');
      return;
    }

    // Query all versions without embedding using raw SQL since Prisma doesn't support Unsupported type in queries
    const versions = await this.prisma.$queryRaw<Array<{ id: string; content: string }>>`
      SELECT id, content
      FROM use_case_versions
      WHERE embedding IS NULL
    `;

    this.logger.log(`Regenerating embeddings for ${versions.length} use case versions`);

    for (const version of versions) {
      try {
        const embedding = await this.generateEmbedding(version.content);
        // Use raw SQL to update embedding since Prisma doesn't support Unsupported type in updates
        await this.prisma.$executeRaw`
          UPDATE use_case_versions
          SET embedding = ${`[${embedding.join(',')}]`}::vector
          WHERE id = ${version.id}::uuid
        `;
        this.logger.log(`Generated embedding for use case version ${version.id}`);
      } catch (error) {
        this.logger.error(`Failed to generate embedding for version ${version.id}: ${error.message}`);
      }
    }

    this.logger.log('Finished regenerating embeddings');
  }
}
