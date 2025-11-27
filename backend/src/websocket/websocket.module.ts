import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AppWebSocketGateway } from './websocket.gateway';

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'development-secret-change-in-production',
      signOptions: { expiresIn: '24h' },
    }),
  ],
  providers: [AppWebSocketGateway],
  exports: [AppWebSocketGateway],
})
export class WebSocketModule {}
