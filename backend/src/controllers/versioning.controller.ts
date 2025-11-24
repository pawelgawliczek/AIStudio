import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { VersioningService } from '../services/versioning.service';
import { ChecksumService } from '../services/checksum.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateVersionDto,
  CompareVersionsQueryDto,
  ComponentVersionResponse,
  CoordinatorVersionResponse,
  WorkflowVersionResponse,
  VersionComparisonResponse,
  ChecksumVerificationResponse,
} from '../dtos/versioning.dto';

@Controller('versioning')
export class VersioningController {
  private readonly logger = new Logger(VersioningController.name);

  constructor(
    private readonly versioningService: VersioningService,
    private readonly checksumService: ChecksumService,
    private readonly prisma: PrismaService,
  ) {}

  // ============================================================================
  // COMPONENT VERSIONING ENDPOINTS
  // ============================================================================

  @Get('components/:componentId/versions')
  async getComponentVersionHistory(
    @Param('componentId') componentId: string,
  ): Promise<ComponentVersionResponse[]> {
    this.logger.log(`Getting version history for component ${componentId}`);

    // Get the full version tree (including all descendants)
    const tree = await this.versioningService.getVersionLineageTree('component', componentId);

    // Flatten tree to get all versions
    const flattenTree = (node: any): any[] => {
      const versions = [node];
      if (node.children && node.children.length > 0) {
        node.children.forEach((child: any) => {
          versions.push(...flattenTree(child));
        });
      }
      return versions;
    };

    const allVersionIds = flattenTree(tree).map(v => v.id);

    // Fetch full component data for each version
    const versions = await Promise.all(
      allVersionIds.map(async (versionId) => {
        const component = await this.prisma.component.findUnique({
          where: { id: versionId },
        });
        if (!component) {
          throw new NotFoundException(`Component version ${versionId} not found`);
        }
        return this.mapComponentToVersionResponse(component);
      }),
    );

    return versions;
  }

  @Get('components/versions/:versionId')
  async getComponentVersion(
    @Param('versionId') versionId: string,
  ): Promise<ComponentVersionResponse> {
    this.logger.log(`Getting component version ${versionId}`);

    const component = await this.prisma.component.findUnique({
      where: { id: versionId },
    });

    if (!component) {
      throw new NotFoundException(`Component version ${versionId} not found`);
    }

    return this.mapComponentToVersionResponse(component);
  }

  @Post('components/:componentId/versions')
  async createComponentVersion(
    @Param('componentId') componentId: string,
    @Body() createVersionDto: CreateVersionDto,
  ): Promise<ComponentVersionResponse> {
    this.logger.log(`Creating new version for component ${componentId}`, createVersionDto);

    let newVersion;
    if (createVersionDto.majorVersion !== undefined) {
      newVersion = await this.versioningService.createMajorVersion(
        'component',
        componentId,
        createVersionDto.majorVersion,
        { changeDescription: createVersionDto.changeDescription },
      );
    } else {
      newVersion = await this.versioningService.createMinorVersion(
        'component',
        componentId,
        { changeDescription: createVersionDto.changeDescription },
      );
    }

    return this.mapComponentToVersionResponse(newVersion);
  }

  @Post('components/versions/:versionId/activate')
  async activateComponentVersion(
    @Param('versionId') versionId: string,
  ): Promise<ComponentVersionResponse> {
    this.logger.log(`Activating component version ${versionId}`);

    const component = await this.prisma.component.update({
      where: { id: versionId },
      data: { active: true },
    });

    return this.mapComponentToVersionResponse(component);
  }

  @Post('components/versions/:versionId/deactivate')
  async deactivateComponentVersion(
    @Param('versionId') versionId: string,
  ): Promise<ComponentVersionResponse> {
    this.logger.log(`Deactivating component version ${versionId}`);

    const component = await this.prisma.component.update({
      where: { id: versionId },
      data: { active: false },
    });

    return this.mapComponentToVersionResponse(component);
  }

  @Get('components/versions/compare')
  async compareComponentVersions(
    @Query() query: CompareVersionsQueryDto,
  ): Promise<VersionComparisonResponse> {
    this.logger.log(`Comparing component versions ${query.versionId1} vs ${query.versionId2}`);

    const [version1, version2] = await Promise.all([
      this.prisma.component.findUnique({ where: { id: query.versionId1 } }),
      this.prisma.component.findUnique({ where: { id: query.versionId2 } }),
    ]);

    if (!version1 || !version2) {
      throw new NotFoundException('One or both component versions not found');
    }

    return this.compareVersions('component', version1, version2);
  }

