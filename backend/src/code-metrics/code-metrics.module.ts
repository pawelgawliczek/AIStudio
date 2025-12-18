import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { WorkersModule } from '../workers/workers.module';
import { CodeMetricsController } from './code-metrics.controller';
import { CodeMetricsService } from './code-metrics.service';
import { MetricsService } from './services/metrics.service';
import { FileDetailService } from './services/file-detail.service';
import { AnalysisService } from './services/analysis.service';
import { TestCoverageService } from './services/test-coverage.service';

@Module({
  imports: [PrismaModule, WorkersModule],
  controllers: [CodeMetricsController],
  providers: [
    CodeMetricsService,
    MetricsService,
    FileDetailService,
    AnalysisService,
    TestCoverageService,
  ],
  exports: [CodeMetricsService],
})
export class CodeMetricsModule {}
