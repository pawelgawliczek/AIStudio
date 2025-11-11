import { Module } from '@nestjs/common';
import { CodeMetricsController } from './code-metrics.controller';
import { CodeMetricsService } from './code-metrics.service';
import { PrismaModule } from '../prisma/prisma.module';
import { WorkersModule } from '../workers/workers.module';

@Module({
  imports: [PrismaModule, WorkersModule],
  controllers: [CodeMetricsController],
  providers: [CodeMetricsService],
  exports: [CodeMetricsService],
})
export class CodeMetricsModule {}
