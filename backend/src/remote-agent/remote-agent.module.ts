import { Module, OnModuleInit, forwardRef } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ScheduleModule } from '@nestjs/schedule';
import { setRemoteExecutionService } from '../mcp/servers/git/git_utils';
import { PrismaModule } from '../prisma/prisma.module';
import { TelemetryModule } from '../telemetry/telemetry.module';
import { WebSocketModule } from '../websocket/websocket.module';
import { ClaudeCodeHandler } from './handlers/claude-code.handler';
import { GitJobHandler } from './handlers/git-job.handler';
import { TranscriptHandler } from './handlers/transcript.handler';
import { OrphanDetectorService } from './orphan-detector.service';
import { RemoteAgentController } from './remote-agent.controller';
import { RemoteAgentGateway } from './remote-agent.gateway';
import { RemoteExecutionService } from './remote-execution.service';
import { StreamEventService } from './stream-event.service';
import { TranscriptRegistrationService } from './transcript-registration.service';

/**
 * ST-133: Remote Agent Module
 * ST-150: Claude Code Agent Execution
 * ST-258: Distributed Tracing Phase 4
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
 * - Distributed tracing for agent lifecycle events
 */
@Module({
  imports: [
    PrismaModule,
    TelemetryModule, // ST-258: Add telemetry support
    ScheduleModule.forRoot(), // Required for @Cron decorators
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'development-secret-change-in-production',
      signOptions: { expiresIn: '30d' }, // Long-lived for remote agents
    }),
    // ST-182: Import WebSocketModule with forwardRef for transcript relay
    forwardRef(() => WebSocketModule),
  ],
  controllers: [RemoteAgentController],
  providers: [
    RemoteAgentGateway,
    RemoteExecutionService,
    StreamEventService,
    OrphanDetectorService,
    TranscriptRegistrationService,
    ClaudeCodeHandler,
    GitJobHandler,
    TranscriptHandler,
  ],
  exports: [
    RemoteExecutionService,
    RemoteAgentGateway,
    StreamEventService,
    OrphanDetectorService,
    TranscriptRegistrationService,
  ],
})
export class RemoteAgentModule implements OnModuleInit {
  constructor(private readonly remoteExecutionService: RemoteExecutionService) {}

  /**
   * ST-153: Wire up RemoteExecutionService to git_utils for location-aware git execution
   */
  onModuleInit() {
    setRemoteExecutionService(this.remoteExecutionService);
  }
}