  @Post('components/versions/:versionId/verify-checksum')
  async verifyComponentChecksum(
    @Param('versionId') versionId: string,
  ): Promise<ChecksumVerificationResponse> {
    this.logger.log(`Verifying checksum for component version ${versionId}`);

    const component = await this.prisma.component.findUnique({
      where: { id: versionId },
    });

    if (!component) {
      throw new NotFoundException(`Component version ${versionId} not found`);
    }

    return this.verifyChecksum('component', component);
  }

  // ============================================================================
  // COORDINATOR VERSIONING ENDPOINTS
  // ============================================================================

  @Get('coordinators/:coordinatorId/versions')
  async getCoordinatorVersionHistory(
    @Param('coordinatorId') coordinatorId: string,
  ): Promise<CoordinatorVersionResponse[]> {
    this.logger.log(`Getting version history for coordinator ${coordinatorId}`);

    const history = await this.versioningService.getVersionHistory('component', coordinatorId);

    const versions = await Promise.all(
      history.map(async (item) => {
        const component = await this.prisma.component.findUnique({
          where: { id: item.id },
        });
        if (!component) {
          throw new NotFoundException(`Coordinator version ${item.id} not found`);
        }
        return this.mapCoordinatorToVersionResponse(component);
      }),
    );

    return versions;
  }

  @Get('coordinators/versions/:versionId')
  async getCoordinatorVersion(
    @Param('versionId') versionId: string,
  ): Promise<CoordinatorVersionResponse> {
    this.logger.log(`Getting coordinator version ${versionId}`);

    const component = await this.prisma.component.findUnique({
      where: { id: versionId },
    });

    if (!component) {
      throw new NotFoundException(`Coordinator version ${versionId} not found`);
    }

    return this.mapCoordinatorToVersionResponse(component);
  }

  @Post('coordinators/:coordinatorId/versions')
  async createCoordinatorVersion(
    @Param('coordinatorId') coordinatorId: string,
    @Body() createVersionDto: CreateVersionDto,
  ): Promise<CoordinatorVersionResponse> {
    this.logger.log(`Creating new version for coordinator ${coordinatorId}`, createVersionDto);

    let newVersion;
    if (createVersionDto.majorVersion !== undefined) {
      newVersion = await this.versioningService.createMajorVersion(
        'component',
        coordinatorId,
        createVersionDto.majorVersion,
        { changeDescription: createVersionDto.changeDescription },
      );
    } else {
      newVersion = await this.versioningService.createMinorVersion(
        'component',
        coordinatorId,
        { changeDescription: createVersionDto.changeDescription },
      );
    }

    return this.mapCoordinatorToVersionResponse(newVersion);
  }

  @Post('coordinators/versions/:versionId/activate')
  async activateCoordinatorVersion(
    @Param('versionId') versionId: string,
  ): Promise<CoordinatorVersionResponse> {
    this.logger.log(`Activating coordinator version ${versionId}`);

    const component = await this.prisma.component.update({
      where: { id: versionId },
      data: { active: true },
    });

    return this.mapCoordinatorToVersionResponse(component);
  }

  @Post('coordinators/versions/:versionId/deactivate')
  async deactivateCoordinatorVersion(
    @Param('versionId') versionId: string,
  ): Promise<CoordinatorVersionResponse> {
    this.logger.log(`Deactivating coordinator version ${versionId}`);

    const component = await this.prisma.component.update({
      where: { id: versionId },
      data: { active: false },
    });

    return this.mapCoordinatorToVersionResponse(component);
  }

  @Get('coordinators/versions/compare')
  async compareCoordinatorVersions(
    @Query() query: CompareVersionsQueryDto,
  ): Promise<VersionComparisonResponse> {
    this.logger.log(`Comparing coordinator versions ${query.versionId1} vs ${query.versionId2}`);

    const [version1, version2] = await Promise.all([
      this.prisma.component.findUnique({ where: { id: query.versionId1 } }),
      this.prisma.component.findUnique({ where: { id: query.versionId2 } }),
    ]);

    if (!version1 || !version2) {
      throw new NotFoundException('One or both coordinator versions not found');
    }

    return this.compareVersions('coordinator', version1, version2);
  }

