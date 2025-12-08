/**
 * Set Context Tool
 * Set session context for subsequent MCP tool calls
 *
 * ST-187: MCP Tool Optimization & Step Commands
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { PrismaClient } from '@prisma/client';
import {
  setContext,
  getContext,
  formatContext,
  type SessionContext,
} from '../../shared/session-context';
import { resolveProject, resolveTeam, resolveStory } from '../../shared/resolve-identifiers';

export const tool: Tool = {
  name: 'set_context',
  description: `Set session context for subsequent MCP tool calls.

Once context is set, tools that require projectId, teamId, etc. will automatically
use these values if not explicitly provided.

**Context Values:**
- \`project\` / \`projectId\` - Project name or UUID (most commonly used)
- \`team\` / \`teamId\` - Team/workflow name or UUID
- \`story\` / \`storyId\` - Story key (ST-123) or UUID
- \`model\` - Default model for agent operations

**Example Usage:**
\`\`\`typescript
// Set project context
set_context({ project: "AI Studio" })

// Now all tools use this project automatically
list_stories({})           // Uses AI Studio project
create_story({ title: "New feature" })  // Uses AI Studio project

// Override for specific call
list_stories({ projectId: "other-project-uuid" })
\`\`\``,
  inputSchema: {
    type: 'object',
    properties: {
      // Project identification (name or UUID)
      project: {
        type: 'string',
        description: 'Project name (e.g., "AI Studio") or UUID',
      },
      projectId: {
        type: 'string',
        description: 'Project UUID (alternative to project name)',
      },
      // Team/workflow identification
      team: {
        type: 'string',
        description: 'Team/workflow name (e.g., "Simplified Dev Workflow")',
      },
      teamId: {
        type: 'string',
        description: 'Team/workflow UUID',
      },
      // Story identification
      story: {
        type: 'string',
        description: 'Story key (e.g., "ST-123") or UUID',
      },
      storyId: {
        type: 'string',
        description: 'Story UUID',
      },
      // Active run
      runId: {
        type: 'string',
        description: 'Active WorkflowRun UUID',
      },
      // Default model
      model: {
        type: 'string',
        description: 'Default model for agent operations (e.g., "sonnet", "opus")',
      },
      // Clear existing context first
      clear: {
        type: 'boolean',
        description: 'Clear existing context before setting new values (default: false)',
      },
    },
  },
};

export const metadata = {
  category: 'context',
  domain: 'Session Context',
  tags: ['context', 'session', 'configuration'],
  version: '1.0.0',
  since: '2025-12-08',
};

export async function handler(
  prisma: PrismaClient,
  params: {
    project?: string;
    projectId?: string;
    team?: string;
    teamId?: string;
    story?: string;
    storyId?: string;
    runId?: string;
    model?: string;
    clear?: boolean;
  }
) {
  const newContext: Partial<SessionContext> = {};
  const resolved: Record<string, string> = {};

  // Handle clear option
  if (params.clear) {
    const { clearContext } = await import('../../shared/session-context');
    clearContext();
  }

  // Resolve and set project
  const projectIdentifier = params.project || params.projectId;
  if (projectIdentifier) {
    const project = await resolveProject(prisma, projectIdentifier);
    if (!project) {
      throw new Error(`Project not found: ${projectIdentifier}`);
    }
    newContext.projectId = project.id;
    newContext.projectName = project.name;
    resolved.project = `${project.name} (${project.id.substring(0, 8)}...)`;
  }

  // Resolve and set team
  const teamIdentifier = params.team || params.teamId;
  if (teamIdentifier) {
    const team = await resolveTeam(prisma, {
      team: params.team,
      teamId: params.teamId,
      projectId: newContext.projectId,
    });
    if (!team) {
      throw new Error(`Team not found: ${teamIdentifier}`);
    }
    newContext.teamId = team.id;
    newContext.teamName = team.name;
    resolved.team = `${team.name} (${team.id.substring(0, 8)}...)`;
  }

  // Resolve and set story
  const storyIdentifier = params.story || params.storyId;
  if (storyIdentifier) {
    const story = await resolveStory(prisma, storyIdentifier);
    if (!story) {
      throw new Error(`Story not found: ${storyIdentifier}`);
    }
    newContext.storyId = story.id;
    newContext.storyKey = story.key;
    resolved.story = `${story.key} - ${story.title}`;

    // Also set projectId from story if not already set
    if (!newContext.projectId) {
      newContext.projectId = story.projectId;
    }
  }

  // Set runId directly
  if (params.runId) {
    // Validate run exists
    const run = await prisma.workflowRun.findUnique({
      where: { id: params.runId },
      select: { id: true, workflowId: true, storyId: true },
    });
    if (!run) {
      throw new Error(`WorkflowRun not found: ${params.runId}`);
    }
    newContext.runId = run.id;
    resolved.runId = run.id.substring(0, 8) + '...';
  }

  // Set model directly
  if (params.model) {
    newContext.model = params.model;
    resolved.model = params.model;
  }

  // Apply context
  const updatedContext = setContext(newContext);

  return {
    success: true,
    context: updatedContext,
    resolved,
    summary: formatContext(updatedContext),
    message: Object.keys(resolved).length > 0
      ? `Context set: ${formatContext(updatedContext)}`
      : 'No context values provided',
    hint: 'Subsequent tool calls will use these values automatically. Use get_context to view current context.',
  };
}
