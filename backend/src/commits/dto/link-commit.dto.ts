import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsString, IsOptional, IsDateString, IsArray, ValidateNested, IsInt, Min } from 'class-validator';

export class CommitFileDto {
  @ApiProperty({ description: 'File path relative to repository root' })
  @IsString()
  filePath: string;

  @ApiProperty({ description: 'Lines of code added' })
  @IsInt()
  @Min(0)
  locAdded: number;

  @ApiProperty({ description: 'Lines of code deleted' })
  @IsInt()
  @Min(0)
  locDeleted: number;

  @ApiPropertyOptional({ description: 'Complexity before change' })
  @IsOptional()
  @IsInt()
  @Min(0)
  complexityBefore?: number;

  @ApiPropertyOptional({ description: 'Complexity after change' })
  @IsOptional()
  @IsInt()
  @Min(0)
  complexityAfter?: number;

  @ApiPropertyOptional({ description: 'Coverage before change' })
  @IsOptional()
  coverageBefore?: number;

  @ApiPropertyOptional({ description: 'Coverage after change' })
  @IsOptional()
  coverageAfter?: number;
}

export class LinkCommitDto {
  @ApiProperty({ description: 'Git commit hash (SHA-1)' })
  @IsString()
  hash: string;

  @ApiProperty({ description: 'Project ID' })
  @IsString()
  projectId: string;

  @ApiProperty({ description: 'Commit author name/email' })
  @IsString()
  author: string;

  @ApiProperty({ description: 'Commit timestamp' })
  @IsDateString()
  timestamp: string;

  @ApiProperty({ description: 'Commit message' })
  @IsString()
  message: string;

  @ApiPropertyOptional({ description: 'Story ID to link to' })
  @IsOptional()
  @IsString()
  storyId?: string;

  @ApiPropertyOptional({ description: 'Epic ID to link to' })
  @IsOptional()
  @IsString()
  epicId?: string;

  @ApiPropertyOptional({ description: 'List of files changed in commit', type: [CommitFileDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CommitFileDto)
  files?: CommitFileDto[];
}
