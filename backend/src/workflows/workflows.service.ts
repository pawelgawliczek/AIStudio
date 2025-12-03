import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateWorkflowDto, UpdateWorkflowDto, WorkflowResponseDto } from './dto';
import { TemplateParserService } from './template-parser.service';

@Injectable()
export class WorkflowsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly templateParser: TemplateParserService,
  ) {}

  async create(projectId: string, dto: CreateWorkflowDto): Promise<WorkflowResponseDto> {
    // Verify project exists
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      throw new NotFoundException(`Project with ID ${projectId} not found`);
    }

    // Validate component assignments if provided
    if (dto.componentAssignments && dto.componentAssignments.length > 0) {
      this.validateComponentAssignments(dto.componentAssignments);

      // Verify all component IDs exist
      const componentIds = dto.componentAssignments.map((ca) => ca.componentId);
      const components = await this.prisma.component.findMany({
        where: {
          id: { in: componentIds },
          projectId,
        },
      });

      if (components.length !== componentIds.length) {
        throw new BadRequestException('One or more component IDs are invalid or do not belong to this project');
      }
    }

    const workflow = await this.prisma.workflow.create({
      data: {
        projectId,
        name: dto.name,
        description: dto.description,
        version: dto.version ?? 'v1.0',
        triggerConfig: dto.triggerConfig,
        componentAssignments: (dto.componentAssignments || []) as any,
        active: dto.active ?? true,
      },
    });

    return this.mapToResponseDto(workflow);
  }

  /**
   * Validate that component names are unique within the workflow
   */
  private validateComponentAssignments(assignments: any[]): void {
    const names = assignments.map((a) => a.componentName);
    const uniqueNames = new Set(names);

    if (names.length !== uniqueNames.size) {
      // Find duplicates
      const duplicates = names.filter((name, index) => names.indexOf(name) !== index);
      throw new BadRequestException({
        message: 'Component names must be unique within a workflow',
        duplicates: [...new Set(duplicates)],
      });
    }
  }

  async findAll(
    projectId: string,
    options?: {
      active?: boolean;
      search?: string;
    },
  ): Promise<WorkflowResponseDto[]> {
    const where: any = {
      projectId,
      isDeprecated: false, // Only show non-deprecated versions
    };

    if (options?.active !== undefined) {
      where.active = options.active;
    }

    if (options?.search) {
      where.OR = [
        { name: { contains: options.search, mode: 'insensitive' } },
        { description: { contains: options.search, mode: 'insensitive' } },
      ];
    }

    // Get all workflows and group by base name to find latest versions
    const allWorkflows = await this.prisma.workflow.findMany({
      where,
      orderBy: [
        { versionMajor: 'desc' },
        { versionMinor: 'desc' },
      ],
    });

    // Group by name and take only the latest version (highest versionMajor.versionMinor)
    const workflowsByName = new Map<string, any>();
    for (const workflow of allWorkflows) {
      const existing = workflowsByName.get(workflow.name);
      if (!existing ||
          workflow.versionMajor > existing.versionMajor ||
          (workflow.versionMajor === existing.versionMajor && workflow.versionMinor > existing.versionMinor)) {
        workflowsByName.set(workflow.name, workflow);
      }
    }

    const workflows = Array.from(workflowsByName.values());

    return workflows.map((w) => this.mapToResponseDto(w));
  }

  async findOne(id: string, includeStats = false): Promise<WorkflowResponseDto> {
    const workflow = await this.prisma.workflow.findUnique({
      where: { id },
    });

    if (!workflow) {
      throw new NotFoundException(`Workflow with ID ${id} not found`);
    }

    const response = this.mapToResponseDto(workflow);

    if (includeStats) {
      response.usageStats = await this.getWorkflowStats(id);
    }

    return response;
  }

  async update(id: string, dto: UpdateWorkflowDto): Promise<WorkflowResponseDto> {
    const existing = await this.prisma.workflow.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`Workflow with ID ${id} not found`);
    }

    const updated = await this.prisma.workflow.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        version: dto.version,
        triggerConfig: dto.triggerConfig,
        componentAssignments: dto.componentAssignments ? (dto.componentAssignments as any) : undefined,
        active: dto.active,
      },
    });

    return this.mapToResponseDto(updated);
  }

  async remove(id: string): Promise<void> {
    const workflow = await this.prisma.workflow.findUnique({
      where: { id },
      include: {
        workflowRuns: { take: 1 },
      },
    });

    if (!workflow) {
      throw new NotFoundException(`Workflow with ID ${id} not found`);
    }

    // Check if workflow has any execution history
    if (workflow.workflowRuns && workflow.workflowRuns.length > 0) {
      throw new BadRequestException(
        'Cannot delete workflow with execution history. Consider deactivating instead.',
      );
    }

    await this.prisma.workflow.delete({
      where: { id },
    });
  }

  async deactivate(id: string): Promise<WorkflowResponseDto> {
    const workflow = await this.prisma.workflow.findUnique({
      where: { id },
    });

    if (!workflow) {
      throw new NotFoundException(`Workflow with ID ${id} not found`);
    }

    const updated = await this.prisma.workflow.update({
      where: { id },
      data: { active: false },
    });

    return this.mapToResponseDto(updated);
  }

  async activate(id: string): Promise<WorkflowResponseDto> {
    const workflow = await this.prisma.workflow.findUnique({
      where: { id },
    });

    if (!workflow) {
      throw new NotFoundException(`Workflow with ID ${id} not found`);
    }

    const updated = await this.prisma.workflow.update({
      where: { id },
      data: { active: true },
    });

    return this.mapToResponseDto(updated);
  }

  private async getWorkflowStats(workflowId: string) {
    const runs = await this.prisma.workflowRun.findMany({
      where: { workflowId },
    });

    if (runs.length === 0) {
      return {
        totalRuns: 0,
        avgRuntime: 0,
        avgCost: 0,
        successRate: 0,
      };
    }

    const successfulRuns = runs.filter((r) => r.status === 'completed').length;
    const totalRuntime = runs.reduce((sum, r) => sum + (r.durationSeconds || 0), 0);
    const totalCost = runs.reduce((sum, r) => sum + (r.estimatedCost || 0), 0);

    return {
      totalRuns: runs.length,
      avgRuntime: totalRuntime / runs.length,
      avgCost: totalCost / runs.length,
      successRate: (successfulRuns / runs.length) * 100,
    };
  }

  private mapToResponseDto(workflow: any): WorkflowResponseDto {
    return {
      id: workflow.id,
      projectId: workflow.projectId,
      name: workflow.name,
      description: workflow.description,
      version: `v${workflow.versionMajor}.${workflow.versionMinor}`, // Construct version from versionMajor/versionMinor
      versionMajor: workflow.versionMajor,
      versionMinor: workflow.versionMinor,
      triggerConfig: workflow.triggerConfig,
      componentAssignments: workflow.componentAssignments || [],
      active: workflow.active,
      createdAt: workflow.createdAt,
      updatedAt: workflow.updatedAt,
    };
  }
}
