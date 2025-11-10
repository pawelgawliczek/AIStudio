import { IsUUID, IsNotEmpty, IsEnum, IsInt, IsOptional, IsString, IsNumber, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { TestExecutionStatus } from '@prisma/client';

export class ReportTestExecutionDto {
  @ApiProperty({ description: 'Test case ID' })
  @IsUUID()
  @IsNotEmpty()
  testCaseId: string;

  @ApiPropertyOptional({ description: 'Story ID that triggered this test' })
  @IsUUID()
  @IsOptional()
  storyId?: string;

  @ApiPropertyOptional({ description: 'Commit hash that triggered this test' })
  @IsString()
  @IsOptional()
  commitHash?: string;

  @ApiProperty({
    description: 'Test execution status',
    enum: TestExecutionStatus,
    example: 'pass'
  })
  @IsEnum(TestExecutionStatus)
  @IsNotEmpty()
  status: TestExecutionStatus;

  @ApiPropertyOptional({ description: 'Test duration in milliseconds' })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @IsOptional()
  durationMs?: number;

  @ApiPropertyOptional({ description: 'Error message if test failed' })
  @IsString()
  @IsOptional()
  errorMessage?: string;

  @ApiPropertyOptional({ description: 'Coverage percentage (0-100)' })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  @IsOptional()
  coveragePercentage?: number;

  @ApiPropertyOptional({ description: 'Number of lines covered' })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @IsOptional()
  linesCovered?: number;

  @ApiPropertyOptional({ description: 'Total number of lines' })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @IsOptional()
  linesTotal?: number;

  @ApiPropertyOptional({ description: 'CI/CD run ID' })
  @IsString()
  @IsOptional()
  ciRunId?: string;

  @ApiPropertyOptional({ description: 'Environment (dev, staging, prod)' })
  @IsString()
  @IsOptional()
  environment?: string;
}
