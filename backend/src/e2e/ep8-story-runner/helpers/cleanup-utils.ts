/**
 * EP-8 Story Runner E2E Cleanup Utilities
 * Functions for cleaning up test data after tests
 */

import { PrismaClient } from '@prisma/client';
import { TestContext } from './test-context';
import { TEST_CONFIG } from '../config/test-config';

/**
 * Main cleanup function - deletes all test data
 *
 * Strategy: Delete the test project first (cascade deletes most entities).
 * If that fails, delete in reverse dependency order.
 */
export async function cleanupTestData(
  prisma: PrismaClient,
  ctx: TestContext
): Promise<{ success: boolean; errors: string[] }> {
  const errors: string[] = [];

  console.log('\n[CLEANUP] Starting test data cleanup...');

  // Try cascade delete via project first
  if (ctx.projectId) {
    try {
      console.log(`[CLEANUP] Deleting test project: ${ctx.projectId}`);
      await prisma.project.delete({
        where: { id: ctx.projectId },
      });
      console.log('[CLEANUP] Project cascade delete successful');
      return { success: true, errors: [] };
    } catch (error: any) {
      console.warn('[CLEANUP] Project cascade delete failed, using fallback cleanup');
      errors.push(`Project cascade delete failed: ${error.message}`);
    }
  }

  // Fallback: Delete in reverse dependency order
  console.log('[CLEANUP] Running fallback cleanup...');

  // 0. Delete worktrees first (ST-153)
  if (ctx.worktreeId) {
    try {
      await prisma.worktree.delete({ where: { id: ctx.worktreeId } });
      console.log('[CLEANUP] Deleted worktree');
    } catch (error: any) {
      errors.push(`Worktree delete failed: ${error.message}`);
    }
  }

  // 1. Delete artifacts (most dependent)
  if (ctx.artifactId) {
    try {
      await prisma.artifact.delete({ where: { id: ctx.artifactId } });
      console.log('[CLEANUP] Deleted artifact');
    } catch (error: any) {
      errors.push(`Artifact delete failed: ${error.message}`);
    }
  }

  // 2. Delete artifact definitions
  if (ctx.artifactDefinitionId) {
    try {
      await prisma.artifactDefinition.delete({ where: { id: ctx.artifactDefinitionId } });
      console.log('[CLEANUP] Deleted artifact definition');
    } catch (error: any) {
      errors.push(`Artifact definition delete failed: ${error.message}`);
    }
  }

  // 2.5. Delete agent questions (ST-160)
  if (ctx.workflowRunId) {
    try {
      await prisma.agentQuestion.deleteMany({ where: { workflowRunId: ctx.workflowRunId } });
      console.log('[CLEANUP] Deleted agent questions');
    } catch (error: any) {
      errors.push(`Agent questions delete failed: ${error.message}`);
    }
  }

  // 3. Delete component runs (all for workflow run AND all for components in this project)
  // Must delete component runs before components due to FK constraint
  if (ctx.workflowRunId) {
    try {
      await prisma.componentRun.deleteMany({ where: { workflowRunId: ctx.workflowRunId } });
      console.log('[CLEANUP] Deleted component runs by workflowRunId');
    } catch (error: any) {
      errors.push(`Component runs delete by workflowRunId failed: ${error.message}`);
    }
  }

  // Also delete component runs for ALL workflow runs of the workflow
  if (ctx.workflowId) {
    try {
      // Get all workflow run IDs for this workflow
      const workflowRuns = await prisma.workflowRun.findMany({
        where: { workflowId: ctx.workflowId },
        select: { id: true },
      });
      const runIds = workflowRuns.map(r => r.id);
      if (runIds.length > 0) {
        await prisma.componentRun.deleteMany({ where: { workflowRunId: { in: runIds } } });
        console.log(`[CLEANUP] Deleted component runs for ${runIds.length} workflow runs`);
      }
    } catch (error: any) {
      errors.push(`Component runs delete for workflow failed: ${error.message}`);
    }
  }

  // Also delete any component runs referencing our components (including orphaned ones)
  const componentIds = [ctx.agentComponentId, ctx.coordinatorComponentId].filter(Boolean) as string[];
  if (componentIds.length > 0) {
    try {
      await prisma.componentRun.deleteMany({ where: { componentId: { in: componentIds } } });
      console.log('[CLEANUP] Deleted component runs by componentId');
    } catch (error: any) {
      errors.push(`Component runs delete by componentId failed: ${error.message}`);
    }
  }

  if (ctx.componentRunId) {
    try {
      await prisma.componentRun.delete({ where: { id: ctx.componentRunId } });
      console.log('[CLEANUP] Deleted component run');
    } catch (error: any) {
      errors.push(`Component run delete failed: ${error.message}`);
    }
  }

  // 4. Delete workflow runs (both tracked and any orphaned ones for the workflow)
  if (ctx.workflowRunId) {
    try {
      await prisma.workflowRun.delete({ where: { id: ctx.workflowRunId } });
      console.log('[CLEANUP] Deleted workflow run by id');
    } catch (error: any) {
      errors.push(`Workflow run delete by id failed: ${error.message}`);
    }
  }

  // Also delete any workflow runs for our workflow (in case there are orphaned runs)
  if (ctx.workflowId) {
    try {
      await prisma.workflowRun.deleteMany({ where: { workflowId: ctx.workflowId } });
      console.log('[CLEANUP] Deleted workflow runs by workflowId');
    } catch (error: any) {
      errors.push(`Workflow runs delete by workflowId failed: ${error.message}`);
    }
  }

  // 5. Delete workflow states
  if (ctx.workflowStateIds && ctx.workflowStateIds.length > 0) {
    for (const stateId of ctx.workflowStateIds) {
      try {
        await prisma.workflowState.delete({ where: { id: stateId } });
      } catch (error: any) {
        errors.push(`Workflow state ${stateId} delete failed: ${error.message}`);
      }
    }
    console.log(`[CLEANUP] Deleted ${ctx.workflowStateIds.length} workflow states`);
  }

  // 6. Delete workflow
  if (ctx.workflowId) {
    try {
      await prisma.workflow.delete({ where: { id: ctx.workflowId } });
      console.log('[CLEANUP] Deleted workflow');
    } catch (error: any) {
      errors.push(`Workflow delete failed: ${error.message}`);
    }
  }

  // 7. Delete components (agent and coordinator)
  for (const componentId of [ctx.agentComponentId, ctx.coordinatorComponentId]) {
    if (componentId) {
      try {
        await prisma.component.delete({ where: { id: componentId } });
      } catch (error: any) {
        errors.push(`Component ${componentId} delete failed: ${error.message}`);
      }
    }
  }
  console.log('[CLEANUP] Deleted components');

  // 8. Delete story
  if (ctx.storyId) {
    try {
      await prisma.story.delete({ where: { id: ctx.storyId } });
      console.log('[CLEANUP] Deleted story');
    } catch (error: any) {
      errors.push(`Story delete failed: ${error.message}`);
    }
  }

  // 9. Delete epic
  if (ctx.epicId) {
    try {
      await prisma.epic.delete({ where: { id: ctx.epicId } });
      console.log('[CLEANUP] Deleted epic');
    } catch (error: any) {
      errors.push(`Epic delete failed: ${error.message}`);
    }
  }

  // 10. Delete project (final)
  if (ctx.projectId) {
    try {
      await prisma.project.delete({ where: { id: ctx.projectId } });
      console.log('[CLEANUP] Deleted project');
    } catch (error: any) {
      errors.push(`Project delete failed: ${error.message}`);
    }
  }

  const success = errors.length === 0;
  console.log(`[CLEANUP] Cleanup ${success ? 'completed' : 'completed with errors'}`);

  return { success, errors };
}

/**
 * Find and clean up orphaned test data from previous failed runs
 * Looks for any entities with the test prefix
 */
export async function cleanupOrphanedTestData(prisma: PrismaClient): Promise<{
  projectsDeleted: number;
  errors: string[];
}> {
  const errors: string[] = [];
  let projectsDeleted = 0;

  console.log('[CLEANUP] Searching for orphaned test data...');

  try {
    // Find all test projects
    const testProjects = await prisma.project.findMany({
      where: {
        name: {
          startsWith: TEST_CONFIG.PREFIX,
        },
      },
    });

    console.log(`[CLEANUP] Found ${testProjects.length} orphaned test projects`);

    for (const project of testProjects) {
      try {
        await prisma.project.delete({ where: { id: project.id } });
        projectsDeleted++;
        console.log(`[CLEANUP] Deleted orphaned project: ${project.name}`);
      } catch (error: any) {
        errors.push(`Failed to delete ${project.name}: ${error.message}`);
      }
    }
  } catch (error: any) {
    errors.push(`Error finding orphaned projects: ${error.message}`);
  }

  return { projectsDeleted, errors };
}
