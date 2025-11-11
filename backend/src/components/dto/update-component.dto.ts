import { PartialType } from '@nestjs/swagger';
import { CreateComponentDto } from './create-component.dto';
import { OmitType } from '@nestjs/swagger';

export class UpdateComponentDto extends PartialType(
  OmitType(CreateComponentDto, ['projectId'] as const)
) {}
