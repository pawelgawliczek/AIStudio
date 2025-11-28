import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PrismaModule } from '../prisma/prisma.module';
import { RemoteAgentGateway } from './remote-agent.gateway';
import { RemoteExecutionService } from './remote-execution.service';
import { RemoteAgentController } from './remote-agent.controller';

/**
 * ST-133: Remote Agent Module
 *
 * Provides remote script execution via WebSocket-connected agents.
 * Used for executing transcript parsing and analysis scripts on the host machine
 * where Claude Code runs (has access to transcript files).
 */
@Module({
  imports: [
    PrismaModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'development-secret-change-in-production',
      signOptions: { expiresIn: '30d' }, // Long-lived for remote agents
    }),
  ],
  controllers: [RemoteAgentController],
  providers: [RemoteAgentGateway, RemoteExecutionService],
  exports: [RemoteExecutionService, RemoteAgentGateway],
})
export class RemoteAgentModule {}
