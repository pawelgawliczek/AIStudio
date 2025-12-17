import { Module } from '@nestjs/common';
import { DatabaseMetricsController } from './database-metrics.controller';
import { DatabaseMetricsService } from './database-metrics.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [DatabaseMetricsController],
  providers: [DatabaseMetricsService],
})
export class DatabaseMetricsModule {}
