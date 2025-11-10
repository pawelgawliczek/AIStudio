import { Module } from '@nestjs/common';
import { SubtasksController } from './subtasks.controller';
import { SubtasksService } from './subtasks.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [SubtasksController],
  providers: [SubtasksService],
  exports: [SubtasksService],
})
export class SubtasksModule {}
