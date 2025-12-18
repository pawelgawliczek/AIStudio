import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { getErrorMessage } from '../../common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateUseCaseDto, UpdateUseCaseDto, UseCaseResponse } from '../dto';
import { normalizeArea } from '../taxonomy.util';

/**
 * Use Case CRUD Operations Service
 * Handles create, read, update, delete operations
 */
@Injectable()
export class UseCasesCrudService {
  private readonly logger = new Logger(UseCasesCrudService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Generate embedding for text using OpenAI (if available)
   */
  async generateEmbedding(text: string, openai: any): Promise<number[]> {
    if (!openai) {
      throw new Error('OpenAI client not initialized');
    }

    const response = await openai.embeddings.create({
      model: 'text-embedding-ada-002',
      input: text,
    });

    return response.data[0].embedding;
  }

  /**
   * Create a new use case with initial version
   */
  async create(
    dto: CreateUseCaseDto,
    createdById: string | undefined,
    openai: any,
    validateAndNormalizeArea: (projectId: string, area: string, autoAdd?: boolean) => Promise<string>,
  ): Promise<UseCaseResponse> {
    const project = await this.prisma.project.findUnique({
      where: { id: dto.projectId },
    });

    if (!project) {
      throw new NotFoundException(`Project with ID ${dto.projectId} not found`);
    }

    let normalizedArea: string | undefined;
    if (dto.area) {
      normalizedArea = await validateAndNormalizeArea(
        dto.projectId,
        dto.area,
        dto.autoAddArea
      );
    }

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

    let embedding: number[] | null = null;
    if (openai) {
      try {
        embedding = await this.generateEmbedding(dto.content, openai);
      } catch (error) {
        this.logger.error(`Failed to generate embedding: ${getErrorMessage(error)}`);
      }
    }

    const userId = createdById || dto.createdById;

    const useCase = await this.prisma.$transaction(async (tx) => {
      const newUseCase = await tx.useCase.create({
        data: {
          projectId: dto.projectId,
          key: dto.key,
          title: dto.title,
          area: normalizedArea,
        },
      });

      await tx.$executeRaw`
        INSERT INTO use_case_versions (id, use_case_id, version, summary, content, embedding, created_by)
        VALUES (
          uuid_generate_v4(),
          ${newUseCase.id}::uuid,
          1,
          ${dto.summary},
          ${dto.content},
          ${embedding ? `[${embedding.join(',')}]` : null}::vector,
          ${userId}::uuid
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

    return useCases.map((uc) => this.mapToResponse(uc));
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
      ...this.mapToResponse(useCase),
      versions: useCase.versions.map((v) => ({
        id: v.id,
        version: v.version,
        summary: v.summary ?? undefined,
        content: v.content,
        createdAt: v.createdAt,
        createdBy: v.createdBy,
        linkedStoryId: v.linkedStoryId ?? undefined,
        linkedDefectId: v.linkedDefectId ?? undefined,
      })),
    };
  }

  /**
   * Update a use case (creates a new version)
   */
  async update(
    id: string,
    dto: UpdateUseCaseDto,
    createdById: string | undefined,
    openai: any,
    validateAndNormalizeArea: (projectId: string, area: string, autoAdd?: boolean) => Promise<string>,
  ): Promise<UseCaseResponse> {
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

    let normalizedArea: string | undefined;
    if (dto.area !== undefined) {
      normalizedArea = await validateAndNormalizeArea(
        useCase.projectId,
        dto.area,
        dto.autoAddArea
      );
    }

    let embedding: number[] | null = null;
    if (dto.content && openai) {
      try {
        embedding = await this.generateEmbedding(dto.content, openai);
      } catch (error) {
        this.logger.error(`Failed to generate embedding: ${getErrorMessage(error)}`);
      }
    }

    const latestVersion = useCase.versions[0];
    const newVersion = latestVersion ? latestVersion.version + 1 : 1;

    await this.prisma.$transaction(async (tx) => {
      await tx.useCase.update({
        where: { id },
        data: {
          title: dto.title ?? undefined,
          area: normalizedArea ?? undefined,
        },
      });

      if (dto.content || dto.summary) {
        const summary = dto.summary ?? latestVersion?.summary;
        const content = dto.content ?? latestVersion?.content;

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
   * Batch get use cases by IDs
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

    return useCases.map((uc) => this.mapToResponse(uc));
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