  @Post('coordinators/versions/:versionId/verify-checksum')
  async verifyCoordinatorChecksum(
    @Param('versionId') versionId: string,
  ): Promise<ChecksumVerificationResponse> {
    this.logger.log(`Verifying checksum for coordinator version ${versionId}`);

    const component = await this.prisma.component.findUnique({
      where: { id: versionId },
    });

    if (!component) {
      throw new NotFoundException(`Coordinator version ${versionId} not found`);
    }

    return this.verifyChecksum('coordinator', component);
  }

  // ============================================================================
  // WORKFLOW VERSIONING ENDPOINTS
  // ============================================================================

  @Get('workflows/:workflowId/versions')
  async getWorkflowVersionHistory(
    @Param('workflowId') workflowId: string,
  ): Promise<WorkflowVersionResponse[]> {
    this.logger.log(`Getting version history for workflow ${workflowId}`);

    const history = await this.versioningService.getVersionHistory('workflow', workflowId);

    const versions = await Promise.all(
      history.map(async (item) => {
        const workflow = await this.prisma.workflow.findUnique({
          where: { id: item.id },
          include: { coordinator: true },
        });
        if (!workflow) {
          throw new NotFoundException(`Workflow version ${item.id} not found`);
        }
        return this.mapWorkflowToVersionResponse(workflow);
      }),
    );

    return versions;
  }

  @Get('workflows/versions/:versionId')
  async getWorkflowVersion(
    @Param('versionId') versionId: string,
  ): Promise<WorkflowVersionResponse> {
    this.logger.log(`Getting workflow version ${versionId}`);

    const workflow = await this.prisma.workflow.findUnique({
      where: { id: versionId },
      include: { coordinator: true },
    });

    if (!workflow) {
      throw new NotFoundException(`Workflow version ${versionId} not found`);
    }

    return this.mapWorkflowToVersionResponse(workflow);
  }

  @Post('workflows/:workflowId/versions')
  async createWorkflowVersion(
    @Param('workflowId') workflowId: string,
    @Body() createVersionDto: CreateVersionDto,
  ): Promise<WorkflowVersionResponse> {
    this.logger.log(`Creating new version for workflow ${workflowId}`, createVersionDto);

    let newVersion;
    if (createVersionDto.majorVersion !== undefined) {
      newVersion = await this.versioningService.createMajorVersion(
        'workflow',
        workflowId,
        createVersionDto.majorVersion,
        { changeDescription: createVersionDto.changeDescription },
      );
    } else {
      newVersion = await this.versioningService.createMinorVersion(
        'workflow',
        workflowId,
        { changeDescription: createVersionDto.changeDescription },
      );
    }

    const workflow = await this.prisma.workflow.findUnique({
      where: { id: newVersion.id },
      include: { coordinator: true },
    });

    return this.mapWorkflowToVersionResponse(workflow!);
  }

  @Post('workflows/versions/:versionId/activate')
  async activateWorkflowVersion(
    @Param('versionId') versionId: string,
  ): Promise<WorkflowVersionResponse> {
    this.logger.log(`Activating workflow version ${versionId}`);

    const workflow = await this.prisma.workflow.update({
      where: { id: versionId },
      data: { active: true },
      include: { coordinator: true },
    });

    return this.mapWorkflowToVersionResponse(workflow);
  }

  @Post('workflows/versions/:versionId/deactivate')
  async deactivateWorkflowVersion(
    @Param('versionId') versionId: string,
  ): Promise<WorkflowVersionResponse> {
    this.logger.log(`Deactivating workflow version ${versionId}`);

    const workflow = await this.prisma.workflow.update({
      where: { id: versionId },
      data: { active: false },
      include: { coordinator: true },
    });

    return this.mapWorkflowToVersionResponse(workflow);
  }

  @Get('workflows/versions/compare')
  async compareWorkflowVersions(
    @Query() query: CompareVersionsQueryDto,
  ): Promise<VersionComparisonResponse> {
    this.logger.log(`Comparing workflow versions ${query.versionId1} vs ${query.versionId2}`);

    const [version1, version2] = await Promise.all([
      this.prisma.workflow.findUnique({
        where: { id: query.versionId1 },
        include: { coordinator: true },
      }),
      this.prisma.workflow.findUnique({
        where: { id: query.versionId2 },
        include: { coordinator: true },
      }),
    ]);

    if (!version1 || !version2) {
      throw new NotFoundException('One or both workflow versions not found');
    }

    return this.compareVersions('workflow', version1, version2);
  }

