import { Controller, Post, Body, UseGuards, HttpCode } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiExcludeEndpoint } from '@nestjs/swagger';
import { InternalApiGuard } from '../auth/guards/internal-api.guard';
import { AppWebSocketGateway } from '../websocket/websocket.gateway';
import { TranscriptTailService } from '../workflow-runs/transcript-tail.service';

/**
 * Internal Transcript Controller (ST-176)
 *
 * This controller handles transcript tailing requests from MCP handlers
 * running in separate stdio processes. MCP handlers call these HTTP endpoints
 * to start/stop transcript file watching.
 *
 * Security: Protected by InternalApiGuard which validates INTERNAL_API_SECRET
 */

interface StartTailingRequest {
  componentRunId: string;
  transcriptPath: string;
}

interface StopTailingRequest {
  componentRunId: string;
}

@ApiTags('internal')
@Controller('internal/transcript')
export class InternalTranscriptController {
  constructor(
    private readonly transcriptTailService: TranscriptTailService,
    private readonly wsGateway: AppWebSocketGateway,
  ) {}

  @Post('start-tailing')
  @UseGuards(InternalApiGuard)
  @HttpCode(200)
  @ApiExcludeEndpoint() // Hide from Swagger - internal use only
  @ApiOperation({ summary: 'Internal: Start transcript tailing (MCP handlers only)' })
  async startTailing(@Body() body: StartTailingRequest) {
    const { componentRunId, transcriptPath } = body;

    try {
      await this.transcriptTailService.startTailing(componentRunId, transcriptPath);
      return { success: true, componentRunId, transcriptPath };
    } catch (error: any) {
      console.error(`[ST-176] Failed to start tailing: ${error.message}`, error.stack);
      return { success: false, error: error.message };
    }
  }

  @Post('stop-tailing')
  @UseGuards(InternalApiGuard)
  @HttpCode(200)
  @ApiExcludeEndpoint() // Hide from Swagger - internal use only
  @ApiOperation({ summary: 'Internal: Stop transcript tailing (MCP handlers only)' })
  async stopTailing(@Body() body: StopTailingRequest) {
    const { componentRunId } = body;

    try {
      await this.transcriptTailService.stopTailing(componentRunId);

      // Emit transcript:complete event to WebSocket clients
      const server = this.wsGateway.getServer();
      const room = `transcript:${componentRunId}`;
      server.to(room).emit('transcript:complete', {
        componentRunId,
        timestamp: new Date(),
      });

      return { success: true, componentRunId };
    } catch (error: any) {
      console.error(`[ST-176] Failed to stop tailing: ${error.message}`, error.stack);
      return { success: false, error: error.message };
    }
  }
}
