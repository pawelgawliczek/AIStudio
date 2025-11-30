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

  // 3. Delete component runs
  if (ctx.componentRunId) {
    try {
      await prisma.componentRun.delete({ where: { id: ctx.componentRunId } });
      console.log('[CLEANUP] Deleted component run');
    } catch (error: any) {
      errors.push(`Component run delete failed: ${error.message}`);
    }
  }

  // 4. Delete workflow runs
  if (ctx.workflowRunId) {
    try {
      await prisma.workflowRun.delete({ where: { id: ctx.workflowRunId } });
      console.log('[CLEANUP] Deleted workflow run');
    } catch (error: any) {
      errors.push(`Workflow run delete failed: ${error.message}`);
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
