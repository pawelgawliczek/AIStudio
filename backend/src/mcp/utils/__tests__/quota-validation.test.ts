/**
 * Quota Validation Utility Tests (ST-177)
 * TDD Approach: Tests written BEFORE implementation
 *
 * Tests for shared quota enforcement logic extracted from TranscriptsService
 */

import { PrismaClient } from '@prisma/client';
import { validateArtifactQuota } from '../quota-validation';
import { ValidationError } from '../../types';

// Mock Prisma
const mockPrisma = {
  artifact: {
    aggregate: jest.fn(),
  },
} as unknown as PrismaClient;

describe('quota-validation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('validateArtifactQuota', () => {
    it('should pass validation when quotas are not exceeded', async () => {
      // Mock 5MB existing in run, 30MB in project
      (mockPrisma.artifact.aggregate as jest.Mock)
        .mockResolvedValueOnce({ _sum: { size: 5 * 1024 * 1024 } }) // Run total
        .mockResolvedValueOnce({ _sum: { size: 30 * 1024 * 1024 } }); // Project total

      await expect(
        validateArtifactQuota(mockPrisma, 'run-uuid', 'project-uuid', 1 * 1024 * 1024)
      ).resolves.toBeUndefined();

      expect(mockPrisma.artifact.aggregate).toHaveBeenCalledTimes(2);
    });

    it('should throw ValidationError when run quota exceeded (10MB)', async () => {
      // Mock 9MB existing in run + 2MB new = 11MB (exceeds 10MB limit)
      (mockPrisma.artifact.aggregate as jest.Mock)
        .mockResolvedValueOnce({ _sum: { size: 9 * 1024 * 1024 } }); // Run total

      await expect(
        validateArtifactQuota(mockPrisma, 'run-uuid', 'project-uuid', 2 * 1024 * 1024)
      ).rejects.toThrow(ValidationError);

      await expect(
        validateArtifactQuota(mockPrisma, 'run-uuid', 'project-uuid', 2 * 1024 * 1024)
      ).rejects.toThrow(/run quota.*10MB.*exceeded/i);
    });

    it('should throw ValidationError when project quota exceeded (100MB)', async () => {
      // Mock 95MB existing in project + 10MB new = 105MB (exceeds 100MB limit)
      (mockPrisma.artifact.aggregate as jest.Mock)
        .mockResolvedValueOnce({ _sum: { size: 5 * 1024 * 1024 } }) // Run total (passes)
        .mockResolvedValueOnce({ _sum: { size: 95 * 1024 * 1024 } }); // Project total (fails)

      await expect(
        validateArtifactQuota(mockPrisma, 'run-uuid', 'project-uuid', 10 * 1024 * 1024)
      ).rejects.toThrow(ValidationError);

      await expect(
        validateArtifactQuota(mockPrisma, 'run-uuid', 'project-uuid', 10 * 1024 * 1024)
      ).rejects.toThrow(/project quota.*100MB.*exceeded/i);
    });

    it('should handle null aggregate results (no existing artifacts)', async () => {
      (mockPrisma.artifact.aggregate as jest.Mock)
        .mockResolvedValueOnce({ _sum: { size: null } }) // Run total (null = 0)
        .mockResolvedValueOnce({ _sum: { size: null } }); // Project total (null = 0)

      await expect(
        validateArtifactQuota(mockPrisma, 'run-uuid', 'project-uuid', 1 * 1024 * 1024)
      ).resolves.toBeUndefined();
    });

    it('should handle undefined aggregate results', async () => {
      (mockPrisma.artifact.aggregate as jest.Mock)
        .mockResolvedValueOnce({ _sum: { size: undefined } }) // Run total
        .mockResolvedValueOnce({ _sum: { size: undefined } }); // Project total

      await expect(
        validateArtifactQuota(mockPrisma, 'run-uuid', 'project-uuid', 1 * 1024 * 1024)
      ).resolves.toBeUndefined();
    });

    it('should include size breakdown in error message for run quota', async () => {
      (mockPrisma.artifact.aggregate as jest.Mock)
        .mockResolvedValueOnce({ _sum: { size: 8 * 1024 * 1024 } }); // 8MB existing

      try {
        await validateArtifactQuota(mockPrisma, 'run-uuid', 'project-uuid', 3 * 1024 * 1024);
        fail('Should have thrown ValidationError');
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationError);
        expect((error as ValidationError).message).toMatch(/8.*MB/); // Existing size
        expect((error as ValidationError).message).toMatch(/3.*MB/); // New size
      }
    });

    it('should include size breakdown in error message for project quota', async () => {
      (mockPrisma.artifact.aggregate as jest.Mock)
        .mockResolvedValueOnce({ _sum: { size: 2 * 1024 * 1024 } }) // Run (passes)
        .mockResolvedValueOnce({ _sum: { size: 98 * 1024 * 1024 } }); // Project (98MB existing)

      try {
        await validateArtifactQuota(mockPrisma, 'run-uuid', 'project-uuid', 5 * 1024 * 1024);
        fail('Should have thrown ValidationError');
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationError);
        expect((error as ValidationError).message).toMatch(/98.*MB/); // Existing size
        expect((error as ValidationError).message).toMatch(/5.*MB/); // New size
      }
    });

    it('should validate exact quota limits (edge cases)', async () => {
      // Test exact run quota limit (10MB existing + 0 bytes new = exactly 10MB)
      (mockPrisma.artifact.aggregate as jest.Mock)
        .mockResolvedValueOnce({ _sum: { size: 10 * 1024 * 1024 } })
        .mockResolvedValueOnce({ _sum: { size: 0 } });

      await expect(
        validateArtifactQuota(mockPrisma, 'run-uuid', 'project-uuid', 0)
      ).resolves.toBeUndefined();

      jest.clearAllMocks();

      // Test exact project quota limit (100MB existing + 0 bytes new = exactly 100MB)
      (mockPrisma.artifact.aggregate as jest.Mock)
        .mockResolvedValueOnce({ _sum: { size: 0 } })
        .mockResolvedValueOnce({ _sum: { size: 100 * 1024 * 1024 } });

      await expect(
        validateArtifactQuota(mockPrisma, 'run-uuid', 'project-uuid', 0)
      ).resolves.toBeUndefined();
    });

    it('should perform run quota check before project quota check', async () => {
      const aggregateMock = mockPrisma.artifact.aggregate as jest.Mock;
      const calls: string[] = [];

      aggregateMock.mockImplementation((args: any) => {
        if (args.where.workflowRunId) {
          calls.push('run');
          return Promise.resolve({ _sum: { size: 9 * 1024 * 1024 } });
        } else if (args.where.workflowRun?.projectId) {
          calls.push('project');
          return Promise.resolve({ _sum: { size: 50 * 1024 * 1024 } });
        }
      });

      try {
        await validateArtifactQuota(mockPrisma, 'run-uuid', 'project-uuid', 2 * 1024 * 1024);
      } catch (error) {
        // Expected to fail on run quota
      }

      expect(calls[0]).toBe('run');
      expect(calls.length).toBe(1); // Should not proceed to project check
    });

    it('should format sizes in human-readable format (MB)', async () => {
      (mockPrisma.artifact.aggregate as jest.Mock)
        .mockResolvedValueOnce({ _sum: { size: 9.5 * 1024 * 1024 } }); // 9.5 MB

      try {
        await validateArtifactQuota(mockPrisma, 'run-uuid', 'project-uuid', 1.5 * 1024 * 1024);
        fail('Should have thrown ValidationError');
      } catch (error) {
        expect((error as ValidationError).message).toMatch(/\d+\.\d+.*MB/);
      }
    });
  });
});
