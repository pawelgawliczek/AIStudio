import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from '../prisma/prisma.module';
import { RemoteAgentGateway } from './remote-agent.gateway';
import { RemoteExecutionService } from './remote-execution.service';
import { RemoteAgentController } from './remote-agent.controller';
import { StreamEventService } from './stream-event.service';
import { OrphanDetectorService } from './orphan-detector.service';

/**
 * ST-133: Remote Agent Module
 * ST-150: Claude Code Agent Execution
 *
 * Provides remote script and Claude Code agent execution via WebSocket-connected agents.
 * Used for executing transcript parsing scripts and dispatching Claude Code agents
 * on the host machine (laptop) where Claude Code runs.
 *
 * Features:
 * - WebSocket gateway for remote agent communication
 * - Script execution service
 * - Claude Code agent execution service
 * - Stream event storage for observability
 * - Orphan job detection (stale jobs, expired grace periods)
 */
@Module({
  imports: [
    PrismaModule,
    ScheduleModule.forRoot(), // Required for @Cron decorators
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'development-secret-change-in-production',
      signOptions: { expiresIn: '30d' }, // Long-lived for remote agents
    }),
  ],
  controllers: [RemoteAgentController],
  providers: [
    RemoteAgentGateway,
    RemoteExecutionService,
    StreamEventService,
    OrphanDetectorService,
  ],
  exports: [
    RemoteExecutionService,
    RemoteAgentGateway,
    StreamEventService,
    OrphanDetectorService,
  ],
})
export class RemoteAgentModule {}
