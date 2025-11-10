import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CommitFileResponseDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  commitHash: string;

  @ApiProperty()
  filePath: string;

  @ApiProperty()
  locAdded: number;

  @ApiProperty()
  locDeleted: number;

  @ApiPropertyOptional()
  complexityBefore?: number;

  @ApiPropertyOptional()
  complexityAfter?: number;

  @ApiPropertyOptional()
  coverageBefore?: number;

  @ApiPropertyOptional()
  coverageAfter?: number;
}

export class CommitResponseDto {
  @ApiProperty()
  hash: string;

  @ApiProperty()
  projectId: string;

  @ApiProperty()
  author: string;

  @ApiProperty()
  timestamp: Date;

  @ApiProperty()
  message: string;

  @ApiPropertyOptional()
  storyId?: string;

  @ApiPropertyOptional()
  epicId?: string;

  @ApiPropertyOptional({ type: [CommitFileResponseDto] })
  files?: CommitFileResponseDto[];

  @ApiPropertyOptional()
  project?: any;

  @ApiPropertyOptional()
  story?: any;

  @ApiPropertyOptional()
  epic?: any;
}
