import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AgentMetricsController } from './agent-metrics.controller';
import { AgentMetricsService } from './agent-metrics.service';
import { ComprehensiveMetricsCalculator } from './calculators/comprehensive-metrics.calculator';
import { MetricsAggregationService } from './services/metrics-aggregation.service';
import { FrameworkMetricsService } from './services/framework-metrics.service';
import { WorkflowMetricsService } from './services/workflow-metrics.service';
import { DashboardMetricsService } from './services/dashboard-metrics.service';
import { StoryMetricsService } from './services/story-metrics.service';

@Module({
  imports: [PrismaModule],
  controllers: [AgentMetricsController],
  providers: [
    AgentMetricsService,
    ComprehensiveMetricsCalculator,
    MetricsAggregationService,
    FrameworkMetricsService,
    WorkflowMetricsService,
    DashboardMetricsService,
    StoryMetricsService,
  ],
  exports: [AgentMetricsService],
})
export class AgentMetricsModule {}
