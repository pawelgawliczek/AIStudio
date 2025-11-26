import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { CoordinatorsController, ProjectManagersController } from './coordinators.controller';
import { CoordinatorsService } from './coordinators.service';

@Module({
  imports: [PrismaModule],
  controllers: [CoordinatorsController, ProjectManagersController],
  providers: [CoordinatorsService],
  exports: [CoordinatorsService],
})
export class CoordinatorsModule {}
