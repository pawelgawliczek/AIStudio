import { Module } from '@nestjs/common';
import { ActivationService } from '../mcp/services/activation.service';
import { PrismaModule } from '../prisma/prisma.module';
import { TemplateParserService } from './template-parser.service';
import { WorkflowsController, TeamsController } from './workflows.controller';
import { WorkflowsService } from './workflows.service';

@Module({
  imports: [PrismaModule],
  controllers: [WorkflowsController, TeamsController], // Both old and new routes
  providers: [WorkflowsService, ActivationService, TemplateParserService],
  exports: [WorkflowsService, ActivationService, TemplateParserService],
})
export class WorkflowsModule {}
