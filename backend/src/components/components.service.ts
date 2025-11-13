import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateComponentDto, UpdateComponentDto, ComponentResponseDto } from './dto';

@Injectable()
export class ComponentsService {
  constructor(private prisma: PrismaService) {}

  async create(projectId: string, dto: CreateComponentDto): Promise<ComponentResponseDto> {
    // Validate project exists
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      throw new NotFoundException(`Project ${projectId} not found`);
    }

    // Create component
    const component = await this.prisma.component.create({
      data: {
        projectId,
        name: dto.name,
        description: dto.description,
        inputInstructions: dto.inputInstructions,
        operationInstructions: dto.operationInstructions,
        outputInstructions: dto.outputInstructions,
        config: dto.config as any,
        tools: dto.tools,
        subtaskConfig: dto.subtaskConfig as any,
        onFailure: dto.onFailure,
        tags: dto.tags || [],
        active: dto.active ?? true,
        version: dto.version || 'v1.0',
      },
    });

    return this.mapToResponse(component);
  }

  async findAll(
    projectId: string,
    options?: {
      active?: boolean;
      tags?: string[];
      search?: string;
    },
  ): Promise<ComponentResponseDto[]> {
    const where: any = { projectId };

    if (options?.active !== undefined) {
      where.active = options.active;
    }

    if (options?.tags && options.tags.length > 0) {
      where.tags = {
        hasSome: options.tags,
      };
    }

    if (options?.search) {
      where.OR = [
        { name: { contains: options.search, mode: 'insensitive' } },
        { description: { contains: options.search, mode: 'insensitive' } },
      ];
    }

    const components = await this.prisma.component.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    // Get usage stats for all components
    const componentsWithStats = await Promise.all(
      components.map(async (component) => {
        const stats = await this.getComponentStats(component.id);
        return {
          ...this.mapToResponse(component),
          usageStats: stats,
        };
      }),
    );

    return componentsWithStats;
  }

  async findOne(id: string, includeStats = false): Promise<ComponentResponseDto> {
    const component = await this.prisma.component.findUnique({
      where: { id },
    });

    if (!component) {
      throw new NotFoundException(`Component ${id} not found`);
    }

    const response = this.mapToResponse(component);

    if (includeStats) {
      response.usageStats = await this.getComponentStats(id);
    }

    return response;
  }

  async update(id: string, dto: UpdateComponentDto): Promise<ComponentResponseDto> {
    const existing = await this.prisma.component.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`Component ${id} not found`);
    }

    const updated = await this.prisma.component.update({
      where: { id },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.inputInstructions && { inputInstructions: dto.inputInstructions }),
        ...(dto.operationInstructions && { operationInstructions: dto.operationInstructions }),
        ...(dto.outputInstructions && { outputInstructions: dto.outputInstructions }),
        ...(dto.config && { config: dto.config as any }),
        ...(dto.tools && { tools: dto.tools }),
        ...(dto.subtaskConfig !== undefined && { subtaskConfig: dto.subtaskConfig as any }),
        ...(dto.onFailure && { onFailure: dto.onFailure }),
        ...(dto.tags && { tags: dto.tags }),
        ...(dto.active !== undefined && { active: dto.active }),
        ...(dto.version && { version: dto.version }),
      },
    });

    return this.mapToResponse(updated);
  }

  async remove(id: string): Promise<void> {
    const component = await this.prisma.component.findUnique({
      where: { id },
      include: {
        componentRuns: {
          take: 1,
        },
      },
    });

    if (!component) {
      throw new NotFoundException(`Component ${id} not found`);
    }

    // Check if component has been used
    if (component.componentRuns.length > 0) {
      throw new BadRequestException(
        'Cannot delete component that has execution history. Deactivate it instead.',
      );
    }

    await this.prisma.component.delete({
      where: { id },
    });
  }

  async deactivate(id: string): Promise<ComponentResponseDto> {
    return this.update(id, { active: false });
  }

  async activate(id: string): Promise<ComponentResponseDto> {
    return this.update(id, { active: true });
  }

  private async getComponentStats(componentId: string) {
    const runs = await this.prisma.componentRun.findMany({
      where: { componentId },
      select: {
        durationSeconds: true,
        cost: true,
        status: true,
      },
    });

    if (runs.length === 0) {
      return {
        totalRuns: 0,
        avgRuntime: 0,
        avgCost: 0,
        successRate: 0,
      };
    }

    const successfulRuns = runs.filter((r) => r.status === 'completed');
    const totalRuntime = runs.reduce((sum, r) => sum + (r.durationSeconds || 0), 0);
    const totalCost = runs.reduce((sum, r) => sum + (r.cost || 0), 0);

    return {
      totalRuns: runs.length,
      avgRuntime: Math.round(totalRuntime / runs.length),
      avgCost: parseFloat((totalCost / runs.length).toFixed(4)),
      successRate: parseFloat(((successfulRuns.length / runs.length) * 100).toFixed(2)),
    };
  }

  private mapToResponse(component: any): ComponentResponseDto {
    return {
      id: component.id,
      projectId: component.projectId,
      name: component.name,
      description: component.description,
      inputInstructions: component.inputInstructions,
      operationInstructions: component.operationInstructions,
      outputInstructions: component.outputInstructions,
      config: component.config,
      tools: component.tools,
      subtaskConfig: component.subtaskConfig,
      onFailure: component.onFailure,
      tags: component.tags,
      active: component.active,
      version: component.version,
      createdAt: component.createdAt,
      updatedAt: component.updatedAt,
    };
  }

  /**
   * Test a component with sample data (sandbox execution)
   * This would integrate with the actual execution engine in Phase 3
   */
  async testComponent(id: string, testInput: any): Promise<any> {
    const component = await this.findOne(id);

    // TODO: Implement actual test execution in Phase 3
    // For now, return a mock response
    return {
      componentId: id,
      componentName: component.name,
      testInput,
      status: 'simulated',
      message: 'Test execution will be implemented in Phase 3 (Execution Engine)',
      estimatedCost: 0.0,
      estimatedRuntime: 0,
    };
  }
}
