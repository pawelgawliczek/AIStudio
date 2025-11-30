import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { RunnerController } from './runner.controller';
import { RunnerService } from './runner.service';
import { BreakpointService } from './breakpoint.service';
import { ApprovalService } from './approval.service';

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
