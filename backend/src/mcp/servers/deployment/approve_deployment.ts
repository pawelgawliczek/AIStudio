/**
 * MCP Tool: Approve Deployment for Direct Commit Mode
 *
 * **ST-84: Support Direct Commits & Simplified Approval for Solo Development**
 *
 * Provides manual approval mechanism for production deployments when using
 * direct commits to main (bypassing PR workflow). This is designed for solo
 * development workflows where the developer acts as both implementer and reviewer.
 *
 * **WORKFLOW:**
 * 1. Validate story exists and is deployment-ready
 * 2. Set manual approval flag with expiration
 * 3. Record approver and approval timestamp
 * 4. Return approval details for audit trail
 *
 * **APPROVAL EXPIRATION:**
 * - Default: 60 minutes
 * - Configurable via expiresInMinutes parameter
 * - Prevents stale approvals from being used
 *
 * **EXAMPLE USAGE:**
 * ```typescript
 * approve_deployment({
 *   storyId: "2e809be4-cc67-4fc7-8c3d-4d337c0043d5",
 *   approvedBy: "pawel",
 *   approvalReason: "Hotfix for critical bug - solo development",
 *   expiresInMinutes: 60
 * })
 * ```
 *
 * Related to ST-77 (Production Deployment Safety System)
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { PrismaClient } from '@prisma/client';
import { ValidationError, NotFoundError } from '../../types.js';
import { validateRequired } from '../../utils.js';

// ============================================================================
// Input/Output Types
// ============================================================================

export interface ApproveDeploymentParams {
  storyId: string;
  approvedBy: string;
  approvalReason?: string;
  expiresInMinutes?: number; // Default: 60 minutes
}

export interface ApproveDeploymentResponse {
  success: boolean;
  storyId: string;
  storyKey: string;
  approvedBy: string;
  approvedAt: string; // ISO 8601 timestamp
  approvalExpiresAt: string; // ISO 8601 timestamp
  expiresInMinutes: number;
  approvalReason?: string;
  message: string;
}

// ============================================================================
// Tool Definition
// ============================================================================

export const tool: Tool = {
  name: 'approve_deployment',
  description: 'Manually approve deployment for direct commit mode. Single-use approval with 60-minute expiration (configurable). For solo development bypassing PR workflow.',

  inputSchema: {
    type: 'object',
    properties: {
      storyId: {
        type: 'string',
        description: 'Story UUID (required)',
      },
      approvedBy: {
        type: 'string',
        description: 'Approver identifier (required) - e.g., username or email',
      },
      approvalReason: {
        type: 'string',
        description: 'Reason for approval (optional) - e.g., "Hotfix for critical bug"',
      },
      expiresInMinutes: {
        type: 'number',
        description: 'Approval validity in minutes (default: 60, max: 480 = 8 hours)',
      },
    },
    required: ['storyId', 'approvedBy'],
  },
};

// ============================================================================
// Handler Implementation
// ============================================================================

export async function handler(
  prisma: PrismaClient,
  params: ApproveDeploymentParams
): Promise<ApproveDeploymentResponse> {
  const client = prisma;
  const shouldDisconnect = false;

  try {
    console.log('='.repeat(80));
    console.log('✅ DEPLOYMENT APPROVAL REQUEST');
    console.log('='.repeat(80));
    console.log(`Story ID: ${params.storyId}`);
    console.log(`Approved By: ${params.approvedBy}`);
    if (params.approvalReason) {
      console.log(`Reason: ${params.approvalReason}`);
    }
    console.log('='.repeat(80));

    // ========================================================================
    // VALIDATION
    // ========================================================================

    // Validate required parameters
    validateRequired(params, ['storyId', 'approvedBy']);

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(params.storyId)) {
      throw new ValidationError(
        `Invalid storyId format: ${params.storyId}. Expected UUID format.`
      );
    }

    // Validate approvedBy is not empty
    if (!params.approvedBy.trim()) {
      throw new ValidationError(
        'approvedBy cannot be empty. Provide approver identifier (e.g., username, email).'
      );
    }

    // Validate expiresInMinutes (default: 60, max: 480 = 8 hours)
    const expiresInMinutes = params.expiresInMinutes ?? 60;
    if (expiresInMinutes < 1 || expiresInMinutes > 480) {
      throw new ValidationError(
        `Invalid expiresInMinutes: ${expiresInMinutes}. Must be between 1 and 480 minutes (8 hours).`
      );
    }

    // ========================================================================
    // FETCH AND VALIDATE STORY
    // ========================================================================

    const story = await client.story.findUnique({
      where: { id: params.storyId },
      select: {
        id: true,
        key: true,
        title: true,
        status: true,
        manualApproval: true,
        approvedBy: true,
        approvedAt: true,
        approvalExpiresAt: true,
        metadata: true,
      },
    });

    if (!story) {
      throw new NotFoundError('Story', params.storyId);
    }

    // Check if story is in deployable status (qa or done)
    if (!['qa', 'done'].includes(story.status)) {
      throw new ValidationError(
        `Story ${story.key} is not ready for deployment. ` +
        `Status: ${story.status}. Expected: qa or done.`
      );
    }

    // Warn if approval already exists and is still valid
    if (story.manualApproval && story.approvalExpiresAt) {
      const now = new Date();
      const expiresAt = new Date(story.approvalExpiresAt);

      if (expiresAt > now) {
        console.warn(
          `⚠️  WARNING: Story ${story.key} already has valid approval from ${story.approvedBy || 'unknown'} ` +
          `(expires at ${expiresAt.toISOString()}). Overwriting with new approval.`
        );
      }
    }

    // ========================================================================
    // SET MANUAL APPROVAL
    // ========================================================================

    const now = new Date();
    const expiresAt = new Date(now.getTime() + expiresInMinutes * 60 * 1000);

    const updatedStory = await client.story.update({
      where: { id: params.storyId },
      data: {
        manualApproval: true,
        approvedBy: params.approvedBy,
        approvedAt: now,
        approvalExpiresAt: expiresAt,
        // Store approval reason in metadata for audit trail
        metadata: {
          ...(typeof story.metadata === 'object' && story.metadata !== null ? story.metadata : {}),
          lastManualApproval: {
            approvedBy: params.approvedBy,
            approvedAt: now.toISOString(),
            expiresAt: expiresAt.toISOString(),
            reason: params.approvalReason || 'No reason provided',
            timestamp: now.toISOString(),
          },
        } as any,
      },
      select: {
        id: true,
        key: true,
        approvedBy: true,
        approvedAt: true,
        approvalExpiresAt: true,
      },
    });

    console.log('='.repeat(80));
    console.log('✅ DEPLOYMENT APPROVAL GRANTED');
    console.log('='.repeat(80));
    console.log(`Story: ${story.key}`);
    console.log(`Approved By: ${updatedStory.approvedBy}`);
    console.log(`Approved At: ${updatedStory.approvedAt?.toISOString()}`);
    console.log(`Expires At: ${updatedStory.approvalExpiresAt?.toISOString()}`);
    console.log(`Valid For: ${expiresInMinutes} minutes`);
    console.log('='.repeat(80));

    // ========================================================================
    // RETURN SUCCESS RESPONSE
    // ========================================================================

    return {
      success: true,
      storyId: updatedStory.id,
      storyKey: story.key,
      approvedBy: updatedStory.approvedBy!,
      approvedAt: updatedStory.approvedAt!.toISOString(),
      approvalExpiresAt: updatedStory.approvalExpiresAt!.toISOString(),
      expiresInMinutes,
      approvalReason: params.approvalReason,
      message: `✅ Deployment approved for ${story.key} by ${updatedStory.approvedBy}. ` +
        `Approval valid for ${expiresInMinutes} minutes (expires at ${updatedStory.approvalExpiresAt!.toISOString()}).`,
    };

  } catch (error: any) {
    console.error('❌ DEPLOYMENT APPROVAL FAILED:', error.message);
    console.log('='.repeat(80));

    // Re-throw with proper error type
    if (error instanceof ValidationError || error instanceof NotFoundError) {
      throw error;
    }

    throw new Error(`Deployment approval failed: ${error.message}`);

  } finally {
    if (shouldDisconnect) {
      await client.$disconnect();
    }
  }
}

// ============================================================================
// Export
// ============================================================================

export default {
  tool,
  handler,
};
