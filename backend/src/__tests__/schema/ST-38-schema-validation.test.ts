/**
 * ST-38: Database Schema Validation Tests
 * Epic: EP-7 - Git Workflow Agent
 *
 * QA Automation Component Test Suite
 * Tests validate acceptance criteria from baAnalysis
 */

import { PrismaClient } from '@prisma/client';
import { createTestPrismaClient } from '@/test-utils/safe-prisma-client';

const prisma = createTestPrismaClient();

describe('ST-38: Database Schema - Worktree & Queue Management', () => {

  describe('AC-SCHEMA-001: Worktree Table Structure', () => {
    it('should have correct table structure', async () => {
      // Verify table exists and has all required fields
      const result = await prisma.$queryRaw<any[]>`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_name = 'worktrees'
        ORDER BY ordinal_position;
      `;

      const columns = result.map(r => r.column_name);

      expect(columns).toContain('id');
      expect(columns).toContain('story_id');
      expect(columns).toContain('branch_name');
      expect(columns).toContain('worktree_path');
      expect(columns).toContain('base_branch');
      expect(columns).toContain('status');
      expect(columns).toContain('created_at');
      expect(columns).toContain('updated_at');
    });

    it('should have correct foreign key constraint with CASCADE delete', async () => {
      const fkConstraint = await prisma.$queryRaw<any[]>`
        SELECT
          conname,
          confdeltype,
          confupdtype
        FROM pg_constraint
        WHERE conname = 'worktrees_story_id_fkey';
      `;

      expect(fkConstraint.length).toBe(1);
      expect(fkConstraint[0].confdeltype).toBe('c'); // CASCADE
      expect(fkConstraint[0].confupdtype).toBe('c'); // CASCADE
    });

    it('should have required indexes', async () => {
      const indexes = await prisma.$queryRaw<any[]>`
        SELECT indexname
        FROM pg_indexes
        WHERE tablename = 'worktrees'
        ORDER BY indexname;
      `;

      const indexNames = indexes.map(i => i.indexname);

      expect(indexNames).toContain('worktrees_story_id_status_idx');
      expect(indexNames).toContain('worktrees_status_idx');
      expect(indexNames).toContain('worktrees_branch_name_idx');
      expect(indexNames).toContain('worktrees_pkey'); // Primary key index
    });
  });

  describe('AC-SCHEMA-002: TestQueue Table Structure', () => {
    it('should have correct table structure', async () => {
      const result = await prisma.$queryRaw<any[]>`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'test_queue'
        ORDER BY ordinal_position;
      `;

      const columns = result.map(r => r.column_name);

      expect(columns).toContain('id');
      expect(columns).toContain('story_id');
      expect(columns).toContain('position');
      expect(columns).toContain('priority');
      expect(columns).toContain('status');
      expect(columns).toContain('submitted_by');
      expect(columns).toContain('test_results');
      expect(columns).toContain('error_message');
      expect(columns).toContain('created_at');
      expect(columns).toContain('updated_at');
    });

    it('should have JSONB type for test_results', async () => {
      const result = await prisma.$queryRaw<any[]>`
        SELECT data_type
        FROM information_schema.columns
        WHERE table_name = 'test_queue' AND column_name = 'test_results';
      `;

      expect(result[0].data_type).toBe('jsonb');
    });

    it('should have foreign key constraint with CASCADE delete', async () => {
      const fkConstraint = await prisma.$queryRaw<any[]>`
        SELECT
          conname,
          confdeltype
        FROM pg_constraint
        WHERE conname = 'test_queue_story_id_fkey';
      `;

      expect(fkConstraint.length).toBe(1);
      expect(fkConstraint[0].confdeltype).toBe('c'); // CASCADE
    });

    it('should have composite index on status and position', async () => {
      const indexes = await prisma.$queryRaw<any[]>`
        SELECT indexname
        FROM pg_indexes
        WHERE tablename = 'test_queue' AND indexname = 'test_queue_status_position_idx';
      `;

      expect(indexes.length).toBe(1);
    });

    it('should have composite index on status and priority', async () => {
      const indexes = await prisma.$queryRaw<any[]>`
        SELECT indexname
        FROM pg_indexes
        WHERE tablename = 'test_queue' AND indexname = 'test_queue_status_priority_idx';
      `;

      expect(indexes.length).toBe(1);
    });
  });

  describe('AC-SCHEMA-003: PullRequest Table Structure', () => {
    it('should have correct table structure', async () => {
      const result = await prisma.$queryRaw<any[]>`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'pull_requests'
        ORDER BY ordinal_position;
      `;

      const columns = result.map(r => r.column_name);

      expect(columns).toContain('id');
      expect(columns).toContain('story_id');
      expect(columns).toContain('pr_number');
      expect(columns).toContain('pr_url');
      expect(columns).toContain('title');
      expect(columns).toContain('description');
      expect(columns).toContain('status');
      expect(columns).toContain('created_at');
      expect(columns).toContain('updated_at');
    });

    it('should have foreign key constraint with CASCADE delete', async () => {
      const fkConstraint = await prisma.$queryRaw<any[]>`
        SELECT
          conname,
          confdeltype
        FROM pg_constraint
        WHERE conname = 'pull_requests_story_id_fkey';
      `;

      expect(fkConstraint.length).toBe(1);
      expect(fkConstraint[0].confdeltype).toBe('c'); // CASCADE
    });

    it('should have required indexes', async () => {
      const indexes = await prisma.$queryRaw<any[]>`
        SELECT indexname
        FROM pg_indexes
        WHERE tablename = 'pull_requests'
        ORDER BY indexname;
      `;

      const indexNames = indexes.map(i => i.indexname);

      expect(indexNames).toContain('pull_requests_story_id_status_idx');
      expect(indexNames).toContain('pull_requests_pr_number_idx');
      expect(indexNames).toContain('pull_requests_status_idx');
    });
  });

  describe('AC-SCHEMA-004: Enum Definitions', () => {
    it('should have WorktreeStatus enum with correct values', async () => {
      const enumValues = await prisma.$queryRaw<any[]>`
        SELECT enumlabel
        FROM pg_enum
        WHERE enumtypid = 'WorktreeStatus'::regtype
        ORDER BY enumsortorder;
      `;

      const values = enumValues.map(e => e.enumlabel);
      expect(values).toEqual(['active', 'idle', 'cleaning', 'removed']);
    });

    it('should have QueueStatus enum with correct values', async () => {
      const enumValues = await prisma.$queryRaw<any[]>`
        SELECT enumlabel
        FROM pg_enum
        WHERE enumtypid = 'QueueStatus'::regtype
        ORDER BY enumsortorder;
      `;

      const values = enumValues.map(e => e.enumlabel);
      expect(values).toEqual(['pending', 'running', 'passed', 'failed', 'cancelled', 'skipped']);
    });

    it('should have PRStatus enum with correct values', async () => {
      const enumValues = await prisma.$queryRaw<any[]>`
        SELECT enumlabel
        FROM pg_enum
        WHERE enumtypid = 'PRStatus'::regtype
        ORDER BY enumsortorder;
      `;

      const values = enumValues.map(e => e.enumlabel);
      expect(values).toEqual(['draft', 'open', 'approved', 'changes_requested', 'merged', 'closed', 'conflict']);
    });

    it('should have StoryPhase enum with correct values', async () => {
      const enumValues = await prisma.$queryRaw<any[]>`
        SELECT enumlabel
        FROM pg_enum
        WHERE enumtypid = 'StoryPhase'::regtype
        ORDER BY enumsortorder;
      `;

      const values = enumValues.map(e => e.enumlabel);
      expect(values).toEqual(['context', 'ba', 'design', 'architecture', 'implementation', 'testing', 'review', 'done']);
    });
  });

  describe('AC-SCHEMA-005: Story Model Extensions', () => {
    it('should have currentPhase field', async () => {
      const result = await prisma.$queryRaw<any[]>`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'stories' AND column_name = 'current_phase';
      `;

      expect(result.length).toBe(1);
      expect(result[0].data_type).toBe('USER-DEFINED'); // Enum type
      expect(result[0].is_nullable).toBe('YES'); // Nullable for backward compatibility
    });

    it('should have worktrees relation accessible via Prisma', async () => {
      // Test that Prisma client has the relation
      const storyWithWorktrees = await prisma.story.findFirst({
        include: { worktrees: true }
      });

      expect(storyWithWorktrees).toBeDefined();
      // Relation exists (even if empty array)
      expect(Array.isArray(storyWithWorktrees?.worktrees)).toBe(true);
    });

    it('should have testQueueEntries relation accessible via Prisma', async () => {
      const storyWithQueue = await prisma.story.findFirst({
        include: { testQueueEntries: true }
      });

      expect(storyWithQueue).toBeDefined();
      expect(Array.isArray(storyWithQueue?.testQueueEntries)).toBe(true);
    });

    it('should have pullRequests relation accessible via Prisma', async () => {
      const storyWithPRs = await prisma.story.findFirst({
        include: { pullRequests: true }
      });

      expect(storyWithPRs).toBeDefined();
      expect(Array.isArray(storyWithPRs?.pullRequests)).toBe(true);
    });
  });

  describe('AC-REL-001/002/003: Cascade Delete Behavior', () => {
    let testStoryId: string;
    let testProjectId: string;
    let testUserId: string;

    beforeAll(async () => {
      // Get existing project and user
      const project = await prisma.project.findFirst();
      const user = await prisma.user.findFirst();

      if (!project || !user) {
        throw new Error('Test requires at least one project and user in database');
      }

      testProjectId = project.id;
      testUserId = user.id;
    });

    beforeEach(async () => {
      // Create test story
      const story = await prisma.story.create({
        data: {
          projectId: testProjectId,
          key: `TEST-DELETE-${Date.now()}`,
          title: 'Test Story for Cascade Delete',
          createdById: testUserId
        }
      });

      testStoryId = story.id;
    });

    afterEach(async () => {
      // Cleanup test story if it still exists
      await prisma.story.deleteMany({
        where: { id: testStoryId }
      });
    });

    it('should cascade delete worktrees when story is deleted', async () => {
      // Create worktree
      const worktree = await prisma.worktree.create({
        data: {
          storyId: testStoryId,
          branchName: 'test-branch',
          worktreePath: '/tmp/test-worktree'
        }
      });

      // Verify worktree exists
      const worktreeBefore = await prisma.worktree.findUnique({
        where: { id: worktree.id }
      });
      expect(worktreeBefore).not.toBeNull();

      // Delete story
      await prisma.story.delete({
        where: { id: testStoryId }
      });

      // Verify worktree was cascade deleted
      const worktreeAfter = await prisma.worktree.findUnique({
        where: { id: worktree.id }
      });
      expect(worktreeAfter).toBeNull();
    });

    it('should cascade delete test queue entries when story is deleted', async () => {
      // Create queue entry
      const queueEntry = await prisma.testQueue.create({
        data: {
          storyId: testStoryId,
          position: 100,
          priority: 0,
          submittedBy: 'test-user'
        }
      });

      // Verify entry exists
      const entryBefore = await prisma.testQueue.findUnique({
        where: { id: queueEntry.id }
      });
      expect(entryBefore).not.toBeNull();

      // Delete story
      await prisma.story.delete({
        where: { id: testStoryId }
      });

      // Verify entry was cascade deleted
      const entryAfter = await prisma.testQueue.findUnique({
        where: { id: queueEntry.id }
      });
      expect(entryAfter).toBeNull();
    });

    it('should cascade delete pull requests when story is deleted', async () => {
      // Create PR
      const pr = await prisma.pullRequest.create({
        data: {
          storyId: testStoryId,
          prNumber: 999,
          prUrl: 'https://github.com/test/test/pull/999',
          title: 'Test PR'
        }
      });

      // Verify PR exists
      const prBefore = await prisma.pullRequest.findUnique({
        where: { id: pr.id }
      });
      expect(prBefore).not.toBeNull();

      // Delete story
      await prisma.story.delete({
        where: { id: testStoryId }
      });

      // Verify PR was cascade deleted
      const prAfter = await prisma.pullRequest.findUnique({
        where: { id: pr.id }
      });
      expect(prAfter).toBeNull();
    });

    it('should cascade delete all related records when story is deleted', async () => {
      // Create all related records
      const worktree = await prisma.worktree.create({
        data: {
          storyId: testStoryId,
          branchName: 'test-branch-all',
          worktreePath: '/tmp/test-all'
        }
      });

      const queueEntry = await prisma.testQueue.create({
        data: {
          storyId: testStoryId,
          position: 200,
          submittedBy: 'test-user'
        }
      });

      const pr = await prisma.pullRequest.create({
        data: {
          storyId: testStoryId,
          prNumber: 1000,
          prUrl: 'https://github.com/test/test/pull/1000',
          title: 'Test PR All'
        }
      });

      // Delete story
      await prisma.story.delete({
        where: { id: testStoryId }
      });

      // Verify all were cascade deleted
      const [worktreeAfter, queueAfter, prAfter] = await Promise.all([
        prisma.worktree.findUnique({ where: { id: worktree.id } }),
        prisma.testQueue.findUnique({ where: { id: queueEntry.id } }),
        prisma.pullRequest.findUnique({ where: { id: pr.id } })
      ]);

      expect(worktreeAfter).toBeNull();
      expect(queueAfter).toBeNull();
      expect(prAfter).toBeNull();
    });
  });

  describe('AC-DATA-001: UUID Generation', () => {
    let testStoryId: string;

    beforeAll(async () => {
      const project = await prisma.project.findFirst();
      const user = await prisma.user.findFirst();

      if (!project || !user) {
        throw new Error('Test requires at least one project and user');
      }

      const story = await prisma.story.create({
        data: {
          projectId: project.id,
          key: `TEST-UUID-${Date.now()}`,
          title: 'Test Story for UUID',
          createdById: user.id
        }
      });

      testStoryId = story.id;
    });

    afterAll(async () => {
      await prisma.story.delete({ where: { id: testStoryId } });
    });

    it('should auto-generate UUID for Worktree', async () => {
      const worktree = await prisma.worktree.create({
        data: {
          storyId: testStoryId,
          branchName: 'test-uuid',
          worktreePath: '/tmp/uuid-test'
        }
      });

      expect(worktree.id).toBeDefined();
      expect(typeof worktree.id).toBe('string');
      expect(worktree.id.length).toBe(36); // UUID format

      await prisma.worktree.delete({ where: { id: worktree.id } });
    });

    it('should auto-generate UUID for TestQueue', async () => {
      const entry = await prisma.testQueue.create({
        data: {
          storyId: testStoryId,
          position: 100,
          submittedBy: 'test'
        }
      });

      expect(entry.id).toBeDefined();
      expect(typeof entry.id).toBe('string');
      expect(entry.id.length).toBe(36);

      await prisma.testQueue.delete({ where: { id: entry.id } });
    });

    it('should auto-generate UUID for PullRequest', async () => {
      const pr = await prisma.pullRequest.create({
        data: {
          storyId: testStoryId,
          prNumber: 123,
          prUrl: 'https://github.com/test/test/pull/123',
          title: 'Test'
        }
      });

      expect(pr.id).toBeDefined();
      expect(typeof pr.id).toBe('string');
      expect(pr.id.length).toBe(36);

      await prisma.pullRequest.delete({ where: { id: pr.id } });
    });
  });

  describe('AC-DATA-003: Status Default Values', () => {
    let testStoryId: string;

    beforeAll(async () => {
      const project = await prisma.project.findFirst();
      const user = await prisma.user.findFirst();

      if (!project || !user) {
        throw new Error('Test requires at least one project and user');
      }

      const story = await prisma.story.create({
        data: {
          projectId: project.id,
          key: `TEST-DEFAULTS-${Date.now()}`,
          title: 'Test Story for Defaults',
          createdById: user.id
        }
      });

      testStoryId = story.id;
    });

    afterAll(async () => {
      await prisma.story.delete({ where: { id: testStoryId } });
    });

    it('should default Worktree status to "active"', async () => {
      const worktree = await prisma.worktree.create({
        data: {
          storyId: testStoryId,
          branchName: 'test-default',
          worktreePath: '/tmp/default-test'
        }
      });

      expect(worktree.status).toBe('active');

      await prisma.worktree.delete({ where: { id: worktree.id } });
    });

    it('should default TestQueue status to "pending"', async () => {
      const entry = await prisma.testQueue.create({
        data: {
          storyId: testStoryId,
          position: 100,
          submittedBy: 'test'
        }
      });

      expect(entry.status).toBe('pending');

      await prisma.testQueue.delete({ where: { id: entry.id } });
    });

    it('should default PullRequest status to "draft"', async () => {
      const pr = await prisma.pullRequest.create({
        data: {
          storyId: testStoryId,
          prNumber: 456,
          prUrl: 'https://github.com/test/test/pull/456',
          title: 'Test Default'
        }
      });

      expect(pr.status).toBe('draft');

      await prisma.pullRequest.delete({ where: { id: pr.id } });
    });
  });

  describe('Business Logic: Queue Ordering', () => {
    let testStoryId: string;

    beforeAll(async () => {
      const project = await prisma.project.findFirst();
      const user = await prisma.user.findFirst();

      if (!project || !user) {
        throw new Error('Test requires at least one project and user');
      }

      const story = await prisma.story.create({
        data: {
          projectId: project.id,
          key: `TEST-QUEUE-${Date.now()}`,
          title: 'Test Story for Queue',
          createdById: user.id
        }
      });

      testStoryId = story.id;
    });

    afterAll(async () => {
      await prisma.story.delete({ where: { id: testStoryId } });
    });

    it('should order queue entries by priority DESC, then position ASC', async () => {
      // Create multiple queue entries with different priorities and positions
      await Promise.all([
        prisma.testQueue.create({
          data: { storyId: testStoryId, position: 100, priority: 0, submittedBy: 'test' }
        }),
        prisma.testQueue.create({
          data: { storyId: testStoryId, position: 200, priority: 5, submittedBy: 'test' }
        }),
        prisma.testQueue.create({
          data: { storyId: testStoryId, position: 300, priority: 0, submittedBy: 'test' }
        }),
        prisma.testQueue.create({
          data: { storyId: testStoryId, position: 150, priority: 10, submittedBy: 'test' }
        })
      ]);

      // Query with business logic ordering
      const orderedEntries = await prisma.testQueue.findMany({
        where: { status: 'pending' },
        orderBy: [
          { priority: 'desc' },
          { position: 'asc' }
        ]
      });

      // Verify ordering: priority 10 first, then 5, then 0 (position 100), then 0 (position 300)
      expect(orderedEntries[0].priority).toBe(10);
      expect(orderedEntries[1].priority).toBe(5);
      expect(orderedEntries[2].position).toBe(100);
      expect(orderedEntries[3].position).toBe(300);
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });
});
