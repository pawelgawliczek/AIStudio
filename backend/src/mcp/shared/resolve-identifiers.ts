/**
 * Shared identifier resolution utilities for MCP tools
 *
 * ST-187: MCP Tool Optimization & Step Commands
 *
 * These utilities allow MCP tools to accept human-friendly identifiers
 * (like story keys ST-123) instead of requiring UUIDs everywhere.
 */

import { PrismaClient } from '@prisma/client';

/**
 * Pattern for story keys (e.g., ST-123, EP-45)
 */
const STORY_KEY_PATTERN = /^[A-Z]+-\d+$/;

/**
 * UUID v4 pattern
 */
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface ResolvedStory {
  id: string;
  key: string;
  title: string;
  status: string;
  projectId: string;
}

export interface ResolvedRun {
  id: string;
  workflowId: string;
  status: string;
  storyId: string | null;
  story?: ResolvedStory;
}

export interface ResolvedProject {
  id: string;
  name: string;
}

/**
 * Check if a string is a story key (ST-123 format)
 */
export function isStoryKey(value: string): boolean {
  return STORY_KEY_PATTERN.test(value);
}

/**
 * Check if a string is a UUID
 */
export function isUUID(value: string): boolean {
  return UUID_PATTERN.test(value);
}

/**
 * Resolve a story identifier (key like ST-123 or UUID) to a Story record
 *
 * @param prisma - Prisma client
 * @param storyIdentifier - Story key (ST-123) or UUID
 * @returns Resolved story or null if not found
 *
 * @example
 * const story = await resolveStory(prisma, "ST-123");
 * const story = await resolveStory(prisma, "uuid-here");
 */
export async function resolveStory(
  prisma: PrismaClient,
  storyIdentifier: string
): Promise<ResolvedStory | null> {
  if (isStoryKey(storyIdentifier)) {
    // Lookup by key
    const story = await prisma.story.findFirst({
      where: { key: storyIdentifier },
      select: {
        id: true,
        key: true,
        title: true,
        status: true,
        projectId: true,
      },
    });
    return story;
  }

  if (isUUID(storyIdentifier)) {
    // Lookup by UUID
    const story = await prisma.story.findUnique({
      where: { id: storyIdentifier },
      select: {
        id: true,
        key: true,
        title: true,
        status: true,
        projectId: true,
      },
    });
    return story;
  }

  // Invalid format
  throw new Error(
    `Invalid story identifier: "${storyIdentifier}". Expected story key (e.g., ST-123) or UUID.`
  );
}

/**
 * Resolve a story identifier to an active WorkflowRun
 *
 * Finds the most recent running or paused workflow run for the given story.
 * This allows tools to accept story keys instead of run IDs.
 *
 * @param prisma - Prisma client
 * @param params - Either { story: string } or { runId: string }
 * @returns Resolved workflow run
 * @throws Error if no active run found
 *
 * @example
 * const run = await resolveRunId(prisma, { story: "ST-123" });
 * const run = await resolveRunId(prisma, { runId: "uuid-here" });
 */
export async function resolveRunId(
  prisma: PrismaClient,
  params: { story?: string; runId?: string }
): Promise<ResolvedRun> {
  // If runId provided directly, use it
  if (params.runId) {
    const run = await prisma.workflowRun.findUnique({
      where: { id: params.runId },
      select: {
        id: true,
        workflowId: true,
        status: true,
        storyId: true,
        story: {
          select: {
            id: true,
            key: true,
            title: true,
            status: true,
            projectId: true,
          },
        },
      },
    });

    if (!run) {
      throw new Error(`WorkflowRun not found: ${params.runId}`);
    }

    return {
      id: run.id,
      workflowId: run.workflowId,
      status: run.status,
      storyId: run.storyId,
      story: run.story || undefined,
    };
  }

  // If story provided, resolve to active run
  if (params.story) {
    const story = await resolveStory(prisma, params.story);
    if (!story) {
      throw new Error(`Story not found: ${params.story}`);
    }

    // Find active run for this story
    const run = await prisma.workflowRun.findFirst({
      where: {
        storyId: story.id,
        status: { in: ['running', 'paused', 'pending'] },
      },
      orderBy: { startedAt: 'desc' },
      select: {
        id: true,
        workflowId: true,
        status: true,
        storyId: true,
      },
    });

    if (!run) {
      throw new Error(
        `No active workflow run found for story ${params.story}. ` +
          `Use start_team_run to start a new workflow.`
      );
    }

    return {
      id: run.id,
      workflowId: run.workflowId,
      status: run.status,
      storyId: run.storyId,
      story,
    };
  }

  throw new Error('Either story or runId is required');
}

/**
 * Resolve a project identifier (name or UUID) to a Project record
 *
 * @param prisma - Prisma client
 * @param projectIdentifier - Project name or UUID
 * @returns Resolved project or null if not found
 *
 * @example
 * const project = await resolveProject(prisma, "AI Studio");
 * const project = await resolveProject(prisma, "uuid-here");
 */
