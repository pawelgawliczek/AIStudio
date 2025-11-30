import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { PrismaClient } from '@prisma/client';

export const tool: Tool = {
  name: 'get_component_context',
  description:
    'Retrieve work instructions for a component agent. Returns input/operation/output instructions, config, tools, and accessible artifacts. Used by spawned component agents to get their instructions on-demand, enabling token-efficient workflow orchestration.',
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
      tools: component.tools,
      onFailure: component.onFailure,
    },
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
      if (params.includeStoryContext !== false && metadata?.storyId) {
        const story = await prisma.story.findUnique({
          where: { id: metadata.storyId },
          select: {
            id: true,
            key: true,
            title: true,
            description: true,
            status: true,
            type: true,
            contextExploration: true,
            baAnalysis: true,
            architectAnalysis: true,
            designerAnalysis: true,
          },
        });
        if (story) {
          response.story = story;
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

        response.previousOutputs = completedRuns.map((cr) => ({
          componentName: cr.component.name,
          componentId: cr.componentId,
          output: cr.outputData,
          completedAt: cr.finishedAt?.toISOString(),
        }));
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
          response.artifacts = {
            accessible: accessRules.map((ar) => {
              const artifact = artifacts.find((a) => a.definitionId === ar.definitionId);
              return {
                definitionId: ar.definitionId,
                definitionKey: ar.definition.key,
                definitionName: ar.definition.name,
                type: ar.definition.type,
                accessType: ar.accessType,
                isMandatory: ar.definition.isMandatory,
                artifact: artifact
                  ? {
                      id: artifact.id,
                      content: artifact.content,
                      contentType: artifact.contentType,
                      size: artifact.size,
                      version: artifact.version,
                      createdBy: artifact.createdByComponent?.name || 'unknown',
                      updatedAt: artifact.updatedAt.toISOString(),
                    }
                  : null,
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