  @Post('workflows/versions/:versionId/verify-checksum')
  async verifyWorkflowChecksum(
    @Param('versionId') versionId: string,
  ): Promise<ChecksumVerificationResponse> {
    this.logger.log(`Verifying checksum for workflow version ${versionId}`);

    const workflow = await this.prisma.workflow.findUnique({
      where: { id: versionId },
    });

    if (!workflow) {
      throw new NotFoundException(`Workflow version ${versionId} not found`);
    }

    return this.verifyChecksum('workflow', workflow);
  }

  // ============================================================================
  // PRIVATE HELPER METHODS
  // ============================================================================

  private mapComponentToVersionResponse(component: any): ComponentVersionResponse {
    const config = typeof component.config === 'string'
      ? JSON.parse(component.config)
      : component.config;

    return {
      id: component.id,
      componentId: component.parentId || component.id,
      versionMajor: component.versionMajor,
      versionMinor: component.versionMinor,
      version: `${component.versionMajor}.${component.versionMinor}`,
      inputInstructions: component.inputInstructions,
      operationInstructions: component.operationInstructions,
      outputInstructions: component.outputInstructions,
      config,
      tools: component.tools,
      active: component.active,
      checksum: component.instructionsChecksum,
      checksumAlgorithm: 'MD5',
      changeDescription: component.changeDescription,
      createdAt: component.createdAt.toISOString(),
      updatedAt: component.updatedAt.toISOString(),
    };
  }

  private mapCoordinatorToVersionResponse(component: any): CoordinatorVersionResponse {
    const config = typeof component.config === 'string'
      ? JSON.parse(component.config)
      : component.config;

    // Extract coordinator-specific fields from component
    const coordinatorInstructions = component.operationInstructions;
    const decisionStrategy = this.extractDecisionStrategy(component);

    return {
      id: component.id,
      coordinatorId: component.parentId || component.id,
      versionMajor: component.versionMajor,
      versionMinor: component.versionMinor,
      version: `${component.versionMajor}.${component.versionMinor}`,
      coordinatorInstructions,
      decisionStrategy,
      config,
      tools: component.tools,
      active: component.active,
      checksum: component.instructionsChecksum,
      checksumAlgorithm: 'MD5',
      changeDescription: component.changeDescription,
      createdAt: component.createdAt.toISOString(),
      updatedAt: component.updatedAt.toISOString(),
    };
  }

  private mapWorkflowToVersionResponse(workflow: any): WorkflowVersionResponse {
    const triggerConfig = typeof workflow.triggerConfig === 'string'
      ? JSON.parse(workflow.triggerConfig)
      : workflow.triggerConfig;

    return {
      id: workflow.id,
      workflowId: workflow.parentId || workflow.id,
      versionMajor: workflow.versionMajor,
      versionMinor: workflow.versionMinor,
      version: `${workflow.versionMajor}.${workflow.versionMinor}`,
      coordinatorId: workflow.coordinatorId,
      coordinatorVersion: workflow.coordinator
        ? `${workflow.coordinator.versionMajor}.${workflow.coordinator.versionMinor}`
        : '1.0',
      triggerConfig,
      active: workflow.active,
      checksum: workflow.instructionsChecksum,
      checksumAlgorithm: 'MD5',
      changeDescription: workflow.changeDescription,
      createdAt: workflow.createdAt.toISOString(),
      updatedAt: workflow.updatedAt.toISOString(),
    };
  }

  private extractDecisionStrategy(component: any): 'sequential' | 'adaptive' | 'parallel' | 'conditional' {
    // Try to extract from tags or config
    if (component.tags?.includes('sequential')) return 'sequential';
    if (component.tags?.includes('adaptive')) return 'adaptive';
    if (component.tags?.includes('parallel')) return 'parallel';
    if (component.tags?.includes('conditional')) return 'conditional';

    // Default to sequential
    return 'sequential';
  }

