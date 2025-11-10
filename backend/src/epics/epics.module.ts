import { Module } from '@nestjs/common';
import { EpicsController } from './epics.controller';
import { EpicsService } from './epics.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [EpicsController],
  providers: [EpicsService],
  exports: [EpicsService],
})
export class EpicsModule {}
