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

    // Verify coordinator exists and belongs to the project
    const coordinator = await this.prisma.component.findUnique({
      where: { id: dto.coordinatorId },
    });

    if (!coordinator || coordinator.projectId !== projectId) {
      throw new BadRequestException('Invalid coordinator ID or coordinator does not belong to this project');
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

    // Validate coordinator instructions against component assignments
    if (dto.componentAssignments && dto.componentAssignments.length > 0) {
      const coordinatorInstructions = coordinator.operationInstructions || '';
      const validation = this.templateParser.validateReferences(
        coordinatorInstructions,
        dto.componentAssignments as any,
      );

      if (!validation.valid) {
        throw new BadRequestException({
          message: 'Coordinator instructions contain invalid template references',
          errors: validation.errors,
        });
      }
    }

    const workflow = await this.prisma.workflow.create({
      data: {
        projectId,
        coordinatorId: dto.coordinatorId,
        name: dto.name,
        description: dto.description,
        version: dto.version ?? 'v1.0',
        triggerConfig: dto.triggerConfig,
        componentAssignments: (dto.componentAssignments || []) as any,
        active: dto.active ?? true,
      },
      include: {
        coordinator: true,
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
      coordinatorId?: string;
      search?: string;
    },
  ): Promise<WorkflowResponseDto[]> {
    const where: any = { projectId };

    if (options?.active !== undefined) {
      where.active = options.active;
    }

    if (options?.coordinatorId) {
      where.coordinatorId = options.coordinatorId;
    }

    if (options?.search) {
      where.OR = [
        { name: { contains: options.search, mode: 'insensitive' } },
        { description: { contains: options.search, mode: 'insensitive' } },
      ];
    }

    const workflows = await this.prisma.workflow.findMany({
      where,
      include: {
        coordinator: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    // Fetch component names for coordinators
    const workflowsWithComponents = await Promise.all(
      workflows.map(async (workflow) => {
        const coordinatorConfig = (workflow.coordinator?.config as any) || {};
        const componentIds = coordinatorConfig.componentIds || [];
        if (componentIds.length > 0) {
          const components = await this.prisma.component.findMany({
            where: {
              id: { in: componentIds },
            },
            select: {
              id: true,
              name: true,
            },
          });
          return {
            ...workflow,
            coordinator: {
              ...workflow.coordinator,
              components,
            },
          };
        }
        return workflow;
      }),
    );

    return workflowsWithComponents.map((w) => this.mapToResponseDto(w));
  }

  async findOne(id: string, includeStats = false): Promise<WorkflowResponseDto> {
    const workflow = await this.prisma.workflow.findUnique({
      where: { id },
      include: {
        coordinator: true,
        activeWorkflows: true,
      },
    });

    if (!workflow) {
      throw new NotFoundException(`Workflow with ID ${id} not found`);
    }

    const response = this.mapToResponseDto(workflow);

    if (includeStats) {
      response.usageStats = await this.getWorkflowStats(id);
    }

    if (workflow.activeWorkflows && workflow.activeWorkflows.length > 0) {
      const activeWorkflow = workflow.activeWorkflows[0];
      response.activationStatus = {
        isActivated: true,
        activatedAt: activeWorkflow.activatedAt,
        activatedBy: activeWorkflow.activatedBy,
        filesGenerated: activeWorkflow.filesGenerated,
      };
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

    // Verify coordinator if provided
    if (dto.coordinatorId) {
      const coordinator = await this.prisma.component.findUnique({
        where: { id: dto.coordinatorId },
      });

      if (!coordinator || coordinator.projectId !== existing.projectId) {
        throw new BadRequestException('Invalid coordinator ID or coordinator does not belong to this project');
      }
    }

    const updated = await this.prisma.workflow.update({
      where: { id },
      data: {
        coordinatorId: dto.coordinatorId,
        name: dto.name,
        description: dto.description,
        version: dto.version,
        triggerConfig: dto.triggerConfig,
        componentAssignments: dto.componentAssignments ? (dto.componentAssignments as any) : undefined,
        active: dto.active,
      },
      include: {
        coordinator: true,
      },
    });

    return this.mapToResponseDto(updated);
  }

  async remove(id: string): Promise<void> {
    const workflow = await this.prisma.workflow.findUnique({
      where: { id },
      include: {
        workflowRuns: { take: 1 },
        activeWorkflows: true,
      },
    });

    if (!workflow) {
      throw new NotFoundException(`Workflow with ID ${id} not found`);
    }

    // Check if workflow is activated
    if (workflow.activeWorkflows && workflow.activeWorkflows.length > 0) {
      throw new BadRequestException(
        'Cannot delete an activated workflow. Deactivate it first using the deactivate endpoint.',
      );
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
      include: { coordinator: true },
    });

    if (!workflow) {
      throw new NotFoundException(`Workflow with ID ${id} not found`);
    }

    const updated = await this.prisma.workflow.update({
      where: { id },
      data: { active: false },
      include: { coordinator: true },
    });

    return this.mapToResponseDto(updated);
  }

  async activate(id: string): Promise<WorkflowResponseDto> {
    const workflow = await this.prisma.workflow.findUnique({
      where: { id },
      include: { coordinator: true },
    });

    if (!workflow) {
      throw new NotFoundException(`Workflow with ID ${id} not found`);
    }

    const updated = await this.prisma.workflow.update({
      where: { id },
      data: { active: true },
      include: { coordinator: true },
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
    // Extract coordinator-specific fields from config
    const coordinatorConfig = (workflow.coordinator?.config as any) || {};
    const componentIds = coordinatorConfig.componentIds || [];

    return {
      id: workflow.id,
      projectId: workflow.projectId,
      coordinatorId: workflow.coordinatorId,
      name: workflow.name,
      description: workflow.description,
      version: workflow.version,
      triggerConfig: workflow.triggerConfig,
      active: workflow.active,
      createdAt: workflow.createdAt,
      updatedAt: workflow.updatedAt,
      coordinator: workflow.coordinator
        ? {
            id: workflow.coordinator.id,
            name: workflow.coordinator.name,
            domain: coordinatorConfig.domain,
            flowDiagram: coordinatorConfig.flowDiagram,
            componentIds: componentIds,
            components: workflow.coordinator.components,
          }
        : undefined,
    };
  }
}
