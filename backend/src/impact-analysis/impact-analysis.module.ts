import { Module } from '@nestjs/common';
import { ImpactAnalysisController } from './impact-analysis.controller';
import { ImpactAnalysisService } from './impact-analysis.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [ImpactAnalysisController],
  providers: [ImpactAnalysisService],
  exports: [ImpactAnalysisService],
})
export class ImpactAnalysisModule {}
