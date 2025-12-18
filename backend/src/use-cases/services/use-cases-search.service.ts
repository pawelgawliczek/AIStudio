import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { getErrorMessage } from '../../common';
import { PrismaService } from '../../prisma/prisma.service';
import { SearchUseCasesDto, LinkUseCaseToStoryDto, UseCaseResponse } from '../dto';

/**
 * Use Case Search and Relations Service
 * Handles search, semantic search, and story linking
 */
@Injectable()
export class UseCasesSearchService {
  private readonly logger = new Logger(UseCasesSearchService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Search use cases with component/area/story/epic filtering
   */
  async search(dto: SearchUseCasesDto): Promise<UseCaseResponse[]> {
    const where: Prisma.UseCaseWhereInput = {
      projectId: dto.projectId,
    };

    if (dto.area) {
      where.area = dto.area;
    }

    if (dto.areas && dto.areas.length > 0) {
      where.area = { in: dto.areas };
    }

    if (dto.storyId) {
      where.storyLinks = {
        some: {
          storyId: dto.storyId,
        },
      };
    }

    if (dto.epicId) {
      where.storyLinks = {
        some: {
          story: {
            epicId: dto.epicId,
          },
        },
      };
    }

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

    return useCases.map((uc) => this.mapToResponse(uc));
  }

  /**
   * Semantic search using vector similarity
   */
  async searchSemantic(
    dto: SearchUseCasesDto & { minSimilarity?: number },
    openai: any,
    generateEmbedding: (text: string) => Promise<number[]>,
  ): Promise<UseCaseResponse[]> {
    if (!openai) {
      throw new BadRequestException('Semantic search is not available (OpenAI API key not configured)');
    }

    if (!dto.query) {
      throw new BadRequestException('Query is required for semantic search');
    }

    const queryEmbedding = await generateEmbedding(dto.query);
    const minSimilarity = dto.minSimilarity || 0.7;
    const limit = dto.limit || 20;

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

    const useCaseMap = new Map(useCases.map((uc) => [uc.id, uc]));

    return results
      .map((result) => {
        const uc = useCaseMap.get(result.id);
        if (!uc) return null;

        return {
          ...this.mapToResponse(uc),
          similarity: result.similarity,
        };
      })
      .filter((uc): uc is NonNullable<typeof uc> => uc !== null) as UseCaseResponse[];
  }

  /**
   * Find related use cases for a story
   */
  async findRelatedForStory(
    storyId: string,
    options: {
      includeEpicUseCases?: boolean;
      includeSemanticallySimilar?: boolean;
      limit?: number;
      minSimilarity?: number;
    },
    openai: any,
    searchSemantic: (dto: any) => Promise<UseCaseResponse[]>,
  ): Promise<UseCaseResponse[]> {
    const {
      includeEpicUseCases = true,
      includeSemanticallySimilar = true,
      limit = 10,
      minSimilarity = 0.6,
    } = options;

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

    // 1. Already linked use cases
    for (const link of story.useCaseLinks) {
      if (!seenIds.has(link.useCase.id)) {
        seenIds.add(link.useCase.id);
        results.push({
          ...this.mapToResponse(link.useCase),
          similarity: 1.0,
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
            ...this.mapToResponse(uc),
            similarity: 0.8,
          });
        }
      }
    }

    // 3. Semantically similar use cases
    if (includeSemanticallySimilar && openai && story.description && results.length < limit) {
      try {
        const searchQuery = `${story.title}\n\n${story.description}`;
        const semanticResults = await searchSemantic({
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
        this.logger.error(`Failed to find semantically similar use cases: ${getErrorMessage(error)}`);
      }
    }

    return results.slice(0, limit);
  }

  /**
   * Link a use case to a story
   */
  async linkToStory(dto: LinkUseCaseToStoryDto): Promise<void> {
    const useCase = await this.prisma.useCase.findUnique({
      where: { id: dto.useCaseId },
    });

    if (!useCase) {
      throw new NotFoundException(`Use case with ID ${dto.useCaseId} not found`);
    }

    const story = await this.prisma.story.findUnique({
      where: { id: dto.storyId },
    });

    if (!story) {
      throw new NotFoundException(`Story with ID ${dto.storyId} not found`);
    }

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
   * Get use case with full context for AI agents
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

  private mapToResponse(uc: any): UseCaseResponse {
    return {
      id: uc.id,
      projectId: uc.projectId,
      key: uc.key,
      title: uc.title,
      area: uc.area ?? undefined,
      createdAt: uc.createdAt,
      updatedAt: uc.updatedAt,
      latestVersion: uc.versions?.[0]
        ? {
            id: uc.versions[0].id,
            version: uc.versions[0].version,
            summary: uc.versions[0].summary ?? undefined,
            content: uc.versions[0].content ?? undefined,
            createdAt: uc.versions[0].createdAt,
            createdBy: uc.versions[0].createdBy ?? undefined,
            linkedStoryId: uc.versions[0].linkedStoryId ?? undefined,
            linkedDefectId: uc.versions[0].linkedDefectId ?? undefined,
          }
        : undefined,
      storyLinks: uc.storyLinks?.map((link: any) => ({
        storyId: link.storyId,
        relation: link.relation,
        story: link.story,
      })) || [],
    };
  }
}
