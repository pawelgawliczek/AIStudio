import { PartialType } from '@nestjs/swagger';
import { CreateWorkflowRunDto } from './create-workflow-run.dto';

export class UpdateWorkflowRunDto extends PartialType(CreateWorkflowRunDto) {}
