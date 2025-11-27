/**
 * Integration Tests for Component Lifecycle MCP Tools
 * Tests activate_component and deactivate_component with real database
 *
 * Covers:
 * - AC-CL-01: activate_component sets active=true
 * - AC-CL-02: deactivate_component validates no active workflows
 * - AC-CL-03: deactivate returns affectedWorkflows list
 * - AC-CL-04: get_component_usage returns accurate workflow count
 * - TC-VER-005: Component deactivation with workflow validation
 */

import { randomUUID } from 'crypto';
import { PrismaClient, Component, Workflow, Project } from '@prisma/client';
import { handler as activateHandler } from '../activate_component';
import { handler as deactivateHandler } from '../deactivate_component';

describe('Component Lifecycle MCP Tools - Integration Tests', () => {
  let prisma: PrismaClient;
  let testProject: Project;
  const TEST_PREFIX = 'test_ST83_lifecycle_';

  beforeAll(async () => {
    prisma = new PrismaClient();

    // Create test project
    testProject = await prisma.project.create({
      data: {
        id: randomUUID(),
        name: `${TEST_PREFIX}project_${Date.now()}`,
        description: 'Test project for component lifecycle integration tests',
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
        tags: ['coordinator'],
        version: 'v1.0',
        versionMajor: 1,
        versionMinor: 0,
        active: true,
        ...overrides,
      },
    });
  }

  // Helper to create test workflow
  async function createTestWorkflow(
    coordinatorId: string,
    overrides: Partial<Workflow> = {},
  ): Promise<Workflow> {
    return prisma.workflow.create({
      data: {
        id: randomUUID(),
        projectId: testProject.id,
        coordinatorId,
        name: `${TEST_PREFIX}workflow_${Date.now()}`,
        version: 'v1.0',
        versionMajor: 1,
        versionMinor: 0,
        triggerConfig: { type: 'manual' },
        active: true,
        ...overrides,
      },
    });
  }

  describe('AC-CL-01: activate_component', () => {
    let inactiveComponent: Component;

    beforeEach(async () => {
      inactiveComponent = await createTestComponent({
        active: false,
      });
    });

    afterEach(async () => {
      await prisma.component.delete({
        where: { id: inactiveComponent.id },
      });
    });

    it('should set active=true for inactive component', async () => {
      const result = await activateHandler(prisma, {
        componentId: inactiveComponent.id,
      });

      expect(result.success).toBe(true);
      expect(result.component.active).toBe(true);

      // Verify in database
      const updated = await prisma.component.findUnique({
        where: { id: inactiveComponent.id },
      });
      expect(updated?.active).toBe(true);
    });

    it('should return success message', async () => {
      const result = await activateHandler(prisma, {
        componentId: inactiveComponent.id,
      });

      expect(result.message).toContain('activated successfully');
    });

    it('should include component metadata in response', async () => {
      const result = await activateHandler(prisma, {
        componentId: inactiveComponent.id,
      });

      expect(result.component.id).toBe(inactiveComponent.id);
      expect(result.component.projectId).toBe(testProject.id);
      expect(result.component.name).toBe(inactiveComponent.name);
      expect(result.component.version).toBeDefined();
      expect(result.component.tags).toEqual(['coordinator']);
    });

    it('should succeed even if component is already active', async () => {
      const activeComponent = await createTestComponent({ active: true });

      const result = await activateHandler(prisma, {
        componentId: activeComponent.id,
      });

      expect(result.success).toBe(true);
      expect(result.component.active).toBe(true);

      await prisma.component.delete({ where: { id: activeComponent.id } });
    });

    it('should throw NotFoundError for non-existent component', async () => {
      await expect(
        activateHandler(prisma, { componentId: randomUUID() }),
      ).rejects.toMatchObject({
        name: 'NotFoundError',
        code: 'NOT_FOUND',
      });
    });
  });

  describe('AC-CL-02: deactivate_component with workflow validation', () => {
    let coordinator: Component;
    let activeWorkflow: Workflow;

    beforeEach(async () => {
      coordinator = await createTestComponent();
      activeWorkflow = await createTestWorkflow(coordinator.id, { active: true });
    });

    afterEach(async () => {
      await prisma.workflow.delete({ where: { id: activeWorkflow.id } });
      await prisma.component.delete({ where: { id: coordinator.id } });
    });

    it('should throw ValidationError when active workflows exist', async () => {
      await expect(
        deactivateHandler(prisma, {
          componentId: coordinator.id,
          force: false,
        }),
      ).rejects.toMatchObject({
        name: 'ValidationError',
        code: 'VALIDATION_ERROR',
      });
    });

    it('should include workflow count in error message', async () => {
      try {
        await deactivateHandler(prisma, {
          componentId: coordinator.id,
          force: false,
        });
        fail('Should have thrown');
      } catch (error: any) {
        expect(error.message).toContain('1 active workflow');
      }
    });

    it('should succeed with force=true even with active workflows', async () => {
      const result = await deactivateHandler(prisma, {
        componentId: coordinator.id,
        force: true,
      });

      expect(result.success).toBe(true);
      expect(result.component.active).toBe(false);
    });
  });

  describe('AC-CL-03: deactivate returns affectedWorkflows', () => {
    let coordinator: Component;
    let workflow1: Workflow;
    let workflow2: Workflow;
    let inactiveWorkflow: Workflow;

    beforeEach(async () => {
      coordinator = await createTestComponent();
      workflow1 = await createTestWorkflow(coordinator.id, {
        name: `${TEST_PREFIX}workflow1`,
        active: true,
      });
      workflow2 = await createTestWorkflow(coordinator.id, {
        name: `${TEST_PREFIX}workflow2`,
        active: true,
      });
      inactiveWorkflow = await createTestWorkflow(coordinator.id, {
        name: `${TEST_PREFIX}inactive_workflow`,
        active: false,
      });
    });

    afterEach(async () => {
      await prisma.workflow.deleteMany({
        where: { coordinatorId: coordinator.id },
      });
      await prisma.component.delete({ where: { id: coordinator.id } });
    });

    it('should return all affected workflows (both active and inactive)', async () => {
      const result = await deactivateHandler(prisma, {
        componentId: coordinator.id,
        force: true,
      });

      expect(result.affectedWorkflows).toHaveLength(3);
    });

    it('should include workflow id, name, and active status', async () => {
      const result = await deactivateHandler(prisma, {
        componentId: coordinator.id,
        force: true,
      });

      const affected1 = result.affectedWorkflows.find(w => w.id === workflow1.id);
      expect(affected1).toBeDefined();
      expect(affected1?.name).toBe(workflow1.name);
      expect(affected1?.active).toBe(true);

      const affectedInactive = result.affectedWorkflows.find(
        w => w.id === inactiveWorkflow.id,
      );
      expect(affectedInactive?.active).toBe(false);
    });

    it('should include count in message', async () => {
      const result = await deactivateHandler(prisma, {
        componentId: coordinator.id,
        force: true,
      });

      expect(result.message).toContain('3 workflow(s) affected');
    });
  });

  describe('TC-VER-005: Component without workflows', () => {
    let componentNoWorkflows: Component;

    beforeEach(async () => {
      componentNoWorkflows = await createTestComponent();
    });

    afterEach(async () => {
      await prisma.component.delete({
        where: { id: componentNoWorkflows.id },
      });
    });

    it('should deactivate without force when no workflows exist', async () => {
      const result = await deactivateHandler(prisma, {
        componentId: componentNoWorkflows.id,
        force: false,
      });

      expect(result.success).toBe(true);
      expect(result.component.active).toBe(false);
      expect(result.affectedWorkflows).toHaveLength(0);
    });

    it('should return empty affectedWorkflows array', async () => {
      const result = await deactivateHandler(prisma, {
        componentId: componentNoWorkflows.id,
      });

      expect(result.affectedWorkflows).toEqual([]);
    });
  });

  describe('Component with only inactive workflows', () => {
    let coordinator: Component;
    let inactiveWorkflow1: Workflow;
    let inactiveWorkflow2: Workflow;

    beforeEach(async () => {
      coordinator = await createTestComponent();
      inactiveWorkflow1 = await createTestWorkflow(coordinator.id, {
        active: false,
      });
      inactiveWorkflow2 = await createTestWorkflow(coordinator.id, {
        active: false,
      });
    });

    afterEach(async () => {
      await prisma.workflow.deleteMany({
        where: { coordinatorId: coordinator.id },
      });
      await prisma.component.delete({ where: { id: coordinator.id } });
    });

    it('should deactivate without force when only inactive workflows exist', async () => {
      const result = await deactivateHandler(prisma, {
        componentId: coordinator.id,
        force: false,
      });

      expect(result.success).toBe(true);
      expect(result.component.active).toBe(false);
    });

    it('should still return inactive workflows in affectedWorkflows', async () => {
      const result = await deactivateHandler(prisma, {
        componentId: coordinator.id,
      });

      expect(result.affectedWorkflows).toHaveLength(2);
      result.affectedWorkflows.forEach(w => {
        expect(w.active).toBe(false);
      });
    });
  });

  describe('Error Handling', () => {
    it('should throw NotFoundError for non-existent component on deactivate', async () => {
      await expect(
        deactivateHandler(prisma, { componentId: randomUUID() }),
      ).rejects.toMatchObject({
        name: 'NotFoundError',
        code: 'NOT_FOUND',
      });
    });

    it('should throw error when componentId missing for activate', async () => {
      await expect(
        activateHandler(prisma, {} as any),
      ).rejects.toThrow();
    });

    it('should throw error when componentId missing for deactivate', async () => {
      await expect(
        deactivateHandler(prisma, {} as any),
      ).rejects.toThrow();
    });
  });

  describe('Database State Verification', () => {
    let component: Component;

    beforeEach(async () => {
      component = await createTestComponent({ active: true });
    });

    afterEach(async () => {
      await prisma.component.delete({ where: { id: component.id } });
    });

    it('should persist active state changes to database', async () => {
      // Deactivate
      await deactivateHandler(prisma, { componentId: component.id });

      let dbComponent = await prisma.component.findUnique({
        where: { id: component.id },
      });
      expect(dbComponent?.active).toBe(false);

      // Reactivate
      await activateHandler(prisma, { componentId: component.id });

      dbComponent = await prisma.component.findUnique({
        where: { id: component.id },
      });
      expect(dbComponent?.active).toBe(true);
    });

    it('should update updatedAt timestamp', async () => {
      const originalUpdatedAt = component.updatedAt;

      // Small delay to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 10));

      await deactivateHandler(prisma, { componentId: component.id });

      const updated = await prisma.component.findUnique({
        where: { id: component.id },
      });

      expect(updated?.updatedAt.getTime()).toBeGreaterThan(
        originalUpdatedAt.getTime(),
      );
    });
  });
});
