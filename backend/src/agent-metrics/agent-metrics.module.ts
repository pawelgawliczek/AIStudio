import { Module } from '@nestjs/common';
import { AgentMetricsService } from './agent-metrics.service';
import { AgentMetricsController } from './agent-metrics.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [AgentMetricsController],
  providers: [AgentMetricsService],
  exports: [AgentMetricsService],
})
export class AgentMetricsModule {}
