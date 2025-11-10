import { ApiProperty } from '@nestjs/swagger';
import { StoryStatus } from '@prisma/client';
import { IsEnum, IsNotEmpty } from 'class-validator';

export class UpdateStoryStatusDto {
  @ApiProperty({ enum: StoryStatus, description: 'New story status' })
  @IsEnum(StoryStatus)
  @IsNotEmpty()
  status: StoryStatus;
}
