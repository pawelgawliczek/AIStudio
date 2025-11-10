import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { ProjectsModule } from './projects/projects.module';
import { UsersModule } from './users/users.module';
import { StoriesModule } from './stories/stories.module';
import { EpicsModule } from './epics/epics.module';
import { SubtasksModule } from './subtasks/subtasks.module';
import { WebSocketModule } from './websocket/websocket.module';
import { UseCasesModule } from './use-cases/use-cases.module';
import { HealthController } from './health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    PrismaModule,
    AuthModule,
    ProjectsModule,
    UsersModule,
    StoriesModule,
    EpicsModule,
    SubtasksModule,
    WebSocketModule,
    UseCasesModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
