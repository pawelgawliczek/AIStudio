import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TestExecutionStatus } from '@prisma/client';

export class TestExecutionResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  testCaseId: string;

  @ApiPropertyOptional()
  storyId?: string;

  @ApiPropertyOptional()
  commitHash?: string;

  @ApiProperty()
  executedAt: Date;

  @ApiProperty({ enum: TestExecutionStatus })
  status: TestExecutionStatus;

  @ApiPropertyOptional()
  durationMs?: number;

  @ApiPropertyOptional()
  errorMessage?: string;

  @ApiPropertyOptional()
  coveragePercentage?: number;

  @ApiPropertyOptional()
  linesCovered?: number;

  @ApiPropertyOptional()
  linesTotal?: number;

  @ApiPropertyOptional()
  ciRunId?: string;

  @ApiPropertyOptional()
  environment?: string;

  // Optional included relations
  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  testCase?: any;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  story?: any;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  commit?: any;
}
