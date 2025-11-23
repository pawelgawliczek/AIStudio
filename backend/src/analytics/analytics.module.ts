import { Module } from '@nestjs/common';
import { AnalyticsController } from '../controllers/analytics.controller';
import { AnalyticsService } from '../services/analytics.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [AnalyticsController],
  providers: [AnalyticsService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
