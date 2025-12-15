import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  normalizeArea,
  findSimilarAreas,
  SIMILARITY_THRESHOLD,
} from '../use-cases/taxonomy.util';
import { CreateProjectDto, UpdateProjectDto } from './dto';

@Injectable()
export class ProjectsService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.project.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: {
            epics: true,
            stories: true,
            useCases: true,
          },
        },
      },
    });
  }

  async findOne(id: string) {
    const project = await this.prisma.project.findUnique({
      where: { id },
      include: {
        epics: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
        _count: {
          select: {
            epics: true,
            stories: true,
            useCases: true,
            commits: true,
            testCases: true,
          },
        },
      },
    });

    if (!project) {
      throw new NotFoundException(`Project with ID ${id} not found`);
    }

    return project;
  }

  async create(createProjectDto: CreateProjectDto) {
    // Check if project with same name already exists
    const existingProject = await this.prisma.project.findUnique({
      where: { name: createProjectDto.name },
    });

    if (existingProject) {
      throw new BadRequestException('Project with this name already exists');
    }

    return this.prisma.project.create({
      data: createProjectDto,
    });
  }

  async update(id: string, updateProjectDto: UpdateProjectDto) {
    const existingProject = await this.prisma.project.findUnique({ where: { id } });

    if (!existingProject) {
      throw new NotFoundException(`Project with ID ${id} not found`);
    }

    // If name is being updated, check if it's already taken
    if (updateProjectDto.name && updateProjectDto.name !== existingProject.name) {
      const nameTaken = await this.prisma.project.findUnique({
        where: { name: updateProjectDto.name },
      });

      if (nameTaken) {
        throw new BadRequestException('Project name already taken');
      }
    }

    return this.prisma.project.update({
      where: { id },
      data: updateProjectDto,
    });
  }

  async remove(id: string) {
    const project = await this.prisma.project.findUnique({ where: { id } });

    if (!project) {
      throw new NotFoundException(`Project with ID ${id} not found`);
    }

    await this.prisma.project.delete({ where: { id } });

    return { message: 'Project deleted successfully' };
  }

  // Taxonomy Management Methods
  async listTaxonomy(projectId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { taxonomy: true },
    });

    if (!project) {
      throw new NotFoundException(`Project with ID ${projectId} not found`);
    }

    const taxonomy = (project.taxonomy as string[]) || [];

    // Get usage counts for each area
    const areasWithUsage = await Promise.all(
      taxonomy.map(async (area) => {
        const usageCount = await this.prisma.useCase.count({
          where: { projectId, area },
        });
        return { area, usageCount };
      })
    );

    return areasWithUsage;
  }

  async addTaxonomyArea(projectId: string, area: string, force = false) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { taxonomy: true },
    });

    if (!project) {
      throw new NotFoundException(`Project with ID ${projectId} not found`);
    }

    const taxonomy = (project.taxonomy as string[]) || [];
    const normalized = normalizeArea(area);

    if (!normalized) {
      throw new BadRequestException('Area name cannot be empty');
    }

    // Check for exact match
    const exactMatch = taxonomy.find(
      (a) => a.toLowerCase() === normalized.toLowerCase()
    );

    if (exactMatch) {
      throw new BadRequestException(`Area "${exactMatch}" already exists`);
    }

    // Check for similar areas
    const similar = findSimilarAreas(normalized, taxonomy);
    if (similar.length > 0 && similar[0].distance <= SIMILARITY_THRESHOLD && !force) {
      throw new BadRequestException(
        `Similar area "${similar[0].area}" already exists (distance: ${similar[0].distance})`
      );
    }

    const newTaxonomy = [...taxonomy, normalized];

    await this.prisma.project.update({
      where: { id: projectId },
      data: { taxonomy: newTaxonomy },
    });

    return {
      added: normalized,
      taxonomy: newTaxonomy,
      warnings: force && similar.length > 0
        ? [`Similar areas exist: ${similar.map((s) => s.area).join(', ')}`]
        : undefined,
    };
  }

  async removeTaxonomyArea(projectId: string, area: string, force = false) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { taxonomy: true },
    });

    if (!project) {
      throw new NotFoundException(`Project with ID ${projectId} not found`);
    }

    const taxonomy = (project.taxonomy as string[]) || [];
    const normalized = normalizeArea(area);

    const areaIndex = taxonomy.findIndex(
      (a) => a.toLowerCase() === normalized.toLowerCase()
    );

    if (areaIndex === -1) {
      throw new NotFoundException(`Area "${normalized}" not found in taxonomy`);
    }

    const areaToRemove = taxonomy[areaIndex];

    // Check usage
    const usageCount = await this.prisma.useCase.count({
      where: { projectId, area: areaToRemove },
    });

    if (usageCount > 0 && !force) {
      throw new BadRequestException(
        `Cannot remove area "${areaToRemove}": ${usageCount} use cases are using this area`
      );
    }

    const newTaxonomy = taxonomy.filter((_, index) => index !== areaIndex);

    await this.prisma.project.update({
      where: { id: projectId },
      data: { taxonomy: newTaxonomy },
    });

    return {
      removed: areaToRemove,
      taxonomy: newTaxonomy,
      warnings: usageCount > 0
        ? [`${usageCount} use cases were using this area and are now orphaned`]
        : undefined,
    };
  }

  async renameTaxonomyArea(projectId: string, area: string, newName: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { taxonomy: true },
    });

    if (!project) {
      throw new NotFoundException(`Project with ID ${projectId} not found`);
    }

    const taxonomy = (project.taxonomy as string[]) || [];
    const normalized = normalizeArea(area);
    const newNormalized = normalizeArea(newName);

    const areaIndex = taxonomy.findIndex(
      (a) => a.toLowerCase() === normalized.toLowerCase()
    );

    if (areaIndex === -1) {
      throw new NotFoundException(`Area "${normalized}" not found in taxonomy`);
    }

    const oldArea = taxonomy[areaIndex];

    // Check if new name already exists
    const existingNew = taxonomy.find(
      (a) => a.toLowerCase() === newNormalized.toLowerCase()
    );

    if (existingNew) {
      throw new BadRequestException(`Area "${existingNew}" already exists`);
    }

    // Use transaction to update both taxonomy and use cases
    const result = await this.prisma.$transaction(async (tx) => {
      const newTaxonomy = [...taxonomy];
      newTaxonomy[areaIndex] = newNormalized;

      await tx.project.update({
        where: { id: projectId },
        data: { taxonomy: newTaxonomy },
      });

      const updateResult = await tx.useCase.updateMany({
        where: { projectId, area: oldArea },
        data: { area: newNormalized },
      });

      return {
        renamed: { from: oldArea, to: newNormalized },
        useCasesUpdated: updateResult.count,
        taxonomy: newTaxonomy,
      };
    });

    return result;
  }

  async mergeTaxonomyAreas(
    projectId: string,
    sourceAreas: string[],
    targetArea: string
  ) {
    if (!sourceAreas || sourceAreas.length < 2) {
      throw new BadRequestException('Merge requires at least 2 source areas');
    }

    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { taxonomy: true },
    });

    if (!project) {
      throw new NotFoundException(`Project with ID ${projectId} not found`);
    }

    const taxonomy = (project.taxonomy as string[]) || [];
    const normalizedTarget = normalizeArea(targetArea);
    const normalizedAreas = sourceAreas.map((a) => normalizeArea(a));

    // Validate all source areas exist
    for (const area of normalizedAreas) {
      const exists = taxonomy.find((a) => a.toLowerCase() === area.toLowerCase());
      if (!exists) {
        throw new NotFoundException(`Area "${area}" not found in taxonomy`);
      }
    }

    // Use transaction
    const result = await this.prisma.$transaction(async (tx) => {
      let newTaxonomy = taxonomy.filter(
        (a) => !normalizedAreas.some((na) => na.toLowerCase() === a.toLowerCase())
      );

      if (!newTaxonomy.some((a) => a.toLowerCase() === normalizedTarget.toLowerCase())) {
        newTaxonomy = [...newTaxonomy, normalizedTarget];
      }

      await tx.project.update({
        where: { id: projectId },
        data: { taxonomy: newTaxonomy },
      });

      const updateResult = await tx.useCase.updateMany({
        where: { projectId, area: { in: normalizedAreas } },
        data: { area: normalizedTarget },
      });

      return {
        merged: { from: normalizedAreas, to: normalizedTarget },
        useCasesUpdated: updateResult.count,
        taxonomy: newTaxonomy,
      };
    });

    return result;
  }

  async validateTaxonomyArea(projectId: string, area: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { taxonomy: true },
    });

    if (!project) {
      throw new NotFoundException(`Project with ID ${projectId} not found`);
    }

    const taxonomy = (project.taxonomy as string[]) || [];
    const normalized = normalizeArea(area);

    const exactMatch = taxonomy.find(
      (a) => a.toLowerCase() === normalized.toLowerCase()
    );

    if (exactMatch) {
      return { valid: true, exactMatch: true };
    }

    const similar = findSimilarAreas(normalized, taxonomy);

    return {
      valid: false,
      exactMatch: false,
      suggestions: similar,
    };
  }

  async suggestTaxonomyAreas(projectId: string, area: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { taxonomy: true },
    });

    if (!project) {
      throw new NotFoundException(`Project with ID ${projectId} not found`);
    }

    const taxonomy = (project.taxonomy as string[]) || [];
    const similar = findSimilarAreas(area, taxonomy);

    return similar;
  }
}
