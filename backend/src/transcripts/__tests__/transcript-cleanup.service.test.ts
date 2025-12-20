/**
 * Transcript Cleanup Service Unit Tests
 *
 * Tests cover (ST-348):
 * - Daily cleanup of old transcript lines
 * - Configurable retention period (TRANSCRIPT_RETENTION_DAYS)
 * - Cleanup metrics logging (deleted count, duration)
 * - Error handling and recovery
 */

// Skip Prisma mock from conditional-setup by not importing PrismaService from the actual module
// Instead we'll mock PrismaService directly
jest.mock('../../prisma/prisma.service', () => ({
  PrismaService: jest.fn().mockImplementation(() => ({})),
}));

import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../prisma/prisma.service';
import { TranscriptCleanupService } from '../transcript-cleanup.service';

// ============================================================================
// Mocks
// ============================================================================

const mockPrisma = {
  transcriptLine: {
    deleteMany: jest.fn(),
  },
};

const mockConfigService = {
  get: jest.fn((key: string, defaultValue?: string) => {
    const config: Record<string, string> = {
      TRANSCRIPT_RETENTION_DAYS: '7',
    };
    return config[key] || defaultValue;
  }),
};

// ============================================================================
// Test Suite
// ============================================================================

describe('TranscriptCleanupService', () => {
  let service: TranscriptCleanupService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TranscriptCleanupService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<TranscriptCleanupService>(TranscriptCleanupService);

    // Reset mocks
    jest.clearAllMocks();
  });

  describe('cleanupOldTranscriptLines', () => {
    it('should successfully delete transcript lines older than retention period', async () => {
      // Mock database response: 150 lines deleted
      mockPrisma.transcriptLine.deleteMany.mockResolvedValue({ count: 150 });

      await service.cleanupOldTranscriptLines();

      // Verify deleteMany was called with correct date filter
      expect(mockPrisma.transcriptLine.deleteMany).toHaveBeenCalledWith({
        where: {
          createdAt: {
            lt: expect.any(Date),
          },
        },
      });

      // Verify cutoff date is approximately 7 days ago
      const callArgs = mockPrisma.transcriptLine.deleteMany.mock.calls[0][0];
      const cutoffDate = callArgs.where.createdAt.lt;
      const expectedCutoff = new Date();
      expectedCutoff.setDate(expectedCutoff.getDate() - 7);

      // Allow 1 minute tolerance for test execution time
      const timeDiff = Math.abs(cutoffDate.getTime() - expectedCutoff.getTime());
      expect(timeDiff).toBeLessThan(60000); // 1 minute
    });

    it('should handle zero deletions when no old transcript lines exist', async () => {
      mockPrisma.transcriptLine.deleteMany.mockResolvedValue({ count: 0 });

      await service.cleanupOldTranscriptLines();

      expect(mockPrisma.transcriptLine.deleteMany).toHaveBeenCalled();
    });

    it('should respect custom retention period from config', async () => {
      // Create new service with custom retention period
      mockConfigService.get.mockImplementation((key: string, defaultValue?: string) => {
        if (key === 'TRANSCRIPT_RETENTION_DAYS') {
          return '30'; // 30 days retention
        }
        return defaultValue;
      });

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          TranscriptCleanupService,
          { provide: PrismaService, useValue: mockPrisma },
          { provide: ConfigService, useValue: mockConfigService },
        ],
      }).compile();

      const customService = module.get<TranscriptCleanupService>(
        TranscriptCleanupService
      );

      mockPrisma.transcriptLine.deleteMany.mockResolvedValue({ count: 50 });

      await customService.cleanupOldTranscriptLines();

      // Verify cutoff date is approximately 30 days ago
      const callArgs = mockPrisma.transcriptLine.deleteMany.mock.calls[0][0];
      const cutoffDate = callArgs.where.createdAt.lt;
      const expectedCutoff = new Date();
      expectedCutoff.setDate(expectedCutoff.getDate() - 30);

      const timeDiff = Math.abs(cutoffDate.getTime() - expectedCutoff.getTime());
      expect(timeDiff).toBeLessThan(60000); // 1 minute tolerance
    });

    it('should use default retention period of 7 days when not configured', async () => {
      mockConfigService.get.mockImplementation((key: string, defaultValue?: string) => {
        // Return undefined for TRANSCRIPT_RETENTION_DAYS to trigger default
        if (key === 'TRANSCRIPT_RETENTION_DAYS') {
          return defaultValue;
        }
        return defaultValue;
      });

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          TranscriptCleanupService,
          { provide: PrismaService, useValue: mockPrisma },
          { provide: ConfigService, useValue: mockConfigService },
        ],
      }).compile();

      const defaultService = module.get<TranscriptCleanupService>(
        TranscriptCleanupService
      );

      mockPrisma.transcriptLine.deleteMany.mockResolvedValue({ count: 100 });

      await defaultService.cleanupOldTranscriptLines();

      // Verify cutoff date is approximately 7 days ago (default)
      const callArgs = mockPrisma.transcriptLine.deleteMany.mock.calls[0][0];
      const cutoffDate = callArgs.where.createdAt.lt;
      const expectedCutoff = new Date();
      expectedCutoff.setDate(expectedCutoff.getDate() - 7);

      const timeDiff = Math.abs(cutoffDate.getTime() - expectedCutoff.getTime());
      expect(timeDiff).toBeLessThan(60000); // 1 minute tolerance
    });

    it('should handle database errors gracefully', async () => {
      mockPrisma.transcriptLine.deleteMany.mockRejectedValue(
        new Error('Database connection failed')
      );

      // Should not throw - errors are logged internally
      await service.cleanupOldTranscriptLines();

      expect(mockPrisma.transcriptLine.deleteMany).toHaveBeenCalled();
    });

    it('should log cleanup metrics on success', async () => {
      const logSpy = jest.spyOn(service['logger'], 'log');
      mockPrisma.transcriptLine.deleteMany.mockResolvedValue({ count: 250 });

      await service.cleanupOldTranscriptLines();

      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('250 lines deleted')
      );
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('cutoff:'));
    });

    it('should log error details on failure', async () => {
      const errorSpy = jest.spyOn(service['logger'], 'error');
      const testError = new Error('Database timeout');
      mockPrisma.transcriptLine.deleteMany.mockRejectedValue(testError);

      await service.cleanupOldTranscriptLines();

      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Transcript cleanup failed'),
        expect.any(String)
      );
    });
  });

  describe('getRetentionConfig', () => {
    it('should return configured retention period', () => {
      const config = service.getRetentionConfig();

      expect(config).toEqual({
        retentionDays: 7,
      });
    });

    it('should return custom retention period when configured', async () => {
      mockConfigService.get.mockImplementation((key: string, defaultValue?: string) => {
        if (key === 'TRANSCRIPT_RETENTION_DAYS') {
          return '14';
        }
        return defaultValue;
      });

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          TranscriptCleanupService,
          { provide: PrismaService, useValue: mockPrisma },
          { provide: ConfigService, useValue: mockConfigService },
        ],
      }).compile();

      const customService = module.get<TranscriptCleanupService>(
        TranscriptCleanupService
      );

      const config = customService.getRetentionConfig();

      expect(config).toEqual({
        retentionDays: 14,
      });
    });
  });

  describe('onModuleInit', () => {
    it('should log initialization with retention configuration', async () => {
      // Create fresh service to ensure clean state
      mockConfigService.get.mockImplementation((key: string, defaultValue?: string) => {
        if (key === 'TRANSCRIPT_RETENTION_DAYS') {
          return '7';
        }
        return defaultValue;
      });

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          TranscriptCleanupService,
          { provide: PrismaService, useValue: mockPrisma },
          { provide: ConfigService, useValue: mockConfigService },
        ],
      }).compile();

      const freshService = module.get<TranscriptCleanupService>(
        TranscriptCleanupService
      );

      const logSpy = jest.spyOn(freshService['logger'], 'log');

      await freshService.onModuleInit();

      expect(logSpy).toHaveBeenCalledWith('Transcript Cleanup Service started');
      expect(logSpy).toHaveBeenCalledWith('Configuration: retention=7 days');
    });
  });
});
