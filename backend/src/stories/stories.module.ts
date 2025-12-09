import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { RunnerModule } from '../runner/runner.module';
import { WebSocketModule } from '../websocket/websocket.module';
import { StoriesController } from './stories.controller';
import { StoriesService } from './stories.service';

@Module({
  imports: [PrismaModule, WebSocketModule, RunnerModule],
  controllers: [StoriesController],
  providers: [StoriesService],
  exports: [StoriesService],
})
export class StoriesModule {}
