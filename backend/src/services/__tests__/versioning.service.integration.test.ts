/**
 * Integration Tests for VersioningService
 * Tests real database interactions for version creation and history
 *
 * Covers:
 * - AC-VS-01: Minor version creation
 * - AC-VS-02: Major version creation
 * - AC-VS-03: Version history traversal
 * - AC-VS-04: Lineage tree building
 * - AC-VS-05: Checksum determinism
 * - AC-VS-06: Deprecated entity blocking
 */

import { PrismaClient, Component, Workflow, Project } from '@prisma/client';
import { VersioningService } from '../versioning.service';
import { randomUUID } from 'crypto';

describe('VersioningService - Integration Tests', () => {
  let prisma: PrismaClient;
  let versioningService: VersioningService;
  let testProject: Project;
  const TEST_PREFIX = 'test_ST83_';

  beforeAll(async () => {
    prisma = new PrismaClient();
    versioningService = new VersioningService(prisma as any);

    // Create test project
    testProject = await prisma.project.create({
      data: {
        id: randomUUID(),
        name: `${TEST_PREFIX}project_${Date.now()}`,
        description: 'Test project for ST-83 versioning integration tests',
        status: 'active',
      },
    });
  });

  afterAll(async () => {
    // Cleanup test data
    await prisma.workflow.deleteMany({
      where: { projectId: testProject.id },
    });
    await prisma.component.deleteMany({
      where: { projectId: testProject.id },
    });
    await prisma.project.delete({
      where: { id: testProject.id },
    });
    await prisma.$disconnect();
  });

  // Helper to create test component
  async function createTestComponent(overrides: Partial<Component> = {}): Promise<Component> {
    return prisma.component.create({
      data: {
        id: randomUUID(),
        projectId: testProject.id,
        name: `${TEST_PREFIX}component_${Date.now()}`,
        inputInstructions: 'Test input instructions',
        operationInstructions: 'Test operation instructions',
        outputInstructions: 'Test output instructions',
        config: { modelId: 'claude-3-sonnet' },
        tools: ['tool1', 'tool2'],
        version: 'v1.0',
        versionMajor: 1,
        versionMinor: 0,
        ...overrides,
      },
    });
  }

  // Helper to create test workflow
  async function createTestWorkflow(coordinatorId: string, overrides: Partial<Workflow> = {}): Promise<Workflow> {
    return prisma.workflow.create({
      data: {
        id: randomUUID(),
        projectId: testProject.id,
        coordinatorId,
        name: `${TEST_PREFIX}workflow_${Date.now()}`,
        description: 'Test workflow',
        version: 'v1.0',
        versionMajor: 1,
        versionMinor: 0,
        triggerConfig: { type: 'manual' },
        ...overrides,
      },
    });
  }

  describe('AC-VS-01: Minor Version Creation', () => {
    let sourceComponent: Component;

    beforeEach(async () => {
      sourceComponent = await createTestComponent();
    });

    afterEach(async () => {
      // Cleanup versions created in tests
      await prisma.component.deleteMany({
        where: { parentId: sourceComponent.id },
      });
      await prisma.component.delete({
        where: { id: sourceComponent.id },
      });
    });

    it('should increment versionMinor correctly (1.0 -> 1.1)', async () => {
      const newVersion = await versioningService.createMinorVersion(
        'component',
        sourceComponent.id,
      ) as Component;

      expect(newVersion.versionMajor).toBe(1);
      expect(newVersion.versionMinor).toBe(1);
      expect(newVersion.parentId).toBe(sourceComponent.id);
      expect(newVersion.createdFromVersion).toBe('1.0');
    });

    it('should set parentId to source component ID', async () => {
      const newVersion = await versioningService.createMinorVersion(
        'component',
        sourceComponent.id,
      ) as Component;

      expect(newVersion.parentId).toBe(sourceComponent.id);
    });

    it('should record createdFromVersion correctly', async () => {
      const newVersion = await versioningService.createMinorVersion(
        'component',
        sourceComponent.id,
      ) as Component;

      expect(newVersion.createdFromVersion).toBe('1.0');
    });

    it('should copy all component fields to new version', async () => {
      const newVersion = await versioningService.createMinorVersion(
        'component',
        sourceComponent.id,
      ) as Component;

      expect(newVersion.name).toBe(sourceComponent.name);
      expect(newVersion.inputInstructions).toBe(sourceComponent.inputInstructions);
      expect(newVersion.operationInstructions).toBe(sourceComponent.operationInstructions);
      expect(newVersion.outputInstructions).toBe(sourceComponent.outputInstructions);
      expect(newVersion.config).toEqual(sourceComponent.config);
      expect(newVersion.tools).toEqual(sourceComponent.tools);
    });

    it('should preserve changeDescription if provided', async () => {
      const changeDescription = 'Minor update for testing';
      const newVersion = await versioningService.createMinorVersion(
        'component',
        sourceComponent.id,
        { changeDescription },
      ) as Component;

      expect(newVersion.changeDescription).toBe(changeDescription);
    });

    it('should create multiple sequential minor versions (1.0 -> 1.1 -> 1.2)', async () => {
      const v11 = await versioningService.createMinorVersion(
        'component',
        sourceComponent.id,
      ) as Component;

      const v12 = await versioningService.createMinorVersion(
        'component',
        v11.id,
      ) as Component;

      expect(v12.versionMajor).toBe(1);
      expect(v12.versionMinor).toBe(2);
      expect(v12.parentId).toBe(v11.id);
      expect(v12.createdFromVersion).toBe('1.1');

      // Cleanup
      await prisma.component.delete({ where: { id: v12.id } });
    });
  });

  describe('AC-VS-02: Major Version Creation', () => {
    let sourceComponent: Component;

    beforeEach(async () => {
      sourceComponent = await createTestComponent({
        versionMajor: 1,
        versionMinor: 3,
      });
    });

    afterEach(async () => {
      await prisma.component.deleteMany({
        where: { parentId: sourceComponent.id },
      });
      await prisma.component.delete({
        where: { id: sourceComponent.id },
      });
    });

    it('should validate majorVersion > current (1.3 -> 2.0)', async () => {
      const newVersion = await versioningService.createMajorVersion(
        'component',
        sourceComponent.id,
        2,
      ) as Component;

      expect(newVersion.versionMajor).toBe(2);
      expect(newVersion.versionMinor).toBe(0);
    });

    it('should reset versionMinor to 0', async () => {
      const newVersion = await versioningService.createMajorVersion(
        'component',
        sourceComponent.id,
        3,
      ) as Component;

      expect(newVersion.versionMinor).toBe(0);
    });

    it('should throw error for majorVersion <= current', async () => {
      await expect(
        versioningService.createMajorVersion('component', sourceComponent.id, 1),
      ).rejects.toThrow('New major version must be greater than current (1)');
    });

    it('should throw error for majorVersion = 0', async () => {
      await expect(
        versioningService.createMajorVersion('component', sourceComponent.id, 0),
      ).rejects.toThrow('Major version must be greater than 0');
    });
  });

  describe('AC-VS-03: Version History Traversal', () => {
    let v10: Component;
    let v11: Component;
    let v12: Component;

    beforeAll(async () => {
      v10 = await createTestComponent({
        name: `${TEST_PREFIX}history_component`,
      });
      v11 = await versioningService.createMinorVersion('component', v10.id) as Component;
      v12 = await versioningService.createMinorVersion('component', v11.id) as Component;
    });

    afterAll(async () => {
      await prisma.component.delete({ where: { id: v12.id } });
      await prisma.component.delete({ where: { id: v11.id } });
      await prisma.component.delete({ where: { id: v10.id } });
    });

    it('should return version chain from oldest to newest', async () => {
      const history = await versioningService.getVersionHistory('component', v12.id);

      expect(history).toHaveLength(3);
      expect(history[0].id).toBe(v10.id);
      expect(history[1].id).toBe(v11.id);
      expect(history[2].id).toBe(v12.id);
    });

    it('should return correct versionLabels in history', async () => {
      const history = await versioningService.getVersionHistory('component', v12.id);

      expect(history[0].versionLabel).toBe('1.0');
      expect(history[1].versionLabel).toBe('1.1');
      expect(history[2].versionLabel).toBe('1.2');
    });

    it('should include parentId in history items', async () => {
      const history = await versioningService.getVersionHistory('component', v12.id);

      expect(history[0].parentId).toBeNull();
      expect(history[1].parentId).toBe(v10.id);
      expect(history[2].parentId).toBe(v11.id);
    });
  });

  describe('AC-VS-04: Lineage Tree Building', () => {
    let root: Component;
    let child1: Component;
    let child2: Component;
    let grandchild: Component;

    beforeAll(async () => {
      root = await createTestComponent({
        name: `${TEST_PREFIX}tree_root`,
      });
      // Create two branches from root
      child1 = await versioningService.createMinorVersion('component', root.id) as Component;
      child2 = await versioningService.createMinorVersion('component', root.id) as Component;
      // Create grandchild from child1
      grandchild = await versioningService.createMinorVersion('component', child1.id) as Component;
    });

    afterAll(async () => {
      await prisma.component.delete({ where: { id: grandchild.id } });
      await prisma.component.delete({ where: { id: child2.id } });
      await prisma.component.delete({ where: { id: child1.id } });
      await prisma.component.delete({ where: { id: root.id } });
    });

    it('should build recursive tree structure', async () => {
      const tree = await versioningService.getVersionLineageTree('component', grandchild.id);

      expect(tree.id).toBe(root.id);
      expect(tree.versionLabel).toBe('1.0');
      expect(tree.children).toBeDefined();
      expect(tree.children.length).toBeGreaterThanOrEqual(2);
    });

    it('should include all children at each level', async () => {
      const tree = await versioningService.getVersionLineageTree('component', root.id);

      // Root should have at least 2 children (child1 and child2)
      expect(tree.children.length).toBeGreaterThanOrEqual(2);

      // Find child1 and verify it has grandchild
      const child1Node = tree.children.find(c => c.id === child1.id);
      expect(child1Node).toBeDefined();
      expect(child1Node!.children.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('AC-VS-05: Checksum Determinism', () => {
    it('should produce same checksum for identical data', () => {
      const data = {
        inputInstructions: 'Test input',
        operationInstructions: 'Test operation',
        outputInstructions: 'Test output',
      };

      const checksum1 = versioningService.calculateChecksum(data);
      const checksum2 = versioningService.calculateChecksum(data);

      expect(checksum1).toBe(checksum2);
    });

    it('should produce same checksum regardless of key order', () => {
      const data1 = { a: 1, b: 2, c: 3 };
      const data2 = { c: 3, a: 1, b: 2 };

      const checksum1 = versioningService.calculateChecksum(data1);
      const checksum2 = versioningService.calculateChecksum(data2);

      expect(checksum1).toBe(checksum2);
    });

    it('should produce valid 32-char MD5 hex string', () => {
      const checksum = versioningService.calculateChecksum({ test: 'data' });

      expect(checksum).toMatch(/^[a-f0-9]{32}$/);
    });

    it('should produce different checksums for different data', () => {
      const checksum1 = versioningService.calculateChecksum({ value: 1 });
      const checksum2 = versioningService.calculateChecksum({ value: 2 });

      expect(checksum1).not.toBe(checksum2);
    });
  });

  describe('AC-VS-06: Deprecated Entity Blocking', () => {
    let deprecatedComponent: Component;

    beforeEach(async () => {
      deprecatedComponent = await createTestComponent({
        isDeprecated: true,
        deprecatedAt: new Date(),
      });
    });

    afterEach(async () => {
      await prisma.component.delete({
        where: { id: deprecatedComponent.id },
      });
    });

    it('should throw BadRequestException for minor version from deprecated component', async () => {
      await expect(
        versioningService.createMinorVersion('component', deprecatedComponent.id),
      ).rejects.toThrow('Cannot create version from deprecated component');
    });

    it('should throw BadRequestException for major version from deprecated component', async () => {
      await expect(
        versioningService.createMajorVersion('component', deprecatedComponent.id, 2),
      ).rejects.toThrow('Cannot create version from deprecated component');
    });
  });

  describe('Workflow Versioning', () => {
    let coordinator: Component;
    let sourceWorkflow: Workflow;

    beforeEach(async () => {
      coordinator = await createTestComponent({
        tags: ['coordinator'],
      });
      sourceWorkflow = await createTestWorkflow(coordinator.id);
    });

    afterEach(async () => {
      await prisma.workflow.deleteMany({
        where: { parentId: sourceWorkflow.id },
      });
      await prisma.workflow.delete({
        where: { id: sourceWorkflow.id },
      });
      await prisma.component.delete({
        where: { id: coordinator.id },
      });
    });

    it('should create minor version of workflow', async () => {
      const newVersion = await versioningService.createMinorVersion(
        'workflow',
        sourceWorkflow.id,
      ) as Workflow;

      expect(newVersion.versionMajor).toBe(1);
      expect(newVersion.versionMinor).toBe(1);
      expect(newVersion.parentId).toBe(sourceWorkflow.id);
      expect(newVersion.coordinatorId).toBe(coordinator.id);
    });

    it('should get workflow version history', async () => {
      const v11 = await versioningService.createMinorVersion(
        'workflow',
        sourceWorkflow.id,
      ) as Workflow;

      const history = await versioningService.getVersionHistory('workflow', v11.id);

      expect(history).toHaveLength(2);
      expect(history[0].id).toBe(sourceWorkflow.id);
      expect(history[1].id).toBe(v11.id);

      // Cleanup
      await prisma.workflow.delete({ where: { id: v11.id } });
    });
  });
});
