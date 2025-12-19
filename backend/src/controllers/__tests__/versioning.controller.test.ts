/**
 * Unit tests for VersioningController
 * Tests version management for components, coordinators, and workflows
 */

import { NotFoundException, BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Component, Workflow } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ChecksumService } from '../../services/checksum.service';
import { VersioningService, VersionNode } from '../../services/versioning.service';
import { VersioningController } from '../versioning.controller';

describe('VersioningController', () => {
  let controller: VersioningController;
  let mockPrisma: any;
  let mockVersioningService: any;
  let mockChecksumService: any;

  const mockComponent: Component = {
    id: 'comp-123',
    name: 'TestComponent',
    parentId: 'parent-123',
    versionMajor: 1,
    versionMinor: 0,
    inputInstructions: 'Input test',
    operationInstructions: 'Operation test',
    outputInstructions: 'Output test',
    config: { modelId: 'claude-sonnet' },
    tools: ['Read', 'Write'],
    active: true,
    instructionsChecksum: 'checksum123',
    changeDescription: 'Initial version',
    tags: [],
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  };

  const mockWorkflow: Workflow = {
    id: 'wf-123',
    name: 'TestWorkflow',
    projectId: 'proj-123',
    parentId: null,
    versionMajor: 2,
    versionMinor: 5,
    triggerConfig: { type: 'manual' },
    triggerType: 'manual',
    active: true,
    instructionsChecksum: 'wf-checksum',
    changeDescription: 'Updated workflow',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  };

  beforeEach(async () => {
    mockPrisma = {
      component: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
      },
      workflow: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
      },
    };

    mockVersioningService = {
      getVersionHistory: jest.fn(),
      getVersionLineageTree: jest.fn(),
      createMajorVersion: jest.fn(),
      createMinorVersion: jest.fn(),
    };

    mockChecksumService = {
      calculateChecksum: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [VersioningController],
      providers: [
        { provide: PrismaService, useValue: mockPrisma },
        { provide: VersioningService, useValue: mockVersioningService },
        { provide: ChecksumService, useValue: mockChecksumService },
      ],
    }).compile();

    controller = module.get<VersioningController>(VersioningController);
    jest.clearAllMocks();
  });

  // ==========================================================================
  // Component Version Endpoints
  // ==========================================================================

  describe('getComponentVersionHistory', () => {
    it('should return flattened version history from tree', async () => {
      const versionTree: VersionNode = {
        id: 'v1',
        versionMajor: 1,
        versionMinor: 0,
        children: [
          { id: 'v2', versionMajor: 1, versionMinor: 1, children: [] },
        ],
      };

      mockVersioningService.getVersionLineageTree.mockResolvedValue(versionTree);
      mockPrisma.component.findUnique
        .mockResolvedValueOnce({ ...mockComponent, id: 'v1' })
        .mockResolvedValueOnce({ ...mockComponent, id: 'v2' });

      const result = await controller.getComponentVersionHistory('comp-123');

      expect(result).toHaveLength(2);
      expect(mockVersioningService.getVersionLineageTree).toHaveBeenCalledWith('component', 'comp-123');
      expect(mockPrisma.component.findUnique).toHaveBeenCalledTimes(2);
    });

    it('should throw NotFoundException if version not found', async () => {
      const versionTree: VersionNode = {
        id: 'v1',
        versionMajor: 1,
        versionMinor: 0,
        children: [],
      };

      mockVersioningService.getVersionLineageTree.mockResolvedValue(versionTree);
      mockPrisma.component.findUnique.mockResolvedValue(null);

      await expect(controller.getComponentVersionHistory('comp-123')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getComponentVersion', () => {
    it('should return component version by id', async () => {
      mockPrisma.component.findUnique.mockResolvedValue(mockComponent);

      const result = await controller.getComponentVersion('comp-123');

      expect(result.id).toBe('comp-123');
      expect(result.version).toBe('1.0');
      expect(mockPrisma.component.findUnique).toHaveBeenCalledWith({
        where: { id: 'comp-123' },
      });
    });

    it('should throw NotFoundException if component not found', async () => {
      mockPrisma.component.findUnique.mockResolvedValue(null);

      await expect(controller.getComponentVersion('invalid')).rejects.toThrow(NotFoundException);
    });
  });

  describe('createComponentVersion', () => {
    it('should create major version when majorVersion specified', async () => {
      const newVersion = { ...mockComponent, versionMajor: 2, versionMinor: 0 };
      mockVersioningService.createMajorVersion.mockResolvedValue(newVersion);

      const result = await controller.createComponentVersion('comp-123', {
        majorVersion: 2,
        changeDescription: 'Breaking changes',
      });

      expect(result.version).toBe('2.0');
      expect(mockVersioningService.createMajorVersion).toHaveBeenCalledWith(
        'component',
        'comp-123',
        2,
        { changeDescription: 'Breaking changes' }
      );
    });

    it('should create minor version when majorVersion not specified', async () => {
      const newVersion = { ...mockComponent, versionMinor: 1 };
      mockVersioningService.createMinorVersion.mockResolvedValue(newVersion);

      const result = await controller.createComponentVersion('comp-123', {
        changeDescription: 'Minor update',
      });

      expect(result.version).toBe('1.1');
      expect(mockVersioningService.createMinorVersion).toHaveBeenCalledWith(
        'component',
        'comp-123',
        { changeDescription: 'Minor update' }
      );
    });
  });

  describe('compareComponentVersions', () => {
    it('should compare two component versions', async () => {
      const v1 = { ...mockComponent, versionMinor: 0 };
      const v2 = { ...mockComponent, versionMinor: 1, outputInstructions: 'Updated output' };

      mockPrisma.component.findUnique
        .mockResolvedValueOnce(v1)
        .mockResolvedValueOnce(v2);

      const result = await controller.compareComponentVersions({
        versionId1: 'v1',
        versionId2: 'v2',
      });

      expect(result.entityType).toBe('component');
      expect(result.diff.changes.length).toBeGreaterThan(0);
    });

    it('should throw NotFoundException if version not found', async () => {
      mockPrisma.component.findUnique
        .mockResolvedValueOnce(mockComponent)
        .mockResolvedValueOnce(null);

      await expect(controller.compareComponentVersions({
        versionId1: 'v1',
        versionId2: 'v2',
      })).rejects.toThrow(NotFoundException);
    });
  });

  describe('verifyComponentChecksum', () => {
    it('should verify checksum matches', async () => {
      mockPrisma.component.findUnique.mockResolvedValue(mockComponent);
      mockChecksumService.calculateChecksum.mockReturnValue('checksum123');

      const result = await controller.verifyComponentChecksum('comp-123');

      expect(result.verified).toBe(true);
      expect(result.expectedChecksum).toBe('checksum123');
      expect(result.actualChecksum).toBe('checksum123');
    });

    it('should detect checksum mismatch', async () => {
      mockPrisma.component.findUnique.mockResolvedValue(mockComponent);
      mockChecksumService.calculateChecksum.mockReturnValue('different-checksum');

      const result = await controller.verifyComponentChecksum('comp-123');

      expect(result.verified).toBe(false);
      expect(result.mismatchDetails).toBeDefined();
    });
  });

  // ==========================================================================
  // Coordinator Version Endpoints
  // ==========================================================================

  describe('getCoordinatorVersionHistory', () => {
    it('should return coordinator version history', async () => {
      const historyItems = [
        { id: 'v1', versionMajor: 1, versionMinor: 0 },
        { id: 'v2', versionMajor: 1, versionMinor: 1 },
      ];

      mockVersioningService.getVersionHistory.mockResolvedValue(historyItems);
      mockPrisma.component.findUnique
        .mockResolvedValueOnce({ ...mockComponent, id: 'v1' })
        .mockResolvedValueOnce({ ...mockComponent, id: 'v2' });

      const result = await controller.getCoordinatorVersionHistory('coord-123');

      expect(result).toHaveLength(2);
      expect(mockVersioningService.getVersionHistory).toHaveBeenCalledWith('component', 'coord-123');
    });
  });

  describe('getCoordinatorVersion', () => {
    it('should return coordinator version with extracted decision strategy', async () => {
      const coordComponent = { ...mockComponent, tags: ['sequential'] };
      mockPrisma.component.findUnique.mockResolvedValue(coordComponent);

      const result = await controller.getCoordinatorVersion('coord-123');

      expect(result.decisionStrategy).toBe('sequential');
    });

    it('should default to sequential strategy when no tags', async () => {
      mockPrisma.component.findUnique.mockResolvedValue(mockComponent);

      const result = await controller.getCoordinatorVersion('coord-123');

      expect(result.decisionStrategy).toBe('sequential');
    });
  });

  // ==========================================================================
  // Workflow Version Endpoints
  // ==========================================================================

  describe('getWorkflowVersionHistory', () => {
    it('should return workflow version history', async () => {
      const historyItems = [
        { id: 'wf-v1', versionMajor: 1, versionMinor: 0 },
      ];

      mockVersioningService.getVersionHistory.mockResolvedValue(historyItems);
      mockPrisma.workflow.findUnique.mockResolvedValue(mockWorkflow);

      const result = await controller.getWorkflowVersionHistory('wf-123');

      expect(result).toHaveLength(1);
      expect(result[0].version).toBe('2.5');
    });
  });

  describe('getWorkflowVersion', () => {
    it('should return workflow version', async () => {
      mockPrisma.workflow.findUnique.mockResolvedValue(mockWorkflow);

      const result = await controller.getWorkflowVersion('wf-123');

      expect(result.id).toBe('wf-123');
      expect(result.version).toBe('2.5');
      expect(result.triggerConfig).toEqual({ type: 'manual' });
    });

    it('should parse string triggerConfig to object', async () => {
      const wfWithStringConfig = {
        ...mockWorkflow,
        triggerConfig: JSON.stringify({ type: 'webhook' }),
      };
      mockPrisma.workflow.findUnique.mockResolvedValue(wfWithStringConfig);

      const result = await controller.getWorkflowVersion('wf-123');

      expect(result.triggerConfig).toEqual({ type: 'webhook' });
    });
  });

  describe('createWorkflowVersion', () => {
    it('should create workflow major version', async () => {
      const newVersion = { ...mockWorkflow, versionMajor: 3, versionMinor: 0 };
      mockVersioningService.createMajorVersion.mockResolvedValue({ id: 'wf-new' });
      mockPrisma.workflow.findUnique.mockResolvedValue(newVersion);

      const result = await controller.createWorkflowVersion('wf-123', {
        majorVersion: 3,
        changeDescription: 'Major update',
      });

      expect(result.version).toBe('3.0');
    });
  });

  describe('compareWorkflowVersions', () => {
    it('should compare two workflow versions', async () => {
      const v1 = mockWorkflow;
      const v2 = { ...mockWorkflow, triggerConfig: { type: 'webhook' } };

      mockPrisma.workflow.findUnique
        .mockResolvedValueOnce(v1)
        .mockResolvedValueOnce(v2);

      const result = await controller.compareWorkflowVersions({
        versionId1: 'wf-v1',
        versionId2: 'wf-v2',
      });

      expect(result.entityType).toBe('workflow');
      expect(result.diff.changes.length).toBeGreaterThan(0);
    });
  });

  describe('verifyWorkflowChecksum', () => {
    it('should verify workflow checksum', async () => {
      mockPrisma.workflow.findUnique.mockResolvedValue(mockWorkflow);
      mockChecksumService.calculateChecksum.mockReturnValue('wf-checksum');

      const result = await controller.verifyWorkflowChecksum('wf-123');

      expect(result.verified).toBe(true);
    });
  });

  // ==========================================================================
  // Helper Methods
  // ==========================================================================

  describe('mapComponentToVersionResponse', () => {
    it('should map component with string config', () => {
      const componentWithStringConfig = {
        ...mockComponent,
        config: JSON.stringify({ modelId: 'test' }),
      };
      mockPrisma.component.findUnique.mockResolvedValue(componentWithStringConfig);

      return controller.getComponentVersion('comp-123').then(result => {
        expect(result.config).toEqual({ modelId: 'test' });
      });
    });
  });

  describe('compareVersions', () => {
    it('should detect modified fields', async () => {
      const v1 = mockComponent;
      const v2 = { ...mockComponent, inputInstructions: 'Changed input' };

      mockPrisma.component.findUnique
        .mockResolvedValueOnce(v1)
        .mockResolvedValueOnce(v2);

      const result = await controller.compareComponentVersions({
        versionId1: 'v1',
        versionId2: 'v2',
      });

      expect(result.diff.summary.fieldsModified).toBeGreaterThan(0);
      expect(result.diff.changes.some(c => c.field === 'inputInstructions')).toBe(true);
    });

    it('should not detect breaking changes when tools added (only removal is breaking)', async () => {
      const v1 = { ...mockComponent, tools: ['Read'] };
      const v2 = { ...mockComponent, tools: ['Read', 'Write'] };

      mockPrisma.component.findUnique
        .mockResolvedValueOnce(v1)
        .mockResolvedValueOnce(v2);

      const result = await controller.compareComponentVersions({
        versionId1: 'v1',
        versionId2: 'v2',
      });

      // Tools were added, not removed, so not breaking
      expect(result.diff.impactAnalysis.breakingChanges).toBe(false);
    });

    it('should detect breaking changes when modelId changes', async () => {
      const v1 = { ...mockComponent, config: { modelId: 'opus' } };
      const v2 = { ...mockComponent, config: { modelId: 'sonnet' } };

      mockPrisma.component.findUnique
        .mockResolvedValueOnce(v1)
        .mockResolvedValueOnce(v2);

      const result = await controller.compareComponentVersions({
        versionId1: 'v1',
        versionId2: 'v2',
      });

      expect(result.diff.impactAnalysis.breakingChanges).toBe(true);
    });
  });

  describe('extractDecisionStrategy', () => {
    it('should extract sequential from tags', async () => {
      const comp = { ...mockComponent, tags: ['sequential', 'other'] };
      mockPrisma.component.findUnique.mockResolvedValue(comp);

      const result = await controller.getCoordinatorVersion('coord-123');

      expect(result.decisionStrategy).toBe('sequential');
    });

    it('should extract adaptive from tags', async () => {
      const comp = { ...mockComponent, tags: ['adaptive'] };
      mockPrisma.component.findUnique.mockResolvedValue(comp);

      const result = await controller.getCoordinatorVersion('coord-123');

      expect(result.decisionStrategy).toBe('adaptive');
    });

    it('should extract parallel from tags', async () => {
      const comp = { ...mockComponent, tags: ['parallel'] };
      mockPrisma.component.findUnique.mockResolvedValue(comp);

      const result = await controller.getCoordinatorVersion('coord-123');

      expect(result.decisionStrategy).toBe('parallel');
    });

    it('should extract conditional from tags', async () => {
      const comp = { ...mockComponent, tags: ['conditional'] };
      mockPrisma.component.findUnique.mockResolvedValue(comp);

      const result = await controller.getCoordinatorVersion('coord-123');

      expect(result.decisionStrategy).toBe('conditional');
    });
  });
});
