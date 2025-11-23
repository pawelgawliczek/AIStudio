import { Test, TestingModule } from '@nestjs/testing';
import { VersioningController } from '../versioning.controller';
import { VersioningService } from '../../services/versioning.service';
import { ChecksumService } from '../../services/checksum.service';
import { PrismaService } from '../../prisma/prisma.service';
import { NotFoundException } from '@nestjs/common';

describe('VersioningController', () => {
  let controller: VersioningController;
  let versioningService: VersioningService;
  let prismaService: PrismaService;

  const mockComponent = {
    id: 'component-123',
    projectId: 'project-123',
    name: 'Test Component',
    description: 'Test component description',
    inputInstructions: 'Input instructions',
    operationInstructions: 'Operation instructions',
    outputInstructions: 'Output instructions',
    config: { modelId: 'claude-3-5-sonnet-20241022', temperature: 0.7 },
    tools: ['tool1', 'tool2'],
    subtaskConfig: null,
    onFailure: 'stop',
    tags: [],
    active: true,
    version: 'v1.0',
    versionMajor: 1,
    versionMinor: 0,
    parentId: null,
    instructionsChecksum: 'abc123',
    configChecksum: 'def456',
    isDeprecated: false,
    deprecatedAt: null,
    changeDescription: null,
    createdFromVersion: null,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  };

  const mockWorkflow = {
    id: 'workflow-123',
    projectId: 'project-123',
    coordinatorId: 'coordinator-123',
    name: 'Test Workflow',
    description: 'Test workflow description',
    version: 'v1.0',
    triggerConfig: { type: 'manual' },
    active: true,
    versionMajor: 1,
    versionMinor: 0,
    parentId: null,
    instructionsChecksum: 'abc123',
    configChecksum: 'def456',
    isDeprecated: false,
    deprecatedAt: null,
    changeDescription: null,
    createdFromVersion: null,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    coordinator: {
      id: 'coordinator-123',
      name: 'Test Coordinator',
      versionMajor: 1,
      versionMinor: 0,
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [VersioningController],
      providers: [
        {
          provide: VersioningService,
          useValue: {
            getVersionHistory: jest.fn(),
            createMinorVersion: jest.fn(),
            createMajorVersion: jest.fn(),
          },
        },
        {
          provide: ChecksumService,
          useValue: {
            calculateChecksum: jest.fn().mockReturnValue('abc123'),
          },
        },
        {
          provide: PrismaService,
          useValue: {
            component: {
              findUnique: jest.fn(),
              update: jest.fn(),
            },
            workflow: {
              findUnique: jest.fn(),
              update: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    controller = module.get<VersioningController>(VersioningController);
    versioningService = module.get<VersioningService>(VersioningService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('Component Versioning', () => {
    describe('getComponentVersionHistory', () => {
      it('should return version history for a component', async () => {
        const historyItems = [
          {
            id: 'component-123',
            versionMajor: 1,
            versionMinor: 0,
            versionLabel: '1.0',
            parentId: null,
            isDeprecated: false,
            changeDescription: null,
            createdFromVersion: null,
            instructionsChecksum: 'abc123',
            configChecksum: 'def456',
            createdAt: new Date('2024-01-01'),
          },
        ];

        jest.spyOn(versioningService, 'getVersionHistory').mockResolvedValue(historyItems);
        jest.spyOn(prismaService.component, 'findUnique').mockResolvedValue(mockComponent);

        const result = await controller.getComponentVersionHistory('component-123');

        expect(result).toHaveLength(1);
        expect(result[0].version).toBe('1.0');
        expect(versioningService.getVersionHistory).toHaveBeenCalledWith('component', 'component-123');
      });
    });

    describe('getComponentVersion', () => {
      it('should return a specific component version', async () => {
        jest.spyOn(prismaService.component, 'findUnique').mockResolvedValue(mockComponent);

        const result = await controller.getComponentVersion('component-123');

        expect(result).toBeDefined();
        expect(result.id).toBe('component-123');
        expect(result.version).toBe('1.0');
      });

      it('should throw NotFoundException when component not found', async () => {
        jest.spyOn(prismaService.component, 'findUnique').mockResolvedValue(null);

        await expect(controller.getComponentVersion('non-existent')).rejects.toThrow(
          NotFoundException,
        );
      });
    });

    describe('createComponentVersion', () => {
      it('should create a minor version', async () => {
        const newVersion = { ...mockComponent, id: 'component-124', versionMinor: 1 };
        jest.spyOn(versioningService, 'createMinorVersion').mockResolvedValue(newVersion);

        const result = await controller.createComponentVersion('component-123', {
          changeDescription: 'Minor update',
        });

        expect(result.version).toBe('1.1');
        expect(versioningService.createMinorVersion).toHaveBeenCalledWith(
          'component',
          'component-123',
          { changeDescription: 'Minor update' },
        );
      });

      it('should create a major version', async () => {
        const newVersion = { ...mockComponent, id: 'component-125', versionMajor: 2, versionMinor: 0 };
        jest.spyOn(versioningService, 'createMajorVersion').mockResolvedValue(newVersion);

        const result = await controller.createComponentVersion('component-123', {
          majorVersion: 2,
          changeDescription: 'Major update',
        });

        expect(result.version).toBe('2.0');
        expect(versioningService.createMajorVersion).toHaveBeenCalledWith(
          'component',
          'component-123',
          2,
          { changeDescription: 'Major update' },
        );
      });
    });

    describe('activateComponentVersion', () => {
      it('should activate a component version', async () => {
        const activated = { ...mockComponent, active: true };
        jest.spyOn(prismaService.component, 'update').mockResolvedValue(activated);

        const result = await controller.activateComponentVersion('component-123');

        expect(result.active).toBe(true);
        expect(prismaService.component.update).toHaveBeenCalledWith({
          where: { id: 'component-123' },
          data: { active: true },
        });
      });
    });

    describe('compareComponentVersions', () => {
      it('should compare two component versions', async () => {
        const version1 = mockComponent;
        const version2 = { ...mockComponent, id: 'component-124', versionMinor: 1 };

        jest
          .spyOn(prismaService.component, 'findUnique')
          .mockResolvedValueOnce(version1)
          .mockResolvedValueOnce(version2);

        const result = await controller.compareComponentVersions({
          versionId1: 'component-123',
          versionId2: 'component-124',
        });

        expect(result.entityType).toBe('component');
        expect(result.version1).toBeDefined();
        expect(result.version2).toBeDefined();
        expect(result.diff).toBeDefined();
      });
    });
  });

  describe('Workflow Versioning', () => {
    describe('getWorkflowVersionHistory', () => {
      it('should return version history for a workflow', async () => {
        const historyItems = [
          {
            id: 'workflow-123',
            versionMajor: 1,
            versionMinor: 0,
            versionLabel: '1.0',
            parentId: null,
            isDeprecated: false,
            changeDescription: null,
            createdFromVersion: null,
            instructionsChecksum: 'abc123',
            configChecksum: 'def456',
            createdAt: new Date('2024-01-01'),
          },
        ];

        jest.spyOn(versioningService, 'getVersionHistory').mockResolvedValue(historyItems);
        jest.spyOn(prismaService.workflow, 'findUnique').mockResolvedValue(mockWorkflow);

        const result = await controller.getWorkflowVersionHistory('workflow-123');

        expect(result).toHaveLength(1);
        expect(result[0].version).toBe('1.0');
        expect(versioningService.getVersionHistory).toHaveBeenCalledWith('workflow', 'workflow-123');
      });
    });

    describe('createWorkflowVersion', () => {
      it('should create a minor workflow version', async () => {
        const newVersion = { ...mockWorkflow, id: 'workflow-124', versionMinor: 1 };
        jest.spyOn(versioningService, 'createMinorVersion').mockResolvedValue(newVersion);
        jest.spyOn(prismaService.workflow, 'findUnique').mockResolvedValue({
          ...newVersion,
          coordinator: mockWorkflow.coordinator,
        });

        const result = await controller.createWorkflowVersion('workflow-123', {
          changeDescription: 'Minor workflow update',
        });

        expect(result.version).toBe('1.1');
        expect(versioningService.createMinorVersion).toHaveBeenCalledWith(
          'workflow',
          'workflow-123',
          { changeDescription: 'Minor workflow update' },
        );
      });
    });
  });
});
