import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AgentMetricsController } from './agent-metrics.controller';
import { AgentMetricsService } from './agent-metrics.service';

@Module({
  imports: [PrismaModule],
  controllers: [AgentMetricsController],
  providers: [AgentMetricsService],
  exports: [AgentMetricsService],
})
export class AgentMetricsModule {}
