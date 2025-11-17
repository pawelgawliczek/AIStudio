import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { WorkersModule } from '../workers/workers.module';
import { CommitsController } from './commits.controller';
import { CommitsService } from './commits.service';

@Module({
  imports: [PrismaModule, WorkersModule],
  controllers: [CommitsController],
  providers: [CommitsService],
  exports: [CommitsService],
})
export class CommitsModule {}
