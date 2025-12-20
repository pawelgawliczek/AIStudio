import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AgentMetricsModule } from './agent-metrics/agent-metrics.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { AuthModule } from './auth/auth.module';
import { BackupsModule } from './backups/backups.module';
import { CodeMetricsModule } from './code-metrics/code-metrics.module';
import { CommitsModule } from './commits/commits.module';
import { ComponentsModule } from './components/components.module'; // New Generic Component pattern
import { CoordinatorsModule } from './coordinators/coordinators.module';
import { DatabaseMetricsModule } from './database-metrics/database-metrics.module';
import { DocsModule } from './docs/docs.module';
import { EpicsModule } from './epics/epics.module';
import { HealthController } from './health.controller';
import { ImpactAnalysisModule } from './impact-analysis/impact-analysis.module';
import { InternalModule } from './internal/internal.module';
import { McpHttpModule } from './mcp-http/mcp-http.module';
import { MetricsModule } from './metrics/metrics.module';
import { PrismaModule } from './prisma/prisma.module';
import { ProjectsModule } from './projects/projects.module';
import { RemoteAgentModule } from './remote-agent/remote-agent.module';
import { RunnerModule } from './runner/runner.module';
import { RunsModule } from './runs/runs.module';
import { VersioningModule } from './services/versioning.module';
import { StoriesModule } from './stories/stories.module';
import { SubtasksModule } from './subtasks/subtasks.module';
import { TelemetryModule } from './telemetry/telemetry.module';
import { TestCasesModule } from './test-cases/test-cases.module';
import { TestExecutionModule } from './test-execution/test-execution.module';
import { TestExecutionsModule } from './test-executions/test-executions.module';
import { TranscriptCleanupModule } from './transcripts/transcript-cleanup.module';
import { UseCasesModule } from './use-cases/use-cases.module';
import { UsersModule } from './users/users.module';
import { WebSocketModule } from './websocket/websocket.module';
import { DiskMonitorModule } from './workers/disk-monitor.module';
import { QueueProcessorModule } from './workers/queue-processor.module';
import { WorkersModule } from './workers/workers.module';
// import { LayersModule } from './layers/layers.module'; // Removed - layers deprecated
// import { ComponentsModule } from './components/components.module'; // Removed - old components deprecated
import { WorkflowRunsModule } from './workflow-runs/workflow-runs.module';
import { WorkflowsModule } from './workflows/workflows.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    PrismaModule,
    TelemetryModule, // ST-257: Distributed tracing infrastructure
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
    TestExecutionModule, // ST-128: Test execution reporting with WebSocket
    WorkersModule,
    QueueProcessorModule, // Queue processor background worker
    DiskMonitorModule, // Disk space monitoring and alerting (ST-54)
    TranscriptCleanupModule, // Transcript line retention management (ST-348)
    BackupsModule, // Backup management API (ST-130)
    InternalModule, // Internal API for MCP handlers (ST-129)
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
    AnalyticsModule,
    RemoteAgentModule, // ST-133: Remote execution agent
    RunnerModule, // ST-145: Story Runner REST API endpoints
    McpHttpModule, // ST-163: MCP HTTP Transport
    DatabaseMetricsModule, // ST-280: PostgreSQL connection pool monitoring
  ],
  controllers: [HealthController],
})
export class AppModule {}
