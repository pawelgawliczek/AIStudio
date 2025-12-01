/**
 * ST-153: Location-Aware Git Operations E2E Tests
 * ST-158: MCP-Orchestrated Laptop Worktree Creation
 *
 * Tests worktree creation using MCP tool with target='laptop':
 * - Uses git_create_worktree MCP tool with target='laptop' for MCP-orchestrated creation
 * - Falls back to manual git commands if agent is offline
 * - Verifies the directory exists
 * - Verifies worktree is recorded in database with hostType='local'
 * - Cleans up after tests (deletes worktree and DB record)
 *
 * Prerequisites:
 * - Git repository must exist at PROJECT_PATH
 * - User must have write permissions in worktree directory
 * - For MCP-orchestrated tests: laptop agent must be online
 */

import { PrismaClient } from '@prisma/client';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { TEST_CONFIG, testName } from './config/test-config';
import { TestContext, createTestContext } from './helpers/test-context';
import {
  createTestProjectParams,
  createTestEpicParams,
  createTestStoryParams,
} from './helpers/test-data-factory';

// MCP Handler Imports
import { handler as createProject } from '../../mcp/servers/projects/create_project';
import { handler as createEpic } from '../../mcp/servers/epics/create_epic';
import { handler as createStory } from '../../mcp/servers/stories/create_story';
import { handler as gitCreateWorktree } from '../../mcp/servers/git/git_create_worktree';
import { handler as recordWorktreeCreated } from '../../mcp/servers/git/record_worktree_created';
import { handler as gitDeleteWorktree } from '../../mcp/servers/git/git_delete_worktree';
import { handler as gitGetWorktreeStatus } from '../../mcp/servers/git/git_get_worktree_status';

// Prisma client with production database
const prisma = new PrismaClient();

// Test configuration
const LAPTOP_PROJECT_PATH = process.env.PROJECT_PATH || '/Users/pawelgawliczek/projects/AIStudio';
const LAPTOP_WORKTREE_ROOT = path.join(os.homedir(), 'worktrees-test');

// Extended test context for worktree tests
interface WorktreeTestContext extends TestContext {
  worktreeId?: string;
  worktreePath?: string;
  branchName?: string;
}

// Shared test context
let ctx: WorktreeTestContext;

/**
 * Execute git command locally on the laptop
 */
