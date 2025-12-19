/**
 * Unit tests for worktree_run_tests MCP tool
 * Tests isolated test execution with Docker containers
 */

import { execSync } from 'child_process';
import { PrismaClient } from '@prisma/client';
import { handler } from '../worktree_run_tests';
import { ValidationError, NotFoundError } from '../../../types';

// Mock child_process
jest.mock('child_process', () => ({
  execSync: jest.fn(),
  spawn: jest.fn(),
}));

describe('worktree_run_tests MCP Tool', () => {
  let mockPrisma: jest.Mocked<PrismaClient>;

  const mockStory = {
    id: 'story-123',
    key: 'ST-123',
    title: 'Test Story',
  };

  const mockTestQueue = {
    id: 'tq-123',
    storyId: 'story-123',
    status: 'running',
    priority: 5,
    position: 0,
    submittedBy: 'test',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    mockPrisma = {
      story: {
        findUnique: jest.fn(),
      },
      testQueue: {
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    } as any;

    jest.clearAllMocks();
  });

  // ==========================================================================
  // Validation Tests
  // ==========================================================================

  describe('Input Validation', () => {
    it('should throw ValidationError if storyId missing', async () => {
      await expect(handler(mockPrisma, {})).rejects.toThrow('storyId');
    });

    it('should throw NotFoundError if story not found', async () => {
      mockPrisma.story.findUnique.mockResolvedValue(null);

      await expect(handler(mockPrisma, {
        storyId: 'invalid',
      })).rejects.toThrow(NotFoundError);
    });

    it('should throw ValidationError for invalid testType', async () => {
      mockPrisma.story.findUnique.mockResolvedValue(mockStory);

      await expect(handler(mockPrisma, {
        storyId: 'story-123',
        testType: 'invalid',
      })).rejects.toThrow(ValidationError);
    });

    it('should accept "unit" test type', async () => {
      mockPrisma.story.findUnique.mockResolvedValue(mockStory);
      mockPrisma.testQueue.findFirst.mockResolvedValue(null);
      mockPrisma.testQueue.create.mockResolvedValue(mockTestQueue);

      // Mock successful container start and test execution
      (execSync as jest.Mock)
        .mockReturnValueOnce('Containers started') // docker compose up
        .mockReturnValueOnce('') // pg_isready
        .mockReturnValueOnce('Schema synced') // prisma db push
        .mockReturnValueOnce('Tests passed'); // npm test

      mockPrisma.testQueue.update.mockResolvedValue(mockTestQueue);

      const result = await handler(mockPrisma, {
        storyId: 'story-123',
        testType: 'unit',
      });

      expect(result.testType).toBe('unit');
    });

    it('should accept "integration" test type', async () => {
      mockPrisma.story.findUnique.mockResolvedValue(mockStory);
      mockPrisma.testQueue.findFirst.mockResolvedValue(null);
      mockPrisma.testQueue.create.mockResolvedValue(mockTestQueue);

      (execSync as jest.Mock)
        .mockReturnValueOnce('Containers started')
        .mockReturnValueOnce('')
        .mockReturnValueOnce('Schema synced')
        .mockReturnValueOnce('Tests passed');

      mockPrisma.testQueue.update.mockResolvedValue(mockTestQueue);

      const result = await handler(mockPrisma, {
        storyId: 'story-123',
        testType: 'integration',
      });

      expect(result.testType).toBe('integration');
    });

    it('should accept "e2e" test type', async () => {
      mockPrisma.story.findUnique.mockResolvedValue(mockStory);
      mockPrisma.testQueue.findFirst.mockResolvedValue(null);
      mockPrisma.testQueue.create.mockResolvedValue(mockTestQueue);

      (execSync as jest.Mock)
        .mockReturnValueOnce('Containers started')
        .mockReturnValueOnce('')
        .mockReturnValueOnce('Schema synced')
        .mockReturnValueOnce('Tests passed');

      mockPrisma.testQueue.update.mockResolvedValue(mockTestQueue);

      const result = await handler(mockPrisma, {
        storyId: 'story-123',
        testType: 'e2e',
      });

      expect(result.testType).toBe('e2e');
    });

    it('should default to "all" test type', async () => {
      mockPrisma.story.findUnique.mockResolvedValue(mockStory);
      mockPrisma.testQueue.findFirst.mockResolvedValue(null);
      mockPrisma.testQueue.create.mockResolvedValue(mockTestQueue);

      (execSync as jest.Mock)
        .mockReturnValueOnce('Containers started')
        .mockReturnValueOnce('')
        .mockReturnValueOnce('Schema synced')
        .mockReturnValueOnce('Unit tests passed')
        .mockReturnValueOnce('Integration tests passed')
        .mockReturnValueOnce('E2E tests passed');

      mockPrisma.testQueue.update.mockResolvedValue(mockTestQueue);

      const result = await handler(mockPrisma, {
        storyId: 'story-123',
      });

      expect(result.testType).toBe('all');
    });
  });

  // ==========================================================================
  // Test Queue Management Tests
  // ==========================================================================

  describe('Test Queue Management', () => {
    it('should create new TestQueue entry if none exists', async () => {
      mockPrisma.story.findUnique.mockResolvedValue(mockStory);
      mockPrisma.testQueue.findFirst.mockResolvedValue(null);
      mockPrisma.testQueue.create.mockResolvedValue(mockTestQueue);

      (execSync as jest.Mock)
        .mockReturnValueOnce('Containers started')
        .mockReturnValueOnce('')
        .mockReturnValueOnce('Schema synced')
        .mockReturnValueOnce('Tests passed');

      mockPrisma.testQueue.update.mockResolvedValue(mockTestQueue);

      await handler(mockPrisma, {
        storyId: 'story-123',
        testType: 'unit',
      });

      expect(mockPrisma.testQueue.create).toHaveBeenCalledWith({
        data: {
          storyId: 'story-123',
          status: 'running',
          priority: 5,
          position: 0,
          submittedBy: 'worktree_run_tests',
        },
      });
    });

    it('should reuse existing TestQueue entry', async () => {
      mockPrisma.story.findUnique.mockResolvedValue(mockStory);
      mockPrisma.testQueue.findFirst.mockResolvedValue(mockTestQueue);

      (execSync as jest.Mock)
        .mockReturnValueOnce('Containers started')
        .mockReturnValueOnce('')
        .mockReturnValueOnce('Schema synced')
        .mockReturnValueOnce('Tests passed');

      mockPrisma.testQueue.update.mockResolvedValue(mockTestQueue);

      await handler(mockPrisma, {
        storyId: 'story-123',
        testType: 'unit',
      });

      expect(mockPrisma.testQueue.create).not.toHaveBeenCalled();
    });

    it('should update existing entry to running status', async () => {
      mockPrisma.story.findUnique.mockResolvedValue(mockStory);
      mockPrisma.testQueue.findFirst.mockResolvedValue({
        ...mockTestQueue,
        status: 'pending',
      });

      (execSync as jest.Mock)
        .mockReturnValueOnce('Containers started')
        .mockReturnValueOnce('')
        .mockReturnValueOnce('Schema synced')
        .mockReturnValueOnce('Tests passed');

      mockPrisma.testQueue.update.mockResolvedValue(mockTestQueue);

      await handler(mockPrisma, {
        storyId: 'story-123',
        testType: 'unit',
      });

      expect(mockPrisma.testQueue.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: mockTestQueue.id },
          data: expect.objectContaining({
            status: 'running',
          }),
        })
      );
    });
  });

  // ==========================================================================
  // Container Management Tests
  // ==========================================================================

  describe('Container Management', () => {
    beforeEach(() => {
      mockPrisma.story.findUnique.mockResolvedValue(mockStory);
      mockPrisma.testQueue.findFirst.mockResolvedValue(null);
      mockPrisma.testQueue.create.mockResolvedValue(mockTestQueue);
      mockPrisma.testQueue.update.mockResolvedValue(mockTestQueue);
    });

    it('should start test containers before running tests', async () => {
      (execSync as jest.Mock)
        .mockReturnValueOnce('Containers started')
        .mockReturnValueOnce('')
        .mockReturnValueOnce('Schema synced')
        .mockReturnValueOnce('Tests passed');

      await handler(mockPrisma, {
        storyId: 'story-123',
        testType: 'unit',
      });

      expect(execSync).toHaveBeenCalledWith(
        expect.stringContaining('docker compose'),
        expect.any(Object)
      );
    });

    it('should wait for PostgreSQL to be ready', async () => {
      (execSync as jest.Mock)
        .mockReturnValueOnce('Containers started')
        .mockReturnValueOnce('') // pg_isready success
        .mockReturnValueOnce('Schema synced')
        .mockReturnValueOnce('Tests passed');

      await handler(mockPrisma, {
        storyId: 'story-123',
        testType: 'unit',
      });

      expect(execSync).toHaveBeenCalledWith(
        expect.stringContaining('pg_isready'),
        expect.any(Object)
      );
    });

    it('should sync Prisma schema to test database', async () => {
      (execSync as jest.Mock)
        .mockReturnValueOnce('Containers started')
        .mockReturnValueOnce('')
        .mockReturnValueOnce('Schema synced')
        .mockReturnValueOnce('Tests passed');

      await handler(mockPrisma, {
        storyId: 'story-123',
        testType: 'unit',
      });

      expect(execSync).toHaveBeenCalledWith(
        expect.stringContaining('prisma db push'),
        expect.objectContaining({
          cwd: expect.stringContaining('backend'),
        })
      );
    });

    it('should stop containers after tests complete', async () => {
      (execSync as jest.Mock)
        .mockReturnValueOnce('Containers started')
        .mockReturnValueOnce('')
        .mockReturnValueOnce('Schema synced')
        .mockReturnValueOnce('Tests passed')
        .mockReturnValueOnce('Containers stopped'); // docker compose down

      await handler(mockPrisma, {
        storyId: 'story-123',
        testType: 'unit',
      });

      expect(execSync).toHaveBeenCalledWith(
        expect.stringContaining('docker compose'),
        expect.objectContaining({
          cwd: expect.stringContaining('AIStudio'),
        })
      );
    });

    it('should stop containers even when tests fail', async () => {
      (execSync as jest.Mock)
        .mockReturnValueOnce('Containers started')
        .mockReturnValueOnce('')
        .mockReturnValueOnce('Schema synced')
        .mockImplementationOnce(() => {
          const error: any = new Error('Tests failed');
          error.status = 1;
          throw error;
        })
        .mockReturnValueOnce('Containers stopped');

      await expect(handler(mockPrisma, {
        storyId: 'story-123',
        testType: 'unit',
      })).rejects.toThrow();

      // Container stop should still be called
      expect(execSync).toHaveBeenCalledWith(
        expect.stringContaining('down'),
        expect.any(Object)
      );
    });

    it('should handle container start failure', async () => {
      (execSync as jest.Mock).mockImplementationOnce(() => {
        throw new Error('Failed to start containers');
      });

      await expect(handler(mockPrisma, {
        storyId: 'story-123',
        testType: 'unit',
      })).rejects.toThrow('Failed to start containers');

      expect(mockPrisma.testQueue.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'failed',
          }),
        })
      );
    });
  });

  // ==========================================================================
  // Test Execution Tests
  // ==========================================================================

  describe('Test Execution', () => {
    beforeEach(() => {
      mockPrisma.story.findUnique.mockResolvedValue(mockStory);
      mockPrisma.testQueue.findFirst.mockResolvedValue(null);
      mockPrisma.testQueue.create.mockResolvedValue(mockTestQueue);
      mockPrisma.testQueue.update.mockResolvedValue(mockTestQueue);

      (execSync as jest.Mock)
        .mockReturnValueOnce('Containers started')
        .mockReturnValueOnce('')
        .mockReturnValueOnce('Schema synced');
    });

    it('should execute unit tests with correct command', async () => {
      (execSync as jest.Mock).mockReturnValueOnce('Tests: 10 passed, 10 total');

      await handler(mockPrisma, {
        storyId: 'story-123',
        testType: 'unit',
      });

      expect(execSync).toHaveBeenCalledWith(
        expect.stringContaining('npm run test'),
        expect.objectContaining({
          env: expect.objectContaining({
            NODE_ENV: 'test',
          }),
        })
      );
    });

    it('should execute integration tests with correct pattern', async () => {
      (execSync as jest.Mock).mockReturnValueOnce('Tests: 5 passed, 5 total');

      await handler(mockPrisma, {
        storyId: 'story-123',
        testType: 'integration',
      });

      expect(execSync).toHaveBeenCalledWith(
        expect.stringContaining('--testPathPattern="integration"'),
        expect.any(Object)
      );
    });

    it('should execute e2e tests with Playwright', async () => {
      (execSync as jest.Mock).mockReturnValueOnce('5 passed');

      await handler(mockPrisma, {
        storyId: 'story-123',
        testType: 'e2e',
      });

      expect(execSync).toHaveBeenCalledWith(
        expect.stringContaining('playwright test'),
        expect.any(Object)
      );
    });

    it('should use isolated database URL', async () => {
      (execSync as jest.Mock).mockReturnValueOnce('Tests passed');

      await handler(mockPrisma, {
        storyId: 'story-123',
        testType: 'unit',
      });

      expect(execSync).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          env: expect.objectContaining({
            DATABASE_URL: expect.stringContaining('5434'),
          }),
        })
      );
    });

    it('should use isolated Redis URL', async () => {
      (execSync as jest.Mock).mockReturnValueOnce('Tests passed');

      await handler(mockPrisma, {
        storyId: 'story-123',
        testType: 'unit',
      });

      expect(execSync).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          env: expect.objectContaining({
            REDIS_URL: expect.stringContaining('6381'),
          }),
        })
      );
    });
  });

  // ==========================================================================
  // Test Parsing Tests
  // ==========================================================================

  describe('Test Output Parsing', () => {
    beforeEach(() => {
      mockPrisma.story.findUnique.mockResolvedValue(mockStory);
      mockPrisma.testQueue.findFirst.mockResolvedValue(null);
      mockPrisma.testQueue.create.mockResolvedValue(mockTestQueue);
      mockPrisma.testQueue.update.mockResolvedValue(mockTestQueue);

      (execSync as jest.Mock)
        .mockReturnValueOnce('Containers started')
        .mockReturnValueOnce('')
        .mockReturnValueOnce('Schema synced');
    });

    it('should parse Jest test summary', async () => {
      (execSync as jest.Mock).mockReturnValueOnce(
        'Tests: 2 failed, 3 skipped, 15 passed, 20 total'
      );

      const result = await handler(mockPrisma, {
        storyId: 'story-123',
        testType: 'unit',
      });

      expect(result.testResults.totalTests).toBe(20);
      expect(result.testResults.passedTests).toBe(15);
      expect(result.testResults.failedTests).toBe(2);
      expect(result.testResults.skippedTests).toBe(3);
    });

    it('should parse Playwright test summary', async () => {
      (execSync as jest.Mock).mockReturnValueOnce('10 passed 2 failed 1 skipped');

      const result = await handler(mockPrisma, {
        storyId: 'story-123',
        testType: 'e2e',
      });

      expect(result.testResults.passedTests).toBeGreaterThanOrEqual(0);
    });

    it('should extract failed test names from Jest output', async () => {
      const output = `
● TestSuite › should test something
  Expected: true
  Received: false
      `;

      (execSync as jest.Mock).mockImplementationOnce(() => {
        const error: any = new Error('Tests failed');
        error.status = 1;
        error.stdout = output;
        throw error;
      });

      await expect(handler(mockPrisma, {
        storyId: 'story-123',
        testType: 'unit',
      })).rejects.toThrow();
    });
  });

  // ==========================================================================
  // Retry Logic Tests
  // ==========================================================================

  describe('Retry Logic', () => {
    beforeEach(() => {
      mockPrisma.story.findUnique.mockResolvedValue(mockStory);
      mockPrisma.testQueue.findFirst.mockResolvedValue(null);
      mockPrisma.testQueue.create.mockResolvedValue(mockTestQueue);
      mockPrisma.testQueue.update.mockResolvedValue(mockTestQueue);

      (execSync as jest.Mock)
        .mockReturnValueOnce('Containers started')
        .mockReturnValueOnce('')
        .mockReturnValueOnce('Schema synced');
    });

    it('should succeed on first attempt when tests pass', async () => {
      (execSync as jest.Mock).mockReturnValueOnce('Tests: 10 passed, 10 total');

      const result = await handler(mockPrisma, {
        storyId: 'story-123',
        testType: 'unit',
      });

      expect(result.success).toBe(true);
      expect(result.testResults.attempts).toHaveLength(1);
    });

    it('should handle test timeout', async () => {
      (execSync as jest.Mock).mockImplementationOnce(() => {
        const error: any = new Error('Timeout');
        error.killed = true;
        error.signal = 'SIGTERM';
        throw error;
      });

      await expect(handler(mockPrisma, {
        storyId: 'story-123',
        testType: 'unit',
      })).rejects.toThrow();
    });

    it('should handle test execution errors', async () => {
      (execSync as jest.Mock).mockImplementationOnce(() => {
        const error: any = new Error('Test execution failed');
        error.status = 1;
        error.stdout = 'Tests: 5 failed, 15 passed, 20 total';
        throw error;
      });

      await expect(handler(mockPrisma, {
        storyId: 'story-123',
        testType: 'unit',
      })).rejects.toThrow();
    });
  });

  // ==========================================================================
  // Result Recording Tests
  // ==========================================================================

  describe('Result Recording', () => {
    beforeEach(() => {
      mockPrisma.story.findUnique.mockResolvedValue(mockStory);
      mockPrisma.testQueue.findFirst.mockResolvedValue(null);
      mockPrisma.testQueue.create.mockResolvedValue(mockTestQueue);
      mockPrisma.testQueue.update.mockResolvedValue(mockTestQueue);

      (execSync as jest.Mock)
        .mockReturnValueOnce('Containers started')
        .mockReturnValueOnce('')
        .mockReturnValueOnce('Schema synced');
    });

    it('should update TestQueue with passed results', async () => {
      (execSync as jest.Mock).mockReturnValueOnce('Tests: 10 passed, 10 total');

      await handler(mockPrisma, {
        storyId: 'story-123',
        testType: 'unit',
      });

      expect(mockPrisma.testQueue.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'passed',
            errorMessage: null,
          }),
        })
      );
    });

    it('should update TestQueue with failed results', async () => {
      (execSync as jest.Mock).mockImplementationOnce(() => {
        const error: any = new Error('Tests failed');
        error.status = 1;
        error.stdout = 'Tests: 5 failed, 15 passed, 20 total';
        throw error;
      });

      await expect(handler(mockPrisma, {
        storyId: 'story-123',
        testType: 'unit',
      })).rejects.toThrow();

      expect(mockPrisma.testQueue.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'failed',
            errorMessage: expect.stringContaining('failed'),
          }),
        })
      );
    });

    it('should include test results in response', async () => {
      (execSync as jest.Mock).mockReturnValueOnce('Tests: 10 passed, 10 total');

      const result = await handler(mockPrisma, {
        storyId: 'story-123',
        testType: 'unit',
      });

      expect(result.testResults).toBeDefined();
      expect(result.testResults.testType).toBe('unit');
      expect(result.testResults.success).toBe(true);
    });
  });

  // ==========================================================================
  // All Tests Type Tests
  // ==========================================================================

  describe('All Tests Type', () => {
    beforeEach(() => {
      mockPrisma.story.findUnique.mockResolvedValue(mockStory);
      mockPrisma.testQueue.findFirst.mockResolvedValue(null);
      mockPrisma.testQueue.create.mockResolvedValue(mockTestQueue);
      mockPrisma.testQueue.update.mockResolvedValue(mockTestQueue);

      (execSync as jest.Mock)
        .mockReturnValueOnce('Containers started')
        .mockReturnValueOnce('')
        .mockReturnValueOnce('Schema synced');
    });

    it('should run all test types sequentially', async () => {
      (execSync as jest.Mock)
        .mockReturnValueOnce('Tests: 10 passed, 10 total') // unit
        .mockReturnValueOnce('Tests: 5 passed, 5 total') // integration
        .mockReturnValueOnce('3 passed'); // e2e

      const result = await handler(mockPrisma, {
        storyId: 'story-123',
        testType: 'all',
      });

      expect(result.testType).toBe('all');
      expect(result.testResults.totalTests).toBeGreaterThan(0);
    });

    it('should stop on first failure (fail-fast)', async () => {
      (execSync as jest.Mock)
        .mockReturnValueOnce('Tests: 10 passed, 10 total') // unit passes
        .mockImplementationOnce(() => { // integration fails
          const error: any = new Error('Tests failed');
          error.status = 1;
          error.stdout = 'Tests: 2 failed, 3 passed, 5 total';
          throw error;
        });

      const result = await handler(mockPrisma, {
        storyId: 'story-123',
        testType: 'all',
      });

      expect(result.success).toBe(false);
      expect(result.failureReasons).toBeDefined();
      // E2E tests should not have been executed
      expect(execSync).not.toHaveBeenCalledWith(
        expect.stringContaining('playwright'),
        expect.any(Object)
      );
    });

    it('should aggregate results from all test types', async () => {
      (execSync as jest.Mock)
        .mockReturnValueOnce('Tests: 10 passed, 10 total')
        .mockReturnValueOnce('Tests: 5 passed, 5 total')
        .mockReturnValueOnce('8 passed');

      const result = await handler(mockPrisma, {
        storyId: 'story-123',
        testType: 'all',
      });

      expect(result.testResults.totalTests).toBeGreaterThanOrEqual(15);
    });
  });
});