  private compareVersions(
    entityType: 'component' | 'coordinator' | 'workflow',
    version1: any,
    version2: any,
  ): VersionComparisonResponse {
    const changes: Array<{
      field: string;
      changeType: 'added' | 'removed' | 'modified';
      oldValue?: any;
      newValue?: any;
      description: string;
    }> = [];

    let fieldsAdded = 0;
    let fieldsRemoved = 0;
    let fieldsModified = 0;

    // Compare based on entity type
    if (entityType === 'component' || entityType === 'coordinator') {
      this.compareField(
        changes,
        'inputInstructions',
        version1.inputInstructions,
        version2.inputInstructions,
        'Input instructions changed',
      );
      this.compareField(
        changes,
        'operationInstructions',
        version1.operationInstructions,
        version2.operationInstructions,
        'Operation instructions changed',
      );
      this.compareField(
        changes,
        'outputInstructions',
        version1.outputInstructions,
        version2.outputInstructions,
        'Output instructions changed',
      );
      this.compareField(
        changes,
        'config',
        version1.config,
        version2.config,
        'Configuration changed',
      );
      this.compareField(
        changes,
        'tools',
        version1.tools,
        version2.tools,
        'Tools changed',
      );
    } else if (entityType === 'workflow') {
      this.compareField(
        changes,
        'coordinatorId',
        version1.coordinatorId,
        version2.coordinatorId,
        'Coordinator changed',
      );
      this.compareField(
        changes,
        'triggerConfig',
        version1.triggerConfig,
        version2.triggerConfig,
        'Trigger configuration changed',
      );
    }

    // Calculate summary
    changes.forEach((change) => {
      if (change.changeType === 'added') fieldsAdded++;
      if (change.changeType === 'removed') fieldsRemoved++;
      if (change.changeType === 'modified') fieldsModified++;
    });

    // Analyze impact
    const breakingChanges = this.detectBreakingChanges(changes);
    const impactAnalysis = {
      breakingChanges,
      recommendation: breakingChanges
        ? 'Review changes carefully - breaking changes detected'
        : 'Changes are backward compatible',
    };

    return {
      entityType,
      version1: this.mapToVersionResponse(entityType, version1),
      version2: this.mapToVersionResponse(entityType, version2),
      diff: {
        summary: {
          fieldsAdded,
          fieldsRemoved,
          fieldsModified,
        },
        changes,
        impactAnalysis,
      },
    };
  }

  private compareField(
    changes: any[],
    field: string,
    oldValue: any,
    newValue: any,
    description: string,
  ) {
    const oldStr = JSON.stringify(oldValue);
    const newStr = JSON.stringify(newValue);

    if (oldStr !== newStr) {
      changes.push({
        field,
        changeType: 'modified',
        oldValue,
        newValue,
        description,
      });
    }
  }

  private detectBreakingChanges(changes: any[]): boolean {
    // Breaking changes:
    // - Removed tools
    // - Changed model ID
    // - Changed coordinator
    return changes.some(
      (change) =>
        (change.field === 'tools' && change.changeType === 'removed') ||
        (change.field === 'config' &&
          change.oldValue?.modelId !== change.newValue?.modelId) ||
        change.field === 'coordinatorId',
    );
  }

  private mapToVersionResponse(entityType: string, entity: any): any {
    if (entityType === 'component') {
      return this.mapComponentToVersionResponse(entity);
    } else if (entityType === 'coordinator') {
      return this.mapCoordinatorToVersionResponse(entity);
    } else {
      return this.mapWorkflowToVersionResponse(entity);
    }
  }

  private verifyChecksum(
    entityType: 'component' | 'coordinator' | 'workflow',
    entity: any,
  ): ChecksumVerificationResponse {
    const expectedChecksum = entity.instructionsChecksum;

    let actualChecksum: string;
    if (entityType === 'component' || entityType === 'coordinator') {
      actualChecksum = this.checksumService.calculateChecksum({
        inputInstructions: entity.inputInstructions,
        operationInstructions: entity.operationInstructions,
        outputInstructions: entity.outputInstructions,
      });
    } else {
      actualChecksum = this.checksumService.calculateChecksum({
        coordinatorId: entity.coordinatorId,
        triggerConfig: entity.triggerConfig,
      });
    }

    const verified = expectedChecksum === actualChecksum;

    return {
      verified,
      expectedChecksum: expectedChecksum || 'none',
      actualChecksum,
      algorithm: 'MD5',
      verifiedAt: new Date().toISOString(),
      mismatchDetails: verified ? undefined : 'Checksum mismatch detected',
    };
  }
}
