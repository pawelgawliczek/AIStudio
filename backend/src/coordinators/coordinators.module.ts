import { Module } from '@nestjs/common';
import { CoordinatorsController } from './coordinators.controller';
import { CoordinatorsService } from './coordinators.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [CoordinatorsController],
  providers: [CoordinatorsService],
  exports: [CoordinatorsService],
})
export class CoordinatorsModule {}
