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
import { RunsModule } from './runs/runs.module';
import { CommitsModule } from './commits/commits.module';
import { CodeMetricsModule } from './code-metrics/code-metrics.module';
import { AgentMetricsModule } from './agent-metrics/agent-metrics.module';
import { TestCasesModule } from './test-cases/test-cases.module';
import { TestExecutionsModule } from './test-executions/test-executions.module';
import { LayersModule } from './layers/layers.module';
import { ComponentsModule } from './components/components.module';
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
    RunsModule,
    CommitsModule,
    CodeMetricsModule,
    AgentMetricsModule,
    TestCasesModule,
    TestExecutionsModule,
    LayersModule,
    ComponentsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
