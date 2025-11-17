import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AgentMetricsModule } from './agent-metrics/agent-metrics.module';
import { AuthModule } from './auth/auth.module';
import { CodeMetricsModule } from './code-metrics/code-metrics.module';
import { CommitsModule } from './commits/commits.module';
import { ComponentsModule } from './components/components.module'; // New Generic Component pattern
import { CoordinatorsModule } from './coordinators/coordinators.module';
import { DocsModule } from './docs/docs.module';
import { EpicsModule } from './epics/epics.module';
import { ImpactAnalysisModule } from './impact-analysis/impact-analysis.module';
import { MetricsModule } from './metrics/metrics.module';
import { PrismaModule } from './prisma/prisma.module';
import { ProjectsModule } from './projects/projects.module';
import { StoriesModule } from './stories/stories.module';
import { UsersModule } from './users/users.module';
import { SubtasksModule } from './subtasks/subtasks.module';
import { WebSocketModule } from './websocket/websocket.module';
import { UseCasesModule } from './use-cases/use-cases.module';
import { RunsModule } from './runs/runs.module';
import { TestCasesModule } from './test-cases/test-cases.module';
import { TestExecutionsModule } from './test-executions/test-executions.module';
import { WorkersModule } from './workers/workers.module';
// import { LayersModule } from './layers/layers.module'; // Removed - layers deprecated
// import { ComponentsModule } from './components/components.module'; // Removed - old components deprecated
import { WorkflowRunsModule } from './workflow-runs/workflow-runs.module';
import { WorkflowsModule } from './workflows/workflows.module';
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
    WorkersModule,
    // LayersModule, // Removed - layers deprecated
    // ComponentsModule, // Removed - old components deprecated
    ComponentsModule, // New Generic Component pattern
    CoordinatorsModule,
    WorkflowsModule,
    WorkflowRunsModule,
    MetricsModule,
    ImpactAnalysisModule,
    DocsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
