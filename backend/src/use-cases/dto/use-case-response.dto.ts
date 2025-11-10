import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UseCaseVersionResponse {
  @ApiProperty()
  id: string;

  @ApiProperty()
  version: number;

  @ApiPropertyOptional()
  summary?: string;

  @ApiProperty()
  content: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  createdBy: {
    id: string;
    name: string;
    email: string;
  };

  @ApiPropertyOptional()
  linkedStoryId?: string;

  @ApiPropertyOptional()
  linkedDefectId?: string;
}

export class UseCaseResponse {
  @ApiProperty()
  id: string;

  @ApiProperty()
  projectId: string;

  @ApiProperty()
  key: string;

  @ApiProperty()
  title: string;

  @ApiPropertyOptional()
  area?: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiPropertyOptional({
    description: 'Latest version of the use case',
  })
  latestVersion?: UseCaseVersionResponse;

  @ApiPropertyOptional({
    description: 'All versions of the use case',
    type: [UseCaseVersionResponse],
  })
  versions?: UseCaseVersionResponse[];

  @ApiPropertyOptional({
    description: 'Linked stories',
    type: 'array',
  })
  storyLinks?: {
    storyId: string;
    relation: string;
    story: {
      id: string;
      key: string;
      title: string;
      status: string;
    };
  }[];

  @ApiPropertyOptional({
    description: 'Similarity score (for semantic search)',
  })
  similarity?: number;
}
