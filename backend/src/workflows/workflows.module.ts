import { Module } from '@nestjs/common';
import { ActivationService } from '../mcp/services/activation.service';
import { PrismaModule } from '../prisma/prisma.module';
import { WorkflowsController } from './workflows.controller';
import { WorkflowsService } from './workflows.service';
import { TemplateParserService } from './template-parser.service';

@Module({
  imports: [PrismaModule],
  controllers: [WorkflowsController],
  providers: [WorkflowsService, ActivationService, TemplateParserService],
  exports: [WorkflowsService, ActivationService, TemplateParserService],
})
export class WorkflowsModule {}
