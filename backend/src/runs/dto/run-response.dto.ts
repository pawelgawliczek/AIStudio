import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RunResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  projectId: string;

  @ApiPropertyOptional()
  storyId?: string;

  @ApiPropertyOptional()
  subtaskId?: string;

  @ApiPropertyOptional()
  agentId?: string;

  @ApiPropertyOptional()
  frameworkId?: string;

  @ApiProperty()
  origin: string;

  @ApiProperty()
  tokensInput: number;

  @ApiProperty()
  tokensOutput: number;

  @ApiProperty()
  startedAt: Date;

  @ApiPropertyOptional()
  finishedAt?: Date;

  @ApiProperty()
  success: boolean;

  @ApiPropertyOptional()
  errorType?: string;

  @ApiProperty()
  iterations: number;

  @ApiPropertyOptional()
  metadata?: Record<string, any>;

  @ApiPropertyOptional()
  project?: any;

  @ApiPropertyOptional()
  story?: any;

  @ApiPropertyOptional()
  subtask?: any;

  @ApiPropertyOptional()
  agent?: any;

  @ApiPropertyOptional()
  framework?: any;
}