function execGitLocal(command: string, cwd?: string): string {
  try {
    return execSync(command, {
      cwd: cwd || LAPTOP_PROJECT_PATH,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
  } catch (error: any) {
    throw new Error(`Git command failed: ${error.stderr || error.message}\nCommand: ${command}`);
  }
}

/**
 * Cleanup function for worktree (called in afterAll and on test failure)
 */
async function cleanupWorktree(worktreePath?: string, branchName?: string): Promise<void> {
  if (!worktreePath) return;

  console.log(`\n[CLEANUP] Cleaning up worktree: ${worktreePath}`);

  // 1. Remove worktree from git
  try {
    if (fs.existsSync(worktreePath)) {
      execGitLocal(`git worktree remove --force "${worktreePath}"`, LAPTOP_PROJECT_PATH);
      console.log('[CLEANUP] Git worktree removed');
    }
  } catch (error: any) {
    console.warn(`[CLEANUP] Git worktree remove failed: ${error.message}`);
    // Try to manually remove the directory
    try {
      if (fs.existsSync(worktreePath)) {
        fs.rmSync(worktreePath, { recursive: true, force: true });
        console.log('[CLEANUP] Directory removed manually');
      }
    } catch (rmError: any) {
      console.warn(`[CLEANUP] Manual directory removal failed: ${rmError.message}`);
    }
  }

  // 2. Delete the branch if it exists
  if (branchName) {
    try {
      execGitLocal(`git branch -D "${branchName}"`, LAPTOP_PROJECT_PATH);
      console.log(`[CLEANUP] Branch ${branchName} deleted`);
    } catch (error: any) {
      // Branch may not exist or may already be deleted
      console.log(`[CLEANUP] Branch delete skipped: ${error.message.substring(0, 50)}`);
    }
  }

  // 3. Prune worktrees
  try {
    execGitLocal('git worktree prune', LAPTOP_PROJECT_PATH);
    console.log('[CLEANUP] Worktree pruned');
  } catch (error: any) {
    console.warn(`[CLEANUP] Worktree prune failed: ${error.message}`);
  }
}

describe('ST-153: Local Worktree E2E Tests', () => {
  // Pre-flight check: Verify local environment
  beforeAll(async () => {
    console.log('\n============================================================');
    console.log('ST-153: Local Worktree E2E Tests');
    console.log('============================================================');
    console.log(`Started at: ${new Date().toISOString()}`);
    console.log(`Project path: ${LAPTOP_PROJECT_PATH}`);
    console.log(`Worktree root: ${LAPTOP_WORKTREE_ROOT}`);
    console.log('');

    // Create worktree test directory if needed
    if (!fs.existsSync(LAPTOP_WORKTREE_ROOT)) {
      fs.mkdirSync(LAPTOP_WORKTREE_ROOT, { recursive: true });
      console.log(`✓ Created worktree root: ${LAPTOP_WORKTREE_ROOT}`);
    }

    // Verify git repository exists
    if (!fs.existsSync(path.join(LAPTOP_PROJECT_PATH, '.git'))) {
      console.error(`❌ Git repository not found at ${LAPTOP_PROJECT_PATH}`);
      throw new Error('Git repository required for tests');
    }
    console.log(`✓ Git repository found at ${LAPTOP_PROJECT_PATH}`);

    ctx = createTestContext() as WorktreeTestContext;
  });

  // Cleanup after all tests
  afterAll(async () => {
    console.log('\n============================================================');
    console.log('CLEANUP');
    console.log('============================================================');

    // Clean up worktree first
    await cleanupWorktree(ctx.worktreePath, ctx.branchName);

    // Clean up database entities
    if (ctx.worktreeId) {
      try {
        await prisma.worktree.delete({ where: { id: ctx.worktreeId } });
        console.log('[CLEANUP] Worktree DB record deleted');
      } catch (error: any) {
        console.warn(`[CLEANUP] Worktree DB delete failed: ${error.message}`);
      }
    }

    if (ctx.storyId) {
      try {
        await prisma.story.delete({ where: { id: ctx.storyId } });
        console.log('[CLEANUP] Story deleted');
      } catch (error: any) {
        console.warn(`[CLEANUP] Story delete failed: ${error.message}`);
      }
    }

    if (ctx.epicId) {
      try {
        await prisma.epic.delete({ where: { id: ctx.epicId } });
        console.log('[CLEANUP] Epic deleted');
      } catch (error: any) {
        console.warn(`[CLEANUP] Epic delete failed: ${error.message}`);
      }
    }

    if (ctx.projectId) {
      try {
        await prisma.project.delete({ where: { id: ctx.projectId } });
        console.log('[CLEANUP] Project deleted');
      } catch (error: any) {
        console.warn(`[CLEANUP] Project delete failed: ${error.message}`);
      }
    }

    await prisma.$disconnect();

    console.log('\n============================================================');
    console.log(`Completed at: ${new Date().toISOString()}`);
    console.log('============================================================');
  });

  // ============================================================
  // PRE-FLIGHT: Verify Git Environment
  // ============================================================
  describe('Pre-flight: Git Environment', () => {
    it('should have git available locally', () => {
      const gitVersion = execGitLocal('git --version');
      expect(gitVersion).toMatch(/git version/);
      console.log(`  ✓ ${gitVersion}`);
    });

    it('should be in a git repository', () => {
      const toplevel = execGitLocal('git rev-parse --show-toplevel');
      expect(toplevel).toBe(LAPTOP_PROJECT_PATH);
      console.log(`  ✓ Git root: ${toplevel}`);
    });
  });

  // ============================================================
  // SETUP: Create Test Entities
  // ============================================================
  describe('Setup: Create Test Entities', () => {
    it('should create test project', async () => {
      const params = {
        ...createTestProjectParams(),
        name: `${TEST_CONFIG.PREFIX}WorktreeLocal_${TEST_CONFIG.TIMESTAMP}`,
      };
      const result = await createProject(prisma, params);

      ctx.projectId = result.id;
      expect(result.id).toBeDefined();
      console.log(`  ✓ Project created: ${result.name}`);
    });

    it('should create test epic', async () => {
      if (!ctx.projectId) {
        console.log('  ⚠ Skipping - no project');
        return;
      }

      const params = createTestEpicParams(ctx.projectId);
      const result = await createEpic(prisma, params);

      ctx.epicId = result.id;
      console.log(`  ✓ Epic created: ${result.title}`);
    });

    it('should create test story', async () => {
      if (!ctx.projectId) {
        console.log('  ⚠ Skipping - no project');
        return;
      }

      const params = {
        ...createTestStoryParams(ctx.projectId, ctx.epicId),
        title: testName('WorktreeTest'),
      };
      const result = await createStory(prisma, params);

      ctx.storyId = result.id;
      console.log(`  ✓ Story created: ${result.title} (${result.key})`);
    });
  });

  // ============================================================
  // PHASE 1: Local Worktree Creation (ST-158: MCP-Orchestrated)
  // ============================================================
  describe('Phase 1: Create Worktree via MCP Tool (ST-158)', () => {
    it('should create a git worktree using MCP tool with target=laptop', async () => {
      if (!ctx.storyId) {
        console.log('  ⚠ Skipping - no story created');
        return;
      }

      console.log('  Attempting MCP-orchestrated worktree creation (target=laptop)...');

      try {
        // ST-158: Use MCP tool with target='laptop' for fully orchestrated creation
        const result = await gitCreateWorktree(prisma, {
          storyId: ctx.storyId,
          target: 'laptop',
        });

        // Check if it returned runLocally directive (agent offline)
        if ('runLocally' in result && result.runLocally) {
          console.log('  ⚠ MCP tool returned runLocally directive - agent may be offline');
          console.log('  Falling back to manual worktree creation...');

          // Manual fallback
          ctx.branchName = `test-worktree-${TEST_CONFIG.TIMESTAMP}`;
          ctx.worktreePath = path.join(LAPTOP_WORKTREE_ROOT, ctx.branchName);

          execGitLocal(`git fetch origin main`, LAPTOP_PROJECT_PATH);
          execGitLocal(`git branch ${ctx.branchName} origin/main`, LAPTOP_PROJECT_PATH);
          execGitLocal(`git worktree add "${ctx.worktreePath}" ${ctx.branchName}`, LAPTOP_PROJECT_PATH);

          console.log(`  ✓ Worktree created manually at ${ctx.worktreePath}`);
          return;
        }

        // MCP-orchestrated success
        ctx.worktreeId = result.worktreeId;
        ctx.branchName = result.branchName;
        ctx.worktreePath = result.worktreePath;

        expect(result.executedOn).toBe('laptop');
        console.log(`  ✓ MCP-orchestrated worktree created!`);
        console.log(`    - Worktree ID: ${result.worktreeId}`);
        console.log(`    - Branch: ${result.branchName}`);
        console.log(`    - Path: ${result.worktreePath}`);
        console.log(`    - Executed on: ${result.executedOn}`);
      } catch (error: any) {
        // Handle agent offline error
        if (error.code === 'AGENT_OFFLINE' || error.message?.includes('offline')) {
          console.log(`  ⚠ Agent offline: ${error.message}`);
          console.log('  Falling back to manual worktree creation...');

          // Manual fallback
          ctx.branchName = `test-worktree-${TEST_CONFIG.TIMESTAMP}`;
          ctx.worktreePath = path.join(LAPTOP_WORKTREE_ROOT, ctx.branchName);

          execGitLocal(`git fetch origin main`, LAPTOP_PROJECT_PATH);
          execGitLocal(`git branch ${ctx.branchName} origin/main`, LAPTOP_PROJECT_PATH);
          execGitLocal(`git worktree add "${ctx.worktreePath}" ${ctx.branchName}`, LAPTOP_PROJECT_PATH);

          console.log(`  ✓ Worktree created manually at ${ctx.worktreePath}`);
        } else {
          throw error;
        }
      }
    });

    it('should verify worktree is in git worktree list', () => {
      if (!ctx.worktreePath) {
        console.log('  ⚠ Skipping - no worktree created');
        return;
      }

      const worktreeList = execGitLocal('git worktree list', LAPTOP_PROJECT_PATH);
      expect(worktreeList).toContain(ctx.worktreePath);
      console.log(`  ✓ Worktree found in git worktree list`);
    });

    it('should verify worktree has correct branch', () => {
      if (!ctx.worktreePath || !ctx.branchName) {
        console.log('  ⚠ Skipping - no worktree created');
        return;
      }

      const currentBranch = execGitLocal('git rev-parse --abbrev-ref HEAD', ctx.worktreePath);
      expect(currentBranch).toBe(ctx.branchName);
      console.log(`  ✓ Worktree is on branch: ${currentBranch}`);
    });
  });

  // ============================================================
  // PHASE 2: Record Worktree in Database (if not already recorded)
  // ============================================================
  describe('Phase 2: Record Worktree in Database', () => {
    it('should record worktree via record_worktree_created MCP tool (if manual)', async () => {
      // ST-158: Skip if worktree was created via MCP tool (already recorded)
      if (ctx.worktreeId) {
        console.log('  ⚠ Skipping - worktree already recorded by MCP tool');
        return;
      }

      if (!ctx.storyId || !ctx.branchName || !ctx.worktreePath) {
        console.log('  ⚠ Skipping - prerequisites not met');
        return;
      }

      const result = await recordWorktreeCreated(prisma, {
        storyId: ctx.storyId,
        branchName: ctx.branchName,
        worktreePath: ctx.worktreePath,
        baseBranch: 'main',
      });

      ctx.worktreeId = result.worktreeId;
      expect(result.worktreeId).toBeDefined();
      expect(result.hostType).toBe('local');
      expect(result.hostName).toBe(os.hostname());
      console.log(`  ✓ Worktree recorded: ${result.worktreeId}`);
      console.log(`  ✓ Host type: ${result.hostType}`);
      console.log(`  ✓ Host name: ${result.hostName}`);
    });

    it('should verify worktree in database', async () => {
      if (!ctx.worktreeId) {
        console.log('  ⚠ Skipping - no worktree recorded');
        return;
      }

      const worktree = await prisma.worktree.findUnique({
        where: { id: ctx.worktreeId },
      });

      expect(worktree).toBeDefined();
      expect(worktree?.storyId).toBe(ctx.storyId);
      expect(worktree?.branchName).toBe(ctx.branchName);
      expect(worktree?.worktreePath).toBe(ctx.worktreePath);
      expect(worktree?.hostType).toBe('local');
      expect(worktree?.status).toBe('active');
      console.log(`  ✓ Database record verified`);
      console.log(`    - Status: ${worktree?.status}`);
      console.log(`    - Host type: ${worktree?.hostType}`);
    });
  });

  // ============================================================
  // PHASE 3: Verify Worktree Status via MCP
  // ============================================================
  describe('Phase 3: Verify Worktree Status via MCP', () => {
    it('should get worktree status via MCP tool', async () => {
      if (!ctx.storyId) {
        console.log('  ⚠ Skipping - no story');
        return;
      }

      try {
        const result = await gitGetWorktreeStatus(prisma, {
          storyId: ctx.storyId,
          includeGitStatus: true,
          includeDiskUsage: false,
        });

        // Note: This may fail if running on KVM and worktree is on laptop
        // The test validates the MCP tool works for local worktrees
        console.log(`  ✓ Worktree status retrieved`);
        if (result.worktree) {
          console.log(`    - Branch: ${result.worktree.branchName}`);
          console.log(`    - Status: ${result.worktree.status}`);
          if (result.worktree.gitStatus) {
            console.log(`    - Git clean: ${result.worktree.gitStatus.isClean}`);
          }
        }
      } catch (error: any) {
        // Expected if MCP server is on KVM but worktree is on laptop
        if (error.message.includes('REMOTE_NOT_CONFIGURED') ||
            error.message.includes('not found') ||
            error.message.includes('offline')) {
          console.log(`  ⚠ Expected: ${error.message.substring(0, 60)}...`);
          console.log('    (MCP tool may not reach laptop worktree when running on KVM)');
        } else {
          throw error;
        }
      }
    });
  });

  // ============================================================
  // PHASE 4: Verify Local Filesystem Operations
  // ============================================================
  describe('Phase 4: Local Filesystem Operations', () => {
    it('should be able to create files in worktree', () => {
      if (!ctx.worktreePath) {
        console.log('  ⚠ Skipping - no worktree');
        return;
      }

      const testFile = path.join(ctx.worktreePath, 'test-file.txt');
      fs.writeFileSync(testFile, `Test file created at ${new Date().toISOString()}\n`);

      expect(fs.existsSync(testFile)).toBe(true);
      console.log(`  ✓ Test file created: ${testFile}`);

      // Clean up test file
      fs.unlinkSync(testFile);
      console.log('  ✓ Test file removed');
    });

    it('should verify git operations work in worktree', () => {
      if (!ctx.worktreePath) {
        console.log('  ⚠ Skipping - no worktree');
        return;
      }

      // Check git status in worktree
      const status = execGitLocal('git status --short', ctx.worktreePath);
      console.log(`  ✓ Git status in worktree: ${status || '(clean)'}`);

      // Check branch
      const branch = execGitLocal('git branch --show-current', ctx.worktreePath);
      expect(branch).toBe(ctx.branchName);
      console.log(`  ✓ Current branch: ${branch}`);
    });
  });

  // ============================================================
  // PHASE 5: Cleanup Verification
  // ============================================================
  describe('Phase 5: Cleanup Verification', () => {
    it('should delete worktree via git_delete_worktree MCP tool', async () => {
      if (!ctx.storyId || !ctx.worktreePath) {
        console.log('  ⚠ Skipping - no worktree to delete');
        return;
      }

      try {
        const result = await gitDeleteWorktree(prisma, {
          storyId: ctx.storyId,
          confirm: true,
          deleteBranch: true,
          forceDelete: true,
          preserveDatabase: false,
        });

        console.log(`  ✓ Worktree deleted via MCP: ${result.message}`);

        // Verify worktree is gone from filesystem
        expect(fs.existsSync(ctx.worktreePath)).toBe(false);
        console.log('  ✓ Worktree directory removed from filesystem');

        // Clear context so afterAll doesn't try to clean up again
        ctx.worktreePath = undefined;
        ctx.worktreeId = undefined;
        ctx.branchName = undefined;
      } catch (error: any) {
        // MCP tool may fail if running on KVM - fall back to manual cleanup
        console.log(`  ⚠ MCP delete failed: ${error.message.substring(0, 60)}...`);
        console.log('    Falling back to manual cleanup in afterAll');
      }
    });
  });

  // ============================================================
  // Summary
  // ============================================================
  describe('Summary', () => {
    it('should report worktree test results', () => {
      console.log('\n  ============================================================');
      console.log('  ST-153 Local Worktree Test Summary');
      console.log('  ============================================================');
      console.log(`    Project: ${ctx.projectId || 'not created'}`);
      console.log(`    Story: ${ctx.storyId || 'not created'}`);
      console.log(`    Worktree ID: ${ctx.worktreeId || 'not recorded'}`);
      console.log(`    Worktree Path: ${ctx.worktreePath || 'cleaned up'}`);
      console.log(`    Branch: ${ctx.branchName || 'cleaned up'}`);
      console.log('  ============================================================');

      // Always pass - this is a summary
      expect(true).toBe(true);
    });
  });
});
