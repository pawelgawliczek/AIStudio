import { Module } from '@nestjs/common';
import { AnalyticsController } from '../controllers/analytics.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AnalyticsService } from '../services/analytics.service';

@Module({
  imports: [PrismaModule],
  controllers: [AnalyticsController],
  providers: [AnalyticsService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
