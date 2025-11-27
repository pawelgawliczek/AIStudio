import { Controller, Get, Post, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { QueueProcessorService } from './workers/queue-processor.service';
import { AppWebSocketGateway } from './websocket/websocket.gateway';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly queueProcessor: QueueProcessorService,
    private readonly wsGateway: AppWebSocketGateway,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Health check endpoint' })
  check() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'aistudio-backend',
    };
  }

  @Get('queue-processor')
  @ApiOperation({ summary: 'Queue processor health check' })
  async queueProcessorHealth() {
    return this.queueProcessor.getHealthStatus();
  }

  @Post('test-notification')
  @ApiOperation({ summary: 'Test WebSocket notification (development only)' })
  @ApiQuery({ name: 'type', required: false, description: 'Notification type: deployment, review, workflow' })
  @ApiQuery({ name: 'storyKey', required: false, description: 'Story key for the notification' })
  @ApiQuery({ name: 'global', required: false, description: 'Broadcast globally to all clients (default: true)' })
  testNotification(
    @Query('type') type: string = 'deployment',
    @Query('storyKey') storyKey: string = 'ST-TEST',
    @Query('global') globalBroadcast: string = 'true',
  ) {
    const projectId = '345a29ee-d6ab-477d-8079-c5dda0844d77'; // AI Studio project
    const storyId = '00000000-0000-0000-0000-000000000000'; // Fake story ID

    // For testing: broadcast globally to all connected clients
    const broadcastGlobally = globalBroadcast === 'true';
    const server = this.wsGateway.getServer();

    switch (type) {
      case 'deployment':
        if (broadcastGlobally && server) {
          server.emit('deployment:completed', {
            storyKey,
            environment: 'production',
            status: 'success',
            completedAt: new Date().toISOString(),
          });
        } else {
          this.wsGateway.broadcastDeploymentCompleted(storyId, projectId, {
            storyKey,
            environment: 'production',
            status: 'success',
            completedAt: new Date().toISOString(),
          });
        }
        break;
      case 'review':
        if (broadcastGlobally && server) {
          server.emit('review:ready', {
            storyKey,
            readyAt: new Date().toISOString(),
          });
        } else {
          this.wsGateway.broadcastReviewReady(storyId, projectId, {
            storyKey,
            readyAt: new Date().toISOString(),
          });
        }
        break;
      case 'workflow':
        if (broadcastGlobally && server) {
          server.emit('workflow:status', {
            storyKey,
            storyTitle: 'Test Notification Story',
            status: 'completed',
          });
        } else {
          this.wsGateway.broadcastWorkflowStatusUpdated('test-run-id', projectId, {
            storyKey,
            storyTitle: 'Test Notification Story',
            status: 'completed',
          });
        }
        break;
      default:
        return { success: false, message: 'Unknown notification type' };
    }

    return {
      success: true,
      message: `Test ${type} notification broadcast ${broadcastGlobally ? 'globally' : 'to project room'} via WebSocket`,
      storyKey,
    };
  }
}
