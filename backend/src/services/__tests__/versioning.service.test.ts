import { NotFoundException, BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../prisma/prisma.service';
import { VersioningService } from '../versioning.service';

describe('VersioningService', () => {
  let service: VersioningService;
  let prisma: any;

  const mockComponent = {
    id: 'comp-1',
    projectId: 'proj-1',
    name: 'Test Component',
    description: 'Test description',
    inputInstructions: 'Input instructions',
    operationInstructions: 'Operation instructions',
    outputInstructions: 'Output instructions',
    config: { modelId: 'claude-3', temperature: 0.7 },
    tools: ['tool1', 'tool2'],
    subtaskConfig: null,
    onFailure: 'stop',
    tags: ['test'],
    active: true,
    version: 'v1.0',
    versionMajor: 1,
    versionMinor: 0,
    parentId: null,
    instructionsChecksum: null,
    configChecksum: null,
    isDeprecated: false,
    deprecatedAt: null,
    changeDescription: null,
    createdFromVersion: null,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  };

  const mockWorkflow = {
    id: 'wf-1',
    projectId: 'proj-1',
    coordinatorId: 'coord-1',
    name: 'Test Workflow',
    description: 'Test description',
    version: 'v1.0',
    triggerConfig: { type: 'manual' },
    active: true,
    versionMajor: 1,
    versionMinor: 0,
    parentId: null,
    instructionsChecksum: null,
    configChecksum: null,
    isDeprecated: false,
    deprecatedAt: null,
    changeDescription: null,
    createdFromVersion: null,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  };

  beforeEach(async () => {
    prisma = {
      component: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
      },
      workflow: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
      },
      $transaction: jest.fn((fn) => fn(prisma)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VersioningService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<VersioningService>(VersioningService);
  });

  describe('calculateChecksum', () => {
    it('should return deterministic hash for same input', () => {
      const data = { foo: 'bar', baz: 123 };
      const hash1 = service.calculateChecksum(data);
      const hash2 = service.calculateChecksum(data);
      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(32); // MD5 hex length
    });

    it('should return same hash regardless of key order', () => {
      const data1 = { a: 1, b: 2 };
      const data2 = { b: 2, a: 1 };
      expect(service.calculateChecksum(data1)).toBe(
        service.calculateChecksum(data2),
      );
    });

    it('should handle nested objects', () => {
      const data1 = { outer: { a: 1, b: 2 } };
      const data2 = { outer: { b: 2, a: 1 } };
      expect(service.calculateChecksum(data1)).toBe(
        service.calculateChecksum(data2),
      );
    });

    it('should handle null input', () => {
      const hash = service.calculateChecksum(null);
      expect(hash).toHaveLength(32);
    });

    it('should handle undefined input', () => {
      const hash = service.calculateChecksum(undefined);
      expect(hash).toHaveLength(32);
    });

    it('should handle arrays', () => {
      const data = { items: [{ z: 1 }, { a: 2 }] };
      const hash = service.calculateChecksum(data);
      expect(hash).toHaveLength(32);
    });
  });

  describe('createMinorVersion', () => {
    it('should increment minor version correctly', async () => {
      prisma.component.findUnique.mockResolvedValue(mockComponent);
      prisma.component.create.mockImplementation(({ data }) => ({
        ...mockComponent,
        ...data,
        id: 'comp-2',
      }));

      const result = await service.createMinorVersion('component', 'comp-1', {
        changeDescription: 'Minor update',
      });

      expect(result.versionMajor).toBe(1);
      expect(result.versionMinor).toBe(1);
      expect(result.parentId).toBe('comp-1');
      expect(result.createdFromVersion).toBe('1.0');
      expect(result.changeDescription).toBe('Minor update');
    });

    it('should reject deprecated entities', async () => {
      prisma.component.findUnique.mockResolvedValue({
        ...mockComponent,
        isDeprecated: true,
      });

      await expect(
        service.createMinorVersion('component', 'comp-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException for non-existent entity', async () => {
      prisma.component.findUnique.mockResolvedValue(null);

      await expect(
        service.createMinorVersion('component', 'non-existent'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should work with workflows', async () => {
      prisma.workflow.findUnique.mockResolvedValue(mockWorkflow);
      prisma.workflow.create.mockImplementation(({ data }) => ({
        ...mockWorkflow,
        ...data,
        id: 'wf-2',
      }));

      const result = await service.createMinorVersion('workflow', 'wf-1');

      expect(result.versionMajor).toBe(1);
      expect(result.versionMinor).toBe(1);
      expect(result.parentId).toBe('wf-1');
    });
  });

  describe('createMajorVersion', () => {
    it('should create major version with minor reset to 0', async () => {
      prisma.component.findUnique.mockResolvedValue({
        ...mockComponent,
        versionMinor: 5,
      });
      prisma.component.create.mockImplementation(({ data }) => ({
        ...mockComponent,
        ...data,
        id: 'comp-2',
      }));

      const result = await service.createMajorVersion(
        'component',
        'comp-1',
        2,
        { changeDescription: 'Major update' },
      );

      expect(result.versionMajor).toBe(2);
      expect(result.versionMinor).toBe(0);
      expect(result.parentId).toBe('comp-1');
      expect(result.createdFromVersion).toBe('1.5');
    });

    it('should reject major version <= 0', async () => {
      await expect(
        service.createMajorVersion('component', 'comp-1', 0),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.createMajorVersion('component', 'comp-1', -1),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject major version not greater than current', async () => {
      prisma.component.findUnique.mockResolvedValue({
        ...mockComponent,
        versionMajor: 2,
      });

      await expect(
        service.createMajorVersion('component', 'comp-1', 2),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.createMajorVersion('component', 'comp-1', 1),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject deprecated entities', async () => {
      prisma.component.findUnique.mockResolvedValue({
        ...mockComponent,
        isDeprecated: true,
      });

      await expect(
        service.createMajorVersion('component', 'comp-1', 2),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getVersionHistory', () => {
    it('should return history in oldest to newest order', async () => {
      const v1 = { ...mockComponent, id: 'v1', parentId: null };
      const v2 = {
        ...mockComponent,
        id: 'v2',
        parentId: 'v1',
        versionMinor: 1,
      };
      const v3 = {
        ...mockComponent,
        id: 'v3',
        parentId: 'v2',
        versionMinor: 2,
      };

      prisma.component.findUnique
        .mockResolvedValueOnce(v3) // Initial lookup
        .mockResolvedValueOnce(v2) // Parent of v3
        .mockResolvedValueOnce(v1); // Parent of v2

      const history = await service.getVersionHistory('component', 'v3');

      expect(history).toHaveLength(3);
      expect(history[0].id).toBe('v1'); // Oldest first
      expect(history[1].id).toBe('v2');
      expect(history[2].id).toBe('v3'); // Newest last
    });

    it('should handle root entity with single item', async () => {
      prisma.component.findUnique.mockResolvedValue(mockComponent);

      const history = await service.getVersionHistory('component', 'comp-1');

      expect(history).toHaveLength(1);
      expect(history[0].id).toBe('comp-1');
      expect(history[0].versionLabel).toBe('1.0');
    });

    it('should include version metadata', async () => {
      prisma.component.findUnique.mockResolvedValue({
        ...mockComponent,
        instructionsChecksum: 'abc123',
        configChecksum: 'def456',
        changeDescription: 'Test change',
        createdFromVersion: '0.9',
      });

      const history = await service.getVersionHistory('component', 'comp-1');

      expect(history[0].instructionsChecksum).toBe('abc123');
      expect(history[0].configChecksum).toBe('def456');
      expect(history[0].changeDescription).toBe('Test change');
      expect(history[0].createdFromVersion).toBe('0.9');
    });
  });

  describe('getVersionLineageTree', () => {
    it('should build correct tree hierarchy', async () => {
      const v1 = { ...mockComponent, id: 'v1', parentId: null };
      const v1_1 = {
        ...mockComponent,
        id: 'v1_1',
        parentId: 'v1',
        versionMinor: 1,
      };
      const v1_2 = {
        ...mockComponent,
        id: 'v1_2',
        parentId: 'v1',
        versionMinor: 2,
      };

      // Mock for finding root (traverse up)
      prisma.component.findUnique.mockResolvedValue(v1);

      // Mock for getting children
      prisma.component.findMany
        .mockResolvedValueOnce([v1_1, v1_2]) // Children of v1
        .mockResolvedValueOnce([]) // Children of v1_1
        .mockResolvedValueOnce([]); // Children of v1_2

      const tree = await service.getVersionLineageTree('component', 'v1');

      expect(tree.id).toBe('v1');
      expect(tree.versionLabel).toBe('1.0');
      expect(tree.children).toHaveLength(2);
      expect(tree.children[0].id).toBe('v1_1');
      expect(tree.children[1].id).toBe('v1_2');
    });

    it('should find root from any node in tree', async () => {
      const v1 = { ...mockComponent, id: 'v1', parentId: null };
      const v2 = {
        ...mockComponent,
        id: 'v2',
        parentId: 'v1',
        versionMinor: 1,
      };

      prisma.component.findUnique
        .mockResolvedValueOnce(v2) // Start with v2
        .mockResolvedValueOnce(v1) // Traverse to v1 (root)
        .mockResolvedValueOnce(v1); // Get root for tree building

      prisma.component.findMany
        .mockResolvedValueOnce([v2]) // Children of v1
        .mockResolvedValueOnce([]); // Children of v2

      const tree = await service.getVersionLineageTree('component', 'v2');

      // Tree should start from root v1
      expect(tree.id).toBe('v1');
      expect(tree.children[0].id).toBe('v2');
    });

    it('should handle branches (multiple children)', async () => {
      const root = { ...mockComponent, id: 'root', parentId: null };
      const branch1 = {
        ...mockComponent,
        id: 'b1',
        parentId: 'root',
        versionMajor: 2,
        versionMinor: 0,
      };
      const branch2 = {
        ...mockComponent,
        id: 'b2',
        parentId: 'root',
        versionMinor: 1,
      };

      prisma.component.findUnique.mockResolvedValue(root);
      prisma.component.findMany
        .mockResolvedValueOnce([branch2, branch1]) // Children of root (ordered by version)
        .mockResolvedValueOnce([]) // Children of branch2
        .mockResolvedValueOnce([]); // Children of branch1

      const tree = await service.getVersionLineageTree('component', 'root');

      expect(tree.children).toHaveLength(2);
    });
  });
});
