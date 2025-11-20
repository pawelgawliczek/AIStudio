import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { CoordinatorsController } from './coordinators.controller';
import { CoordinatorsService } from './coordinators.service';

@Module({
  imports: [PrismaModule],
  controllers: [CoordinatorsController],
  providers: [CoordinatorsService],
  exports: [CoordinatorsService],
})
export class CoordinatorsModule {}
