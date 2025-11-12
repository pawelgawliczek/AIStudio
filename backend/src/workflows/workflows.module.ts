import { Module } from '@nestjs/common';
import { WorkflowsController } from './workflows.controller';
import { WorkflowsService } from './workflows.service';
import { PrismaModule } from '../prisma/prisma.module';
import { ActivationService } from '../mcp/services/activation.service';

@Module({
  imports: [PrismaModule],
  controllers: [WorkflowsController],
  providers: [WorkflowsService, ActivationService],
  exports: [WorkflowsService, ActivationService],
})
export class WorkflowsModule {}
