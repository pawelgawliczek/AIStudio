import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { WebSocketModule } from '../websocket/websocket.module';
import { WorkflowRunsModule } from '../workflow-runs/workflow-runs.module';
import { InternalBroadcastController } from './internal-broadcast.controller';
import { InternalTranscriptController } from './internal-transcript.controller';

/**
 * Internal Module (ST-129, ST-176)
 *
 * Provides internal API endpoints for cross-process communication.
 * These endpoints are called by MCP handlers running in separate stdio processes.
 */
@Module({
  imports: [ConfigModule, WebSocketModule, WorkflowRunsModule],
  controllers: [InternalBroadcastController, InternalTranscriptController],
})
export class InternalModule {}
