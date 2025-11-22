/**
 * Integration Tests for update_workflow Auto-Versioning
 * Tests real database interactions for workflow auto-versioning logic
 *
 * Covers:
 * - AC-WV-01: coordinatorId change triggers auto-version
 * - AC-WV-02: triggerConfig change triggers auto-version
 * - AC-WV-03: Metadata-only changes do NOT trigger auto-version
 * - AC-WV-04: Auto-versioned response includes metadata
 * - AC-WV-05: Inactive coordinator throws ValidationError
 * - TC-VER-006: Workflow auto-versioning on coordinator change
 */

import { PrismaClient, Component, Workflow, Project } from '@prisma/client';
import { createTestPrismaClient } from '@/test-utils/safe-prisma-client';
import { handler } from '../update_workflow';
import { randomUUID } from 'crypto';

describe('update_workflow Auto-Versioning - Integration Tests', () => {
  let prisma: PrismaClient;
  let testProject: Project;
  const TEST_PREFIX = 'test_ST83_workflow_';

  beforeAll(async () => {
    prisma = createTestPrismaClient();

    // Create test project
    testProject = await prisma.project.create({
      data: {
        id: randomUUID(),
        name: `${TEST_PREFIX}project_${Date.now()}`,
        description: 'Test project for workflow auto-versioning integration tests',
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

  // Helper to create test coordinator
  async function createTestCoordinator(overrides: Partial<Component> = {}): Promise<Component> {
    return prisma.component.create({
      data: {
        id: randomUUID(),
        projectId: testProject.id,
        name: `${TEST_PREFIX}coordinator_${Date.now()}`,
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
        description: 'Test workflow',
        version: 'v1.0',
        versionMajor: 1,
        versionMinor: 0,
        triggerConfig: { type: 'manual' },
        active: true,
        ...overrides,
      },
    });
  }

  describe('AC-WV-01: coordinatorId Change Triggers Auto-Version', () => {
    let originalCoordinator: Component;
    let newCoordinator: Component;
    let workflow: Workflow;

    beforeEach(async () => {
      originalCoordinator = await createTestCoordinator({
        name: `${TEST_PREFIX}original_coordinator`,
      });
      newCoordinator = await createTestCoordinator({
        name: `${TEST_PREFIX}new_coordinator`,
      });
      workflow = await createTestWorkflow(originalCoordinator.id);
    });

    afterEach(async () => {
      // Delete workflow versions
      await prisma.workflow.deleteMany({
        where: {
          OR: [
            { id: workflow.id },
            { parentId: workflow.id },
          ],
        },
      });
      await prisma.component.delete({ where: { id: originalCoordinator.id } });
      await prisma.component.delete({ where: { id: newCoordinator.id } });
    });

    it('should create new version when coordinatorId changes', async () => {
      const result = await handler(prisma, {
        workflowId: workflow.id,
        coordinatorId: newCoordinator.id,
      });

      expect(result.autoVersioned).toBe(true);
      expect(result.id).not.toBe(workflow.id); // New version has different ID
      expect(result.coordinatorId).toBe(newCoordinator.id);
    });

    it('should increment versionMinor (1.0 -> 1.1)', async () => {
      const result = await handler(prisma, {
        workflowId: workflow.id,
        coordinatorId: newCoordinator.id,
      });

      expect(result.versionMajor).toBe(1);
      expect(result.versionMinor).toBe(1);
      expect(result.version).toBe('v1.1');
    });

    it('should include versionedFrom in response', async () => {
      const result = await handler(prisma, {
        workflowId: workflow.id,
        coordinatorId: newCoordinator.id,
      });

      expect(result.versionedFrom).toBe('v1.0');
    });

    it('should include changeDescription mentioning coordinator update', async () => {
      const result = await handler(prisma, {
        workflowId: workflow.id,
        coordinatorId: newCoordinator.id,
      });

      expect(result.changeDescription).toContain('Updated coordinator');
      expect(result.changeDescription).toContain(originalCoordinator.id);
      expect(result.changeDescription).toContain(newCoordinator.id);
    });

    it('should create new version with parentId set to original', async () => {
      const result = await handler(prisma, {
        workflowId: workflow.id,
        coordinatorId: newCoordinator.id,
      });

      const newVersion = await prisma.workflow.findUnique({
        where: { id: result.id },
      });

      expect(newVersion?.parentId).toBe(workflow.id);
    });
  });

  describe('AC-WV-02: triggerConfig Change Triggers Auto-Version', () => {
    let coordinator: Component;
    let workflow: Workflow;

    beforeEach(async () => {
      coordinator = await createTestCoordinator();
      workflow = await createTestWorkflow(coordinator.id, {
        triggerConfig: { type: 'manual' },
      });
    });

    afterEach(async () => {
      await prisma.workflow.deleteMany({
        where: {
          OR: [
            { id: workflow.id },
            { parentId: workflow.id },
          ],
        },
      });
      await prisma.component.delete({ where: { id: coordinator.id } });
    });

    it('should create new version when triggerConfig changes', async () => {
      const result = await handler(prisma, {
        workflowId: workflow.id,
        triggerConfig: { type: 'webhook', url: 'https://example.com' },
      });

      expect(result.autoVersioned).toBe(true);
      expect(result.triggerConfig).toEqual({
        type: 'webhook',
        url: 'https://example.com',
      });
    });

    it('should include changeDescription mentioning trigger config', async () => {
      const result = await handler(prisma, {
        workflowId: workflow.id,
        triggerConfig: { type: 'story_assigned' },
      });

      expect(result.changeDescription).toContain('Updated trigger configuration');
    });

    it('should create new version even with minor triggerConfig changes', async () => {
      const result = await handler(prisma, {
        workflowId: workflow.id,
        triggerConfig: { type: 'manual', notifications: { enabled: true } },
      });

      expect(result.autoVersioned).toBe(true);
    });
  });

  describe('AC-WV-03: Metadata-Only Changes Do NOT Trigger Auto-Version', () => {
    let coordinator: Component;
    let workflow: Workflow;

    beforeEach(async () => {
      coordinator = await createTestCoordinator();
      workflow = await createTestWorkflow(coordinator.id);
    });

    afterEach(async () => {
      await prisma.workflow.deleteMany({
        where: { id: workflow.id },
      });
      await prisma.component.delete({ where: { id: coordinator.id } });
    });

    it('should NOT auto-version when only name changes', async () => {
      const result = await handler(prisma, {
        workflowId: workflow.id,
        name: 'Updated Workflow Name',
      });

      expect(result.autoVersioned).toBe(false);
      expect(result.id).toBe(workflow.id); // Same workflow ID
      expect(result.name).toBe('Updated Workflow Name');
    });

    it('should NOT auto-version when only description changes', async () => {
      const result = await handler(prisma, {
        workflowId: workflow.id,
        description: 'Updated description',
      });

      expect(result.autoVersioned).toBe(false);
      expect(result.versionedFrom).toBeUndefined();
    });

    it('should NOT auto-version when only active changes', async () => {
      const result = await handler(prisma, {
        workflowId: workflow.id,
        active: false,
      });

      expect(result.autoVersioned).toBe(false);
      expect(result.active).toBe(false);
    });

    it('should update in place for metadata-only changes', async () => {
      const result = await handler(prisma, {
        workflowId: workflow.id,
        name: 'New Name',
        description: 'New Description',
      });

      // Verify same workflow was updated
      expect(result.id).toBe(workflow.id);
      expect(result.versionMajor).toBe(1);
      expect(result.versionMinor).toBe(0); // No version increment
    });
  });

  describe('AC-WV-04: Auto-Versioned Response Metadata', () => {
    let coordinator1: Component;
    let coordinator2: Component;
    let workflow: Workflow;

    beforeEach(async () => {
      coordinator1 = await createTestCoordinator();
      coordinator2 = await createTestCoordinator();
      workflow = await createTestWorkflow(coordinator1.id);
    });

    afterEach(async () => {
      await prisma.workflow.deleteMany({
        where: {
          OR: [
            { id: workflow.id },
            { parentId: workflow.id },
          ],
        },
      });
      await prisma.component.delete({ where: { id: coordinator1.id } });
      await prisma.component.delete({ where: { id: coordinator2.id } });
    });

    it('should include all required auto-version metadata', async () => {
      const result = await handler(prisma, {
        workflowId: workflow.id,
        coordinatorId: coordinator2.id,
      });

      expect(result.autoVersioned).toBe(true);
      expect(result.versionedFrom).toBeDefined();
      expect(result.changeDescription).toBeDefined();
      expect(result.versionMajor).toBeDefined();
      expect(result.versionMinor).toBeDefined();
    });

    it('should return standard workflow response fields', async () => {
      const result = await handler(prisma, {
        workflowId: workflow.id,
        triggerConfig: { type: 'webhook' },
      });

      expect(result.id).toBeDefined();
      expect(result.projectId).toBe(testProject.id);
      expect(result.coordinatorId).toBeDefined();
      expect(result.name).toBeDefined();
      expect(result.version).toBeDefined();
      expect(result.triggerConfig).toBeDefined();
      expect(result.active).toBeDefined();
      expect(result.createdAt).toBeDefined();
      expect(result.updatedAt).toBeDefined();
    });
  });

  describe('AC-WV-05: Inactive Coordinator Validation', () => {
    let activeCoordinator: Component;
    let inactiveCoordinator: Component;
    let workflow: Workflow;

    beforeEach(async () => {
      activeCoordinator = await createTestCoordinator({ active: true });
      inactiveCoordinator = await createTestCoordinator({ active: false });
      workflow = await createTestWorkflow(activeCoordinator.id);
    });

    afterEach(async () => {
      await prisma.workflow.deleteMany({
        where: { id: workflow.id },
      });
      await prisma.component.delete({ where: { id: activeCoordinator.id } });
      await prisma.component.delete({ where: { id: inactiveCoordinator.id } });
    });

    it('should throw ValidationError when assigning inactive coordinator', async () => {
      await expect(
        handler(prisma, {
          workflowId: workflow.id,
          coordinatorId: inactiveCoordinator.id,
        }),
      ).rejects.toMatchObject({
        name: 'MCPError',
      });
    });

    it('should include coordinator name and version in error message', async () => {
      try {
        await handler(prisma, {
          workflowId: workflow.id,
          coordinatorId: inactiveCoordinator.id,
        });
        fail('Should have thrown');
      } catch (error: any) {
        expect(error.message).toContain('inactive coordinator');
        expect(error.message).toContain(inactiveCoordinator.name);
      }
    });

    it('should succeed with active coordinator', async () => {
      const anotherActiveCoordinator = await createTestCoordinator({
        active: true,
      });

      const result = await handler(prisma, {
        workflowId: workflow.id,
        coordinatorId: anotherActiveCoordinator.id,
      });

      expect(result.autoVersioned).toBe(true);
      expect(result.coordinatorId).toBe(anotherActiveCoordinator.id);

      await prisma.component.delete({ where: { id: anotherActiveCoordinator.id } });
    });
  });

  describe('TC-VER-006: Combined Changes (Structural + Metadata)', () => {
    let coordinator1: Component;
    let coordinator2: Component;
    let workflow: Workflow;

    beforeEach(async () => {
      coordinator1 = await createTestCoordinator();
      coordinator2 = await createTestCoordinator();
      workflow = await createTestWorkflow(coordinator1.id);
    });

    afterEach(async () => {
      await prisma.workflow.deleteMany({
        where: {
          OR: [
            { id: workflow.id },
            { parentId: workflow.id },
          ],
        },
      });
      await prisma.component.delete({ where: { id: coordinator1.id } });
      await prisma.component.delete({ where: { id: coordinator2.id } });
    });

    it('should auto-version when both structural and metadata changes', async () => {
      const result = await handler(prisma, {
        workflowId: workflow.id,
        coordinatorId: coordinator2.id, // Structural
        name: 'Updated Name', // Metadata
        description: 'Updated Description', // Metadata
      });

      expect(result.autoVersioned).toBe(true);
      expect(result.name).toBe('Updated Name');
      expect(result.description).toBe('Updated Description');
      expect(result.coordinatorId).toBe(coordinator2.id);
    });

    it('should include both changes in changeDescription', async () => {
      const result = await handler(prisma, {
        workflowId: workflow.id,
        coordinatorId: coordinator2.id,
        triggerConfig: { type: 'webhook' },
      });

      expect(result.changeDescription).toContain('Updated coordinator');
      expect(result.changeDescription).toContain('Updated trigger configuration');
      expect(result.changeDescription).toContain(';'); // Separator between changes
    });
  });

  describe('Error Handling', () => {
    let coordinator: Component;
    let workflow: Workflow;

    beforeEach(async () => {
      coordinator = await createTestCoordinator();
      workflow = await createTestWorkflow(coordinator.id);
    });

    afterEach(async () => {
      await prisma.workflow.deleteMany({
        where: { id: workflow.id },
      });
      await prisma.component.delete({ where: { id: coordinator.id } });
    });

    it('should throw NotFoundError for non-existent workflow', async () => {
      await expect(
        handler(prisma, {
          workflowId: randomUUID(),
          name: 'Test',
        }),
      ).rejects.toMatchObject({
        name: 'MCPError',
        code: -32602,
      });
    });

    it('should throw NotFoundError for non-existent coordinator', async () => {
      await expect(
        handler(prisma, {
          workflowId: workflow.id,
          coordinatorId: randomUUID(),
        }),
      ).rejects.toMatchObject({
        name: 'MCPError',
        code: -32602,
      });
    });

    it('should throw ValidationError when coordinator from different project', async () => {
      const otherProject = await prisma.project.create({
        data: {
          id: randomUUID(),
          name: `${TEST_PREFIX}other_project`,
          status: 'active',
        },
      });

      const otherCoordinator = await createTestCoordinator({
        projectId: otherProject.id,
      });

      await expect(
        handler(prisma, {
          workflowId: workflow.id,
          coordinatorId: otherCoordinator.id,
        }),
      ).rejects.toMatchObject({
        name: 'MCPError',
      });

      await prisma.component.delete({ where: { id: otherCoordinator.id } });
      await prisma.project.delete({ where: { id: otherProject.id } });
    });

    it('should throw ValidationError when triggerConfig missing type', async () => {
      await expect(
        handler(prisma, {
          workflowId: workflow.id,
          triggerConfig: { filters: {} } as any,
        }),
      ).rejects.toMatchObject({
        name: 'MCPError',
      });
    });

    it('should throw ValidationError when no fields to update', async () => {
      await expect(
        handler(prisma, {
          workflowId: workflow.id,
        }),
      ).rejects.toMatchObject({
        name: 'MCPError',
      });
    });
  });

  describe('Version Chain Integrity', () => {
    let coordinator1: Component;
    let coordinator2: Component;
    let coordinator3: Component;
    let workflow: Workflow;

    beforeEach(async () => {
      coordinator1 = await createTestCoordinator();
      coordinator2 = await createTestCoordinator();
      coordinator3 = await createTestCoordinator();
      workflow = await createTestWorkflow(coordinator1.id);
    });

    afterEach(async () => {
      // Delete entire version chain
      const allVersions = await prisma.workflow.findMany({
        where: {
          OR: [
            { id: workflow.id },
            { parentId: workflow.id },
          ],
        },
      });

      for (const v of allVersions) {
        if (v.parentId) {
          await prisma.workflow.delete({ where: { id: v.id } });
        }
      }
      await prisma.workflow.delete({ where: { id: workflow.id } });

      await prisma.component.delete({ where: { id: coordinator1.id } });
      await prisma.component.delete({ where: { id: coordinator2.id } });
      await prisma.component.delete({ where: { id: coordinator3.id } });
    });

    it('should create proper version chain (1.0 -> 1.1 -> 1.2)', async () => {
      // Create 1.1
      const v11 = await handler(prisma, {
        workflowId: workflow.id,
        coordinatorId: coordinator2.id,
      });

      // Create 1.2 from 1.1
      const v12 = await handler(prisma, {
        workflowId: v11.id,
        triggerConfig: { type: 'webhook' },
      });

      expect(v11.versionMinor).toBe(1);
      expect(v11.versionedFrom).toBe('v1.0');

      expect(v12.versionMinor).toBe(2);
      expect(v12.versionedFrom).toBe('v1.1');

      // Verify parentId chain
      const v12Full = await prisma.workflow.findUnique({
        where: { id: v12.id },
      });
      const v11Full = await prisma.workflow.findUnique({
        where: { id: v11.id },
      });

      expect(v12Full?.parentId).toBe(v11.id);
      expect(v11Full?.parentId).toBe(workflow.id);
    });
  });
});
