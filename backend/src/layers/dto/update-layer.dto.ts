import { PartialType } from '@nestjs/swagger';
import { CreateLayerDto } from './create-layer.dto';
import { OmitType } from '@nestjs/swagger';

export class UpdateLayerDto extends PartialType(
  OmitType(CreateLayerDto, ['projectId'] as const)
) {}
