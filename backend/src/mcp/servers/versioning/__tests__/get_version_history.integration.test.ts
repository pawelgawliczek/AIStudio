/**
 * Integration Tests for get_version_history MCP Tool
 * Tests real database interactions for version history retrieval
 *
 * Covers:
 * - AC-MCP-05: Ordered version chain (oldest to newest)
 * - TC-VER-007: Version history traversal
 */

import { PrismaClient, Component, Workflow, Project } from '@prisma/client';
import { handler } from '../get_version_history';
import { VersioningService } from '../../../../services/versioning.service';
import { randomUUID } from 'crypto';

describe('get_version_history MCP Tool - Integration Tests', () => {
  let prisma: PrismaClient;
  let versioningService: VersioningService;
  let testProject: Project;
  const TEST_PREFIX = 'test_ST83_history_';

  beforeAll(async () => {
    prisma = new PrismaClient();
    versioningService = new VersioningService(prisma as any);

    // Create test project
    testProject = await prisma.project.create({
      data: {
        id: randomUUID(),
        name: `${TEST_PREFIX}project_${Date.now()}`,
        description: 'Test project for version history integration tests',
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
        inputInstructions: 'Test input',
        operationInstructions: 'Test operation',
        outputInstructions: 'Test output',
        config: { modelId: 'claude-3' },
        tools: [],
        version: 'v1.0',
        versionMajor: 1,
        versionMinor: 0,
        ...overrides,
      },
    });
  }

  describe('AC-MCP-05: Component Version History', () => {
    let v10: Component;
    let v11: Component;
    let v12: Component;
    let v20: Component;

    beforeAll(async () => {
      v10 = await createTestComponent({ name: `${TEST_PREFIX}comp_history` });
      v11 = await versioningService.createMinorVersion('component', v10.id) as Component;
      v12 = await versioningService.createMinorVersion('component', v11.id) as Component;
      v20 = await versioningService.createMajorVersion('component', v12.id, 2) as Component;
    });

    afterAll(async () => {
      await prisma.component.delete({ where: { id: v20.id } });
      await prisma.component.delete({ where: { id: v12.id } });
      await prisma.component.delete({ where: { id: v11.id } });
      await prisma.component.delete({ where: { id: v10.id } });
    });

    it('should return history from oldest to newest', async () => {
      const result = await handler(prisma, {
        entityType: 'component',
        entityId: v20.id,
      });

      expect(result.history).toHaveLength(4);
      expect(result.history[0].id).toBe(v10.id);
      expect(result.history[1].id).toBe(v11.id);
      expect(result.history[2].id).toBe(v12.id);
      expect(result.history[3].id).toBe(v20.id);
    });

    it('should include versionLabel in correct format', async () => {
      const result = await handler(prisma, {
        entityType: 'component',
        entityId: v20.id,
      });

      expect(result.history[0].versionLabel).toBe('1.0');
      expect(result.history[1].versionLabel).toBe('1.1');
      expect(result.history[2].versionLabel).toBe('1.2');
      expect(result.history[3].versionLabel).toBe('2.0');
    });

    it('should include entity name and type in response', async () => {
      const result = await handler(prisma, {
        entityType: 'component',
        entityId: v10.id,
      });

      expect(result.entityType).toBe('component');
      expect(result.entityId).toBe(v10.id);
      expect(result.entityName).toBe(v10.name);
    });

    it('should include parentId chain in history items', async () => {
      const result = await handler(prisma, {
        entityType: 'component',
        entityId: v20.id,
      });

      expect(result.history[0].parentId).toBeNull();
      expect(result.history[1].parentId).toBe(v10.id);
      expect(result.history[2].parentId).toBe(v11.id);
      expect(result.history[3].parentId).toBe(v12.id);
    });

    it('should return single item for root version', async () => {
      const result = await handler(prisma, {
        entityType: 'component',
        entityId: v10.id,
      });

      expect(result.history).toHaveLength(1);
      expect(result.history[0].id).toBe(v10.id);
    });
  });

  describe('Coordinator Version History', () => {
    let coordinator: Component;
    let coordinatorV11: Component;

    beforeAll(async () => {
      coordinator = await createTestComponent({
        name: `${TEST_PREFIX}coordinator`,
        tags: ['coordinator'],
      });
      coordinatorV11 = await versioningService.createMinorVersion(
        'component',
        coordinator.id,
      ) as Component;
    });

    afterAll(async () => {
      await prisma.component.delete({ where: { id: coordinatorV11.id } });
      await prisma.component.delete({ where: { id: coordinator.id } });
    });

    it('should handle entityType=coordinator correctly', async () => {
      const result = await handler(prisma, {
        entityType: 'coordinator',
        entityId: coordinatorV11.id,
      });

      expect(result.entityType).toBe('coordinator');
      expect(result.history).toHaveLength(2);
    });

    it('should throw ValidationError if component is not a coordinator', async () => {
      const regularComponent = await createTestComponent({
        tags: ['regular'],
      });

      await expect(
        handler(prisma, {
          entityType: 'coordinator',
          entityId: regularComponent.id,
        }),
      ).rejects.toMatchObject({
        name: 'MCPError',
      });

      await prisma.component.delete({ where: { id: regularComponent.id } });
    });
  });

  describe('Workflow Version History', () => {
    let coordinator: Component;
    let workflow: Workflow;
    let workflowV11: Workflow;

    beforeAll(async () => {
      coordinator = await createTestComponent({
        tags: ['coordinator'],
      });

      workflow = await prisma.workflow.create({
        data: {
          id: randomUUID(),
          projectId: testProject.id,
          coordinatorId: coordinator.id,
          name: `${TEST_PREFIX}workflow`,
          version: 'v1.0',
          versionMajor: 1,
          versionMinor: 0,
          triggerConfig: { type: 'manual' },
        },
      });

      workflowV11 = await versioningService.createMinorVersion(
        'workflow',
        workflow.id,
      ) as Workflow;
    });

    afterAll(async () => {
      await prisma.workflow.delete({ where: { id: workflowV11.id } });
      await prisma.workflow.delete({ where: { id: workflow.id } });
      await prisma.component.delete({ where: { id: coordinator.id } });
    });

    it('should return workflow version history', async () => {
      const result = await handler(prisma, {
        entityType: 'workflow',
        entityId: workflowV11.id,
      });

      expect(result.entityType).toBe('workflow');
      expect(result.history).toHaveLength(2);
      expect(result.history[0].id).toBe(workflow.id);
      expect(result.history[1].id).toBe(workflowV11.id);
    });
  });

  describe('Error Handling', () => {
    it('should throw NotFoundError for non-existent component', async () => {
      const fakeId = randomUUID();

      await expect(
        handler(prisma, {
          entityType: 'component',
          entityId: fakeId,
        }),
      ).rejects.toMatchObject({
        name: 'MCPError',
        code: -32602,
      });
    });

    it('should throw NotFoundError for non-existent workflow', async () => {
      const fakeId = randomUUID();

      await expect(
        handler(prisma, {
          entityType: 'workflow',
          entityId: fakeId,
        }),
      ).rejects.toMatchObject({
        name: 'MCPError',
        code: -32602,
      });
    });

    it('should throw ValidationError for invalid entityType', async () => {
      await expect(
        handler(prisma, {
          entityType: 'invalid' as any,
          entityId: randomUUID(),
        }),
      ).rejects.toMatchObject({
        name: 'MCPError',
      });
    });

    it('should throw error when required params missing', async () => {
      await expect(
        handler(prisma, { entityType: 'component' } as any),
      ).rejects.toThrow();

      await expect(
        handler(prisma, { entityId: randomUUID() } as any),
      ).rejects.toThrow();
    });
  });

  describe('History Item Fields', () => {
    let component: Component;
    let componentV11: Component;

    beforeAll(async () => {
      component = await createTestComponent({
        instructionsChecksum: 'abc123abc123abc123abc123abc123ab',
        configChecksum: 'def456def456def456def456def456de',
      });
      componentV11 = await versioningService.createMinorVersion(
        'component',
        component.id,
        { changeDescription: 'Test change' },
      ) as Component;
    });

    afterAll(async () => {
      await prisma.component.delete({ where: { id: componentV11.id } });
      await prisma.component.delete({ where: { id: component.id } });
    });

    it('should include checksum fields in history items', async () => {
      const result = await handler(prisma, {
        entityType: 'component',
        entityId: componentV11.id,
      });

      expect(result.history[1].instructionsChecksum).toBeDefined();
      expect(result.history[1].configChecksum).toBeDefined();
    });

    it('should include changeDescription and createdFromVersion', async () => {
      const result = await handler(prisma, {
        entityType: 'component',
        entityId: componentV11.id,
      });

      expect(result.history[1].changeDescription).toBe('Test change');
      expect(result.history[1].createdFromVersion).toBe('1.0');
    });

    it('should include isDeprecated and createdAt fields', async () => {
      const result = await handler(prisma, {
        entityType: 'component',
        entityId: component.id,
      });

      expect(result.history[0].isDeprecated).toBe(false);
      expect(result.history[0].createdAt).toBeInstanceOf(Date);
    });
  });
});
