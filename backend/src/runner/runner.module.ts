import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ApprovalService } from './approval.service';
import { BreakpointService } from './breakpoint.service';
import { RunnerController } from './runner.controller';
import { RunnerService } from './runner.service';

/**
 * Runner Module
 * Provides REST API endpoints for Story Runner communication:
 * - Checkpoint save/load/delete
 * - Runner status reporting
 * - Team context retrieval
 * - Breakpoint management (ST-146)
 * - Approval gates (ST-148)
 */
@Module({
  imports: [PrismaModule],
  controllers: [RunnerController],
  providers: [RunnerService, BreakpointService, ApprovalService],
  exports: [RunnerService, BreakpointService, ApprovalService],
})
export class RunnerModule {}
