import { Module} from '@nestjs/common';
import { WorkflowStateService } from '../execution/workflow-state.service';
import { PrismaModule } from '../prisma/prisma.module';
import { WebSocketModule } from '../websocket/websocket.module';
import { TranscriptsService } from './transcripts.service';
import { TranscriptTailService } from './transcript-tail.service';
import { WorkflowRunsController } from './workflow-runs.controller';
import { WorkflowRunsService } from './workflow-runs.service';

@Module({
  imports: [PrismaModule, WebSocketModule],
  controllers: [WorkflowRunsController],
  providers: [WorkflowRunsService, WorkflowStateService, TranscriptsService, TranscriptTailService],
  exports: [WorkflowRunsService, TranscriptsService, TranscriptTailService],
})
export class WorkflowRunsModule {}
