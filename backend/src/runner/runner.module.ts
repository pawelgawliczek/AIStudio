import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { RunnerController } from './runner.controller';
import { RunnerService } from './runner.service';

/**
 * Runner Module
 * Provides REST API endpoints for Story Runner communication:
 * - Checkpoint save/load/delete
 * - Runner status reporting
 * - Team context retrieval
 */
@Module({
  imports: [PrismaModule],
  controllers: [RunnerController],
  providers: [RunnerService],
  exports: [RunnerService],
})
export class RunnerModule {}
