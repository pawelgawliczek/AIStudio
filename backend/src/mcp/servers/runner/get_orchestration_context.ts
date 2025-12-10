/**
 * Get Orchestration Context Tool
 * Returns MasterSession re-initialization context after compaction
 *
 * ST-164: Orchestration Context Recovery
 * ST-190: Story Key Support + get_current_step Integration
 *
 * After context compaction, the MasterSession loses its role definition
 * and response format. This tool provides everything needed to re-initialize
 * the session so the Node.js Runner can continue orchestrating.
 *
 * Now supports story key lookup and reuses get_current_step logic for
 * workflowSequence to maintain single source of truth.
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { PrismaClient } from '@prisma/client';
import { handler as getCurrentStepHandler } from './get_current_step';

export const tool: Tool = {
  name: 'get_orchestration_context',
  description: `Re-initialize MasterSession context after compaction.

**Use this tool after context compaction to restore:**
- MasterSession role and response format
- Current workflow run state
- Story context
- Complete workflowSequence (reuses get_current_step logic)

**ST-172: Automatic Transcript Registration**
If \`sessionId\` and \`transcriptPath\` are provided, this tool will automatically
register the new master transcript (if not already registered) before returning context.

**ST-190: Story Key Support**
You can now use story key (e.g., ST-123) instead of runId. The tool will find
the active workflow run for that story.

**Usage:**
\`\`\`typescript
// After compaction (automatic transcript registration)
get_orchestration_context({
  story: "ST-123",
  sessionId: "session-uuid",
  transcriptPath: "/path/to/transcript.jsonl"
})

// Normal recovery (no transcript registration)
get_orchestration_context({ runId: "uuid-here" })
\`\`\``,
  inputSchema: {
    type: 'object',
    properties: {
      story: {
        type: 'string',
        description: 'Story key (e.g., ST-123) or UUID - preferred input method',
      },
      runId: {
        type: 'string',
        description: 'WorkflowRun ID (optional - use if multiple runs exist for same story)',
      },
      sessionId: {
        type: 'string',
        description: 'Current session ID (optional - for automatic transcript registration after compaction)',
      },
      transcriptPath: {
        type: 'string',
        description: 'Current transcript path (optional - for automatic transcript registration after compaction)',
      },
    },
    // Neither story nor runId required - at least one must be provided
  },
};

export const metadata = {
  category: 'runner',
  domain: 'Story Runner',
  tags: ['runner', 'orchestration', 'context', 'compaction', 'recovery', 'master-session'],
  version: '1.0.0',
  since: '2025-12-02',
};

export async function handler(
  prisma: PrismaClient,
  params: {
    story?: string;
    runId?: string;
    sessionId?: string;
    transcriptPath?: string;
  }
) {
  const { sessionId, transcriptPath } = params;

  // ST-190: Resolve story to runId if provided
  let resolvedRunId = params.runId;
  if (!params.runId && params.story) {
    // Find active workflow runs for this story
    const storyRuns = await prisma.workflowRun.findMany({
      where: {
        story: {
          OR: [
            { key: params.story },
            { id: params.story },
          ],
        },
        status: { in: ['running', 'paused'] },
      },
      orderBy: { startedAt: 'desc' },
      take: 5,
      select: {
        id: true,
        status: true,
        startedAt: true,
        workflow: { select: { name: true } },
      },
    });

    if (storyRuns.length === 0) {
      throw new Error(`No active workflow runs found for story: ${params.story}`);
    }
    if (storyRuns.length > 1) {
      // Return list of runs for user to choose
      return {
        success: false,
        error: 'multiple_runs',
        message: `Multiple active runs for story ${params.story}. Specify runId:`,
        runs: storyRuns.map(r => ({
          runId: r.id,
          status: r.status,
          workflowName: r.workflow.name,
          startedAt: r.startedAt?.toISOString(),
        })),
      };
    }
    resolvedRunId = storyRuns[0].id;
  }

  if (!resolvedRunId) {
    throw new Error('Either story or runId is required');
  }

  // Get workflow run with all related data
  const run = await prisma.workflowRun.findUnique({
    where: { id: resolvedRunId },
    include: {
      workflow: {
        include: {
          states: {
            orderBy: { order: 'asc' },
            include: {
              component: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!run) {
    throw new Error(`WorkflowRun not found: ${resolvedRunId}`);
  }

  // ST-172: Automatic transcript registration after compaction
  // If sessionId and transcriptPath provided, register the new master transcript
  let transcriptAutoRegistered = false;
  if (sessionId && transcriptPath) {
    const existingPaths = run.masterTranscriptPaths || [];

    // Check if transcript already registered
    if (!existingPaths.includes(transcriptPath)) {
      // Add new transcript to array
      await prisma.workflowRun.update({
        where: { id: resolvedRunId },
        data: {
          masterTranscriptPaths: [...existingPaths, transcriptPath],
        },
      });
      transcriptAutoRegistered = true;
    }
  }

  // ST-190: Call get_current_step to get the workflowSequence (single source of truth)
  // This ensures any improvements to get_current_step automatically apply here
  const currentStepResult = await getCurrentStepHandler(prisma, { runId: resolvedRunId });

  // Get story context from get_current_step result or lookup
  const storyContext = currentStepResult.story || null;

  // Build message with transcript registration info
  let message = `MasterSession context restored for "${run.workflow.name}".`;
  if (currentStepResult.currentState) {
    message += ` Currently at state "${currentStepResult.currentState.name}" (${currentStepResult.currentState.phase || 'pre'} phase).`;
  }
  if (currentStepResult.progress) {
    message += ` ${currentStepResult.progress.completedStates?.length || 0}/${currentStepResult.progress.totalStates} states completed.`;
  }
  if (transcriptAutoRegistered) {
    message += ` New master transcript registered: ${transcriptPath}`;
  }

  // Reminder for the PROJECT MANAGER role
  message += ' You are the PROJECT MANAGER orchestrating this story. Follow the workflowSequence to continue.';

  return {
    success: true,

    // IDs for reference
    runId: resolvedRunId,
    workflowId: run.workflowId,
    workflowName: run.workflow.name,

    // Current execution state (from get_current_step)
    status: run.status,
    currentState: currentStepResult.currentState,

    // Progress (from get_current_step)
    progress: currentStepResult.progress,

    // Story context (from get_current_step)
    story: storyContext,

    // ST-190: workflowSequence from get_current_step - single source of truth
    // Any updates to get_current_step logic are automatically reflected here
    workflowSequence: currentStepResult.workflowSequence,

    // Simple next step guidance
    nextStep: 'Follow the workflowSequence above to continue execution.',

    // ST-172: Transcript registration info
    transcriptRegistration: transcriptAutoRegistered
      ? {
          registered: true,
          sessionId,
          transcriptPath,
          totalMasterTranscripts: (run.masterTranscriptPaths?.length || 0) + 1,
        }
      : null,

    message,
  };
}
