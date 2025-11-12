import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCoordinatorDto, UpdateCoordinatorDto, CoordinatorResponseDto } from './dto';

@Injectable()
export class CoordinatorsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(projectId: string, dto: CreateCoordinatorDto): Promise<CoordinatorResponseDto> {
    // Verify project exists
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      throw new NotFoundException(`Project with ID ${projectId} not found`);
    }

    // Verify all component IDs exist
    if (dto.componentIds && dto.componentIds.length > 0) {
      const components = await this.prisma.component.findMany({
        where: {
          id: { in: dto.componentIds },
          projectId,
        },
      });

      if (components.length !== dto.componentIds.length) {
        throw new BadRequestException('One or more component IDs are invalid');
      }
    }

    const coordinator = await this.prisma.coordinatorAgent.create({
      data: {
        projectId,
        name: dto.name,
        description: dto.description,
        domain: dto.domain,
        coordinatorInstructions: dto.coordinatorInstructions,
        config: dto.config,
        tools: dto.tools,
        decisionStrategy: dto.decisionStrategy,
        componentIds: dto.componentIds,
        active: dto.active ?? true,
        version: dto.version ?? 'v1.0',
      },
    });

    return this.mapToResponseDto(coordinator);
  }

  async findAll(
    projectId: string,
    options?: {
      active?: boolean;
      domain?: string;
      search?: string;
    },
  ): Promise<CoordinatorResponseDto[]> {
    const where: any = { projectId };

    if (options?.active !== undefined) {
      where.active = options.active;
    }

    if (options?.domain) {
      where.domain = options.domain;
    }

    if (options?.search) {
      where.OR = [
        { name: { contains: options.search, mode: 'insensitive' } },
        { description: { contains: options.search, mode: 'insensitive' } },
      ];
    }

    const coordinators = await this.prisma.coordinatorAgent.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return coordinators.map((c) => this.mapToResponseDto(c));
  }

  async findOne(id: string, includeStats = false): Promise<CoordinatorResponseDto> {
    const coordinator = await this.prisma.coordinatorAgent.findUnique({
      where: { id },
    });

    if (!coordinator) {
      throw new NotFoundException(`Coordinator with ID ${id} not found`);
    }

    const response = this.mapToResponseDto(coordinator);

    if (includeStats) {
      response.usageStats = await this.getCoordinatorStats(id);
    }

    return response;
  }

  async update(id: string, dto: UpdateCoordinatorDto): Promise<CoordinatorResponseDto> {
    const existing = await this.prisma.coordinatorAgent.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`Coordinator with ID ${id} not found`);
    }

    // Verify component IDs if provided
    if (dto.componentIds && dto.componentIds.length > 0) {
      const components = await this.prisma.component.findMany({
        where: {
          id: { in: dto.componentIds },
          projectId: existing.projectId,
        },
      });

      if (components.length !== dto.componentIds.length) {
        throw new BadRequestException('One or more component IDs are invalid');
      }
    }

    const updated = await this.prisma.coordinatorAgent.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        domain: dto.domain,
        coordinatorInstructions: dto.coordinatorInstructions,
        config: dto.config,
        tools: dto.tools,
        decisionStrategy: dto.decisionStrategy,
        componentIds: dto.componentIds,
        active: dto.active,
        version: dto.version,
      },
    });

    return this.mapToResponseDto(updated);
  }

  async remove(id: string): Promise<void> {
    const coordinator = await this.prisma.coordinatorAgent.findUnique({
      where: { id },
      include: {
        workflowRuns: { take: 1 },
      },
    });

    if (!coordinator) {
      throw new NotFoundException(`Coordinator with ID ${id} not found`);
    }

    // Check if coordinator has any execution history
    if (coordinator.workflowRuns.length > 0) {
      throw new BadRequestException(
        'Cannot delete coordinator with execution history. Consider deactivating instead.',
      );
    }

    await this.prisma.coordinatorAgent.delete({
      where: { id },
    });
  }

  async deactivate(id: string): Promise<CoordinatorResponseDto> {
    const coordinator = await this.prisma.coordinatorAgent.findUnique({
      where: { id },
    });

    if (!coordinator) {
      throw new NotFoundException(`Coordinator with ID ${id} not found`);
    }

    const updated = await this.prisma.coordinatorAgent.update({
      where: { id },
      data: { active: false },
    });

    return this.mapToResponseDto(updated);
  }

  async activate(id: string): Promise<CoordinatorResponseDto> {
    const coordinator = await this.prisma.coordinatorAgent.findUnique({
      where: { id },
    });

    if (!coordinator) {
      throw new NotFoundException(`Coordinator with ID ${id} not found`);
    }

    const updated = await this.prisma.coordinatorAgent.update({
      where: { id },
      data: { active: true },
    });

    return this.mapToResponseDto(updated);
  }

  private async getCoordinatorStats(coordinatorId: string) {
    const runs = await this.prisma.workflowRun.findMany({
      where: { coordinatorId },
      include: {
        componentRuns: true,
      },
    });

    if (runs.length === 0) {
      return {
        totalRuns: 0,
        avgRuntime: 0,
        avgCost: 0,
        successRate: 0,
        avgComponentsUsed: 0,
      };
    }

    const successfulRuns = runs.filter((r) => r.status === 'completed').length;
    const totalRuntime = runs.reduce((sum, r) => sum + (r.totalRuntime || 0), 0);
    const totalCost = runs.reduce((sum, r) => sum + (r.totalCost || 0), 0);
    const totalComponents = runs.reduce((sum, r) => sum + r.componentRuns.length, 0);

    return {
      totalRuns: runs.length,
      avgRuntime: totalRuntime / runs.length,
      avgCost: totalCost / runs.length,
      successRate: (successfulRuns / runs.length) * 100,
      avgComponentsUsed: totalComponents / runs.length,
    };
  }

  private mapToResponseDto(coordinator: any): CoordinatorResponseDto {
    return {
      id: coordinator.id,
      projectId: coordinator.projectId,
      name: coordinator.name,
      description: coordinator.description,
      domain: coordinator.domain,
      coordinatorInstructions: coordinator.coordinatorInstructions,
      config: coordinator.config,
      tools: coordinator.tools,
      decisionStrategy: coordinator.decisionStrategy,
      componentIds: coordinator.componentIds,
      active: coordinator.active,
      version: coordinator.version,
      createdAt: coordinator.createdAt,
      updatedAt: coordinator.updatedAt,
    };
  }
}
