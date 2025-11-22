/**
 * Integration Tests for ChecksumService
 * Tests real database interactions for checksum operations
 *
 * Covers:
 * - AC-CS-01: Instruction checksum whitespace normalization
 * - AC-CS-02: Config checksum key ordering
 * - AC-CS-03: Non-blocking validation
 * - AC-CS-04: Manual change detection
 * - AC-CS-05: MD5 format validation
 */

import { PrismaClient, Component, Project } from '@prisma/client';
import { ChecksumService } from '../checksum.service';
import { randomUUID } from 'crypto';

describe('ChecksumService - Integration Tests', () => {
  let prisma: PrismaClient;
  let checksumService: ChecksumService;
  let testProject: Project;
  const TEST_PREFIX = 'test_ST83_checksum_';

  beforeAll(async () => {
    prisma = new PrismaClient();
    checksumService = new ChecksumService(prisma);

    // Create test project
    testProject = await prisma.project.create({
      data: {
        id: randomUUID(),
        name: `${TEST_PREFIX}project_${Date.now()}`,
        description: 'Test project for ST-83 checksum integration tests',
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
        tools: ['tool1'],
        version: 'v1.0',
        versionMajor: 1,
        versionMinor: 0,
        ...overrides,
      },
    });
  }

  describe('AC-CS-01: Instruction Checksum Whitespace Normalization', () => {
    it('should normalize leading and trailing whitespace', () => {
      const clean = checksumService.calculateInstructionChecksum(
        'input',
        'operation',
        'output',
      );
      const withWhitespace = checksumService.calculateInstructionChecksum(
        '  input  ',
        '\toperation\t',
        '\n  output  \n',
      );

      expect(clean).toBe(withWhitespace);
    });

    it('should collapse multiple spaces into single space', () => {
      const singleSpace = checksumService.calculateInstructionChecksum(
        'test input',
        'test operation',
        'test output',
      );
      const multipleSpaces = checksumService.calculateInstructionChecksum(
        'test    input',
        'test     operation',
        'test      output',
      );

      expect(singleSpace).toBe(multipleSpaces);
    });

    it('should normalize tabs and newlines to single space', () => {
      const normal = checksumService.calculateInstructionChecksum(
        'line one line two',
        'step one step two',
        'result one result two',
      );
      const withTabs = checksumService.calculateInstructionChecksum(
        'line one\tline two',
        'step one\nstep two',
        'result one\r\nresult two',
      );

      expect(normal).toBe(withTabs);
    });

    it('should handle empty strings', () => {
      const checksum = checksumService.calculateInstructionChecksum('', '', '');
      expect(checksum).toMatch(/^[a-f0-9]{32}$/);
    });
  });

  describe('AC-CS-02: Config Checksum Key Ordering', () => {
    it('should produce same hash regardless of key order', () => {
      const config1 = { a: 1, b: 2, c: 3 };
      const config2 = { c: 3, a: 1, b: 2 };
      const config3 = { b: 2, c: 3, a: 1 };

      const hash1 = checksumService.calculateConfigChecksum(config1);
      const hash2 = checksumService.calculateConfigChecksum(config2);
      const hash3 = checksumService.calculateConfigChecksum(config3);

      expect(hash1).toBe(hash2);
      expect(hash2).toBe(hash3);
    });

    it('should handle nested objects with different key orders', () => {
      const config1 = {
        outer: { a: 1, b: 2 },
        other: 'value',
      };
      const config2 = {
        other: 'value',
        outer: { b: 2, a: 1 },
      };

      const hash1 = checksumService.calculateConfigChecksum(config1);
      const hash2 = checksumService.calculateConfigChecksum(config2);

      expect(hash1).toBe(hash2);
    });

    it('should handle arrays in config', () => {
      const config1 = { items: [1, 2, 3], name: 'test' };
      const config2 = { name: 'test', items: [1, 2, 3] };

      const hash1 = checksumService.calculateConfigChecksum(config1);
      const hash2 = checksumService.calculateConfigChecksum(config2);

      expect(hash1).toBe(hash2);
    });

    it('should produce different hashes for different config values', () => {
      const config1 = { modelId: 'claude-3-sonnet' };
      const config2 = { modelId: 'claude-3-opus' };

      const hash1 = checksumService.calculateConfigChecksum(config1);
      const hash2 = checksumService.calculateConfigChecksum(config2);

      expect(hash1).not.toBe(hash2);
    });
  });

  describe('AC-CS-03: Non-blocking Runtime Validation', () => {
    let component: Component;

    beforeEach(async () => {
      component = await createTestComponent({
        instructionsChecksum: 'abc123abc123abc123abc123abc123ab',
      });
    });

    afterEach(async () => {
      await prisma.component.delete({ where: { id: component.id } });
    });

    it('should return match=true when checksums match', async () => {
      const result = await checksumService.validateRuntimeChecksum(
        component.id,
        'abc123abc123abc123abc123abc123ab',
      );

      expect(result.match).toBe(true);
      expect(result.expected).toBe('abc123abc123abc123abc123abc123ab');
      expect(result.actual).toBe('abc123abc123abc123abc123abc123ab');
    });

    it('should return match=false when checksums differ', async () => {
      const result = await checksumService.validateRuntimeChecksum(
        component.id,
        'different_checksum_value_here01',
      );

      expect(result.match).toBe(false);
      expect(result.expected).toBe('abc123abc123abc123abc123abc123ab');
      expect(result.actual).toBe('different_checksum_value_here01');
    });

    it('should return match=false for non-existent component without throwing', async () => {
      const result = await checksumService.validateRuntimeChecksum(
        randomUUID(),
        'some_checksum_value',
      );

      expect(result.match).toBe(false);
      expect(result.expected).toBeNull();
    });

    it('should return match=true when no stored checksum (first run)', async () => {
      const noChecksumComponent = await createTestComponent({
        instructionsChecksum: null,
      });

      const result = await checksumService.validateRuntimeChecksum(
        noChecksumComponent.id,
        'any_checksum_value',
      );

      expect(result.match).toBe(true);
      expect(result.expected).toBeNull();

      await prisma.component.delete({ where: { id: noChecksumComponent.id } });
    });
  });

  describe('AC-CS-04: Manual Change Detection', () => {
    it('should detect instruction changes', async () => {
      // Create component with stored checksum
      const originalChecksum = checksumService.calculateInstructionChecksum(
        'original input',
        'original operation',
        'original output',
      );

      const component = await createTestComponent({
        inputInstructions: 'modified input', // Changed!
        operationInstructions: 'original operation',
        outputInstructions: 'original output',
        instructionsChecksum: originalChecksum,
      });

      const report = await checksumService.detectManualChanges(component.id);

      expect(report.changed).toBe(true);
      expect(report.details).toContain('Instructions have been modified');

      await prisma.component.delete({ where: { id: component.id } });
    });

    it('should detect config changes', async () => {
      const originalConfigChecksum = checksumService.calculateConfigChecksum({
        modelId: 'claude-3-sonnet',
      });
      const originalInstructionsChecksum = checksumService.calculateInstructionChecksum(
        'input',
        'operation',
        'output',
      );

      const component = await createTestComponent({
        inputInstructions: 'input',
        operationInstructions: 'operation',
        outputInstructions: 'output',
        config: { modelId: 'claude-3-opus' }, // Changed!
        instructionsChecksum: originalInstructionsChecksum,
        configChecksum: originalConfigChecksum,
      });

      const report = await checksumService.detectManualChanges(component.id);

      expect(report.changed).toBe(true);
      expect(report.details).toContain('Config has been modified');

      await prisma.component.delete({ where: { id: component.id } });
    });

    it('should return changed=false when no changes detected', async () => {
      const instructions = {
        input: 'test input',
        operation: 'test operation',
        output: 'test output',
      };
      const config = { modelId: 'claude-3-sonnet' };

      const component = await createTestComponent({
        inputInstructions: instructions.input,
        operationInstructions: instructions.operation,
        outputInstructions: instructions.output,
        config,
        instructionsChecksum: checksumService.calculateInstructionChecksum(
          instructions.input,
          instructions.operation,
          instructions.output,
        ),
        configChecksum: checksumService.calculateConfigChecksum(config),
      });

      const report = await checksumService.detectManualChanges(component.id);

      expect(report.changed).toBe(false);

      await prisma.component.delete({ where: { id: component.id } });
    });

    it('should handle component without baseline checksum', async () => {
      const component = await createTestComponent({
        instructionsChecksum: null,
        configChecksum: null,
      });

      const report = await checksumService.detectManualChanges(component.id);

      expect(report.changed).toBe(false);
      expect(report.details).toContain('No baseline checksum');

      await prisma.component.delete({ where: { id: component.id } });
    });
  });

  describe('AC-CS-05: MD5 Format Validation', () => {
    it('should produce valid 32-char hex string for instruction checksum', () => {
      const checksum = checksumService.calculateInstructionChecksum(
        'input',
        'operation',
        'output',
      );

      expect(checksum).toMatch(/^[a-f0-9]{32}$/);
    });

    it('should produce valid 32-char hex string for config checksum', () => {
      const checksum = checksumService.calculateConfigChecksum({
        modelId: 'test',
      });

      expect(checksum).toMatch(/^[a-f0-9]{32}$/);
    });

    it('should produce lowercase hex characters only', () => {
      const checksum = checksumService.calculateInstructionChecksum(
        'TEST',
        'TEST',
        'TEST',
      );

      expect(checksum).toBe(checksum.toLowerCase());
      expect(checksum).not.toMatch(/[A-Z]/);
    });
  });

  describe('updateChecksums Integration', () => {
    let component: Component;

    beforeEach(async () => {
      component = await createTestComponent({
        instructionsChecksum: null,
        configChecksum: null,
      });
    });

    afterEach(async () => {
      await prisma.component.delete({ where: { id: component.id } });
    });

    it('should calculate and persist checksums to component', async () => {
      const result = await checksumService.updateChecksums('component', component.id);

      expect(result.instructionsChecksum).toMatch(/^[a-f0-9]{32}$/);
      expect(result.configChecksum).toMatch(/^[a-f0-9]{32}$/);

      // Verify persisted to database
      const updated = await prisma.component.findUnique({
        where: { id: component.id },
      });

      expect(updated?.instructionsChecksum).toBe(result.instructionsChecksum);
      expect(updated?.configChecksum).toBe(result.configChecksum);
    });

    it('should throw error for non-existent component', async () => {
      await expect(
        checksumService.updateChecksums('component', randomUUID()),
      ).rejects.toThrow('not found');
    });
  });
});
