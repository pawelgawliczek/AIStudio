import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { PrismaClient } from '@prisma/client';
import {
  truncateWithMetadata,
  markOmitted,
  teamRunResultsFetchCommand,
  artifactFetchCommand,
} from '../../truncation-utils';

export const tool: Tool = {
  name: 'get_component_context',
  description: 'Get component instructions, config, tools, and accessible artifacts. Used by spawned agents.',
  inputSchema: {
    type: 'object',
    properties: {
      componentId: {
        type: 'string',
        description: 'Component UUID (required)',
      },
      runId: {
        type: 'string',
        description: 'Workflow run ID (optional - provides transcript tracking if specified)',
      },
      stateId: {
        type: 'string',
        description: 'Workflow State UUID (optional - provides artifact access based on state)',
      },
      includeStoryContext: {
        type: 'boolean',
        description: 'Include story details with analysis fields (default: true)',
      },
      includePreviousOutputs: {
        type: 'boolean',
        description: 'Include outputs from completed components (default: true)',
      },
      includeArtifacts: {
        type: 'boolean',
        description: 'Include accessible artifacts based on state access rules (default: true)',
      },
      summaryMode: {
        type: 'boolean',
        description:
          'Return lightweight context - excludes artifact content and truncates outputs to 500 chars (default: false)',
      },
    },
    required: ['componentId'],
  },
};

export const metadata = {
  category: 'execution',
  domain: 'Workflow Execution',
  tags: ['component', 'context', 'instructions', 'transcript'],
  version: '1.0.0',
  since: '2025-11-26',
};

