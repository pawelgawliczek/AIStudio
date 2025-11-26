/**
 * Integration tests for BuildDecisionService with ServiceDeploymentState - ST-115
 *
 * Tests the full workflow of:
 * - Recording deployment states to database
 * - Querying deployment states
 * - Making build decisions based on real DB state
 *
 * These tests use the test database (port 5434)
 */

import { PrismaClient } from '@prisma/client';
import { BuildDecisionService, ChangeType } from '../build-decision.service';
import { execSync } from 'child_process';

// Skip these tests if not running in integration test environment
const SKIP_INTEGRATION = process.env.SKIP_INTEGRATION_TESTS === 'true';

// Use test database
const TEST_DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:test@127.0.0.1:5434/vibestudio_test?schema=public';

describe('BuildDecisionService Integration Tests', () => {
  let prisma: PrismaClient;
  let service: BuildDecisionService;
  const projectRoot = '/opt/stack/AIStudio';

  beforeAll(async () => {
    if (SKIP_INTEGRATION) {
      return;
    }

    prisma = new PrismaClient({
      datasources: {
        db: { url: TEST_DATABASE_URL },
      },
    });

    await prisma.$connect();
    service = new BuildDecisionService(prisma, projectRoot);
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.$disconnect();
    }
  });

  beforeEach(async () => {
    if (SKIP_INTEGRATION) {
      return;
    }

    // Clean up test data
    await prisma.serviceDeploymentState.deleteMany({
      where: {
        service: { in: ['backend', 'frontend', 'test-service'] },
      },
    });
  });

  // ==========================================================================
  // GROUP 1: ServiceDeploymentState Database Operations
  // ==========================================================================

  describe('ServiceDeploymentState CRUD', () => {
    it('should create a new deployment state record', async () => {
      if (SKIP_INTEGRATION) return;

      await service.recordDeployment(
        'backend',
        'abc123def456',
        ['backend/src/main.ts', 'backend/src/services/auth.ts'],
        { storyKey: 'ST-115', prNumber: 42, duration: 120000 }
      );

      const state = await prisma.serviceDeploymentState.findUnique({
        where: { service: 'backend' },
      });

      expect(state).not.toBeNull();
      expect(state?.lastDeployedCommit).toBe('abc123def456');
      expect(state?.filesChanged).toContain('backend/src/main.ts');
      expect(state?.filesChanged).toContain('backend/src/services/auth.ts');
      expect((state?.metadata as any)?.storyKey).toBe('ST-115');
    });

    it('should update existing deployment state record', async () => {
      if (SKIP_INTEGRATION) return;

      // First deployment
      await service.recordDeployment('frontend', 'commit1', ['frontend/src/App.tsx']);

      // Second deployment
      await service.recordDeployment('frontend', 'commit2', ['frontend/src/index.tsx']);

      const state = await prisma.serviceDeploymentState.findUnique({
        where: { service: 'frontend' },
      });

      expect(state?.lastDeployedCommit).toBe('commit2');
      expect(state?.filesChanged).toContain('frontend/src/index.tsx');
      expect(state?.filesChanged).not.toContain('frontend/src/App.tsx');
    });

    it('should retrieve last deployed commit', async () => {
      if (SKIP_INTEGRATION) return;

      await service.recordDeployment('backend', 'xyz789', []);

      const commit = await service.getLastDeployedCommit('backend');

      expect(commit).toBe('xyz789');
    });

    it('should return null for non-existent service', async () => {
      if (SKIP_INTEGRATION) return;

      const commit = await service.getLastDeployedCommit('nonexistent-service' as any);

      expect(commit).toBeNull();
    });

    it('should store metadata as JSONB', async () => {
      if (SKIP_INTEGRATION) return;

      const metadata = {
        storyKey: 'ST-115',
        prNumber: 42,
        duration: 120000,
        buildType: 'production',
        nested: { foo: 'bar' },
      };

      await service.recordDeployment('backend', 'commit123', [], metadata);

      const state = await prisma.serviceDeploymentState.findUnique({
        where: { service: 'backend' },
      });

      expect((state?.metadata as any)?.storyKey).toBe('ST-115');
      expect((state?.metadata as any)?.nested?.foo).toBe('bar');
    });

    it('should handle empty files array', async () => {
      if (SKIP_INTEGRATION) return;

      await service.recordDeployment('backend', 'commit123', []);

      const state = await prisma.serviceDeploymentState.findUnique({
        where: { service: 'backend' },
      });

      expect(state?.filesChanged).toEqual([]);
    });

    it('should update timestamps correctly', async () => {
      if (SKIP_INTEGRATION) return;

      // First deployment
      await service.recordDeployment('frontend', 'commit1', []);
      const state1 = await prisma.serviceDeploymentState.findUnique({
        where: { service: 'frontend' },
      });

      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 100));

      // Second deployment
      await service.recordDeployment('frontend', 'commit2', []);
      const state2 = await prisma.serviceDeploymentState.findUnique({
        where: { service: 'frontend' },
      });

      expect(state2?.lastDeployedAt.getTime()).toBeGreaterThan(state1?.lastDeployedAt.getTime() || 0);
      expect(state2?.updatedAt.getTime()).toBeGreaterThan(state1?.updatedAt.getTime() || 0);
    });
  });

  // ==========================================================================
  // GROUP 2: Build Decision with DB State
  // ==========================================================================

  describe('makeBuildDecision with DB State', () => {
    it('should return build-both when no deployment history', async () => {
      if (SKIP_INTEGRATION) return;

      // No deployment states recorded
      const decision = await service.makeBuildDecision();

      expect(decision.skipBackendBuild).toBe(false);
      expect(decision.skipFrontendBuild).toBe(false);
      expect(decision.reason).toContain('No deployment history');
    });

    it('should use stored deployment state for comparison', async () => {
      if (SKIP_INTEGRATION) return;

      // Get current HEAD commit
      let currentCommit: string;
      try {
        currentCommit = execSync('git rev-parse HEAD', {
          cwd: projectRoot,
          encoding: 'utf-8',
        }).trim();
      } catch {
        // Skip if git not available
        return;
      }

      // Record deployment with current commit (simulating already deployed)
      await service.recordDeployment('backend', currentCommit, []);
      await service.recordDeployment('frontend', currentCommit, []);

      const decision = await service.makeBuildDecision();

      // Since we're at the same commit, should detect no changes
      expect(decision.analysis.totalChangedFiles).toBe(0);
      expect(decision.analysis.changeType).toBe(ChangeType.NONE);
    });
  });

  // ==========================================================================
  // GROUP 3: Concurrent Deployment State Updates
  // ==========================================================================

  describe('Concurrent Operations', () => {
    it('should handle concurrent upserts safely', async () => {
      if (SKIP_INTEGRATION) return;

      // Simulate concurrent deployments
      const promises = Array.from({ length: 5 }, (_, i) =>
        service.recordDeployment('backend', `commit${i}`, [`file${i}.ts`])
      );

      await Promise.all(promises);

      const state = await prisma.serviceDeploymentState.findUnique({
        where: { service: 'backend' },
      });

      // Should have one record (last one wins)
      expect(state).not.toBeNull();
      expect(state?.lastDeployedCommit).toMatch(/^commit\d$/);
    });

    it('should not create duplicate records', async () => {
      if (SKIP_INTEGRATION) return;

      // Multiple deployments to same service
      await service.recordDeployment('frontend', 'commit1', []);
      await service.recordDeployment('frontend', 'commit2', []);
      await service.recordDeployment('frontend', 'commit3', []);

      const count = await prisma.serviceDeploymentState.count({
        where: { service: 'frontend' },
      });

      expect(count).toBe(1);
    });
  });

  // ==========================================================================
  // GROUP 4: Unique Index Enforcement
  // ==========================================================================

  describe('Unique Index', () => {
    it('should enforce unique service constraint', async () => {
      if (SKIP_INTEGRATION) return;

      // First insert via recordDeployment
      await service.recordDeployment('backend', 'commit1', []);

      // Direct insert should conflict (testing index)
      await expect(
        prisma.serviceDeploymentState.create({
          data: {
            service: 'backend',
            lastDeployedCommit: 'commit2',
            lastDeployedAt: new Date(),
          },
        })
      ).rejects.toThrow(/unique constraint/i);
    });
  });

  // ==========================================================================
  // GROUP 5: Real Git Integration (if available)
  // ==========================================================================

  describe('Real Git Operations', () => {
    it('should get actual HEAD commit', async () => {
      if (SKIP_INTEGRATION) return;

      let commit: string;
      try {
        commit = execSync('git rev-parse HEAD', {
          cwd: projectRoot,
          encoding: 'utf-8',
        }).trim();
      } catch {
        // Git not available, skip
        return;
      }

      expect(commit).toMatch(/^[0-9a-f]{40}$/);
    });

    it('should analyze actual git diff', async () => {
      if (SKIP_INTEGRATION) return;

      // Get two recent commits
      let commits: string[];
      try {
        const output = execSync('git log --oneline -n 2 --format=%H', {
          cwd: projectRoot,
          encoding: 'utf-8',
        }).trim();
        commits = output.split('\n');
      } catch {
        return;
      }

      if (commits.length < 2) {
        return; // Not enough commits
      }

      const analysis = await service.analyzeChanges(commits[1], commits[0]);

      // Should return a valid analysis
      expect(analysis).toHaveProperty('changeType');
      expect(analysis).toHaveProperty('backendFiles');
      expect(analysis).toHaveProperty('frontendFiles');
      expect(typeof analysis.totalChangedFiles).toBe('number');
    });
  });
});
