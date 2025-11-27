import { Controller, Post, Body, UseGuards, HttpCode } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiExcludeEndpoint } from '@nestjs/swagger';
import { InternalApiGuard } from '../auth/guards/internal-api.guard';
import { AppWebSocketGateway } from '../websocket/websocket.gateway';

/**
 * Internal Broadcast Controller (ST-129)
 *
 * This controller handles broadcast requests from MCP handlers running in
 * separate stdio processes. Since MCP handlers cannot share memory with
 * the NestJS WebSocket gateway, they call this HTTP endpoint to trigger
 * WebSocket broadcasts.
 *
 * Security: Protected by InternalApiGuard which validates INTERNAL_API_SECRET
 */

interface BroadcastRequest {
  event: string;
  runId?: string;
  storyId?: string;
  projectId: string;
  data: Record<string, unknown>;
}

@ApiTags('internal')
@Controller('internal')
export class InternalBroadcastController {
  constructor(private readonly wsGateway: AppWebSocketGateway) {}

  @Post('broadcast')
  @UseGuards(InternalApiGuard)
  @HttpCode(200)
  @ApiExcludeEndpoint() // Hide from Swagger - internal use only
  @ApiOperation({ summary: 'Internal: Broadcast WebSocket event (MCP handlers only)' })
  broadcast(@Body() body: BroadcastRequest) {
    const { event, runId, storyId, projectId, data } = body;

    // Route to appropriate broadcast method based on event type
    switch (event) {
      case 'component:started':
        this.wsGateway.broadcastComponentStarted(runId!, projectId, {
          componentName: data.componentName as string,
          storyKey: data.storyKey as string,
          storyTitle: data.storyTitle as string,
          startedAt: data.startedAt as string,
        });
        break;

      case 'component:completed':
        this.wsGateway.broadcastComponentCompleted(runId!, projectId, {
          componentName: data.componentName as string,
          storyKey: data.storyKey as string,
          storyTitle: data.storyTitle as string,
          status: data.status as string,
          completedAt: data.completedAt as string,
        });
        break;

      case 'deployment:started':
        this.wsGateway.broadcastDeploymentStarted(storyId!, projectId, {
          storyKey: data.storyKey as string,
          environment: data.environment as string,
          startedAt: data.startedAt as string,
        });
        break;

      case 'deployment:completed':
        this.wsGateway.broadcastDeploymentCompleted(storyId!, projectId, {
          storyKey: data.storyKey as string,
          environment: data.environment as string,
          status: data.status as string,
          completedAt: data.completedAt as string,
        });
        break;

      default:
        console.warn(`[InternalBroadcast] Unknown event type: ${event}`);
        return { success: false, message: `Unknown event type: ${event}` };
    }

    return { success: true, event, projectId };
  }
}
