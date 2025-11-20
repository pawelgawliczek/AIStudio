import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { WebSocketModule } from '../websocket/websocket.module';
import { EpicsController } from './epics.controller';
import { EpicsService } from './epics.service';

@Module({
  imports: [PrismaModule, WebSocketModule],
  controllers: [EpicsController],
  providers: [EpicsService],
  exports: [EpicsService],
})
export class EpicsModule {}
