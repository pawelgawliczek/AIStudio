import { Module} from '@nestjs/common';
import { WorkflowRunsController } from './workflow-runs.controller';
import { WorkflowRunsService } from './workflow-runs.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [WorkflowRunsController],
  providers: [WorkflowRunsService],
  exports: [WorkflowRunsService],
})
export class WorkflowRunsModule {}
