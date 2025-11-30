import { ChecksumService } from '../checksum.service';
import { PrismaService } from '../../prisma/prisma.service';

// Mock PrismaService
const mockPrisma = {
  component: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
} as unknown as PrismaService;

describe('ChecksumService', () => {
  let service: ChecksumService;

  beforeEach(() => {
    service = new ChecksumService(mockPrisma);
    jest.clearAllMocks();
  });

  describe('TC-CHECKSUM-001: Instruction checksum is deterministic', () => {
    it('should produce identical hash for same inputs across multiple calls', () => {
      const input = 'Read the story context';
      const operation = 'Analyze requirements';
      const output = 'Generate analysis report';

      const hash1 = service.calculateInstructionChecksum(input, operation, output);
      const hash2 = service.calculateInstructionChecksum(input, operation, output);
      const hash3 = service.calculateInstructionChecksum(input, operation, output);

      expect(hash1).toBe(hash2);
      expect(hash2).toBe(hash3);
      expect(hash1).toMatch(/^[a-f0-9]{32}$/); // MD5 hex format
    });

    it('should produce different hash for different inputs', () => {
      const hash1 = service.calculateInstructionChecksum('input1', 'op1', 'output1');
      const hash2 = service.calculateInstructionChecksum('input2', 'op2', 'output2');

      expect(hash1).not.toBe(hash2);
    });

    it('should handle empty strings', () => {
      const hash1 = service.calculateInstructionChecksum('', '', '');
      const hash2 = service.calculateInstructionChecksum('', '', '');

      expect(hash1).toBe(hash2);
      expect(hash1).toMatch(/^[a-f0-9]{32}$/);
    });

    it('should handle null/undefined inputs gracefully', () => {
      const hash1 = service.calculateInstructionChecksum(null as any, undefined as any, '');
      const hash2 = service.calculateInstructionChecksum(null as any, undefined as any, '');

      expect(hash1).toBe(hash2);
    });
  });

  describe('TC-CHECKSUM-002: Whitespace normalization produces same hash', () => {
    it('should normalize leading/trailing whitespace', () => {
      const hash1 = service.calculateInstructionChecksum('  input  ', 'op', 'output');
      const hash2 = service.calculateInstructionChecksum('input', 'op', 'output');

      expect(hash1).toBe(hash2);
    });

    it('should collapse multiple spaces to single space', () => {
      const hash1 = service.calculateInstructionChecksum('input   with    spaces', 'op', 'out');
      const hash2 = service.calculateInstructionChecksum('input with spaces', 'op', 'out');

      expect(hash1).toBe(hash2);
    });

    it('should normalize tabs and newlines', () => {
      const hash1 = service.calculateInstructionChecksum('input\twith\ttabs', 'op\nwith\nnewlines', 'out');
      const hash2 = service.calculateInstructionChecksum('input with tabs', 'op with newlines', 'out');

      expect(hash1).toBe(hash2);
    });

    it('should handle mixed whitespace variations', () => {
      const hash1 = service.calculateInstructionChecksum(
        '  input\t\n  with   mixed  \n\t whitespace  ',
        'operation',
        'output'
      );
      const hash2 = service.calculateInstructionChecksum(
        'input with mixed whitespace',
        'operation',
        'output'
      );

      expect(hash1).toBe(hash2);
    });
  });

  describe('TC-CHECKSUM-003: Config checksum is deterministic with key ordering', () => {
    it('should produce identical hash regardless of key order', () => {
      const config1 = { modelId: 'claude-3', temperature: 0.7, maxTokens: 1000 };
      const config2 = { temperature: 0.7, maxTokens: 1000, modelId: 'claude-3' };
      const config3 = { maxTokens: 1000, modelId: 'claude-3', temperature: 0.7 };

      const hash1 = service.calculateConfigChecksum(config1);
      const hash2 = service.calculateConfigChecksum(config2);
      const hash3 = service.calculateConfigChecksum(config3);

      expect(hash1).toBe(hash2);
      expect(hash2).toBe(hash3);
    });

    it('should handle nested objects with key ordering', () => {
      const config1 = {
        modelId: 'claude-3',
        nested: { b: 2, a: 1 }
      };
      const config2 = {
        nested: { a: 1, b: 2 },
        modelId: 'claude-3'
      };

      const hash1 = service.calculateConfigChecksum(config1);
      const hash2 = service.calculateConfigChecksum(config2);

      expect(hash1).toBe(hash2);
    });

    it('should handle empty config', () => {
      const hash1 = service.calculateConfigChecksum({});
      const hash2 = service.calculateConfigChecksum({});

      expect(hash1).toBe(hash2);
      expect(hash1).toMatch(/^[a-f0-9]{32}$/);
    });

    it('should handle null/undefined config', () => {
      const hash1 = service.calculateConfigChecksum(null as any);
      const hash2 = service.calculateConfigChecksum(undefined as any);

      expect(hash1).toBe(hash2);
    });

    it('should produce different hash for different configs', () => {
      const hash1 = service.calculateConfigChecksum({ modelId: 'claude-3' });
      const hash2 = service.calculateConfigChecksum({ modelId: 'gpt-4' });

      expect(hash1).not.toBe(hash2);
    });
  });

  describe('TC-CHECKSUM-004: validateRuntimeChecksum returns proper result structure', () => {
    it('should return match: true when checksums match', async () => {
      const componentId = 'comp-123';
      const runtimeChecksum = 'abc123def456';

      (mockPrisma.component.findUnique as jest.Mock).mockResolvedValue({
        id: componentId,
        instructionsChecksum: 'abc123def456',
      });

      const result = await service.validateRuntimeChecksum(componentId, runtimeChecksum);

      expect(result).toEqual({
        match: true,
        expected: 'abc123def456',
        actual: 'abc123def456',
      });
    });

    it('should return match: false when checksums do not match', async () => {
      const componentId = 'comp-123';

      (mockPrisma.component.findUnique as jest.Mock).mockResolvedValue({
        id: componentId,
        instructionsChecksum: 'stored-hash',
      });

      const result = await service.validateRuntimeChecksum(componentId, 'different-hash');

      expect(result).toEqual({
        match: false,
        expected: 'stored-hash',
        actual: 'different-hash',
      });
    });

    it('should return match: false with null expected when component not found', async () => {
      (mockPrisma.component.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await service.validateRuntimeChecksum('missing-id', 'any-hash');

      expect(result).toEqual({
        match: false,
        expected: null,
        actual: 'any-hash',
      });
    });

    it('should return match: true with null expected for first run (no stored checksum)', async () => {
      (mockPrisma.component.findUnique as jest.Mock).mockResolvedValue({
        id: 'comp-123',
        instructionsChecksum: null,
      });

      const result = await service.validateRuntimeChecksum('comp-123', 'new-hash');

      expect(result).toEqual({
        match: true,
        expected: null,
        actual: 'new-hash',
      });
    });
  });

  describe('TC-CHECKSUM-005: Runtime validation is non-blocking', () => {
    it('should not throw on database errors', async () => {
      (mockPrisma.component.findUnique as jest.Mock).mockRejectedValue(
        new Error('Database connection failed')
      );

      // Should not throw
      const result = await service.validateRuntimeChecksum('comp-123', 'hash');

      expect(result).toEqual({
        match: false,
        expected: null,
        actual: 'hash',
      });
    });

    it('should return result quickly without blocking', async () => {
      (mockPrisma.component.findUnique as jest.Mock).mockResolvedValue({
        id: 'comp-123',
        instructionsChecksum: 'hash123',
      });

      const start = Date.now();
      await service.validateRuntimeChecksum('comp-123', 'hash123');
      const duration = Date.now() - start;

      // Should complete in under 100ms (non-blocking)
      expect(duration).toBeLessThan(100);
    });

    it('should log warning on error but continue', async () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      (mockPrisma.component.findUnique as jest.Mock).mockRejectedValue(
        new Error('DB Error')
      );

      await service.validateRuntimeChecksum('comp-123', 'hash');

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[ChecksumService]'),
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });
  });

  describe('updateChecksums', () => {
    it('should calculate and store checksums for component', async () => {
      const componentId = 'comp-123';
      const mockComponent = {
        id: componentId,
        inputInstructions: 'input',
        operationInstructions: 'operation',
        outputInstructions: 'output',
        config: { modelId: 'claude-3' },
      };

      (mockPrisma.component.findUnique as jest.Mock).mockResolvedValue(mockComponent);
      (mockPrisma.component.update as jest.Mock).mockResolvedValue({});

      const result = await service.updateChecksums('component', componentId);

      expect(result.instructionsChecksum).toMatch(/^[a-f0-9]{32}$/);
      expect(result.configChecksum).toMatch(/^[a-f0-9]{32}$/);
      expect(mockPrisma.component.update).toHaveBeenCalledWith({
        where: { id: componentId },
        data: {
          instructionsChecksum: result.instructionsChecksum,
          configChecksum: result.configChecksum,
        },
      });
    });

    it('should throw error for unsupported entity type', async () => {
      await expect(
        service.updateChecksums('workflow' as any, 'id')
      ).rejects.toThrow('Unsupported entity type: workflow');
    });

    it('should throw error when component not found', async () => {
      (mockPrisma.component.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        service.updateChecksums('component', 'missing-id')
      ).rejects.toThrow('Component missing-id not found');
    });
  });

  describe('detectManualChanges', () => {
    it('should return changed: false when checksums match', async () => {
      const mockComponent = {
        id: 'comp-123',
        inputInstructions: 'input',
        operationInstructions: 'operation',
        outputInstructions: 'output',
        config: { modelId: 'claude-3' },
        instructionsChecksum: '', // Will be set dynamically
        configChecksum: '',
      };

      // Calculate expected checksums
      const expectedInstructionsChecksum = service.calculateInstructionChecksum(
        'input', 'operation', 'output'
      );
      const expectedConfigChecksum = service.calculateConfigChecksum({ modelId: 'claude-3' });

      mockComponent.instructionsChecksum = expectedInstructionsChecksum;
      mockComponent.configChecksum = expectedConfigChecksum;

      (mockPrisma.component.findUnique as jest.Mock).mockResolvedValue(mockComponent);

      const result = await service.detectManualChanges('comp-123');

      expect(result).toEqual({ changed: false });
    });

    it('should return changed: true when instructions modified', async () => {
      const mockComponent = {
        id: 'comp-123',
        inputInstructions: 'modified input',
        operationInstructions: 'operation',
        outputInstructions: 'output',
        instructionsChecksum: 'old-hash-that-wont-match',
        configChecksum: null,
      };

      (mockPrisma.component.findUnique as jest.Mock).mockResolvedValue(mockComponent);

      const result = await service.detectManualChanges('comp-123');

      expect(result.changed).toBe(true);
      expect(result.details).toContain('Instructions have been modified');
    });

    it('should return changed: false when component not found', async () => {
      (mockPrisma.component.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await service.detectManualChanges('missing-id');

      expect(result).toEqual({ changed: false, details: 'Component not found' });
    });

    it('should return changed: false when no baseline checksum exists', async () => {
      (mockPrisma.component.findUnique as jest.Mock).mockResolvedValue({
        id: 'comp-123',
        instructionsChecksum: null,
      });

      const result = await service.detectManualChanges('comp-123');

      expect(result).toEqual({ changed: false, details: 'No baseline checksum stored' });
    });
  });
});