export async function handler(prisma: PrismaClient, params: any) {
  if (!params.componentId) {
    throw new Error('componentId is required');
  }

  // Get component with full instructions
  const component = await prisma.component.findUnique({
    where: { id: params.componentId },
  });

  if (!component) {
    throw new Error(`Component with ID ${params.componentId} not found`);
  }

  // Build response
  // ST-197: MCP Tool Profile System - Core 28 tools are directly available
  const coreVibeStudioTools = [
    'get_story', 'update_story', 'create_story', 'search_stories', 'list_stories',
    'upload_artifact', 'get_artifact', 'list_artifacts',
    'get_component_context', 'start_team_run', 'record_agent_start', 'record_agent_complete',
    'get_team_context', 'update_team_status', 'list_teams',
    'get_current_step', 'advance_step', 'get_runner_status', 'repeat_step',
    'git_create_worktree', 'git_get_worktree_status',
    'list_projects', 'get_project', 'get_context', 'set_context',
    'search_tools', 'invoke_tool',
  ];

  // Separate tools into direct (core + non-vibestudio) and invoke_tool required
  const componentTools = component.tools || [];
  const directTools = componentTools.filter(
    (t: string) => !t.startsWith('mcp__vibestudio__') || coreVibeStudioTools.includes(t.replace('mcp__vibestudio__', ''))
  );
  const invokeTools = componentTools.filter(
    (t: string) => t.startsWith('mcp__vibestudio__') && !coreVibeStudioTools.includes(t.replace('mcp__vibestudio__', ''))
  );

  const response: any = {
    success: true,
    component: {
      id: component.id,
      name: component.name,
      description: component.description,
      inputInstructions: component.inputInstructions,
      operationInstructions: component.operationInstructions,
      outputInstructions: component.outputInstructions,
      config: component.config,
      tools: directTools,
      onFailure: component.onFailure,
    },
    // ST-197: Tool profile guidance for spawned agents
    toolProfileNote: {
      message: 'Tool categories: Claude Code tools (Read/Write/Glob/Grep/Bash), Playwright MCP, VibeStudio MCP (core vs non-core)',
      coreVibeStudioTools: coreVibeStudioTools.length,
      directToolsCount: directTools.length,
      nonCoreToolsCount: invokeTools.length,
      guidance: invokeTools.length > 0
        ? `${invokeTools.length} tool(s) require invoke_tool: ${invokeTools.map((t: string) => t.replace('mcp__vibestudio__', '')).join(', ')}`
        : 'All allowed VibeStudio tools are in the core profile - call directly.',
    },
    // ST-197: Explicit invoke_tool guidance if needed
    mcpToolsNote: invokeTools.length > 0
      ? {
          message: 'Non-core VibeStudio tools require invoke_tool wrapper',
          invokeToolRequired: invokeTools.map((t: string) => t.replace('mcp__vibestudio__', '')),
          usage: 'invoke_tool({ toolName: "tool_name", params: { ... } })',
          discovery: 'search_tools({ query: "keyword" }) returns tool schemas',
        }
      : undefined,
  };

  // If runId provided, include workflow context and transcript tracking
  if (params.runId) {
    const workflowRun = await prisma.workflowRun.findUnique({
      where: { id: params.runId },
      include: {
        workflow: true,
      },
    });

    if (workflowRun) {
      response.workflow = {
        runId: workflowRun.id,
        workflowId: workflowRun.workflowId,
        workflowName: workflowRun.workflow.name,
        status: workflowRun.status,
        triggeredBy: workflowRun.triggeredBy,
        startedAt: workflowRun.startedAt.toISOString(),
      };

      // Extract transcript tracking from metadata
      const metadata = workflowRun.metadata as any;
      if (metadata?._transcriptTracking) {
        const tracking = metadata._transcriptTracking;
        response.transcriptTracking = {
          projectPath: tracking.projectPath,
          transcriptDirectory: tracking.transcriptDirectory,
          orchestratorStartTime: tracking.orchestratorStartTime,
          agentTranscriptPattern: 'agent-*.jsonl',
          metricsHint:
            'After completing work, find your agent transcript in transcriptDirectory matching agentTranscriptPattern. Pass the full path to record_component_complete via contextOutput parameter (run /context command and pass output).',
        };
      }

      // Include story context if requested
      // NOTE: Deprecated analysis fields (contextExploration, baAnalysis, architectAnalysis, designerAnalysis)
      // are NO LONGER included as of ST-162. Use the Artifact system instead via list_artifacts.
      if (params.includeStoryContext !== false && metadata?.storyId) {
        const story = await prisma.story.findUnique({
          where: { id: metadata.storyId },
          select: {
            id: true,
            key: true,
            title: true,
            summary: true, // Token-efficient 2-sentence summary (ST-162)
            description: true,
            status: true,
            type: true,
            // REMOVED: contextExploration, baAnalysis, architectAnalysis, designerAnalysis
            // These are deprecated (ST-152). Use Artifact system instead.
          },
        });
        if (story) {
          response.story = story;
          // Add note about deprecated fields
          response.storyAnalysisNote =
            'Analysis fields (contextExploration, baAnalysis, architectAnalysis, designerAnalysis) are deprecated. ' +
            'Use list_artifacts({ workflowRunId }) to access analysis artifacts.';
        }
      }

      // Include previous outputs if requested
      if (params.includePreviousOutputs !== false) {
        const completedRuns = await prisma.componentRun.findMany({
          where: {
            workflowRunId: params.runId,
            status: 'completed',
          },
          include: {
            component: {
              select: { name: true },
            },
          },
          orderBy: { startedAt: 'asc' },
        });

        // In summaryMode, truncate outputs to 500 chars with metadata
        response.previousOutputs = completedRuns.map((cr) => {
          if (params.summaryMode && cr.outputData) {
            const truncated = truncateWithMetadata(
              cr.outputData,
              500,
              'output',
              teamRunResultsFetchCommand(params.runId),
            );
            return {
              componentName: cr.component.name,
              componentId: cr.componentId,
              componentRunId: cr.id,
              output: truncated.value,
              _truncated: truncated.truncationInfo,
              completedAt: cr.finishedAt?.toISOString(),
            };
          }
          return {
            componentName: cr.component.name,
            componentId: cr.componentId,
            componentRunId: cr.id,
            output: cr.outputData,
            completedAt: cr.finishedAt?.toISOString(),
          };
        });
      }

      // Include accessible artifacts if requested and stateId is provided
      if (params.includeArtifacts !== false && params.stateId) {
        // Get artifact access rules for this state
        const accessRules = await prisma.artifactAccess.findMany({
          where: {
            stateId: params.stateId,
            accessType: { in: ['read', 'required'] },
          },
          include: {
            definition: true,
          },
        });

        if (accessRules.length > 0) {
          // Get artifacts for accessible definitions
          const definitionIds = accessRules.map((ar) => ar.definitionId);
          const artifacts = await prisma.artifact.findMany({
            where: {
              workflowRunId: params.runId,
              definitionId: { in: definitionIds },
            },
            include: {
              definition: true,
              createdByComponent: {
                select: { id: true, name: true },
              },
            },
            orderBy: { createdAt: 'desc' },
          });

          // Build artifact map with access info
          // In summaryMode, exclude content and provide fetch instructions
          response.artifacts = {
            accessible: accessRules.map((ar) => {
              const artifact = artifacts.find((a) => a.definitionId === ar.definitionId);

              // Build artifact response with optional content exclusion
              let artifactData = null;
              if (artifact) {
                if (params.summaryMode) {
                  // In summaryMode, exclude content but provide metadata
                  artifactData = {
                    id: artifact.id,
                    content: null,
                    contentType: artifact.contentType,
                    size: artifact.size,
                    currentVersion: artifact.currentVersion,
                    createdBy: artifact.createdByComponent?.name || 'unknown',
                    updatedAt: artifact.updatedAt.toISOString(),
                    _truncated: markOmitted(
                      'content',
                      artifact.size || 0,
                      artifactFetchCommand(artifact.id),
                    ),
                  };
                } else {
                  // Full mode - include content
                  artifactData = {
                    id: artifact.id,
                    content: artifact.content,
                    contentType: artifact.contentType,
                    size: artifact.size,
                    currentVersion: artifact.currentVersion,
                    createdBy: artifact.createdByComponent?.name || 'unknown',
                    updatedAt: artifact.updatedAt.toISOString(),
                  };
                }
              }

              return {
                definitionId: ar.definitionId,
                definitionKey: ar.definition.key,
                definitionName: ar.definition.name,
                type: ar.definition.type,
                accessType: ar.accessType,
                isMandatory: ar.definition.isMandatory,
                artifact: artifactData,
              };
            }),
            canWrite: await prisma.artifactAccess
              .findMany({
                where: {
                  stateId: params.stateId,
                  accessType: 'write',
                },
                include: { definition: true },
              })
              .then((rules) =>
                rules.map((r) => ({
                  definitionId: r.definitionId,
                  definitionKey: r.definition.key,
                  definitionName: r.definition.name,
                  type: r.definition.type,
                })),
              ),
          };
        }
      }
    }
  }

  const hasArtifacts = response.artifacts?.accessible?.length > 0;
  response.message = `Component instructions retrieved for "${component.name}". ${
    params.runId ? 'Includes workflow context and transcript tracking.' : 'No workflow context (runId not provided).'
  }${hasArtifacts ? ` Loaded ${response.artifacts.accessible.length} accessible artifact(s).` : ''}`;

  return response;
}
