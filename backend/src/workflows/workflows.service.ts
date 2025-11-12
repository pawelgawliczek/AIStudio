import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateWorkflowDto, UpdateWorkflowDto, WorkflowResponseDto } from './dto';

@Injectable()
export class WorkflowsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(projectId: string, dto: CreateWorkflowDto): Promise<WorkflowResponseDto> {
    // Verify project exists
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      throw new NotFoundException(`Project with ID ${projectId} not found`);
    }

    // Verify coordinator exists and belongs to the project
    const coordinator = await this.prisma.coordinatorAgent.findUnique({
      where: { id: dto.coordinatorId },
    });

    if (!coordinator || coordinator.projectId !== projectId) {
      throw new BadRequestException('Invalid coordinator ID or coordinator does not belong to this project');
    }

    const workflow = await this.prisma.workflow.create({
      data: {
        projectId,
        coordinatorId: dto.coordinatorId,
        name: dto.name,
        description: dto.description,
        version: dto.version ?? 'v1.0',
        triggerConfig: dto.triggerConfig,
        active: dto.active ?? true,
      },
      include: {
        coordinator: true,
      },
    });

    return this.mapToResponseDto(workflow);
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

    return workflows.map((w) => this.mapToResponseDto(w));
  }

  async findOne(id: string, includeStats = false): Promise<WorkflowResponseDto> {
    const workflow = await this.prisma.workflow.findUnique({
      where: { id },
      include: {
        coordinator: true,
        activeWorkflow: true,
      },
    });

    if (!workflow) {
      throw new NotFoundException(`Workflow with ID ${id} not found`);
    }

    const response = this.mapToResponseDto(workflow);

    if (includeStats) {
      response.usageStats = await this.getWorkflowStats(id);
    }

    if (workflow.activeWorkflow) {
      response.activationStatus = {
        isActivated: true,
        activatedAt: workflow.activeWorkflow.activatedAt,
        activatedBy: workflow.activeWorkflow.activatedBy,
        filesGenerated: workflow.activeWorkflow.filesGenerated,
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
      const coordinator = await this.prisma.coordinatorAgent.findUnique({
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
        activeWorkflow: true,
      },
    });

    if (!workflow) {
      throw new NotFoundException(`Workflow with ID ${id} not found`);
    }

    // Check if workflow is activated
    if (workflow.activeWorkflow) {
      throw new BadRequestException(
        'Cannot delete an activated workflow. Deactivate it first using the deactivate endpoint.',
      );
    }

    // Check if workflow has any execution history
    if (workflow.workflowRuns.length > 0) {
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
    const totalRuntime = runs.reduce((sum, r) => sum + (r.totalRuntime || 0), 0);
    const totalCost = runs.reduce((sum, r) => sum + (r.totalCost || 0), 0);

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
            domain: workflow.coordinator.domain,
          }
        : undefined,
    };
  }
}
