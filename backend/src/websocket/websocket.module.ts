import { Module, forwardRef } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PrismaModule } from '../prisma/prisma.module';
import { RemoteAgentModule } from '../remote-agent/remote-agent.module';
import { TelemetryModule } from '../telemetry/telemetry.module';
import { DeploymentLockService } from '../services/deployment-lock.service';
import { OrphanDeploymentDetectorService } from '../workers/orphan-deployment-detector.service';
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
  providers: [
    AppWebSocketGateway,
    DeploymentLockService, // ST-268: For orphan detector
    OrphanDeploymentDetectorService, // ST-268: Orphan deployment cleanup
  ],
  exports: [AppWebSocketGateway],
})
export class WebSocketModule {}
