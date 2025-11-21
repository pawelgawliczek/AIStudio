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
import { HealthController } from './health.controller';
import { ImpactAnalysisModule } from './impact-analysis/impact-analysis.module';
import { MetricsModule } from './metrics/metrics.module';
import { PrismaModule } from './prisma/prisma.module';
import { ProjectsModule } from './projects/projects.module';
import { RunsModule } from './runs/runs.module';
import { StoriesModule } from './stories/stories.module';
import { SubtasksModule } from './subtasks/subtasks.module';
import { TestCasesModule } from './test-cases/test-cases.module';
import { TestExecutionsModule } from './test-executions/test-executions.module';
import { UseCasesModule } from './use-cases/use-cases.module';
import { UsersModule } from './users/users.module';
import { WebSocketModule } from './websocket/websocket.module';
import { WorkersModule } from './workers/workers.module';
import { QueueProcessorModule } from './workers/queue-processor.module';
import { DiskMonitorModule } from './workers/disk-monitor.module';
// import { LayersModule } from './layers/layers.module'; // Removed - layers deprecated
// import { ComponentsModule } from './components/components.module'; // Removed - old components deprecated
import { WorkflowRunsModule } from './workflow-runs/workflow-runs.module';
import { WorkflowsModule } from './workflows/workflows.module';
import { VersioningModule } from './services/versioning.module';

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
    QueueProcessorModule, // Queue processor background worker
    DiskMonitorModule, // Disk space monitoring and alerting (ST-54)
    // LayersModule, // Removed - layers deprecated
    // ComponentsModule, // Removed - old components deprecated
    ComponentsModule, // New Generic Component pattern
    CoordinatorsModule,
    WorkflowsModule,
    WorkflowRunsModule,
    MetricsModule,
    ImpactAnalysisModule,
    DocsModule,
    VersioningModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
