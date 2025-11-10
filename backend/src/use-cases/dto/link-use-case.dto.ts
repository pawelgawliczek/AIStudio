import { IsUUID, IsEnum, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { UseCaseRelation } from '@prisma/client';

export class LinkUseCaseToStoryDto {
  @ApiProperty({
    description: 'Use case ID to link',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID()
  @IsNotEmpty()
  useCaseId: string;

  @ApiProperty({
    description: 'Story ID to link to',
    example: '123e4567-e89b-12d3-a456-426614174001',
  })
  @IsUUID()
  @IsNotEmpty()
  storyId: string;

  @ApiProperty({
    description: 'Relationship type',
    enum: UseCaseRelation,
    example: 'implements',
  })
  @IsEnum(UseCaseRelation)
  @IsNotEmpty()
  relation: UseCaseRelation;
}
