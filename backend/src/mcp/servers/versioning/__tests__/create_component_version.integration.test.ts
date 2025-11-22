/**
 * Integration Tests for create_component_version MCP Tool
 * Tests real database interactions for component version creation
 *
 * Covers:
 * - AC-MCP-03: Minor/major version creation via MCP tool
 * - TC-VER-001: Minor version creation
 * - TC-VER-002: Major version creation
 */

import { PrismaClient, Component, Project } from '@prisma/client';
import { handler } from '../create_component_version';
import { randomUUID } from 'crypto';

describe('create_component_version MCP Tool - Integration Tests', () => {
  let prisma: PrismaClient;
  let testProject: Project;
  const TEST_PREFIX = 'test_ST83_mcp_';

  beforeAll(async () => {
    prisma = new PrismaClient();

    // Create test project
    testProject = await prisma.project.create({
      data: {
        id: randomUUID(),
        name: `${TEST_PREFIX}project_${Date.now()}`,
        description: 'Test project for MCP versioning integration tests',
        status: 'active',
      },
    });
  });

  afterAll(async () => {
    // Cleanup test data
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

  describe('TC-VER-001: Minor Version Creation', () => {
    let sourceComponent: Component;

    beforeEach(async () => {
      sourceComponent = await createTestComponent();
    });

    afterEach(async () => {
      await prisma.component.deleteMany({
        where: { parentId: sourceComponent.id },
      });
      await prisma.component.delete({
        where: { id: sourceComponent.id },
      });
    });

    it('should create minor version when majorVersion not provided', async () => {
      const result = await handler(prisma, {
        componentId: sourceComponent.id,
      });

      expect(result.versionMajor).toBe(1);
      expect(result.versionMinor).toBe(1);
      expect(result.versionLabel).toBe('1.1');
      expect(result.parentId).toBe(sourceComponent.id);
      expect(result.createdFromVersion).toBe('1.0');
    });

    it('should include message in response', async () => {
      const result = await handler(prisma, {
        componentId: sourceComponent.id,
      });

      expect(result.message).toBe('Created version 1.1 from 1.0');
    });

    it('should preserve changeDescription', async () => {
      const result = await handler(prisma, {
        componentId: sourceComponent.id,
        changeDescription: 'Fixed a bug in processing',
      });

      expect(result.changeDescription).toBe('Fixed a bug in processing');
    });

    it('should include checksums in response', async () => {
      const result = await handler(prisma, {
        componentId: sourceComponent.id,
      });

      expect(result.instructionsChecksum).toMatch(/^[a-f0-9]{32}$/);
      expect(result.configChecksum).toMatch(/^[a-f0-9]{32}$/);
    });

    it('should set isDeprecated to false for new version', async () => {
      const result = await handler(prisma, {
        componentId: sourceComponent.id,
      });

      expect(result.isDeprecated).toBe(false);
    });
  });

  describe('TC-VER-002: Major Version Creation', () => {
    let sourceComponent: Component;

    beforeEach(async () => {
      sourceComponent = await createTestComponent({
        versionMajor: 1,
        versionMinor: 5,
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

    it('should create major version when majorVersion provided', async () => {
      const result = await handler(prisma, {
        componentId: sourceComponent.id,
        majorVersion: 2,
      });

      expect(result.versionMajor).toBe(2);
      expect(result.versionMinor).toBe(0);
      expect(result.versionLabel).toBe('2.0');
      expect(result.createdFromVersion).toBe('1.5');
    });

    it('should allow skipping major versions (1.5 -> 3.0)', async () => {
      const result = await handler(prisma, {
        componentId: sourceComponent.id,
        majorVersion: 3,
      });

      expect(result.versionMajor).toBe(3);
      expect(result.versionMinor).toBe(0);
    });

    it('should reject majorVersion <= current version', async () => {
      await expect(
        handler(prisma, {
          componentId: sourceComponent.id,
          majorVersion: 1,
        }),
      ).rejects.toThrow();
    });
  });

  describe('Error Handling', () => {
    it('should throw NotFoundError for non-existent component', async () => {
      const fakeId = randomUUID();

      await expect(
        handler(prisma, { componentId: fakeId }),
      ).rejects.toMatchObject({
        name: 'MCPError',
        code: -32602,
      });
    });

    it('should throw ValidationError for deprecated component', async () => {
      const deprecatedComponent = await createTestComponent({
        isDeprecated: true,
        deprecatedAt: new Date(),
      });

      await expect(
        handler(prisma, { componentId: deprecatedComponent.id }),
      ).rejects.toMatchObject({
        name: 'MCPError',
      });

      await prisma.component.delete({ where: { id: deprecatedComponent.id } });
    });

    it('should throw error when componentId missing', async () => {
      await expect(
        handler(prisma, {} as any),
      ).rejects.toThrow();
    });
  });

  describe('Version Chain Integrity', () => {
    let v10: Component;

    beforeEach(async () => {
      v10 = await createTestComponent({
        name: `${TEST_PREFIX}chain_test`,
      });
    });

    afterEach(async () => {
      // Delete in reverse order
      const versions = await prisma.component.findMany({
        where: {
          OR: [
            { id: v10.id },
            { parentId: v10.id },
          ],
        },
        orderBy: { createdAt: 'desc' },
      });

      for (const v of versions) {
        await prisma.component.delete({ where: { id: v.id } });
      }
    });

    it('should create proper version chain via MCP tool', async () => {
      // Create 1.1
      const v11Result = await handler(prisma, { componentId: v10.id });

      // Fetch v11 for next version
      const v11 = await prisma.component.findUnique({
        where: { id: v11Result.id },
      });

      // Create 1.2
      const v12Result = await handler(prisma, { componentId: v11!.id });

      expect(v11Result.parentId).toBe(v10.id);
      expect(v12Result.parentId).toBe(v11!.id);
      expect(v12Result.createdFromVersion).toBe('1.1');

      // Cleanup v12
      await prisma.component.delete({ where: { id: v12Result.id } });
    });
  });

  describe('Component Data Preservation', () => {
    let sourceComponent: Component;

    beforeEach(async () => {
      sourceComponent = await createTestComponent({
        name: 'Original Name',
        description: 'Original Description',
        inputInstructions: 'Original Input',
        operationInstructions: 'Original Operation',
        outputInstructions: 'Original Output',
        config: { modelId: 'claude-3', temperature: 0.7 },
        tools: ['read', 'write', 'execute'],
        tags: ['test', 'integration'],
        onFailure: 'retry',
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

    it('should preserve all component fields in new version', async () => {
      const result = await handler(prisma, {
        componentId: sourceComponent.id,
      });

      // Verify key fields are preserved
      expect(result.name).toBe('Original Name');

      // Fetch full component to verify all fields
      const newVersion = await prisma.component.findUnique({
        where: { id: result.id },
      });

      expect(newVersion?.inputInstructions).toBe('Original Input');
      expect(newVersion?.operationInstructions).toBe('Original Operation');
      expect(newVersion?.outputInstructions).toBe('Original Output');
      expect(newVersion?.config).toEqual({ modelId: 'claude-3', temperature: 0.7 });
      expect(newVersion?.tools).toEqual(['read', 'write', 'execute']);
      expect(newVersion?.tags).toEqual(['test', 'integration']);
      expect(newVersion?.onFailure).toBe('retry');
    });
  });
});
