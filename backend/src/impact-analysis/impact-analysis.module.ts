import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ImpactAnalysisController } from './impact-analysis.controller';
import { ImpactAnalysisService } from './impact-analysis.service';

@Module({
  imports: [PrismaModule],
  controllers: [ImpactAnalysisController],
  providers: [ImpactAnalysisService],
  exports: [ImpactAnalysisService],
})
export class ImpactAnalysisModule {}
