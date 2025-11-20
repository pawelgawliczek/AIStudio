/**
 * Queue Processor Service Unit Tests
 *
 * Tests cover:
 * - Queue polling and item selection
 * - Distributed locking mechanism
 * - Queue lock checking (migrations)
 * - Deployment and test execution
 * - Status updates and error handling
 * - Circuit breaker functionality
 * - Health check metrics
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getQueueToken } from '@nestjs/bull';
import { QueueProcessorService } from '../queue-processor.service';
import { PrismaService } from '../../prisma/prisma.service';
import { QUEUE_NAMES } from '../constants';

// ============================================================================
// Mocks
// ============================================================================

const mockPrisma = {
  testQueue: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },
  testQueueLock: {
    findFirst: jest.fn(),
  },
  $transaction: jest.fn((callback) => callback(mockPrisma)),
};

const mockRedis = {
  set: jest.fn(),
  get: jest.fn(),
  del: jest.fn(),
  expire: jest.fn(),
};

const mockQueue = {
  client: mockRedis,
  add: jest.fn(),
  process: jest.fn(),
};

const mockConfigService = {
  get: jest.fn((key: string, defaultValue?: any) => {
    const config: Record<string, any> = {
      QUEUE_PROCESSOR_ENABLED: 'true',
      QUEUE_PROCESSOR_INTERVAL_MS: '60000',
      QUEUE_PROCESSOR_TIMEOUT_MS: '1800000',
      QUEUE_PROCESSOR_LOCK_TTL_MS: '90000',
      QUEUE_PROCESSOR_LOCK_RENEWAL_MS: '15000',
    };
    return config[key] || defaultValue;
  }),
};

// Mock MCP Tool Client
jest.mock('../mcp-tool-client', () => {
  return {
    McpToolClient: jest.fn().mockImplementation(() => ({
      deployToTestEnv: jest.fn(),
      runTests: jest.fn(),
      unlockTestQueue: jest.fn(),
    })),
  };
});

// ============================================================================
// Test Suite
// ============================================================================

describe('QueueProcessorService', () => {
  let service: QueueProcessorService;
  let mcpClient: any;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QueueProcessorService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: getQueueToken(QUEUE_NAMES.CODE_ANALYSIS),
          useValue: mockQueue,
        },
      ],
    }).compile();

    service = module.get<QueueProcessorService>(QueueProcessorService);
    mcpClient = (service as any).mcpClient;

    // Initialize service
    await service.onModuleInit();
  });

  afterEach(async () => {
    await service.onModuleDestroy();
  });

  // ==========================================================================
  // Initialization Tests
  // ==========================================================================

  describe('Initialization', () => {
    it('should initialize with correct configuration', () => {
      expect(service).toBeDefined();
      expect(mockConfigService.get).toHaveBeenCalledWith('QUEUE_PROCESSOR_ENABLED', 'true');
      expect(mockConfigService.get).toHaveBeenCalledWith('QUEUE_PROCESSOR_INTERVAL_MS', '60000');
    });

    it('should log startup message', async () => {
      const logSpy = jest.spyOn((service as any).logger, 'log');
      await service.onModuleInit();
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Queue processor started'));
    });
  });

  // ==========================================================================
  // Queue Polling Tests
  // ==========================================================================

  describe('processQueueInterval - Queue Polling', () => {
    it('should skip if already processing', async () => {
      (service as any).state.isProcessing = true;

      await service.processQueueInterval();

      expect(mockRedis.set).not.toHaveBeenCalled();
      expect(mockPrisma.testQueue.findFirst).not.toHaveBeenCalled();
    });

    it('should skip if another worker has lock', async () => {
      mockRedis.set.mockResolvedValue(null); // Lock acquisition failed

      await service.processQueueInterval();

      expect(mockRedis.set).toHaveBeenCalledWith(
        'queue-processor:worker-lock',
        expect.any(String),
        'NX',
        'EX',
        90
      );
      expect(mockPrisma.testQueue.findFirst).not.toHaveBeenCalled();
    });

    it('should skip if queue is locked (migration in progress)', async () => {
      mockRedis.set.mockResolvedValue('OK'); // Lock acquired
      mockRedis.get.mockResolvedValue((service as any).state.workerId); // Mock get for releaseLock
      mockPrisma.testQueueLock.findFirst.mockResolvedValue({
        id: 'lock-1',
        reason: 'Schema migration in progress',
        active: true,
        expiresAt: new Date(Date.now() + 300000),
      });

      await service.processQueueInterval();

      expect(mockPrisma.testQueueLock.findFirst).toHaveBeenCalledWith({
        where: {
          active: true,
          expiresAt: { gt: expect.any(Date) },
        },
        orderBy: { createdAt: 'desc' },
      });
      expect(mockPrisma.testQueue.findFirst).not.toHaveBeenCalled();
      expect(mockRedis.get).toHaveBeenCalledWith('queue-processor:worker-lock');
      expect(mockRedis.del).toHaveBeenCalledWith('queue-processor:worker-lock');
    });

    it('should skip if no pending items', async () => {
      mockRedis.set.mockResolvedValue('OK');
      mockRedis.get.mockResolvedValue((service as any).state.workerId); // Mock get for releaseLock
      mockPrisma.testQueueLock.findFirst.mockResolvedValue(null);
      mockPrisma.testQueue.findFirst.mockResolvedValue(null); // No pending items

      await service.processQueueInterval();

      expect(mockPrisma.testQueue.findFirst).toHaveBeenCalledWith({
        where: { status: 'pending' },
        orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
        include: {
          story: {
            select: {
              key: true,
              title: true,
            },
          },
        },
      });
      expect(mockRedis.get).toHaveBeenCalledWith('queue-processor:worker-lock');
      expect(mockRedis.del).toHaveBeenCalledWith('queue-processor:worker-lock');
    });

    it('should process next pending item', async () => {
      const mockItem = {
        id: 'queue-1',
        storyId: 'story-1',
        priority: 10,
        status: 'pending',
        story: {
          key: 'ST-50',
          title: 'Queue Processor',
        },
      };

      mockRedis.set.mockResolvedValue('OK');
      mockPrisma.testQueueLock.findFirst.mockResolvedValue(null);
      mockPrisma.testQueue.findFirst.mockResolvedValue(mockItem);
      mockPrisma.testQueue.update.mockResolvedValue(mockItem);

      mcpClient.deployToTestEnv.mockResolvedValue({
        success: true,
        storyKey: 'ST-50',
        branchName: 'feature/ST-50',
        duration: 3000,
        message: 'Deployment successful',
      });

      mcpClient.runTests.mockResolvedValue({
        success: true,
        storyId: 'story-1',
        storyKey: 'ST-50',
        testType: 'all',
        testResults: {
          testType: 'all',
          success: true,
          exitCode: 0,
          totalTests: 10,
          passedTests: 10,
          failedTests: 0,
          duration: 5000,
          timestamp: new Date().toISOString(),
          attempts: [],
        },
        message: 'All tests passed',
      });

      await service.processQueueInterval();

      expect(mcpClient.deployToTestEnv).toHaveBeenCalledWith('story-1');
      expect(mcpClient.runTests).toHaveBeenCalledWith('story-1', 'all');
      expect(mockPrisma.testQueue.update).toHaveBeenCalledWith({
        where: { id: 'queue-1' },
        data: expect.objectContaining({
          status: 'passed',
        }),
      });
    });
  });

  // ==========================================================================
  // Distributed Lock Tests
  // ==========================================================================

  describe('Distributed Lock', () => {
    it('should acquire lock successfully', async () => {
      mockRedis.set.mockResolvedValue('OK');

      const result = await (service as any).acquireDistributedLock();

      expect(result).toBe(true);
      expect((service as any).state.lockId).toBe('queue-processor:worker-lock');
      expect(mockRedis.set).toHaveBeenCalledWith(
        'queue-processor:worker-lock',
        expect.any(String),
        'NX',
        'EX',
        90
      );
    });

    it('should fail to acquire lock if already held', async () => {
      mockRedis.set.mockResolvedValue(null);

      const result = await (service as any).acquireDistributedLock();

      expect(result).toBe(false);
      expect((service as any).state.lockId).toBeNull();
    });

    it('should release lock successfully', async () => {
      (service as any).state.lockId = 'queue-processor:worker-lock';
      mockRedis.get.mockResolvedValue((service as any).state.workerId);
      mockRedis.del.mockResolvedValue(1);

      await (service as any).releaseLock();

      expect(mockRedis.get).toHaveBeenCalledWith('queue-processor:worker-lock');
      expect(mockRedis.del).toHaveBeenCalledWith('queue-processor:worker-lock');
      expect((service as any).state.lockId).toBeNull();
    });

    it('should not release lock if not owned', async () => {
      (service as any).state.lockId = 'queue-processor:worker-lock';
      mockRedis.get.mockResolvedValue('different-worker-id');

      await (service as any).releaseLock();

      expect(mockRedis.del).not.toHaveBeenCalled();
      expect((service as any).state.lockId).toBeNull();
    });
  });

  // ==========================================================================
  // Queue Item Processing Tests
  // ==========================================================================

  describe('processQueueItem', () => {
    const mockItem = {
      id: 'queue-1',
      storyId: 'story-1',
      status: 'pending',
      story: {
        key: 'ST-50',
        title: 'Test Story',
      },
    };

    beforeEach(() => {
      mockPrisma.testQueue.update.mockResolvedValue(mockItem);
    });

    it('should update status to running before processing', async () => {
      mcpClient.deployToTestEnv.mockResolvedValue({
        success: true,
        storyKey: 'ST-50',
        branchName: 'feature/ST-50',
        duration: 3000,
        message: 'Deployment successful',
      });

      mcpClient.runTests.mockResolvedValue({
        success: true,
        storyId: 'story-1',
        storyKey: 'ST-50',
        testType: 'all',
        testResults: {
          testType: 'all',
          success: true,
          exitCode: 0,
          totalTests: 10,
          passedTests: 10,
          failedTests: 0,
          duration: 5000,
          timestamp: new Date().toISOString(),
          attempts: [],
        },
        message: 'All tests passed',
      });

      await (service as any).processQueueItem(mockItem);

      expect(mockPrisma.testQueue.update).toHaveBeenCalledWith({
        where: { id: 'queue-1' },
        data: expect.objectContaining({
          status: 'running',
          startedAt: expect.any(Date),
        }),
      });
    });

    it('should mark as passed on successful tests', async () => {
      mcpClient.deployToTestEnv.mockResolvedValue({
        success: true,
        storyKey: 'ST-50',
        branchName: 'feature/ST-50',
        duration: 3000,
        message: 'Deployment successful',
      });

      mcpClient.runTests.mockResolvedValue({
        success: true,
        storyId: 'story-1',
        storyKey: 'ST-50',
        testType: 'all',
        testResults: {
          testType: 'all',
          success: true,
          exitCode: 0,
          totalTests: 10,
          passedTests: 10,
          failedTests: 0,
          duration: 5000,
          timestamp: new Date().toISOString(),
          attempts: [],
        },
        message: 'All tests passed',
      });

      await (service as any).processQueueItem(mockItem);

      expect(mockPrisma.testQueue.update).toHaveBeenCalledWith({
        where: { id: 'queue-1' },
        data: expect.objectContaining({
          status: 'passed',
          completedAt: expect.any(Date),
        }),
      });
      expect((service as any).state.metrics.processedCount).toBe(1);
      expect((service as any).state.consecutiveFailures).toBe(0);
    });

    it('should mark as failed on test failures', async () => {
      mcpClient.deployToTestEnv.mockResolvedValue({
        success: true,
        storyKey: 'ST-50',
        branchName: 'feature/ST-50',
        duration: 3000,
        message: 'Deployment successful',
      });

      mcpClient.runTests.mockResolvedValue({
        success: false,
        storyId: 'story-1',
        storyKey: 'ST-50',
        testType: 'all',
        testResults: {
          testType: 'all',
          success: false,
          exitCode: 1,
          totalTests: 10,
          passedTests: 8,
          failedTests: 2,
          duration: 5000,
          timestamp: new Date().toISOString(),
          attempts: [],
        },
        message: 'Tests failed',
      });

      await (service as any).processQueueItem(mockItem);

      expect(mockPrisma.testQueue.update).toHaveBeenCalledWith({
        where: { id: 'queue-1' },
        data: expect.objectContaining({
          status: 'failed',
          errorMessage: 'Tests failed',
          completedAt: expect.any(Date),
        }),
      });
    });

    it('should unlock queue if breaking migration detected', async () => {
      mcpClient.deployToTestEnv.mockResolvedValue({
        success: true,
        storyKey: 'ST-50',
        branchName: 'feature/ST-50',
        duration: 3000,
        migrationDetails: {
          isBreaking: true,
          lockAcquired: true,
          lockId: 'migration-lock-1',
          migrationsApplied: 1,
        },
        message: 'Deployment successful',
      });

      mcpClient.runTests.mockResolvedValue({
        success: true,
        storyId: 'story-1',
        storyKey: 'ST-50',
        testType: 'all',
        testResults: {
          testType: 'all',
          success: true,
          exitCode: 0,
          totalTests: 10,
          passedTests: 10,
          failedTests: 0,
          duration: 5000,
          timestamp: new Date().toISOString(),
          attempts: [],
        },
        message: 'All tests passed',
      });

      await (service as any).processQueueItem(mockItem);

      expect(mcpClient.unlockTestQueue).toHaveBeenCalledWith('migration-lock-1');
    });

    it('should handle deployment failures gracefully', async () => {
      mcpClient.deployToTestEnv.mockRejectedValue(new Error('Deployment failed'));

      await (service as any).processQueueItem(mockItem);

      expect(mockPrisma.testQueue.update).toHaveBeenCalledWith({
        where: { id: 'queue-1' },
        data: expect.objectContaining({
          status: 'failed',
          errorMessage: 'Deployment failed',
        }),
      });
      expect((service as any).state.metrics.failedCount).toBe(1);
      expect((service as any).state.consecutiveFailures).toBe(1);
    });
  });

  // ==========================================================================
  // Circuit Breaker Tests
  // ==========================================================================

  describe('Circuit Breaker', () => {
    it('should trigger circuit breaker after 5 consecutive failures', async () => {
      const mockItem = {
        id: 'queue-1',
        storyId: 'story-1',
        status: 'pending',
        story: { key: 'ST-50', title: 'Test Story' },
      };

      mockPrisma.testQueue.update.mockResolvedValue(mockItem);
      mcpClient.deployToTestEnv.mockRejectedValue(new Error('Deployment failed'));

      // Set consecutive failures to threshold - 1
      (service as any).state.consecutiveFailures = 4;

      const sleepSpy = jest.spyOn(service as any, 'sleep').mockResolvedValue(undefined);

      await (service as any).processQueueItem(mockItem);

      expect((service as any).state.consecutiveFailures).toBe(0); // Reset after circuit breaker
      expect(sleepSpy).toHaveBeenCalledWith(300000); // 5 minutes
    });
  });

  // ==========================================================================
  // Health Check Tests
  // ==========================================================================

  describe('getHealthStatus', () => {
    it('should return health status with metrics', async () => {
      mockPrisma.testQueue.count
        .mockResolvedValueOnce(5) // pending
        .mockResolvedValueOnce(1) // running
        .mockResolvedValueOnce(10); // total

      mockPrisma.testQueueLock.findFirst.mockResolvedValue(null);

      (service as any).state.metrics.processedCount = 10;
      (service as any).state.metrics.failedCount = 2;
      (service as any).state.metrics.totalProcessingTime = 100000;

      const health = await service.getHealthStatus();

      expect(health).toMatchObject({
        status: 'healthy',
        queueDepth: {
          pending: 5,
          running: 1,
          total: 10,
        },
        metrics: {
          processedCount: 10,
          failedCount: 2,
          successRate: 80,
          avgProcessingTime: 10,
        },
        workerState: 'idle',
      });
    });

    it('should return degraded status with high failure rate', async () => {
      mockPrisma.testQueue.count
        .mockResolvedValueOnce(5)
        .mockResolvedValueOnce(1)
        .mockResolvedValueOnce(10);

      mockPrisma.testQueueLock.findFirst.mockResolvedValue(null);

      (service as any).state.consecutiveFailures = 3;

      const health = await service.getHealthStatus();

      expect(health.status).toBe('degraded');
    });

    it('should return unhealthy status when circuit breaker triggered', async () => {
      mockPrisma.testQueue.count
        .mockResolvedValueOnce(5)
        .mockResolvedValueOnce(1)
        .mockResolvedValueOnce(10);

      mockPrisma.testQueueLock.findFirst.mockResolvedValue(null);

      (service as any).state.consecutiveFailures = 5;

      const health = await service.getHealthStatus();

      expect(health.status).toBe('unhealthy');
    });

    it('should include queue lock status', async () => {
      mockPrisma.testQueue.count
        .mockResolvedValueOnce(5)
        .mockResolvedValueOnce(1)
        .mockResolvedValueOnce(10);

      mockPrisma.testQueueLock.findFirst.mockResolvedValue({
        id: 'lock-1',
        reason: 'Schema migration',
        active: true,
        expiresAt: new Date(Date.now() + 300000),
      });

      const health = await service.getHealthStatus();

      expect(health.queueLockStatus).toMatchObject({
        locked: true,
        reason: 'Schema migration',
        expiresAt: expect.any(String),
      });
    });
  });
});
