import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { InternalBroadcastController } from './internal-broadcast.controller';
import { WebSocketModule } from '../websocket/websocket.module';

/**
 * Internal Module (ST-129)
 *
 * Provides internal API endpoints for cross-process communication.
 * These endpoints are called by MCP handlers running in separate stdio processes.
 */
@Module({
  imports: [ConfigModule, WebSocketModule],
  controllers: [InternalBroadcastController],
})
export class InternalModule {}
