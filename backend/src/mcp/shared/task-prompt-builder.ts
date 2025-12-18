/**
 * Task Prompt Builder Module
 * ST-289: Enhanced Task Spawning Instructions in get_current_step and advance_step
 *
 * This module centralizes task prompt assembly logic for consistency across
 * get_current_step and advance_step tools. It builds complete Task prompts by
 * incorporating:
 * - Component instructions (input/operation/output)
 * - Previous component outputs (componentSummary)
 * - Artifact access rules (read/write/required)
 * - Pre-execution context
 */

import { PrismaClient } from '@prisma/client';
import { parseComponentSummary, ComponentSummaryStructured } from '../../types/component-summary.types';

/**
 * Derive subagent_type from executionType and componentName
 * Maps component configuration to Claude Code Task types
 *
 * @param executionType - Component executionType from database
 * @param componentName - Optional component name for context (not currently used)
 * @returns Subagent type string for Task tool
 */
export function deriveSubagentType(executionType: string, componentName?: string): string {
  const normalized = executionType.toLowerCase();

  if (normalized === 'native_explore') {
    return 'Explore';
  }

  if (normalized === 'native_plan') {
    return 'Plan';
  }

  if (normalized === 'native_general') {
    return 'general-purpose';
  }

  // Default for custom or unknown types
  return 'general-purpose';
}

/**
 * Format previous component outputs into markdown section
 * Uses structured ComponentSummary format for better agent handoffs
 *
 * @param componentRuns - Array of previous ComponentRun records with componentSummary
 * @returns Formatted markdown string or empty string if no runs
 */
export function formatPreviousOutputs(
  componentRuns: Array<{
    id: string;
    componentName: string;
    componentSummary: string | null;
  }>
): string {
  if (!componentRuns || componentRuns.length === 0) {
    return '';
  }

  const sections: string[] = ['## Previous Component Outputs\n'];

  for (const run of componentRuns) {
    sections.push(`### ${run.componentName}\n`);

    if (!run.componentSummary) {
      sections.push('No summary available.\n');
      continue;
    }

    // Try to parse as structured summary
    const parsed = parseComponentSummary(run.componentSummary);

    if (parsed) {
      // Structured format - render nicely
      sections.push(`**Status:** ${parsed.status}\n`);
      sections.push(`${parsed.summary}\n`);

      if (parsed.keyOutputs && parsed.keyOutputs.length > 0) {
        sections.push('\n**Key outputs:**\n');
        for (const output of parsed.keyOutputs) {
          sections.push(`- ${output}\n`);
        }
      }

      if (parsed.nextAgentHints && parsed.nextAgentHints.length > 0) {
        sections.push('\n**Hints for next agent:**\n');
        for (const hint of parsed.nextAgentHints) {
          sections.push(`- ${hint}\n`);
        }
      }

      if (parsed.artifactsProduced && parsed.artifactsProduced.length > 0) {
        sections.push('\n**Artifacts produced:**\n');
        for (const artifact of parsed.artifactsProduced) {
          sections.push(`- ${artifact}\n`);
        }
      }

      if (parsed.errors && parsed.errors.length > 0) {
        sections.push('\n**Errors:**\n');
        for (const error of parsed.errors) {
          sections.push(`- ${error}\n`);
        }
      }
    } else {
      // Legacy text format - just display as-is
      sections.push(`${run.componentSummary}\n`);
    }

    sections.push('\n');
  }

  return sections.join('');
}

/**
 * Format artifact access instructions into markdown section
 * Queries artifact access rules for the state and provides MCP tool usage examples
 *
 * @param prisma - Prisma client instance
 * @param stateId - Workflow state ID
 * @param storyId - Story ID for artifact lookup
 * @returns Formatted markdown string or empty string if no access rules
 */
