import { Module} from '@nestjs/common';
import { WorkflowRunsController } from './workflow-runs.controller';
import { WorkflowRunsService } from './workflow-runs.service';
import { PrismaModule } from '../prisma/prisma.module';
import { WorkflowStateService } from '../execution/workflow-state.service';

@Module({
  imports: [PrismaModule],
  controllers: [WorkflowRunsController],
  providers: [WorkflowRunsService, WorkflowStateService],
  exports: [WorkflowRunsService],
})
export class WorkflowRunsModule {}
