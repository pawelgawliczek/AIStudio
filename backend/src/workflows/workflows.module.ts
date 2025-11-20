import { Module } from '@nestjs/common';
import { ActivationService } from '../mcp/services/activation.service';
import { PrismaModule } from '../prisma/prisma.module';
import { WorkflowsController } from './workflows.controller';
import { WorkflowsService } from './workflows.service';

@Module({
  imports: [PrismaModule],
  controllers: [WorkflowsController],
  providers: [WorkflowsService, ActivationService],
  exports: [WorkflowsService, ActivationService],
})
export class WorkflowsModule {}
