import { Module, forwardRef } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PrismaModule } from '../prisma/prisma.module';
import { TelemetryModule } from '../telemetry/telemetry.module';
import { RemoteAgentModule } from '../remote-agent/remote-agent.module';
import { AppWebSocketGateway } from './websocket.gateway';

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'development-secret-change-in-production',
      signOptions: { expiresIn: '24h' },
    }),
    PrismaModule,
    TelemetryModule, // ST-258: Add telemetry support
    // ST-182: Import RemoteAgentModule for cross-gateway communication
    forwardRef(() => RemoteAgentModule),
  ],
  providers: [AppWebSocketGateway],
  exports: [AppWebSocketGateway],
})
export class WebSocketModule {}
