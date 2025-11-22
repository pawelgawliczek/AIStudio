/**
 * Integration Tests for compare_versions MCP Tool
 * Tests real database interactions for version comparison
 *
 * Covers:
 * - AC-MCP-06: Field diffs, checksum match, summary counts
 * - TC-VER-004: MCP compare_versions field diff
 */

import { PrismaClient, Component, Workflow, Project } from '@prisma/client';
import { handler } from '../compare_versions';
import { randomUUID } from 'crypto';

describe('compare_versions MCP Tool - Integration Tests', () => {
  let prisma: PrismaClient;
  let testProject: Project;
  const TEST_PREFIX = 'test_ST83_compare_';

  beforeAll(async () => {
    prisma = new PrismaClient();

    // Create test project
    testProject = await prisma.project.create({
      data: {
        id: randomUUID(),
        name: `${TEST_PREFIX}project_${Date.now()}`,
        description: 'Test project for compare_versions integration tests',
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
        tools: ['tool1'],
        tags: [],
        version: 'v1.0',
        versionMajor: 1,
        versionMinor: 0,
        ...overrides,
      },
    });
  }

  describe('TC-VER-004: Component Field Diffs', () => {
    let version1: Component;
    let version2: Component;

    beforeAll(async () => {
      version1 = await createTestComponent({
        name: 'Component V1',
        description: 'Original description',
        inputInstructions: 'Original input',
        operationInstructions: 'Original operation',
        outputInstructions: 'Original output',
        config: { modelId: 'claude-3', temperature: 0.5 },
        tools: ['read', 'write'],
        instructionsChecksum: 'abc123abc123abc123abc123abc123ab',
        configChecksum: 'def456def456def456def456def456de',
      });

      version2 = await createTestComponent({
        name: 'Component V2', // Changed
        description: 'Modified description', // Changed
        inputInstructions: 'Original input', // Same
        operationInstructions: 'Modified operation', // Changed
        outputInstructions: 'Original output', // Same
        config: { modelId: 'claude-3-opus', temperature: 0.7 }, // Changed
        tools: ['read', 'write', 'execute'], // Changed
        parentId: version1.id,
        versionMinor: 1,
        instructionsChecksum: 'xyz789xyz789xyz789xyz789xyz789xy', // Different
        configChecksum: 'uvw321uvw321uvw321uvw321uvw321uv', // Different
      });
    });

    afterAll(async () => {
      await prisma.component.delete({ where: { id: version2.id } });
      await prisma.component.delete({ where: { id: version1.id } });
    });

    it('should detect modified fields', async () => {
      const result = await handler(prisma, {
        entityType: 'component',
        versionId1: version1.id,
        versionId2: version2.id,
      });

      const nameDiff = result.fieldDiffs.find(d => d.field === 'name');
      expect(nameDiff?.changeType).toBe('modified');
      expect(nameDiff?.value1).toBe('Component V1');
      expect(nameDiff?.value2).toBe('Component V2');
    });

    it('should detect unchanged fields', async () => {
      const result = await handler(prisma, {
        entityType: 'component',
        versionId1: version1.id,
        versionId2: version2.id,
      });

      const inputDiff = result.fieldDiffs.find(d => d.field === 'inputInstructions');
      expect(inputDiff?.changeType).toBe('unchanged');
    });

    it('should compare config objects', async () => {
      const result = await handler(prisma, {
        entityType: 'component',
        versionId1: version1.id,
        versionId2: version2.id,
      });

      const configDiff = result.fieldDiffs.find(d => d.field === 'config');
      expect(configDiff?.changeType).toBe('modified');
    });

    it('should compare tools arrays', async () => {
      const result = await handler(prisma, {
        entityType: 'component',
        versionId1: version1.id,
        versionId2: version2.id,
      });

      const toolsDiff = result.fieldDiffs.find(d => d.field === 'tools');
      expect(toolsDiff?.changeType).toBe('modified');
    });

    it('should return checksumMatch=false when checksums differ', async () => {
      const result = await handler(prisma, {
        entityType: 'component',
        versionId1: version1.id,
        versionId2: version2.id,
      });

      expect(result.checksumMatch).toBe(false);
    });

    it('should include summary counts', async () => {
      const result = await handler(prisma, {
        entityType: 'component',
        versionId1: version1.id,
        versionId2: version2.id,
      });

      expect(result.summary.modified).toBeGreaterThan(0);
      expect(result.summary.unchanged).toBeGreaterThan(0);
      expect(typeof result.summary.added).toBe('number');
      expect(typeof result.summary.removed).toBe('number');
    });

    it('should include version metadata in response', async () => {
      const result = await handler(prisma, {
        entityType: 'component',
        versionId1: version1.id,
        versionId2: version2.id,
      });

      expect(result.version1.id).toBe(version1.id);
      expect(result.version1.versionLabel).toBe('1.0');
      expect(result.version2.id).toBe(version2.id);
      expect(result.version2.versionLabel).toBe('1.1');
    });
  });

  describe('Identical Versions', () => {
    let version1: Component;
    let version2: Component;

    beforeAll(async () => {
      const commonChecksum = 'aaa111bbb222ccc333ddd444eee555ff';
      version1 = await createTestComponent({
        name: 'Same Component',
        description: 'Same description',
        inputInstructions: 'Same input',
        operationInstructions: 'Same operation',
        outputInstructions: 'Same output',
        config: { modelId: 'claude-3' },
        tools: ['tool1'],
        instructionsChecksum: commonChecksum,
        configChecksum: commonChecksum,
      });

      version2 = await createTestComponent({
        name: 'Same Component',
        description: 'Same description',
        inputInstructions: 'Same input',
        operationInstructions: 'Same operation',
        outputInstructions: 'Same output',
        config: { modelId: 'claude-3' },
        tools: ['tool1'],
        parentId: version1.id,
        versionMinor: 1,
        instructionsChecksum: commonChecksum,
        configChecksum: commonChecksum,
      });
    });

    afterAll(async () => {
      await prisma.component.delete({ where: { id: version2.id } });
      await prisma.component.delete({ where: { id: version1.id } });
    });

    it('should return checksumMatch=true for identical checksums', async () => {
      const result = await handler(prisma, {
        entityType: 'component',
        versionId1: version1.id,
        versionId2: version2.id,
      });

      expect(result.checksumMatch).toBe(true);
    });

    it('should report all fields as unchanged', async () => {
      const result = await handler(prisma, {
        entityType: 'component',
        versionId1: version1.id,
        versionId2: version2.id,
      });

      const modifiedCount = result.fieldDiffs.filter(
        d => d.changeType === 'modified',
      ).length;
      expect(modifiedCount).toBe(0);
    });
  });

  describe('Coordinator Comparison', () => {
    let coordinator1: Component;
    let coordinator2: Component;

    beforeAll(async () => {
      coordinator1 = await createTestComponent({
        name: 'Coordinator V1',
        tags: ['coordinator'],
        coordinatorInstructions: 'Original instructions',
        decisionStrategy: 'sequential',
      });

      coordinator2 = await createTestComponent({
        name: 'Coordinator V2',
        tags: ['coordinator'],
        coordinatorInstructions: 'Modified instructions',
        decisionStrategy: 'adaptive',
        parentId: coordinator1.id,
        versionMinor: 1,
      });
    });

    afterAll(async () => {
      await prisma.component.delete({ where: { id: coordinator2.id } });
      await prisma.component.delete({ where: { id: coordinator1.id } });
    });

    it('should compare coordinator-specific fields', async () => {
      const result = await handler(prisma, {
        entityType: 'coordinator',
        versionId1: coordinator1.id,
        versionId2: coordinator2.id,
      });

      const instructionsDiff = result.fieldDiffs.find(
        d => d.field === 'coordinatorInstructions',
      );
      expect(instructionsDiff).toBeDefined();

      const strategyDiff = result.fieldDiffs.find(
        d => d.field === 'decisionStrategy',
      );
      expect(strategyDiff?.changeType).toBe('modified');
    });

    it('should throw ValidationError if entity is not a coordinator', async () => {
      const regularComponent = await createTestComponent({
        tags: ['regular'],
      });

      await expect(
        handler(prisma, {
          entityType: 'coordinator',
          versionId1: regularComponent.id,
          versionId2: coordinator1.id,
        }),
      ).rejects.toMatchObject({
        name: 'MCPError',
      });

      await prisma.component.delete({ where: { id: regularComponent.id } });
    });
  });

  describe('Workflow Comparison', () => {
    let coordinator: Component;
    let workflow1: Workflow;
    let workflow2: Workflow;

    beforeAll(async () => {
      coordinator = await createTestComponent({
        tags: ['coordinator'],
      });

      workflow1 = await prisma.workflow.create({
        data: {
          id: randomUUID(),
          projectId: testProject.id,
          coordinatorId: coordinator.id,
          name: 'Workflow V1',
          description: 'Original workflow',
          version: 'v1.0',
          versionMajor: 1,
          versionMinor: 0,
          triggerConfig: { type: 'manual' },
          active: true,
        },
      });

      workflow2 = await prisma.workflow.create({
        data: {
          id: randomUUID(),
          projectId: testProject.id,
          coordinatorId: coordinator.id,
          name: 'Workflow V2',
          description: 'Modified workflow',
          version: 'v1.1',
          versionMajor: 1,
          versionMinor: 1,
          triggerConfig: { type: 'webhook', url: 'https://example.com' },
          active: false,
          parentId: workflow1.id,
        },
      });
    });

    afterAll(async () => {
      await prisma.workflow.delete({ where: { id: workflow2.id } });
      await prisma.workflow.delete({ where: { id: workflow1.id } });
      await prisma.component.delete({ where: { id: coordinator.id } });
    });

    it('should compare workflow-specific fields', async () => {
      const result = await handler(prisma, {
        entityType: 'workflow',
        versionId1: workflow1.id,
        versionId2: workflow2.id,
      });

      expect(result.entityType).toBe('workflow');

      const triggerDiff = result.fieldDiffs.find(d => d.field === 'triggerConfig');
      expect(triggerDiff?.changeType).toBe('modified');

      const activeDiff = result.fieldDiffs.find(d => d.field === 'active');
      expect(activeDiff?.changeType).toBe('modified');
    });
  });

  describe('Error Handling', () => {
    it('should throw NotFoundError for non-existent version1', async () => {
      const existingComponent = await createTestComponent();

      await expect(
        handler(prisma, {
          entityType: 'component',
          versionId1: randomUUID(),
          versionId2: existingComponent.id,
        }),
      ).rejects.toMatchObject({
        name: 'MCPError',
        code: -32602,
      });

      await prisma.component.delete({ where: { id: existingComponent.id } });
    });

    it('should throw NotFoundError for non-existent version2', async () => {
      const existingComponent = await createTestComponent();

      await expect(
        handler(prisma, {
          entityType: 'component',
          versionId1: existingComponent.id,
          versionId2: randomUUID(),
        }),
      ).rejects.toMatchObject({
        name: 'MCPError',
        code: -32602,
      });

      await prisma.component.delete({ where: { id: existingComponent.id } });
    });

    it('should throw ValidationError for invalid entityType', async () => {
      await expect(
        handler(prisma, {
          entityType: 'invalid' as any,
          versionId1: randomUUID(),
          versionId2: randomUUID(),
        }),
      ).rejects.toMatchObject({
        name: 'MCPError',
      });
    });

    it('should throw error when required params missing', async () => {
      await expect(
        handler(prisma, {
          entityType: 'component',
          versionId1: randomUUID(),
        } as any),
      ).rejects.toThrow();
    });
  });
});