export async function formatArtifactInstructions(
  prisma: PrismaClient,
  stateId: string,
  storyId: string
): Promise<string> {
  // Query artifact access rules for this state
  const artifactAccess = await prisma.artifactAccess.findMany({
    where: { stateId },
    include: {
      definition: {
        select: {
          key: true,
          name: true,
          description: true,
        },
      },
    },
  });

  if (!artifactAccess || artifactAccess.length === 0) {
    return '';
  }

  // Group by access type
  const required: typeof artifactAccess = [];
  const read: typeof artifactAccess = [];
  const write: typeof artifactAccess = [];

  for (const access of artifactAccess) {
    if (!access.definition) continue; // Skip if definition missing

    if (access.accessType === 'required') {
      required.push(access);
    } else if (access.accessType === 'read') {
      read.push(access);
    } else if (access.accessType === 'write') {
      write.push(access);
    }
  }

  if (required.length === 0 && read.length === 0 && write.length === 0) {
    return '';
  }

  const sections: string[] = ['## Artifact Instructions\n'];

  // Required artifacts (must read)
  if (required.length > 0) {
    sections.push('### Required Artifacts (MUST READ)\n');
    sections.push('CRITICAL: You must read these artifacts before proceeding.\n\n');

    for (const access of required) {
      const def = access.definition!;
      sections.push(`**${def.key}** (${def.name})\n`);
      sections.push(`${def.description}\n\n`);

      // Check if artifact exists
      const artifact = await prisma.artifact.findFirst({
        where: {
          definitionId: access.definitionId,
          storyId,
        },
        orderBy: { currentVersion: 'desc' },
      });

      if (artifact) {
        sections.push(`Read with: \`get_artifact({ storyId: "${storyId}", definitionKey: "${def.key}", includeContent: true })\`\n\n`);
      } else {
        sections.push(`⚠️ Artifact not yet created. If you need it, ensure it was produced by a previous component.\n\n`);
      }
    }
  }

  // Read-only artifacts
  if (read.length > 0) {
    sections.push('### Artifacts to READ\n');
    sections.push('These artifacts are available for reference.\n\n');

    for (const access of read) {
      const def = access.definition!;
      sections.push(`**${def.key}** (${def.name})\n`);
      sections.push(`${def.description}\n\n`);

      const artifact = await prisma.artifact.findFirst({
        where: {
          definitionId: access.definitionId,
          storyId,
        },
        orderBy: { currentVersion: 'desc' },
      });

      if (artifact) {
        sections.push(`Read with: \`get_artifact({ storyId: "${storyId}", definitionKey: "${def.key}", includeContent: true })\`\n\n`);
      } else {
        sections.push(`⚠️ Artifact not yet created.\n\n`);
      }
    }
  }

  // Write artifacts
  if (write.length > 0) {
    sections.push('### Artifacts to CREATE/UPDATE\n');
    sections.push('You are expected to create or update these artifacts.\n\n');

    for (const access of write) {
      const def = access.definition!;
      sections.push(`**${def.key}** (${def.name})\n`);
      sections.push(`${def.description}\n\n`);

      const artifact = await prisma.artifact.findFirst({
        where: {
          definitionId: access.definitionId,
          storyId,
        },
        orderBy: { currentVersion: 'desc' },
      });

      if (artifact) {
        sections.push(`Update with: \`create_artifact({ storyId: "${storyId}", definitionKey: "${def.key}", content: "..." })\`\n\n`);
      } else {
        sections.push(`Create with: \`create_artifact({ storyId: "${storyId}", definitionKey: "${def.key}", content: "..." })\`\n\n`);
      }
    }
  }

  return sections.join('');
}

/**
 * Build complete Task prompt from component configuration and context
 * Assembles all relevant information for spawned agent
 *
 * Note: preExecutionInstructions are NOT included in agent prompts as they
 * are meant for the orchestrator, not the spawned agent. Agent prompts only
 * contain component instructions, previous outputs, and artifact instructions.
 *
 * @param prisma - Prisma client instance
 * @param state - Workflow state with component configuration
 * @param runId - Workflow run ID for context
 * @param storyId - Story ID for artifact access
 * @returns Complete markdown prompt string for Task tool
 */
export async function buildTaskPrompt(
  prisma: PrismaClient,
  state: {
    id: string;
    component: {
      id: string;
      name: string;
      inputInstructions: string | null;
      operationInstructions: string | null;
      outputInstructions: string | null;
    } | null;
  },
  runId: string,
  storyId: string
): Promise<string> {
  const sections: string[] = [];

  // 1. Component instructions (Input, Task, Output)
  if (state.component) {
    if (state.component.inputInstructions) {
      sections.push('## Input\n');
      sections.push(`${state.component.inputInstructions}\n\n`);
    }

    if (state.component.operationInstructions) {
      sections.push('## Task\n');
      sections.push(`${state.component.operationInstructions}\n\n`);
    }

    if (state.component.outputInstructions) {
      sections.push('## Output\n');
      sections.push(`${state.component.outputInstructions}\n\n`);
    }
  }

  // 2. Previous component outputs
  const previousRuns = await prisma.componentRun.findMany({
    where: {
      workflowRunId: runId,
      status: 'completed', // Only completed runs
    },
    orderBy: { startedAt: 'asc' },
    select: {
      id: true,
      componentSummary: true,
      component: {
        select: {
          name: true,
        },
      },
    },
  });

  const previousOutputsSection = formatPreviousOutputs(
    previousRuns.map(run => ({
      id: run.id,
      componentName: run.component?.name ?? 'Unknown Component',
      componentSummary: run.componentSummary,
    }))
  );
  if (previousOutputsSection) {
    sections.push(previousOutputsSection);
  }

  // 3. Artifact instructions
  const artifactSection = await formatArtifactInstructions(prisma, state.id, storyId);
  if (artifactSection) {
    sections.push(artifactSection);
  }

  return sections.join('');
}
