import { Module } from '@nestjs/common';
import { CodeMetricsController } from './code-metrics.controller';
import { CodeMetricsService } from './code-metrics.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [CodeMetricsController],
  providers: [CodeMetricsService],
  exports: [CodeMetricsService],
})
export class CodeMetricsModule {}