export async function resolveProject(
  prisma: PrismaClient,
  projectIdentifier: string
): Promise<ResolvedProject | null> {
  if (isUUID(projectIdentifier)) {
    // Lookup by UUID
    const project = await prisma.project.findUnique({
      where: { id: projectIdentifier },
      select: {
        id: true,
        name: true,
      },
    });
    return project;
  }

  // Lookup by name (case-insensitive)
  const project = await prisma.project.findFirst({
    where: {
      name: {
        equals: projectIdentifier,
        mode: 'insensitive',
      },
    },
    select: {
      id: true,
      name: true,
    },
  });
  return project;
}

/**
 * Resolve a workflow/team identifier (name or UUID) to a Workflow record
 *
 * @param prisma - Prisma client
 * @param params - Team identifier and optional project scope
 * @returns Resolved workflow or null if not found
 *
 * @example
 * const team = await resolveTeam(prisma, { team: "Simplified Dev Workflow" });
 * const team = await resolveTeam(prisma, { teamId: "uuid-here" });
 */
export async function resolveTeam(
  prisma: PrismaClient,
  params: { team?: string; teamId?: string; projectId?: string }
): Promise<{ id: string; name: string; projectId: string } | null> {
  if (params.teamId) {
    // Lookup by UUID
    const workflow = await prisma.workflow.findUnique({
      where: { id: params.teamId },
      select: {
        id: true,
        name: true,
        projectId: true,
      },
    });
    return workflow;
  }

  if (params.team) {
    // Lookup by name
    const workflow = await prisma.workflow.findFirst({
      where: {
        name: {
          equals: params.team,
          mode: 'insensitive',
        },
        ...(params.projectId && { projectId: params.projectId }),
      },
      select: {
        id: true,
        name: true,
        projectId: true,
      },
    });
    return workflow;
  }

  return null;
}

/**
 * Resolve a component/agent identifier (name or UUID) to a Component record
 *
 * @param prisma - Prisma client
 * @param params - Component identifier and optional project scope
 * @returns Resolved component or null if not found
 */
export async function resolveComponent(
  prisma: PrismaClient,
  params: { component?: string; componentId?: string; projectId?: string }
): Promise<{ id: string; name: string; projectId: string } | null> {
  if (params.componentId) {
    // Lookup by UUID
    const component = await prisma.component.findUnique({
      where: { id: params.componentId },
      select: {
        id: true,
        name: true,
        projectId: true,
      },
    });
    return component;
  }

  if (params.component) {
    // Lookup by name
    const component = await prisma.component.findFirst({
      where: {
        name: {
          equals: params.component,
          mode: 'insensitive',
        },
        ...(params.projectId && { projectId: params.projectId }),
      },
      select: {
        id: true,
        name: true,
        projectId: true,
      },
    });
    return component;
  }

  return null;
}

/**
 * Resolve a workflow state identifier (name, order, or UUID)
 *
 * @param prisma - Prisma client
 * @param params - State identifier options
 * @returns Resolved state or null if not found
 */
export async function resolveState(
  prisma: PrismaClient,
  params: {
    stateId?: string;
    stateName?: string;
    stateOrder?: number;
    workflowId?: string;
    runId?: string;
  }
): Promise<{
  id: string;
  name: string;
  order: number;
  workflowId: string;
  componentId: string | null;
} | null> {
  // If stateId provided, use it directly
  if (params.stateId) {
    const state = await prisma.workflowState.findUnique({
      where: { id: params.stateId },
      select: {
        id: true,
        name: true,
        order: true,
        workflowId: true,
        componentId: true,
      },
    });
    return state;
  }

  // Need workflowId for name/order lookup
  let workflowId = params.workflowId;

  // If runId provided but not workflowId, get it from the run
  if (!workflowId && params.runId) {
    const run = await prisma.workflowRun.findUnique({
      where: { id: params.runId },
      select: { workflowId: true },
    });
    workflowId = run?.workflowId;
  }

  if (!workflowId) {
    throw new Error('workflowId or runId required when using stateName or stateOrder');
  }

  // Lookup by name
  if (params.stateName) {
    const state = await prisma.workflowState.findFirst({
      where: {
        workflowId,
        name: {
          equals: params.stateName,
          mode: 'insensitive',
        },
      },
      select: {
        id: true,
        name: true,
        order: true,
        workflowId: true,
        componentId: true,
      },
    });
    return state;
  }

  // Lookup by order
  if (params.stateOrder !== undefined) {
    const state = await prisma.workflowState.findFirst({
      where: {
        workflowId,
        order: params.stateOrder,
      },
      select: {
        id: true,
        name: true,
        order: true,
        workflowId: true,
        componentId: true,
      },
    });
    return state;
  }

  return null;
}
