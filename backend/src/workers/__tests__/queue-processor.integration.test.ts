/**
 * Queue Processor Service Integration Tests
 *
 * Integration tests with real database and Redis connections.
 * Validates end-to-end queue processing workflows.
 *
 * NOTE: These tests require:
 * - PostgreSQL database (configured via DATABASE_URL)
 * - Redis server (configured via REDIS_URL)
 * - Test data seeded in database
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule, getQueueToken } from '@nestjs/bull';
import { QueueProcessorService } from '../queue-processor.service';
import { QueueProcessorModule } from '../queue-processor.module';
import { PrismaService } from '../../prisma/prisma.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { QUEUE_NAMES } from '../constants';

// Mock MCP Tool Client to prevent actual deployments/tests
jest.mock('../mcp-tool-client', () => {
  return {
    McpToolClient: jest.fn().mockImplementation(() => ({
      deployToTestEnv: jest.fn().mockResolvedValue({
        success: true,
        storyKey: 'ST-TEST',
        branchName: 'test-branch',
        duration: 3000,
        message: 'Deployment successful',
      }),
      runTests: jest.fn().mockResolvedValue({
        success: true,
        storyId: 'test-story-id',
        storyKey: 'ST-TEST',
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
      }),
      unlockTestQueue: jest.fn().mockResolvedValue(undefined),
    })),
  };
});

describe('QueueProcessorService Integration', () => {
  let service: QueueProcessorService;
  let prisma: PrismaService;
  let moduleRef: TestingModule;
  let testProjectId: string;
  let testStoryId: string;
  let testUserId: string;

  // Increase timeout for all hooks and tests in this suite
  jest.setTimeout(15000);

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: '.env.test',
        }),
        PrismaModule,
        BullModule.forRootAsync({
          imports: [ConfigModule],
          useFactory: async (configService: ConfigService) => {
            // Configure Redis with explicit IPv4 to avoid IPv6 connection issues
            // ioredis 5.x prefers IPv6, so we need to force IPv4 with family: 4
            return {
              redis: {
                host: '127.0.0.1',
                port: 6380,
                family: 4, // Force IPv4
                maxRetriesPerRequest: null, // Required for Bull
                enableReadyCheck: false,
              },
            };
          },
          inject: [ConfigService],
        }),
        BullModule.registerQueue({ name: QUEUE_NAMES.CODE_ANALYSIS }),
      ],
      providers: [QueueProcessorService],
    }).compile();

    service = moduleRef.get<QueueProcessorService>(QueueProcessorService);
    prisma = moduleRef.get<PrismaService>(PrismaService);

    // Initialize service
    await service.onModuleInit();

      // Note: Redis connection check removed - not needed for tests
    // The Bull queue client manages its own connection lifecycle
  });

  afterAll(async () => {
    // Shutdown service and close module
    // Note: Redis cleanup removed to avoid IPv6 connection issues
    await service.onModuleDestroy();
    await moduleRef.close();
  });

  beforeEach(async () => {
    // Create test user
    const user = await prisma.user.create({
      data: {
        name: 'Test User',
        email: `test-${Date.now()}@example.com`,
        password: 'hashedpassword',
        role: 'dev',
      },
    });
    testUserId = user.id;

    // Create test project
    const project = await prisma.project.create({
      data: {
        name: 'Test Project',
        description: 'Integration test project',
      },
    });
    testProjectId = project.id;

    // Create test story
    const story = await prisma.story.create({
      data: {
        projectId: testProjectId,
        createdById: testUserId,
        key: 'ST-TEST-1',
        type: 'feature',
        title: 'Test Story',
        description: 'Integration test story',
        status: 'implementation',
      },
    });
    testStoryId = story.id;
  });

  afterEach(async () => {
    // Cleanup test data (order matters due to foreign keys)
    // Note: Redis lock cleanup removed to avoid IPv6 connection issues
    // Locks will auto-expire after TTL (90 seconds)
    await prisma.testQueue.deleteMany({ where: { storyId: testStoryId } });
    await prisma.story.deleteMany({ where: { projectId: testProjectId } });
    await prisma.project.deleteMany({ where: { id: testProjectId } });
    await prisma.user.deleteMany({ where: { id: testUserId } });
    await prisma.testQueueLock.deleteMany({});
  });

  // ==========================================================================
  // End-to-End Queue Processing
  // ==========================================================================

  describe('End-to-End Queue Processing', () => {
    it('should process pending queue item successfully', async () => {
      // Add item to queue
      const queueEntry = await prisma.testQueue.create({
        data: {
          storyId: testStoryId,
          position: 100,
          priority: 5,
          status: 'pending',
          submittedBy: 'test-user',
        },
      });

      // Trigger processing (mock interval trigger)
      await service.processQueueInterval();

      // Verify status updated
      const updatedEntry = await prisma.testQueue.findUnique({
        where: { id: queueEntry.id },
      });

      expect(updatedEntry).toBeDefined();
      expect(updatedEntry?.status).toBe('passed');
    });

    it('should respect priority order', async () => {
      // Add multiple items with different priorities
      const lowPriority = await prisma.testQueue.create({
        data: {
          storyId: testStoryId,
          position: 100,
          priority: 1,
          status: 'pending',
          submittedBy: 'test-user',
        },
      });

      // Create another story for high priority item
      const story2 = await prisma.story.create({
        data: {
          projectId: testProjectId,
          createdById: testUserId,
          key: 'ST-TEST-2',
          type: 'feature',
          title: 'High Priority Story',
          description: 'High priority test',
          status: 'implementation',
        },
      });

      const highPriority = await prisma.testQueue.create({
        data: {
          storyId: story2.id,
          position: 200,
          priority: 10,
          status: 'pending',
          submittedBy: 'test-user',
        },
      });

      // Get next pending item
      const nextItem = await (service as any).getNextPendingItem();

      expect(nextItem).toBeDefined();
      expect(nextItem.id).toBe(highPriority.id); // Should select high priority first

      // Cleanup
      await prisma.testQueue.deleteMany({ where: { storyId: story2.id } });
      await prisma.story.delete({ where: { id: story2.id } });
    });

    it('should skip processing when queue is locked', async () => {
      // Create queue lock
      await prisma.testQueueLock.create({
        data: {
          reason: 'Integration test lock',
          lockedBy: 'test-migration',
          expiresAt: new Date(Date.now() + 300000), // 5 minutes
          active: true,
        },
      });

      // Add item to queue
      await prisma.testQueue.create({
        data: {
          storyId: testStoryId,
          position: 100,
          priority: 5,
          status: 'pending',
          submittedBy: 'test-user',
        },
      });

      // Trigger processing
      await service.processQueueInterval();

      // Verify item still pending (not processed due to lock)
      const queueItems = await prisma.testQueue.findMany({
        where: { storyId: testStoryId, status: 'pending' },
      });

      expect(queueItems.length).toBeGreaterThan(0);
    });
  });

  // ==========================================================================
  // Distributed Lock Tests
  // ==========================================================================

  describe('Distributed Lock', () => {
    it('should acquire and release lock correctly', async () => {
      const lockAcquired = await (service as any).acquireDistributedLock();
      expect(lockAcquired).toBe(true);
      expect((service as any).state.lockId).toBe('queue-processor:worker-lock');

      await (service as any).releaseLock();
      expect((service as any).state.lockId).toBeNull();
    });

    it('should prevent concurrent worker execution', async () => {
      // First worker acquires lock
      const firstLock = await (service as any).acquireDistributedLock();
      expect(firstLock).toBe(true);

      // Second worker attempt should fail
      const secondLock = await (service as any).acquireDistributedLock();
      expect(secondLock).toBe(false);

      // Release first worker's lock
      await (service as any).releaseLock();

      // Now second worker can acquire
      const thirdLock = await (service as any).acquireDistributedLock();
      expect(thirdLock).toBe(true);

      await (service as any).releaseLock();
    });
  });

  // ==========================================================================
  // Queue Lock Status Tests
  // ==========================================================================

  describe('Queue Lock Status', () => {
    it('should detect active queue lock', async () => {
      const lock = await prisma.testQueueLock.create({
        data: {
          reason: 'Test migration',
          lockedBy: 'test-user',
          expiresAt: new Date(Date.now() + 300000),
          active: true,
        },
      });

      const status = await (service as any).checkQueueLockStatus();

      expect(status.locked).toBe(true);
      expect(status.reason).toBe('Test migration');
    });

    it('should ignore expired locks', async () => {
      await prisma.testQueueLock.create({
        data: {
          reason: 'Expired lock',
          lockedBy: 'test-user',
          expiresAt: new Date(Date.now() - 1000), // Expired 1 second ago
          active: true,
        },
      });

      const status = await (service as any).checkQueueLockStatus();

      expect(status.locked).toBe(false);
    });

    it('should ignore inactive locks', async () => {
      await prisma.testQueueLock.create({
        data: {
          reason: 'Inactive lock',
          lockedBy: 'test-user',
          expiresAt: new Date(Date.now() + 300000),
          active: false,
        },
      });

      const status = await (service as any).checkQueueLockStatus();

      expect(status.locked).toBe(false);
    });
  });

  // ==========================================================================
  // Health Check Tests
  // ==========================================================================

  describe('Health Check', () => {
    it('should return accurate health status', async () => {
      const health = await service.getHealthStatus();

      expect(health).toHaveProperty('status');
      expect(health).toHaveProperty('uptime');
      expect(health).toHaveProperty('queueDepth');
      expect(health).toHaveProperty('metrics');
      expect(health).toHaveProperty('lockStatus');
      expect(health).toHaveProperty('queueLockStatus');
      expect(health).toHaveProperty('workerState');

      expect(health.status).toMatch(/healthy|degraded|unhealthy/);
      expect(health.workerState).toMatch(/idle|acquiring_lock|checking_queue|processing|error/);
    });

    it('should report queue depth correctly', async () => {
      // Add test queue entries
      await prisma.testQueue.create({
        data: {
          storyId: testStoryId,
          position: 100,
          priority: 5,
          status: 'pending',
          submittedBy: 'test-user',
        },
      });

      const health = await service.getHealthStatus();

      expect(health.queueDepth.pending).toBeGreaterThanOrEqual(1);
      expect(health.queueDepth.total).toBeGreaterThanOrEqual(1);
    });
  });
});
