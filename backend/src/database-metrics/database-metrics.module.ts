import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { DatabaseMetricsController } from './database-metrics.controller';
import { DatabaseMetricsService } from './database-metrics.service';

@Module({
  imports: [PrismaModule],
  controllers: [DatabaseMetricsController],
  providers: [DatabaseMetricsService],
})
export class DatabaseMetricsModule {}
